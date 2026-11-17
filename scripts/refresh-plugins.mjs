#!/usr/bin/env node
// 刷新插件广场数据:星标、近一年发布节奏、GitHub 下载次数(每个安装包 .xpi 的累计下载)、最新版本与各 Zotero 大版本的安装包。
// 用法:GITHUB_TOKEN=<令牌> node --experimental-strip-types scripts/refresh-plugins.mjs [--limit N]
// 令牌只从环境变量读取(在 GitHub Actions 里就是内置的 GITHUB_TOKEN),绝不写进仓库。
// 只调用 GitHub 公开数据;失败的条目保留旧数据。用 GraphQL 批量查询,每次 15 个仓库。
//
// 最新版本:取最新的、非草稿非预发布、带 .xpi 安装包的发布。版本号与兼容范围读安装包里的 manifest.json
// (只读这一个文件,不解压其它内容、不执行任何内容;地址必须先通过目录源的同一份白名单 releaseRejection)。
// 读不到 manifest 时版本号退回发布标签里的数字,安装包列表保持原样(兼容范围没有公开依据就不写)。
//
// 历史保留(src/data/carryover.json):作者移除了大量公开发布、导致统计塌缩的插件,按同一规则保留移除前最后一次
// 公开刷新的数据(出处写在文件里,由 scripts/carryover-scan.mjs 从本仓库 git 历史找出)。对这些插件:
//   - 近一年发布次数 / 有发布的天数 / 每月次数 = 快照(按经过的天数平移)+ 快照之后的现存发布,不重复计数;
//   - 累计下载 = 快照总数 + 之后的新增。新增按发布逐个记账(见 trackDownloads):今日总数比上次低(又有发布被移除,
//     或接口某天少返回了几个发布)时不记负数,也不会在发布重新出现时重复计入。
//   - 快照总数可以按作者提供的移除前累计校准:dl.total 改成校准值,原快照值留在 dl.snapshotOriginal,
//     dl.calibration 写明日期与依据。基线变了的那次刷新不留「上次基线」(当天不出现虚高的每天新增),
//     该插件的历史快照整体平移同样的差值(近七天新增等按快照差值算的数字不受影响)。
// 口径:这些插件的累计下载与近一年发布次数含已移除的历史版本。
//
// 本站下载:最后一步从本站读 /dl-stats.json(服务器按「下载」按钮的上报汇总出的数字),把每个插件的本站下载累计
// 写进 plugins.json 的 siteDl,首页「下载最多」榜与插件广场的下载量排序都以它为主键。取不到、返回错误或格式不对时
// 跳过这一步、保留已有的值,不影响其它数据的刷新;单个插件的条目不合格式只跳过那一条。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { releaseRejection } from "./catalog-feed.mjs";
import { MAX_XPI_BYTES, downloadXpi, readZipManifest } from "./import-addon-ids.mjs";
import { ZOTERO_VERSIONS, compareVersions } from "../src/plugins/lib.ts";
import { parseDlStats } from "../src/plugins/site-downloads.ts";

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/plugins.json");
const HISTORY = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/history.json");
export const CARRYOVER = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/carryover.json");
const DAY = 86_400_000;
const BATCH = 15;
const PAGE = 50; // 每页发布数:每页 100 条加上安装包明细时,GitHub 常报「查询超出资源限制」并只返回残缺数据
const MAX_EXTRA_PAGES = 82; // 发布特别多的仓库,最多再翻 82 页(合计约 4100 条)
const MIN_MAJOR = 7;
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+\-_]{0,63}$/;

