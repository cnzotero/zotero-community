// 机器可读的插件目录「源」:/data/catalog.json。(社区插件的更新清单不由站点提供,见 plugin/RELEASING.md。)
// 只由构建流程调用;数据只来自 scripts/catalog.ts 分出的在架名单(下架的插件不会出现)。
// schema 1 的字段只增不改:消费方(例如社区插件)按 schema 号判断能否读取。
import { CATEGORIES, compareVersions, isAllowedXpiUrl, sortPlugins } from "../src/plugins/lib.ts";
import { addonIdFor, isPlausibleAddonId } from "./import-addon-ids.mjs";
// 社区插件运行时用的同一份校验:地址白名单 + 路径不含 % 与 . / .. / 空段 + 仓库绑定(owner/repo 与插件 id 一致)
import market from "../plugin/addon/content/lib.js";

export const FEED_SCHEMA = 1;
export const FEED_FILE = "data/catalog.json";
export const FEED_SITE = "https://zoterocn.org";
const MIN_MAJOR = 7;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;


/**
 * 安装包地址能否进目录:站点白名单(https、github.com / gitee.com、.xpi)之外,还要过社区插件的同一份校验——
 * 主机只能是 github.com(写死,不看目录里的其它字段);路径不含 %、没有 . / .. / 空段;
 * 路径前两段 owner/repo 与插件 id 小写后完全相等。
 * 返回 null 表示通过,否则返回丢弃原因:"host"(不在站点白名单)| "non-github" | "path" | "repo"。
 */
