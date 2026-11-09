import { test } from "node:test";
import assert from "node:assert/strict";
import { authorTotals, categoryCounts, compatCounts, downloadsPerDay, historyDays, kpis, monthlyTotals, topBy, trending, type History } from "./charts-lib.ts";
import { downloadsText, sortPlugins, type Plugin } from "./lib.ts";

const NOW = new Date("2026-11-10T00:00:00Z");
function mk(o: Partial<Plugin> & { id: string }): Plugin {
  return { name: o.id, summary: "", category: "reading", author: "a", homepage: "", stars: 0, updated: "2026-11-01", zotero: { declared: true, majors: [7, 8, 9, 10] }, ...o };
}
const A = mk({ id: "x/a", name: "A", stars: 100, category: "reading", cadence: { r12: 5, monthly: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2], medianDays: 10, last: "2026-11-01" }, dl: { total: 1000, at: "2026-11-10", prevTotal: 940, prevAt: "2026-11-08" }, issues: 3 });
const B = mk({ id: "x/b", name: "B", stars: 100, category: "ai", zotero: { declared: false, majors: [] }, cadence: { r12: 9, monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3], medianDays: 3, last: "2026-11-05" } });
const C = mk({ id: "y/c", name: "C", stars: 5, category: "ai", updated: "2025-01-01" });
const L = [A, B, C];

test("榜单:零与缺失不上榜,同值按名称稳定,数量受限", () => {
  assert.deepEqual(topBy(L, (p) => p.stars, 2).map((x) => x.id), ["x/a", "x/b"]);
  assert.deepEqual(topBy(L, (p) => p.cadence?.r12, 5).map((x) => x.id), ["x/b", "x/a"]);
  assert.deepEqual(topBy(L, (p) => p.dl?.total, 5).map((x) => x.id), ["x/a"]);
  assert.deepEqual(topBy(L, () => 0, 5), []);
});

test("关键指标", () => {
  assert.deepEqual(kpis(L, NOW), { plugins: 3, stars: 205, releases12m: 14, downloads: 1000, updated30: 2 });
});

test("分类分布与版本适配分布", () => {
  assert.deepEqual(categoryCounts(L).map((c) => [c.label, c.count]), [["AI", 2], ["阅读", 1]]);
  const cc = compatCounts(L);
  assert.equal(cc.find((c) => c.label === "Zotero 10")?.count, 2); // B 未声明,不计入
  assert.equal(cc.find((c) => c.undeclared)?.count, 1);
});

test("每月发布总量", () => {
  assert.deepEqual(monthlyTotals(L), [1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 5]);
});

test("月度汇总:同一插件每月最多计 31 次,高频发版不会压垮整体趋势", () => {
  const spam = mk({ id: "z/z", cadence: { r12: 2000, monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2000], medianDays: 0.1, last: "2026-11-09" } });
  assert.equal(monthlyTotals([spam])[11], 31);
});

test("作者榜按总星标", () => {
  assert.deepEqual(authorTotals(L, 5), [{ id: "x", name: "x", value: 200 }, { id: "y", name: "y", value: 5 }]);
});

test("每天新增下载:按基线间隔天数平均;无基线、同一天、负增长都不给数", () => {
  assert.equal(downloadsPerDay(A), 30);
  assert.equal(downloadsPerDay(B), null);
  assert.equal(downloadsPerDay(mk({ id: "q/q", dl: { total: 10, at: "2026-11-10", prevTotal: 5, prevAt: "2026-11-10" } })), null);
  assert.equal(downloadsPerDay(mk({ id: "q/q", dl: { total: 5, at: "2026-11-10", prevTotal: 10, prevAt: "2026-11-09" } })), null);
});

test("热度趋势:历史不足 N 天不充数;够了按基线算新增", () => {
  const h1: History = { "x/a": [["2026-11-09", 90, null], ["2026-11-10", 100, null]] };
  assert.deepEqual(trending(L, h1, 7, NOW), []);
  assert.equal(historyDays(h1), 1);
  const h2: History = {
    "x/a": [["2026-11-01", 80, null], ["2026-11-05", 90, null], ["2026-11-10", 100, null]],
    "x/b": [["2026-11-01", 100, null], ["2026-11-10", 100, null]],
    "y/c": [["2026-11-10", 5, null]],
  };
  assert.deepEqual(trending(L, h2, 7, NOW).map((x) => [x.id, x.value]), [["x/a", 20]]); // 基线取至少 7 天前的最近一条:11-01(80),新增 20;11-05 只隔 5 天不算
  assert.equal(historyDays(h2), 9);
});

test("下载:文案与按下载量排序", () => {
  assert.equal(downloadsText(A), "1,000 次下载");
  assert.equal(downloadsText(mk({ id: "q/q", dl: { total: 2340782, at: "2026-11-10" } })), "234.1 万次下载");
  assert.equal(downloadsText(mk({ id: "q/q", dl: { total: 120000000, at: "2026-11-10" } })), "1.2 亿次下载");
  assert.equal(downloadsText(mk({ id: "q/q", dl: { total: 30000, at: "2026-11-10" } })), "3 万次下载");
  assert.equal(downloadsText(B), null);
  assert.deepEqual(sortPlugins([B, C, A], "downloads").map((p) => p.id), ["x/a", "x/b", "y/c"]);
});