/** 由发布时间计算更新节奏:近一年次数、每月次数(12 项,旧→新)、最近 10 次发布间隔的中位数。 */
export function cadence(dates, nowMs = Date.now()) {
  const t = dates.map((d) => Date.parse(d)).filter((x) => !Number.isNaN(x)).sort((a, b) => b - a);
  if (t.length === 0) return null;
  const monthly = Array(12).fill(0);
  let r12 = 0;
  const days = new Set(); // 近一年有发布的日期(同一天发多次只算一天)
  for (const x of t) {
    const age = Math.floor((nowMs - x) / (30 * DAY));
    if (age >= 0 && age < 12) { monthly[11 - age]++; r12++; days.add(new Date(x).toISOString().slice(0, 10)); }
  }
  const gaps = [];
  for (let i = 0; i + 1 < Math.min(t.length, 11); i++) gaps.push((t[i] - t[i + 1]) / DAY);
  gaps.sort((a, b) => a - b);
  const medianDays = gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10 : null;
  return { r12, days12: days.size, monthly, medianDays, last: new Date(t[0]).toISOString().slice(0, 10) };
}

const isXpi = (a) => a && /\.xpi$/i.test(a.name ?? "");

/** 累计下载次数:所有发布里 .xpi 安装包的 downloadCount 之和。 */
export function sumXpiDownloads(releases) {
  let n = 0;
  for (const r of releases) {
    if (!r) continue; // GraphQL 偶尔在列表里返回空项
    for (const a of r.releaseAssets?.nodes ?? []) if (isXpi(a)) n += a.downloadCount ?? 0;
  }
  return n;
}

/** 追加今日快照(同一天覆盖),只保留最近 keep 天;快照 = [日期, 星标, 累计下载]。 */
export function pushHistory(hist, day, stars, dl, keep = 35) {
  const out = (hist ?? []).filter((x) => x[0] !== day);
  out.push([day, stars, dl]);
  out.sort((a, b) => a[0].localeCompare(b[0]));
  return out.slice(-keep);
}

/** 历史快照里的下载数整体加上 delta(基线校准时用;没有下载数的快照不动,不会小于 0)。 */
export function shiftHistory(hist, delta) {
  if (!delta) return hist;
  return (hist ?? []).map((x) => (typeof x[2] === "number" ? [x[0], x[1], Math.max(0, x[2] + delta)] : x));
}

/** 合并下载统计并保留上次数据,用来算「今日新增」:同一天重复运行不覆盖上次的基线。 */
export function mergeDownloads(prev, total, today) {
  if (!prev) return { total, at: today };
  if (prev.at === today) return { total, at: today, prevTotal: prev.prevTotal, prevAt: prev.prevAt };
  return { total, at: today, prevTotal: prev.total, prevAt: prev.at };
}

// ---------- 最新版本与安装包 ----------

/** 从发布标签里取版本号(plugin-v10.0.14 → 10.0.14);取不到返回 null。 */
export function versionFromTag(tag) {
  const m = /\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.]+)?/.exec(String(tag ?? ""));
  return m && VERSION_RE.test(m[0]) ? m[0] : null;
}

/** 从 manifest.json 取版本号与作者声明的 Zotero 兼容范围;不合规的字段当作没有。 */
export function manifestInfo(manifest) {
  const ok = (v) => (typeof v === "string" && VERSION_RE.test(v.replace(/\*/g, "0")) ? v : null);
  const z = manifest?.applications?.zotero ?? manifest?.browser_specific_settings?.zotero ?? {};
  return { version: ok(manifest?.version), min: ok(z.strict_min_version), max: ok(z.strict_max_version) };
}

/** 从 xpi 文件内容取 manifestInfo;读不到返回 null。 */
export function xpiInfo(buf) {
  const text = readZipManifest(buf);
  if (text === null) return null;
  try {
    return manifestInfo(JSON.parse(text.replace(/^﻿/, "")));
  } catch {
    return null;
  }
}

/** 文件名里的版本数字换成占位符,用来认出「同一种安装包」(demo-v2.0.0.xpi ≈ demo-v1.9.1.xpi)。 */
const nameShape = (name) => String(name ?? "").toLowerCase().replace(/v?\d+(?:\.\d+)*/g, "#");

/**
 * 最新的、非草稿非预发布、带合格 .xpi 安装包的发布。安装包地址必须通过目录源的 releaseRejection
 * (github.com、路径不含 %、owner/repo 与插件 id 一致),不放宽。
 * 一个发布里有多个 .xpi 时,选与现有安装包文件名同一形状的那个;认不出来就不选安装包(asset 为 null),只更新版本信息。
 * 返回 { tag, date, url, publishedAt, asset: { name, url, size } | null } 或 null。
 */
