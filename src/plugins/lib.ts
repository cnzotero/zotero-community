// 插件广场的纯逻辑:筛选、排序、兼容判断、URL 同步、格式化。不碰 DOM,便于单测。

export type CategoryKey =
  | "ai" | "reading" | "metadata" | "interface" | "attachment"
  | "integration" | "notes" | "utility" | "writing" | "visualization";

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "ai", label: "AI" },
  { key: "reading", label: "阅读" },
  { key: "metadata", label: "元数据" },
  { key: "interface", label: "界面" },
  { key: "attachment", label: "附件" },
  { key: "integration", label: "集成" },
  { key: "notes", label: "笔记" },
  { key: "utility", label: "工具" },
  { key: "writing", label: "写作" },
  { key: "visualization", label: "可视化" },
];

export const ZOTERO_VERSIONS = [7, 8, 9, 10] as const;

export interface Plugin {
  id: string; // owner/repo(小写)
  name: string;
  summary: string;
  category: CategoryKey;
  tags?: CategoryKey[];
  author: string;
  homepage: string;
  stars: number;
  latest?: { version: string; date: string; releaseUrl: string };
  updated: string; // YYYY-MM-DD,可能为空串
  /** declared:作者是否声明了兼容范围;majors:声明范围覆盖的 Zotero 大版本 */
  zotero: { declared: boolean; majors: number[] };
  /** 各 Zotero 大版本对应的安装包(.xpi)直链,仅限 github.com / gitee.com */
  downloads?: Download[];
  /** 更新节奏:由 GitHub 发布记录算出 */
  cadence?: Cadence;
  archived?: boolean;
  forks?: number;
  watchers?: number;
  issues?: number; // 未关闭的 Issues 数
  /** GitHub 安装包累计下载(只统计 .xpi);prevTotal/prevAt 是上一次的基线,用来算每天新增 */
  dl?: { total: number; at: string; prevTotal?: number; prevAt?: string };
}

export interface Cadence {
  r12: number; // 近一年发布次数
  days12?: number; // 近一年有发布的天数(同一天发多次只算一天)
  monthly: number[]; // 近 12 个月每月发布次数,旧 → 新
  medianDays: number | null; // 最近若干次发布间隔的中位数(天)
  last: string; // 最近一次发布日期
  capped?: boolean; // 接口取满上限,实际次数不少于 r12
}

export interface Download {
  t: number; // 面向的 Zotero 大版本
  v: string; // 插件版本
  u: string; // https 直链
  min?: string; // 作者声明的最低 Zotero 版本
  max?: string; // 作者声明的最高 Zotero 版本(支持 *)
  d?: string; // 发布日期
}

export type SortKey = "stars" | "updated" | "cadence" | "downloads" | "name";
export type UpdatedWithin = "any" | "30" | "365";

export interface Filters {
  author: string; // 作者(GitHub 用户名,小写);空串为不限
  query: string;
  category: CategoryKey | "all";
  zotero: number | null;
  within: UpdatedWithin;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = { author: "", query: "", category: "all", zotero: null, within: "any", sort: "stars" };

const DAY = 86_400_000;

export function daysSince(date: string, now: Date): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY);
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKC");
}

export function matchesQuery(p: Plugin, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  const hay = norm([p.name, p.author, p.summary, p.id].join(" "));
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** 没声明兼容范围的插件不会被任何版本筛选命中(但在不筛选时正常出现)。 */
export function supportsZotero(p: Plugin, major: number): boolean {
  return p.zotero.declared && p.zotero.majors.includes(major);
}

export function filterPlugins(list: Plugin[], f: Filters, now: Date): Plugin[] {
  return list.filter((p) => {
    if (f.category !== "all" && p.category !== f.category) return false;
    if (f.author && authorOf(p.id) !== f.author) return false;
    if (f.zotero !== null && !supportsZotero(p, f.zotero)) return false;
    if (f.within !== "any") {
      const d = daysSince(p.updated, now);
      if (d === null || d > Number(f.within)) return false;
    }
    return matchesQuery(p, f.query);
  });
}

export function sortPlugins(list: Plugin[], sort: SortKey): Plugin[] {
  const byName = (a: Plugin, b: Plugin) => a.name.localeCompare(b.name, "zh-Hans-CN") || a.id.localeCompare(b.id);
  const out = [...list];
  out.sort((a, b) => {
    if (sort === "stars") return b.stars - a.stars || byName(a, b);
    if (sort === "updated") return (b.updated || "").localeCompare(a.updated || "") || byName(a, b);
    if (sort === "downloads") return (b.dl?.total ?? -1) - (a.dl?.total ?? -1) || b.stars - a.stars || byName(a, b);
    if (sort === "cadence") return (b.cadence?.r12 ?? -1) - (a.cadence?.r12 ?? -1) || b.stars - a.stars || byName(a, b);
    return byName(a, b);
  });
  return out;
}

export function applyFilters(list: Plugin[], f: Filters, now: Date): Plugin[] {
  return sortPlugins(filterPlugins(list, f, now), f.sort);
}

// ---------- URL 同步 ----------

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((c) => c.key));