export function releaseRejection(u, id) {
  if (!isAllowedXpiUrl(u)) return "host";
  if (!/^https:\/\/github\.com\//.test(u)) return "non-github";
  if (!market.isAllowedXpiUrl(u)) return "path";
  return market.isReleaseUrlForPlugin(u, id) ? null : "repo";
}

/**
 * 每个 Zotero 大版本(7 及以上)的最新安装包;只收通过 releaseRejection 的地址。按大版本从小到大。
 * dropped:可选的数组,收集被丢弃的安装包 { id, t, u, reason },供构建时报告(不放宽规则)。
 */
export function feedReleases(p, addonIds, dropped = null) {
  const best = new Map();
  for (const d of p.downloads ?? []) {
    if (!Number.isInteger(d?.t) || d.t < MIN_MAJOR || typeof d.v !== "string") continue;
    const reason = releaseRejection(d.u, p.id);
    if (reason) {
      if (dropped) dropped.push({ id: p.id, t: d.t, u: d.u, reason });
      continue;
    }
    const prev = best.get(d.t);
    if (!prev || compareVersions(d.v, prev.v) > 0) best.set(d.t, d);
  }
  return [...best.keys()].sort((a, b) => a - b).map((t) => {
    const d = best.get(t);
    const i = addonIdFor(addonIds, p.id, t);
    return {
      t, v: d.v, u: d.u,
      ...(i ? { i } : {}),
      ...(d.min ? { min: d.min } : {}),
      ...(d.max ? { max: d.max } : {}),
      ...(d.d && DAY_RE.test(d.d) ? { d: d.d } : {}),
    };
  });
}

/**
 * 近 7 天新增下载:需要最近一次快照与恰好 7 天前的快照都在、且都有下载数;否则 null(不推断)。
 * 快照 = [日期, 星标, 累计下载]。
 */
export function weeklyDownloads(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return null;
  const sorted = [...snapshots].filter((s) => Array.isArray(s) && DAY_RE.test(s[0])).sort((a, b) => a[0].localeCompare(b[0]));
  const last = sorted[sorted.length - 1];
  if (!last || typeof last[2] !== "number") return null;
  const target = new Date(Date.parse(last[0]) - 7 * DAY_MS).toISOString().slice(0, 10);
  const base = sorted.find((s) => s[0] === target);
  if (!base || typeof base[2] !== "number" || last[2] < base[2]) return null;
  return last[2] - base[2];
}

export function feedPlugin(p, addonIds, history, dropped = null) {
  const c = p.cadence;
  return {
    id: p.id,
    // 与社区插件读取时同一个清理函数:去掉控制字符与双向文字控制符,限制长度
    name: market.cleanText(p.name, market.NAME_MAX),
    summary: market.cleanText(p.summary, market.SUMMARY_MAX),
    category: p.category,
    author: market.cleanText(p.author, market.NAME_MAX),
    homepage: p.homepage,
    stars: p.stars,
    ...(p.updated && DAY_RE.test(p.updated) ? { updated: p.updated } : {}),
    ...(c ? { cadence: { ...(typeof c.days12 === "number" ? { days12: c.days12 } : {}), r12: c.r12, last: c.last } } : {}),
    ...(p.dl ? { dl: { total: p.dl.total, at: p.dl.at } } : {}),
    dlWeek: weeklyDownloads(history?.[p.id]),
    ...(p.archived === true ? { archived: true } : {}),
    zotero: { declared: p.zotero.declared, majors: [...p.zotero.majors] },
    releases: feedReleases(p, addonIds, dropped),
  };
}

/**
 * 由在架名单生成目录源。排序与站点默认一致:星标降序,同分按名称。
 * 安装包被丢弃的插件仍留在目录里(它在站点上在架),只是没有对应的 releases。
 */
export function buildFeed({ listed, day, addonIds = {}, history = {}, dropped = null }) {
  const plugins = sortPlugins(listed, "stars").map((p) => feedPlugin(p, addonIds, history, dropped));
  return {
    schema: FEED_SCHEMA,
    generatedAt: day,
    site: FEED_SITE,
    count: plugins.length,
    categories: CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    plugins,
  };
}

const isStr = (v) => typeof v === "string" && v.length > 0;
const isDay = (v) => typeof v === "string" && DAY_RE.test(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const PLUGIN_KEYS = new Set(["id", "name", "summary", "category", "author", "homepage", "stars", "updated", "cadence", "dl", "dlWeek", "archived", "zotero", "releases"]);
const RELEASE_KEYS = new Set(["t", "v", "u", "i", "min", "max", "d"]);

/** 校验目录源;返回问题清单(空数组表示通过)。excludedIds:不得出现的插件(下架的)。 */
/** 被丢弃安装包的汇总:条数、涉及插件数、因此没有任何安装包的插件、按原因计数与示例。 */
export function droppedSummary(dropped, feed) {
  const ids = [...new Set(dropped.map((d) => d.id))];
  const noRelease = new Set((feed?.plugins ?? []).filter((p) => p.releases.length === 0).map((p) => p.id));
  const byReason = {};
  for (const d of dropped) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  return { releases: dropped.length, plugins: ids.length, lostAll: ids.filter((id) => noRelease.has(id)), byReason, examples: dropped.slice(0, 5) };
}

export function validateFeed(feed, { excludedIds = [] } = {}) {
  const errs = [];
  const bad = (m) => errs.push(m);
  if (feed?.schema !== FEED_SCHEMA) bad("schema 不是 1");
  if (!isDay(feed?.generatedAt)) bad("generatedAt 不是日期");
  if (feed?.site !== FEED_SITE) bad("site 不对");
  if (!Array.isArray(feed?.plugins)) return [...errs, "plugins 不是数组"];
  if (feed.count !== feed.plugins.length) bad("count 与 plugins 条数不一致");
  const cats = new Set((feed.categories ?? []).map((c) => c?.key));
  if (!Array.isArray(feed.categories) || feed.categories.some((c) => !isStr(c?.key) || !isStr(c?.label))) bad("categories 格式不对");
  const seen = new Set();
  const excluded = new Set(excludedIds);
  for (const p of feed.plugins) {
    const at = `插件 ${p?.id}`;
    for (const k of Object.keys(p ?? {})) if (!PLUGIN_KEYS.has(k)) bad(`${at} 多出字段 ${k}`);
    if (!isStr(p?.id) || !/^[a-z0-9._-]+\/[a-z0-9._-]+$/.test(p.id) || !market.isValidPluginId(p.id)) bad(`${at} id 格式不对`);
    if (seen.has(p?.id)) bad(`${at} 重复`);
    seen.add(p?.id);
    if (excluded.has(p?.id)) bad(`${at} 已下架却出现在目录里`);
    if (!isStr(p?.name) || typeof p?.summary !== "string" || !isStr(p?.author)) bad(`${at} 名称、简介或作者不对`);
    if (!cats.has(p?.category)) bad(`${at} 分类不在 categories 里`);
    if (typeof p?.homepage !== "string" || !/^https:\/\//.test(p.homepage)) bad(`${at} homepage 不是 https`);
    if (!isCount(p?.stars)) bad(`${at} stars 不是非负整数`);
    if ("updated" in p && !isDay(p.updated)) bad(`${at} updated 不是日期`);
    if ("cadence" in p && (!isCount(p.cadence?.r12) || !isDay(p.cadence?.last) || ("days12" in p.cadence && !isCount(p.cadence.days12)))) bad(`${at} cadence 格式不对`);
    if ("dl" in p && (!isCount(p.dl?.total) || !isDay(p.dl?.at))) bad(`${at} dl 格式不对`);
    if ("dlWeek" in p && p.dlWeek !== null && !isCount(p.dlWeek)) bad(`${at} dlWeek 格式不对`);
    if ("archived" in p && p.archived !== true) bad(`${at} archived 只能为 true`);
    if (typeof p?.zotero?.declared !== "boolean" || !Array.isArray(p.zotero.majors) || p.zotero.majors.some((m) => !Number.isInteger(m))) bad(`${at} zotero 格式不对`);
    if (!Array.isArray(p?.releases)) {
      bad(`${at} releases 不是数组`);
      continue;
    }
    const ts = new Set();
    for (const r of p.releases) {
      for (const k of Object.keys(r ?? {})) if (!RELEASE_KEYS.has(k)) bad(`${at} 发布记录多出字段 ${k}`);
      if (!Number.isInteger(r?.t) || r.t < MIN_MAJOR || ts.has(r.t)) bad(`${at} 发布记录的大版本不对或重复`);
      ts.add(r?.t);
      if (!isStr(r?.v)) bad(`${at} 发布记录缺版本号`);
      if (releaseRejection(r?.u, p?.id)) bad(`${at} 安装包地址不在白名单或不属于该插件的仓库:${r?.u}`);
      if ("i" in r && !isPlausibleAddonId(r.i)) bad(`${at} 插件标识不对`);
      for (const k of ["min", "max"]) if (k in r && !isStr(r[k])) bad(`${at} ${k} 不对`);
      if ("d" in r && !isDay(r.d)) bad(`${at} d 不是日期`);
    }
  }
  return errs;
}