export function pickLatestRelease(nodes, id, knownNames = []) {
  const shapes = new Set(knownNames.map(nameShape));
  const list = (nodes ?? []).filter((r) => r && !r.isDraft && !r.isPrerelease && !Number.isNaN(Date.parse(r.publishedAt)));
  list.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  for (const r of list) {
    const xpis = (r.releaseAssets?.nodes ?? []).filter((a) => isXpi(a) && releaseRejection(a.downloadUrl, id) === null);
    if (xpis.length === 0) continue;
    const a = xpis.length === 1 ? xpis[0] : xpis.find((x) => shapes.has(nameShape(x.name))) ?? null;
    return {
      tag: r.tagName, date: r.publishedAt.slice(0, 10), publishedAt: r.publishedAt,
      url: typeof r.url === "string" && /^https:\/\/github\.com\//.test(r.url) ? r.url : `https://github.com/${id}/releases`,
      asset: a ? { name: a.name, url: a.downloadUrl, size: a.size ?? 0 } : null,
    };
  }
  return null;
}

const covers = (min, max, major) => {
  const v = String(major);
  return !(min && compareVersions(v, min) < 0) && !(max && compareVersions(v, max) > 0);
};

/**
 * 把一个发布并入插件数据。info 是安装包 manifest 的信息(可为 null)。
 * - latest:版本号(manifest 优先,其次标签)高于现有的才更新;不让「后补的旧大版本修订」把最新版本拉回去。
 * - downloads:只有 manifest 声明了兼容范围时才动。范围覆盖的每个大版本(现有条目的大版本 ∪ 7–当前已知最大版本):
 *   已有条目且新版本更高 → 替换;没有条目 → 新增。范围不覆盖的大版本保留旧条目(那是给旧版 Zotero 的安装包)。
 * 返回 { latest: boolean, downloads: boolean }。
 */
export function applyRelease(p, rel, info) {
  const changed = { latest: false, downloads: false };
  if (!rel) return changed;
  const version = info?.version ?? versionFromTag(rel.tag);
  if (!version) return changed;
  if (!p.latest || compareVersions(version, p.latest.version) > 0) {
    p.latest = { version, date: rel.date, releaseUrl: rel.url };
    changed.latest = true;
  }
  if (rel.asset && info?.version && (info.min || info.max)) {
    const downloads = [...(p.downloads ?? [])];
    const majors = new Set([...downloads.map((d) => d.t), ...ZOTERO_VERSIONS].filter((t) => Number.isInteger(t) && t >= MIN_MAJOR));
    const entry = (t) => ({ t, v: info.version, u: rel.asset.url, ...(info.min ? { min: info.min } : {}), ...(info.max ? { max: info.max } : {}), d: rel.date });
    for (const t of [...majors].sort((a, b) => a - b)) {
      if (!covers(info.min, info.max, t)) continue;
      const i = downloads.findIndex((d) => d.t === t);
      if (i < 0) downloads.push(entry(t));
      else if (compareVersions(info.version, downloads[i].v) > 0) downloads[i] = entry(t);
      else continue;
      changed.downloads = true;
    }
    if (changed.downloads) p.downloads = downloads.sort((a, b) => a.t - b.t);
  }
  if (p.latest && p.latest.date > (p.updated || "")) p.updated = p.latest.date;
  return changed;
}

/** 这个发布需要下载安装包读 manifest 吗:安装包已在数据里、或这个发布页已经是记录的最新版本,就不再下载。 */
export function needsManifest(p, rel) {
  if (!rel?.asset) return false;
  if ((p.downloads ?? []).some((d) => d.u === rel.asset.url)) return false;
  return p.latest?.releaseUrl !== rel.url;
}

// ---------- 历史保留 ----------

const sum = (xs) => xs.reduce((s, x) => s + x, 0);