export function parseFilters(search: string): Filters {
  const sp = new URLSearchParams(search);
  const cat = sp.get("cat") ?? "";
  const zv = Number(sp.get("zv"));
  const within = sp.get("up");
  const sort = sp.get("sort");
  return {
    author: /^[a-z0-9][a-z0-9-]{0,38}$/.test(sp.get("au") ?? "") ? (sp.get("au") as string) : "",
    query: (sp.get("q") ?? "").slice(0, 80),
    category: CATEGORY_KEYS.has(cat) ? (cat as CategoryKey) : "all",
    zotero: (ZOTERO_VERSIONS as readonly number[]).includes(zv) ? zv : null,
    within: within === "30" || within === "365" ? within : "any",
    sort: sort === "updated" || sort === "name" || sort === "cadence" || sort === "downloads" ? sort : "stars",
  };
}

/** 只写与默认值不同的项,保持网址简短。 */
export function serializeFilters(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.query.trim()) sp.set("q", f.query.trim());
  if (f.category !== "all") sp.set("cat", f.category);
  if (f.author) sp.set("au", f.author);
  if (f.zotero !== null) sp.set("zv", String(f.zotero));
  if (f.within !== "any") sp.set("up", f.within);
  if (f.sort !== "stars") sp.set("sort", f.sort);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------- 统计与格式化 ----------

export interface Stats {
  total: number;
  updated30: number;
  zotero10: number;
}

export function computeStats(list: Plugin[], now: Date): Stats {
  return {
    total: list.length,
    updated30: list.filter((p) => {
      const d = daysSince(p.updated, now);
      return d !== null && d <= 30;
    }).length,
    zotero10: list.filter((p) => supportsZotero(p, 10)).length,
  };
}

