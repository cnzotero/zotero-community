#!/usr/bin/env node
// 刷新插件广场数据:星标、近一年发布节奏、GitHub 下载次数(每个安装包 .xpi 的累计下载)。
// 用法:GITHUB_TOKEN=<令牌> node scripts/refresh-plugins.mjs [--limit N]
// 令牌只从环境变量读取(在 GitHub Actions 里就是内置的 GITHUB_TOKEN),绝不写进仓库。
// 只调用 GitHub 公开数据;失败的条目保留旧数据。用 GraphQL 批量查询,每次 15 个仓库。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/plugins.json");
const HISTORY = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/history.json");
const DAY = 86_400_000;
const BATCH = 15;
const MAX_EXTRA_PAGES = 40; // 发布特别多的仓库,最多再翻 40 页(每页 100 条)

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

/** 累计下载次数:所有发布里 .xpi 安装包的 downloadCount 之和。 */
export function sumXpiDownloads(releases) {
  let n = 0;
  for (const r of releases) {
    if (!r) continue; // GraphQL 偶尔在列表里返回空项
    for (const a of r.releaseAssets?.nodes ?? []) if (a && /\.xpi$/i.test(a.name ?? "")) n += a.downloadCount ?? 0;
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

/** 合并下载统计并保留上次数据,用来算「今日新增」:同一天重复运行不覆盖上次的基线。 */
export function mergeDownloads(prev, total, today) {
  if (!prev) return { total, at: today };
  if (prev.at === today) return { total, at: today, prevTotal: prev.prevTotal, prevAt: prev.prevAt };
  return { total, at: today, prevTotal: prev.total, prevAt: prev.at };
}

const FIELDS = `stargazerCount forkCount isArchived pushedAt watchers { totalCount } issues(states: OPEN) { totalCount } releases(first: 100, orderBy: {field: CREATED_AT, direction: DESC}%AFTER%) {
  totalCount pageInfo { hasNextPage endCursor }
  nodes { publishedAt isDraft isPrerelease releaseAssets(first: 20) { nodes { name downloadCount } } }
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
      if (j.data) return j.data; // 个别仓库不存在时 data 里对应项为 null,errors 可忽略
      throw new Error(JSON.stringify(j.errors ?? j).slice(0, 200));
    }
    await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
  }
  throw new Error("GraphQL 请求失败");
}

const q = (s) => JSON.stringify(s);

async function fetchRepos(token, ids) {
  const body = ids.map((id, i) => {
    const [owner, name] = id.split("/");
    return `r${i}: repository(owner: ${q(owner)}, name: ${q(name)}) { ${FIELDS.replace("%AFTER%", "")} }`;
  });
  const data = await gql(token, `query { ${body.join("\n")} }`);
  return ids.map((_, i) => data[`r${i}`] ?? null);
}

async function fetchMorePages(token, id, first) {
  const [owner, name] = id.split("/");
  const nodes = first.releases.nodes.filter(Boolean);
  let info = first.releases.pageInfo;
  for (let i = 0; i < MAX_EXTRA_PAGES && info.hasNextPage; i++) {
    const data = await gql(token, `query { repository(owner: ${q(owner)}, name: ${q(name)}) { ${FIELDS.replace("%AFTER%", `, after: ${q(info.endCursor)}`)} } }`);
    const rel = data.repository?.releases;
    if (!rel) break;
    nodes.push(...rel.nodes.filter(Boolean));
    info = rel.pageInfo;
  }
  return { nodes, truncated: info.hasNextPage };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { console.error("缺少环境变量 GITHUB_TOKEN"); process.exit(1); }
  const limit = Number(process.argv[process.argv.indexOf("--limit") + 1]) || Infinity;
  const data = JSON.parse(readFileSync(FILE, "utf8"));
  const list = data.plugins.slice(0, limit);
  const today = new Date().toISOString().slice(0, 10);
  let history = {};
  try { history = JSON.parse(readFileSync(HISTORY, "utf8")); } catch { /* 首次运行没有历史 */ }
  let failed = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const group = list.slice(i, i + BATCH);
    try {
      const repos = await fetchRepos(token, group.map((p) => p.id));
      for (let k = 0; k < group.length; k++) {
        const p = group[k], repo = repos[k];
        if (!repo) { failed++; continue; }
        try {
          p.stars = repo.stargazerCount ?? p.stars;
          p.forks = repo.forkCount ?? 0;
          p.watchers = repo.watchers?.totalCount ?? 0;
          p.issues = repo.issues?.totalCount ?? 0;
          if (repo.isArchived) p.archived = true; else delete p.archived;
          let nodes = (repo.releases?.nodes ?? []).filter(Boolean), truncated = false;
          if (repo.releases?.pageInfo?.hasNextPage) ({ nodes, truncated } = await fetchMorePages(token, p.id, repo));
          const real = nodes.filter((r) => r && !r.isDraft);
          const c = cadence(real.filter((r) => !r.isPrerelease).map((r) => r.publishedAt));
          if (c) {
            if (truncated) c.capped = true;
            p.cadence = c;
            if (c.last > (p.updated || "")) p.updated = c.last;
          }
          const total = sumXpiDownloads(real);
          if (total > 0) p.dl = mergeDownloads(p.dl, total, today);
          history[p.id] = pushHistory(history[p.id], today, p.stars, total > 0 ? total : null);
        } catch (e) { failed++; console.error(p.id, String(e).slice(0, 100)); }
      }
    } catch (e) { failed += group.length; console.error("批次失败:", String(e).slice(0, 160)); }
    console.log(`${Math.min(i + BATCH, list.length)}/${list.length}(失败 ${failed})`);
  }
  data.plugins.sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id));
  data.generatedAt = today;
  writeFileSync(FILE, JSON.stringify(data));
  writeFileSync(HISTORY, JSON.stringify(history));
  console.log(`完成:${list.length} 个,失败 ${failed},有节奏 ${data.plugins.filter((p) => p.cadence).length},有下载数 ${data.plugins.filter((p) => p.dl).length}`);
}