/**
 * 快照的每月次数按经过的天数平移到「今天」的 12 个 30 天窗口。快照里每个窗口内的发布按均匀分布看待,
 * 平移不足一整段时按比例分到相邻两段(四舍五入,总数不变);移出近一年的部分丢弃。
 */
export function shiftMonthly(monthly, elapsedDays) {
  const out = Array(12).fill(0);
  const e = Math.max(0, elapsedDays);
  const k = Math.floor(e / 30);
  const f = (e - 30 * k) / 30;
  const put = (age, n) => { if (n > 0 && age < 12) out[11 - age] += n; };
  for (let i = 0; i < 12; i++) {
    const c = monthly?.[i] ?? 0;
    if (!c) continue;
    const age = 11 - i;
    const older = Math.round(c * f);
    put(age + k, c - older);
    put(age + k + 1, older);
  }
  return out;
}

/**
 * 快照 ∪ 现存发布的更新节奏。snap 是 carryover.json 里的 cadence 段(cutoff = 快照数据取得的时间)。
 * 现存发布里早于 cutoff 的已经算在快照里,只加 cutoff 之后的;有发布的天数:快照部分按留在近一年里的次数等比例折算,
 * 再加上快照最后发布日之后的新日期(与快照同一天的不重复算)。
 */
export function mergeCadence(snap, dates, nowMs = Date.now()) {
  const cut = Date.parse(snap.cutoff);
  const post = dates.filter((d) => Date.parse(d) > cut);
  const cp = cadence(post, nowMs);
  const shifted = shiftMonthly(snap.monthly, (nowMs - cut) / DAY);
  const kept = sum(shifted);
  const monthly = shifted.map((v, i) => v + (cp?.monthly[i] ?? 0));
  const newDays = new Set();
  for (const d of post) {
    const x = Date.parse(d);
    const age = Math.floor((nowMs - x) / (30 * DAY));
    const day = new Date(x).toISOString().slice(0, 10);
    if (age >= 0 && age < 12 && day > snap.last) newDays.add(day);
  }
  return {
    r12: sum(monthly),
    ...(typeof snap.days12 === "number" ? { days12: (snap.r12 > 0 ? Math.round((snap.days12 * kept) / snap.r12) : 0) + newDays.size } : {}),
    monthly,
    medianDays: cp?.medianDays ?? snap.medianDays ?? null,
    last: cp && cp.last > snap.last ? cp.last : snap.last,
    ...(snap.capped ? { capped: true } : {}),
    carried: true,
  };
}

/** 一个发布里 .xpi 安装包的下载数之和。 */
const releaseXpiDownloads = (r) => sumXpiDownloads([r]);

/**
 * 有历史保留的插件的累计下载,按发布逐个记账(track 存在 carryover.json 里,由每日刷新维护):
 * track.rel = { 标签: [见过的最大下载数, 发布日期, 起点?] }。
 * - 快照之后发布的:整份下载都算新增(起点 0);
 * - 快照时已存在、至今还在的:只算开始记账之后的增长(起点 = 第一次记账时的数;快照到开始记账之间的增长不补,宁少不多);
 * - 发布被移除:账上保留最后见到的数,不会变成负数;某天接口少返回了几个发布、第二天又出现,也不会重复计入(取最大值)。
 * 累计下载 = 快照总数 + 各发布(最大值 − 起点)之和。
 * track.base 记下账上按哪个快照总数算的;快照总数被校准(与 base 不同)时 rebase = 新旧之差。
 * 旧数据没有 base 时按 snapshotOriginal(校准前的快照值)算,都没有就当没变。返回 { track, total, init, rebase }。
 */