export function formatStars(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function relativeTime(date: string, now: Date): string {
  const d = daysSince(date, now);
  if (d === null) return "更新时间未知";
  if (d < 0) return "刚刚";
  if (d === 0) return "今天";
  if (d < 31) return `${d} 天前`;
  if (d < 365) return `${Math.floor(d / 30)} 个月前`;
  return `${Math.floor(d / 365)} 年前`;
}

export type Freshness = "fresh" | "normal" | "stale";

/** 30 天内「新近更新」;超过 2 年「久未更新」;其余不标。只提示,不隐藏。 */
export function freshness(date: string, now: Date): Freshness {
  const d = daysSince(date, now);
  if (d === null) return "normal";
  if (d <= 30) return "fresh";
  if (d > 730) return "stale";
  return "normal";
}

export type CompatKind = "full" | "partial" | "undeclared";

/** 兼容徽标:覆盖全部 7–10 为 full;覆盖部分为 partial;未声明为 undeclared。 */
export function compatSummary(p: Plugin): { kind: CompatKind; text: string } {
  if (!p.zotero.declared) return { kind: "undeclared", text: "兼容范围未声明" };
  const m = [...p.zotero.majors].sort((a, b) => a - b);
  if (m.length === 0) return { kind: "partial", text: "适配范围较早" };
  const first = m[0];
  const last = m[m.length - 1];
  const contiguous = m.length === last - first + 1;
  const text = m.length === 1 ? `适配 Zotero ${first}` : contiguous ? `适配 Zotero ${first}–${last}` : `适配 Zotero ${m.join("/")}`;
  return { kind: m.length === ZOTERO_VERSIONS.length ? "full" : "partial", text };
}

// ---------- 下载 ----------

const WILD = 999_999;
function vparts(v: string, wild: boolean): number[] {
  return String(v ?? "").trim().split(/[.\-+_]/).map((x) => (x === "*" ? (wild ? WILD : 0) : Number.parseInt(x, 10) || 0));
}
export function compareVersions(a: string, b: string): number {
  const pa = vparts(a, true);
  const pb = vparts(b, true);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** 只允许 github.com / gitee.com 的 https .xpi 直链;其它一律不渲染成下载按钮。 */
export function isAllowedXpiUrl(url: string): boolean {
  return /^https:\/\/(github\.com|gitee\.com)\/[^\s?#]+\.xpi$/i.test(url);
}

export function downloadHost(url: string): string {
  return /^https:\/\/([^/]+)/i.exec(url)?.[1]?.toLowerCase() ?? "";
}

export function downloadFilename(url: string): string {
  const last = url.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function releaseCovers(r: Download, major: number): boolean {
  if (!r.min && !r.max) return false; // 没声明范围的不算覆盖
  const v = String(major);
  if (r.min && compareVersions(v, r.min) < 0) return false;
  if (r.max && compareVersions(v, r.max) > 0) return false;
  return true;
}

/** 选出能装在指定 Zotero 大版本上的最新一份安装包;没有就返回 null(不拿别的版本充数)。 */
export function pickDownload(p: Plugin, major: number): Download | null {
  const ok = (p.downloads ?? []).filter((r) => isAllowedXpiUrl(r.u) && releaseCovers(r, major));
  if (ok.length === 0) return null;
  ok.sort((a, b) => compareVersions(b.v, a.v) || Math.abs(a.t - major) - Math.abs(b.t - major));
  return ok[0];
}

export type ActivityKind = "recent" | "active" | "slow" | "stale" | "unknown";

/** 维护状态:按最近一次发布距今的天数分档。只提示,不隐藏。 */
export function activityTag(date: string, now: Date): { kind: ActivityKind; text: string } {
  const d = daysSince(date, now);
  if (d === null) return { kind: "unknown", text: "更新未知" };
  if (d <= 90) return { kind: "recent", text: "近期更新" };
  if (d <= 365) return { kind: "active", text: "维护中" };
  if (d <= 730) return { kind: "slow", text: "更新放缓" };
  return { kind: "stale", text: "久未更新" };
}

export type PopularityKind = "hot" | "common" | "growing" | "niche";

/** 人气档位:按 GitHub 星标分档(只是热度,不代表质量)。 */
export function popularityTag(stars: number): { kind: PopularityKind; text: string } {
  if (stars >= 3000) return { kind: "hot", text: "热门" };
  if (stars >= 500) return { kind: "common", text: "常用" };
  if (stars >= 100) return { kind: "growing", text: "成长中" };
  return { kind: "niche", text: "小众" };
}

export interface CardTag {
  slot: "category" | "compat" | "activity" | "popularity";
  kind: string;
  text: string;
}

/** 每个插件固定四个标签:分类 · 适配版本 · 维护状态 · 人气档位。 */
export function cardTags(p: Plugin, now: Date): CardTag[] {
  const label = CATEGORIES.find((c) => c.key === p.category)?.label ?? "工具";
  const compat = compatSummary(p);
  const act = activityTag(p.updated, now);
  const pop = popularityTag(p.stars);
  return [
    { slot: "category", kind: p.category, text: label },
    { slot: "compat", kind: compat.kind, text: compat.text },
    { slot: "activity", kind: act.kind, text: act.text },
    { slot: "popularity", kind: pop.kind, text: pop.text },
  ];
}

// ---------- 作者与更新速度 ----------

export function authorOf(id: string): string {
  return id.split("/")[0] ?? "";
}

/** 有 2 个及以上插件的作者,按插件数倒序(同数按名称),用于作者筛选。 */
export function topAuthors(list: Plugin[], min = 2): { author: string; count: number }[] {
  const m = new Map<string, number>();
  for (const p of list) m.set(authorOf(p.id), (m.get(authorOf(p.id)) ?? 0) + 1);
  return [...m.entries()]
    .filter(([, n]) => n >= min)
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
}

export function authorStats(list: Plugin[], author: string): { count: number; stars: number } {
  const mine = list.filter((p) => authorOf(p.id) === author);
  return { count: mine.length, stars: mine.reduce((s, p) => s + p.stars, 0) };
}

/** 「近一年发布 12 次」/「近一年发布 100+ 次」/「近一年无发布」/「发布记录未知」 */
export function cadenceText(p: Plugin): string {
  const c = p.cadence;
  if (!c) return "发布记录未知";
  if (c.r12 === 0) return "近一年无发布";
  return `近一年发布 ${c.r12}${c.capped ? "+" : ""} 次`;
}

/** 平均几天一更:不足 1 天写「一天多次」;没有数据返回 null。 */
export function speedText(p: Plugin): string | null {
  const d = p.cadence?.medianDays;
  if (d === null || d === undefined || !p.cadence || p.cadence.r12 === 0) return null;
  if (d < 1) return "一天多次更新";
  if (d < 2) return "约每天更新";
  if (d < 60) return `约 ${Math.round(d)} 天一更`;
  if (d < 365) return `约 ${Math.round(d / 30)} 个月一更`;
  return "一年以上才更一次";
}

/** 中文计数:1,234 / 12.3 万 / 1.2 亿。 */
export function formatCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1).replace(/\.0$/, "")} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1).replace(/\.0$/, "")} 万`;
  return n.toLocaleString("zh-CN");
}

/** 累计下载文案:「234.1 万次下载」;没有数据返回 null。 */
export function downloadsText(p: Plugin): string | null {
  if (!p.dl || p.dl.total <= 0) return null;
  const c = formatCount(p.dl.total);
  return /[万亿]$/.test(c) ? `${c}次下载` : `${c} 次下载`; // 「234.1 万次下载」「1,000 次下载」
}

/** 12 个柱的相对高度(0–1),全 0 时都为 0。 */
export function barHeights(monthly: number[]): number[] {
  const max = Math.max(0, ...monthly);
  return monthly.map((v) => (max === 0 ? 0 : v / max));
}

/** 详情页路径:/plugins/owner/repo */
export function pluginPath(id: string): string {
  return `/plugins/${id}`;
}

export function pluginIdFromPath(pathname: string): string | null {
  const m = /^\/plugins\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  return m ? `${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`.toLowerCase() : null;
}

export function relatedPlugins(list: Plugin[], p: Plugin, n = 4): Plugin[] {
  return sortPlugins(list.filter((x) => x.category === p.category && x.id !== p.id), "stars").slice(0, n);
}
