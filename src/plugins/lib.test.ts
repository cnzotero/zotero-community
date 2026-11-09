import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FILTERS, applyFilters, compatSummary, computeStats, filterPlugins, formatStars, freshness,
  parseFilters, pluginIdFromPath, relatedPlugins, relativeTime, serializeFilters, sortPlugins, supportsZotero,
  type Plugin,
} from "./lib.ts";

const NOW = new Date("2026-11-10T00:00:00Z");

function mk(o: Partial<Plugin> & { id: string }): Plugin {
  return {
    name: o.id, summary: "", category: "reading", author: "a", homepage: "https://github.com/" + o.id,
    stars: 0, updated: "2026-11-01", zotero: { declared: true, majors: [7, 8, 9, 10] }, ...o,
  };
}

const A = mk({ id: "x/a", name: "Alpha 翻译", stars: 500, category: "reading", updated: "2026-11-05" });
const B = mk({ id: "x/b", name: "Beta", stars: 900, category: "metadata", updated: "2025-01-01", zotero: { declared: true, majors: [7, 8] } });
const C = mk({ id: "x/c", name: "Gamma", stars: 900, category: "ai", updated: "2024-01-01", zotero: { declared: false, majors: [] } });
const D = mk({ id: "x/d", name: "Delta", stars: 10, category: "reading", updated: "", summary: "批量标签整理" });
const ALL = [A, B, C, D];

test("关键词检索:名称、作者、摘要、id,多词需同时命中,忽略大小写与全角", () => {
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, query: "alpha" }, NOW).map((p) => p.id), ["x/a"]);
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, query: "ＡＬＰＨＡ 翻译" }, NOW).map((p) => p.id), ["x/a"]);
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, query: "标签" }, NOW).map((p) => p.id), ["x/d"]);
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, query: "alpha 标签" }, NOW), []);
});

test("分类筛选", () => {
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, category: "reading" }, NOW).map((p) => p.id), ["x/a", "x/d"]);
});

test("版本筛选:未声明兼容范围的插件不会被任何版本命中,在不筛选时仍出现", () => {
  assert.equal(supportsZotero(C, 10), false);
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, zotero: 10 }, NOW).map((p) => p.id), ["x/a", "x/d"]);
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, zotero: 7 }, NOW).map((p) => p.id), ["x/a", "x/b", "x/d"]);
  assert.equal(filterPlugins(ALL, DEFAULT_FILTERS, NOW).length, 4);
});

test("更新时间筛选:没有更新日期的插件不会被命中", () => {
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, within: "30" }, NOW).map((p) => p.id), ["x/a"]);
  assert.deepEqual(filterPlugins(ALL, { ...DEFAULT_FILTERS, within: "365" }, NOW).map((p) => p.id), ["x/a"]);
});

test("排序:同分按名称稳定;更新时间倒序;名称按中文排序", () => {
  assert.deepEqual(sortPlugins(ALL, "stars").map((p) => p.id), ["x/b", "x/c", "x/a", "x/d"]);
  assert.deepEqual(sortPlugins(ALL, "updated").map((p) => p.id), ["x/a", "x/b", "x/c", "x/d"]);
  assert.deepEqual(sortPlugins(ALL, "name").map((p) => p.id), ["x/a", "x/b", "x/d", "x/c"]);
  assert.deepEqual(applyFilters(ALL, { ...DEFAULT_FILTERS, sort: "name", category: "reading" }, NOW).map((p) => p.id), ["x/a", "x/d"]);
});

test("排序不改变原数组", () => {
  const copy = [...ALL];
  sortPlugins(ALL, "name");
  assert.deepEqual(ALL, copy);
});

test("URL:只写非默认项,往返一致,非法值回落默认", () => {
  assert.equal(serializeFilters(DEFAULT_FILTERS), "");
  const f = { query: "翻译", category: "reading" as const, zotero: 10, within: "30" as const, sort: "updated" as const };
  const s = serializeFilters(f);
  assert.deepEqual(parseFilters(s), f);
  assert.deepEqual(parseFilters("?cat=evil&zv=99&up=7&sort=x&q=" + "a".repeat(200)), { ...DEFAULT_FILTERS, query: "a".repeat(80) });
});

test("统计", () => {
  assert.deepEqual(computeStats(ALL, NOW), { total: 4, updated30: 1, zotero10: 2 });
});

test("星标缩写", () => {
  assert.equal(formatStars(999), "999");
  assert.equal(formatStars(1000), "1k");
  assert.equal(formatStars(1234), "1.2k");
  assert.equal(formatStars(12250), "12.3k");
  assert.equal(formatStars(120000), "120k");
});

test("相对时间与新旧提示", () => {
  assert.equal(relativeTime("2026-11-10", NOW), "今天");
  assert.equal(relativeTime("2026-11-07", NOW), "3 天前");
  assert.equal(relativeTime("2026-08-01", NOW), "3 个月前");
  assert.equal(relativeTime("2024-01-01", NOW), "2 年前");
  assert.equal(relativeTime("", NOW), "更新时间未知");
  assert.equal(freshness("2026-11-01", NOW), "fresh");
  assert.equal(freshness("2025-06-01", NOW), "normal");
  assert.equal(freshness("2023-01-01", NOW), "stale");
  assert.equal(freshness("", NOW), "normal");
});

test("兼容徽标", () => {
  assert.deepEqual(compatSummary(A), { kind: "full", text: "适配 Zotero 7–10" });
  assert.deepEqual(compatSummary(B), { kind: "partial", text: "适配 Zotero 7–8" });
  assert.deepEqual(compatSummary(C), { kind: "undeclared", text: "兼容范围未声明" });
  assert.deepEqual(compatSummary(mk({ id: "y/z", zotero: { declared: true, majors: [7, 9] } })), { kind: "partial", text: "适配 Zotero 7/9" });
  assert.equal(compatSummary(mk({ id: "y/z", zotero: { declared: true, majors: [9] } })).text, "适配 Zotero 9");
});

test("详情页路径解析", () => {
  assert.equal(pluginIdFromPath("/plugins/Owner/Repo"), "owner/repo");
  assert.equal(pluginIdFromPath("/plugins/owner/repo/"), "owner/repo");
  assert.equal(pluginIdFromPath("/plugins"), null);
  assert.equal(pluginIdFromPath("/plugins/a/b/c"), null);
});

test("相关插件:同分类、不含自己、按热度取前 n", () => {
  const list = [A, D, mk({ id: "x/e", category: "reading", stars: 700 })];
  assert.deepEqual(relatedPlugins(list, A, 1).map((p) => p.id), ["x/e"]);
  assert.deepEqual(relatedPlugins(list, A).map((p) => p.id), ["x/e", "x/d"]);
});