export function trackDownloads(track, snapDl, releases, today) {
  const cut = Date.parse(snapDl.cutoff);
  const rel = {};
  for (const [tag, e] of Object.entries(track?.rel ?? {})) rel[tag] = [...e];
  for (const r of releases ?? []) {
    if (!r || typeof r.tagName !== "string" || !r.tagName || typeof r.publishedAt !== "string") continue;
    const n = releaseXpiDownloads(r);
    const e = rel[r.tagName];
    if (e) e[0] = Math.max(e[0], n);
    else rel[r.tagName] = Date.parse(r.publishedAt) > cut ? [n, r.publishedAt.slice(0, 10)] : [n, r.publishedAt.slice(0, 10), n];
  }
  const total = snapDl.total + sum(Object.values(rel).map((e) => e[0] - (e[2] ?? 0)));
  const sorted = Object.fromEntries(Object.entries(rel).sort((x, y) => x[1][1].localeCompare(y[1][1]) || x[0].localeCompare(y[0])));
  const prevBase = track ? track.base ?? snapDl.snapshotOriginal ?? snapDl.total : snapDl.total;
  return { track: { since: track?.since ?? today, base: snapDl.total, rel: sorted }, total, init: !track, rebase: snapDl.total - prevBase };
}

/**
 * 刷新一个插件(就地修改 p)。repo:GraphQL 返回的仓库;nodes:全部发布(已翻页);truncated:发布是否没取全。
 * ctx:{ today, nowMs, carry(该插件在 carryover.json 里的条目或 undefined;其中 track 会被就地更新), fetchXpi, log,
 * onRebase(快照总数被校准时以差值调用,调用方据此平移该插件的历史快照) }。
 * 最新版本那一步单独兜住:失败只记日志,星标、节奏、下载照常更新。返回今天写进历史快照的下载数。
 */
export async function refreshPlugin(p, repo, nodes, truncated, ctx) {
  const { today, nowMs = Date.now(), carry, fetchXpi = downloadXpi, log = () => {}, onRebase = () => {} } = ctx;
  p.stars = repo.stargazerCount ?? p.stars;
  p.forks = repo.forkCount ?? 0;
  p.watchers = repo.watchers?.totalCount ?? 0;
  p.issues = repo.issues?.totalCount ?? 0;
  if (repo.isArchived) p.archived = true; else delete p.archived;
  const real = nodes.filter((r) => r && !r.isDraft);
  const dates = real.filter((r) => !r.isPrerelease).map((r) => r.publishedAt);
  const prevR12 = p.cadence?.r12;
  const c = carry?.cadence ? mergeCadence(carry.cadence, dates, nowMs) : cadence(dates, nowMs);
  if (c) {
    if (truncated) c.capped = true;
    p.cadence = c;
    if (c.last > (p.updated || "")) p.updated = c.last;
    if (!carry?.cadence && prevR12 >= 10 && c.r12 * 2 <= prevR12) log(`${p.id} 近一年发布次数骤降 ${prevR12} → ${c.r12}(可用 scripts/carryover-scan.mjs 核对)`);
  }
  const raw = sumXpiDownloads(real);
  let dlForHistory;
  if (carry?.dl) {
    const t = trackDownloads(carry.track, carry.dl, real, today);
    carry.track = t.track;
    const rebased = !t.init && t.rebase !== 0;
    if (rebased) {
      onRebase(t.rebase);
      log(`${p.id} 历史保留的快照总数已校准,差值 ${t.rebase}`);
    }
    // 第一次按快照算、或快照总数刚被校准时不留「上次基线」,避免把补回的历史算成当天新增
    const fresh = t.init || rebased || p.dl?.carried !== true;
    p.dl = { ...(fresh ? { total: t.total, at: today } : mergeDownloads(p.dl, t.total, today)), carried: true };
    dlForHistory = t.total;
  } else {
    if (p.dl?.total > 0 && raw * 2 <= p.dl.total) log(`${p.id} 累计下载骤降 ${p.dl.total} → ${raw}(可用 scripts/carryover-scan.mjs 核对)`);
    if (raw > 0) p.dl = mergeDownloads(p.dl, raw, today);
    dlForHistory = raw > 0 ? raw : null;
  }
  try {
    const rel = pickLatestRelease(nodes, p.id, (p.downloads ?? []).map((d) => d.u.split("/").pop()));
    let info = null;
    if (needsManifest(p, rel)) {
      if (rel.asset.size > MAX_XPI_BYTES) log(`${p.id} 安装包超过大小上限,不读取`);
      else {
        try {
          info = xpiInfo(await fetchXpi(rel.asset.url));
        } catch (e) {
          log(`${p.id} 读取安装包失败:${String(e).slice(0, 100)}`);
        }
      }
    }
    applyRelease(p, rel, info);
  } catch (e) {
    log(`${p.id} 最新版本未更新:${String(e).slice(0, 100)}`);
  }
  return dlForHistory;
}

