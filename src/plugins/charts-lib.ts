// 数据看板的纯聚合逻辑:榜单、分布、趋势、关键指标。全部由公开数据按同一规则算出。
import { CATEGORIES, daysSince, supportsZotero, ZOTERO_VERSIONS, authorOf, type CategoryKey, type Plugin } from "./lib.ts";

export type History = Record<string, [string, number, number | null][]>;

export interface RankItem {
  id: string;
  name: string;
  value: number;
  sub?: string;
}

/** 取某个数值字段最大的前 n 个;值缺失或为 0 的不上榜;同值按名称排,保证稳定。 */
export function topBy(list: Plugin[], pick: (p: Plugin) => number | undefined, n: number): RankItem[] {
  return list
    .map((p) => ({ id: p.id, name: p.name, value: pick(p) ?? 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .slice(0, n);
}

export interface Kpis {
  plugins: number;
  stars: number;
  releases12m: number;
  downloads: number;
  updated30: number;
}

export function kpis(list: Plugin[], now: Date): Kpis {
  return {
    plugins: list.length,
    stars: list.reduce((s, p) => s + p.stars, 0),
    releases12m: list.reduce((s, p) => s + (p.cadence?.r12 ?? 0), 0),
    downloads: list.reduce((s, p) => s + (p.dl?.total ?? 0), 0),
    updated30: list.filter((p) => {
      const d = daysSince(p.updated, now);
      return d !== null && d <= 30;
    }).length,
  };
}

export function categoryCounts(list: Plugin[]): { key: CategoryKey; label: string; count: number }[] {
  return CATEGORIES.map((c) => ({ key: c.key, label: c.label, count: list.filter((p) => p.category === c.key).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-Hans-CN"));
}

/** 各 Zotero 版本的适配数量;「未声明」单独一项。 */
export function compatCounts(list: Plugin[]): { label: string; count: number; undeclared?: boolean }[] {
  const out: { label: string; count: number; undeclared?: boolean }[] = ZOTERO_VERSIONS.map((v) => ({
    label: `Zotero ${v}`,
    count: list.filter((p) => supportsZotero(p, v)).length,
  }));
  out.push({ label: "未声明兼容范围", count: list.filter((p) => !p.zotero.declared).length, undeclared: true });
  return out;
}

/** 全体插件近 12 个月每月发布总次数(旧 → 新)。 */
export function monthlyTotals(list: Plugin[]): number[] {
  const t = Array(12).fill(0) as number[];
  // 同一插件同一个月最多按 31 次计(每天一次),避免个别高频发版的插件扭曲整体趋势
  for (const p of list) (p.cadence?.monthly ?? []).forEach((v, i) => { if (i < 12) t[i] += Math.min(v, 31); });
  return t;
}

export function authorTotals(list: Plugin[], n: number): RankItem[] {
  const m = new Map<string, number>();
  for (const p of list) m.set(authorOf(p.id), (m.get(authorOf(p.id)) ?? 0) + p.stars);
  return [...m.entries()]
    .map(([author, value]) => ({ id: author, name: author, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** 每天新增下载:(今天 - 上次基线) / 间隔天数;没有基线或同一天返回 null。 */
export function downloadsPerDay(p: Plugin): number | null {
  const d = p.dl;
  if (!d || d.prevTotal === undefined || !d.prevAt) return null;
  const days = (Date.parse(d.at) - Date.parse(d.prevAt)) / 86_400_000;
  if (!(days >= 1)) return null;
  const delta = d.total - d.prevTotal;
  return delta < 0 ? null : Math.round((delta / days) * 10) / 10;
}

/**
 * 热度趋势:最近 N 天新增星标。用历史快照里「至少 N 天前」的那条做基线;
 * 历史不足 N 天时返回空数组(页面显示「数据积累中」),绝不拿不足的天数充数。
 */
export function trending(list: Plugin[], history: History, days: number, now: Date, n = 15): RankItem[] {
  const out: RankItem[] = [];
  for (const p of list) {
    const h = history[p.id];
    if (!h || h.length < 2) continue;
    const latest = h[h.length - 1];
    const base = [...h].reverse().find((x) => (Date.parse(latest[0]) - Date.parse(x[0])) / 86_400_000 >= days);
    if (!base) continue;
    const gain = latest[1] - base[1];
    if (gain > 0) out.push({ id: p.id, name: p.name, value: gain });
  }
  void now;
  return out.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-Hans-CN")).slice(0, n);
}

/** 历史是否已经积累到 N 天。 */
export function historyDays(history: History): number {
  let max = 0;
  for (const h of Object.values(history)) {
    if (h.length >= 2) max = Math.max(max, (Date.parse(h[h.length - 1][0]) - Date.parse(h[0][0])) / 86_400_000);
  }
  return Math.floor(max);
}
