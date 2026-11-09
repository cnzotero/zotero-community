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
}

export type SortKey = "stars" | "updated" | "name";
export type UpdatedWithin = "any" | "30" | "365";

export interface Filters {
  query: string;
  category: CategoryKey | "all";
  zotero: number | null;
  within: UpdatedWithin;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = { query: "", category: "all", zotero: null, within: "any", sort: "stars" };

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
    query: (sp.get("q") ?? "").slice(0, 80),
    category: CATEGORY_KEYS.has(cat) ? (cat as CategoryKey) : "all",
    zotero: (ZOTERO_VERSIONS as readonly number[]).includes(zv) ? zv : null,
    within: within === "30" || within === "365" ? within : "any",
    sort: sort === "updated" || sort === "name" ? sort : "stars",
  };
}

/** 只写与默认值不同的项,保持网址简短。 */
export function serializeFilters(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.query.trim()) sp.set("q", f.query.trim());
  if (f.category !== "all") sp.set("cat", f.category);
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