const FIELDS = `stargazerCount forkCount isArchived pushedAt watchers { totalCount } issues(states: OPEN) { totalCount } releases(first: ${PAGE}, orderBy: {field: CREATED_AT, direction: DESC}%AFTER%) {
  totalCount pageInfo { hasNextPage endCursor }
  nodes { tagName url publishedAt isDraft isPrerelease releaseAssets(first: 20) { nodes { name size downloadUrl downloadCount } } }
}`;

async function gql(token, query, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "zotero-community-refresh" },
      body: JSON.stringify({ query }),
    });
    if (r.ok) {
      const j = await r.json();
      // 个别仓库不存在时 data 里对应项为 null;某个仓库的部分字段出错(例如发布列表超时)时,errors 里的 path 指向它,
      // 这时 data 里那一项是残缺的,不能当真:记下出错的别名,由调用方按失败处理(保留旧数据)
      if (j.data) return Object.assign(j.data, { [FAILED]: new Set((j.errors ?? []).map((e) => e?.path?.[0]).filter(Boolean)) });
      throw new Error(JSON.stringify(j.errors ?? j).slice(0, 200));
    }
    await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
  }
  throw new Error("GraphQL 请求失败");
}

const q = (s) => JSON.stringify(s);
const FAILED = Symbol("failed");

const repoQuery = (id, alias, after = "") => {
  const [owner, name] = id.split("/");
  return `${alias}: repository(owner: ${q(owner)}, name: ${q(name)}) { ${FIELDS.replace("%AFTER%", after ? `, after: ${q(after)}` : "")} }`;
};

/** 同一个查询出错(数据残缺)时再试几次;仍出错返回 null。 */
async function gqlClean(token, query, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const data = await gql(token, query);
    if (data[FAILED].size === 0) return data;
  }
  return null;
}

async function fetchRepos(token, ids) {
  const data = await gql(token, `query { ${ids.map((id, i) => repoQuery(id, `r${i}`)).join("\n")} }`);
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    if (!data[FAILED].has(`r${i}`)) { out.push(data[`r${i}`] ?? null); continue; }
    // 批量查询里这个仓库的数据残缺:单独再查(不存在的仓库也会走到这里,单独查仍出错就按失败处理)
    const one = await gqlClean(token, `query { ${repoQuery(ids[i], "r")} }`);
    out.push(one?.r ?? null);
  }
  return out;
}

async function fetchMorePages(token, id, first) {
  const nodes = first.releases.nodes.filter(Boolean);
  let info = first.releases.pageInfo;
  for (let i = 0; i < MAX_EXTRA_PAGES && info.hasNextPage; i++) {
    const data = await gqlClean(token, `query { ${repoQuery(id, "r", info.endCursor)} }`);
    if (!data) throw new Error("发布列表翻页出错"); // 残缺的发布列表不当真,整个插件保留旧数据
    const rel = data.r?.releases;
    if (!rel) break;
    nodes.push(...rel.nodes.filter(Boolean));
    info = rel.pageInfo;
  }
  return { nodes, truncated: info.hasNextPage };
}

// ---------- 本站下载 ----------

export const DL_STATS_URL = "https://zoterocn.org/dl-stats.json";

/**
 * 读本站下载汇总:{ plugins: { id: { total, today } }, at }(at 为汇总生成的日期,取不到时用 fallbackDay)。
 * 网络出错、超时、非 2xx(包括还没生成时的 404)、不是 JSON、整体格式不对,一律返回 null(调用方保留已有值)。
 * 格式校验与页面用的是同一个函数 parseDlStats。
 */
export async function fetchSiteDownloads(fallbackDay, fetchImpl = fetch, url = DL_STATS_URL) {
  try {
    const r = await fetchImpl(url, { headers: { "user-agent": "zotero-community-refresh" }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const raw = await r.json();
    const stats = parseDlStats(raw);
    if (!stats) return null;
    const g = typeof raw.generatedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(raw.generatedAt) && !Number.isNaN(Date.parse(raw.generatedAt)) ? raw.generatedAt.slice(0, 10) : null;
    return { plugins: stats.plugins, at: g ?? fallbackDay };
  } catch {
    return null;
  }
}

/** 把本站下载汇总写进插件数据(就地修改):汇总里有的插件写 siteDl = { total, today, at };没有的保留原值。返回写入的个数。 */
export function applySiteDownloads(plugins, site) {
  if (!site) return 0;
  let n = 0;
  for (const p of plugins) {
    const s = Object.hasOwn(site.plugins, p.id) ? site.plugins[p.id] : null;
    if (!s) continue;
    p.siteDl = { total: s.total, today: s.today, at: site.at };
    n++;
  }
  return n;
}

/** 读 carryover.json;没有文件返回空的骨架。 */
export function readCarryover(file = CARRYOVER) {
  try {
    const d = JSON.parse(readFileSync(file, "utf8"));
    return { ...d, plugins: d.plugins ?? {} };
  } catch {
    return { plugins: {} };
  }
}

/** 写 carryover.json:缩进 2 格,只含数字与字符串的数组写在一行,便于审阅差异。 */
export function formatCarryover(d) {
  return JSON.stringify(d, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) => `[${inner.split(/,\s+/).join(", ")}]`) + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { console.error("缺少环境变量 GITHUB_TOKEN"); process.exit(1); }
  const limit = Number(process.argv[process.argv.indexOf("--limit") + 1]) || Infinity;
  const data = JSON.parse(readFileSync(FILE, "utf8"));
  const list = data.plugins.slice(0, limit);
  const today = new Date().toISOString().slice(0, 10);
  const carryover = readCarryover();
  const carried = Object.keys(carryover.plugins).length;
  let history = {};
  try { history = JSON.parse(readFileSync(HISTORY, "utf8")); } catch { /* 首次运行没有历史 */ }
  let failed = 0;
  const log = (m) => console.warn(m);
  for (let i = 0; i < list.length; i += BATCH) {
    const group = list.slice(i, i + BATCH);
    try {
      const repos = await fetchRepos(token, group.map((p) => p.id));
      for (let k = 0; k < group.length; k++) {
        const p = group[k], repo = repos[k];
        if (!repo) { failed++; continue; }
        try {
          let nodes = (repo.releases?.nodes ?? []).filter(Boolean), truncated = false;
          if (repo.releases?.pageInfo?.hasNextPage) ({ nodes, truncated } = await fetchMorePages(token, p.id, repo));
          const onRebase = (d) => { history[p.id] = shiftHistory(history[p.id], d); };
          const dl = await refreshPlugin(p, repo, nodes, truncated, { today, carry: carryover.plugins[p.id], log, onRebase });
          history[p.id] = pushHistory(history[p.id], today, p.stars, dl);
        } catch (e) { failed++; console.error(p.id, String(e).slice(0, 100)); }
      }
    } catch (e) { failed += group.length; console.error("批次失败:", String(e).slice(0, 160)); }
    console.log(`${Math.min(i + BATCH, list.length)}/${list.length}(失败 ${failed})`);
  }
  const site = await fetchSiteDownloads(today);
  if (site) console.log(`本站下载:写入 ${applySiteDownloads(data.plugins, site)} 个插件`);
  else console.warn("本站下载汇总没有取到或格式不对,保留已有值");
  data.plugins.sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id));
  data.generatedAt = today;
  writeFileSync(FILE, JSON.stringify(data));
  writeFileSync(HISTORY, JSON.stringify(history));
  if (carried) writeFileSync(CARRYOVER, formatCarryover(carryover));
  console.log(`完成:${list.length} 个,失败 ${failed},有节奏 ${data.plugins.filter((p) => p.cadence).length},有下载数 ${data.plugins.filter((p) => p.dl).length}`);
}
