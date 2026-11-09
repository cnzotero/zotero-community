import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FILTERS, activityTag, compareVersions, downloadFilename, downloadHost, isAllowedXpiUrl, pickDownload, applyFilters, cardTags, popularityTag, compatSummary, computeStats, filterPlugins, formatStars, freshness,
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

test("维护状态分档", () => {
  assert.equal(activityTag("2026-10-20", NOW).text, "近期更新");
  assert.equal(activityTag("2026-03-01", NOW).text, "维护中");
  assert.equal(activityTag("2025-03-01", NOW).text, "更新放缓");
  assert.equal(activityTag("2023-03-01", NOW).text, "久未更新");
  assert.deepEqual(activityTag("", NOW), { kind: "unknown", text: "更新未知" });
});

test("人气档位边界", () => {
  assert.equal(popularityTag(3000).text, "热门");
  assert.equal(popularityTag(2999).text, "常用");
  assert.equal(popularityTag(500).text, "常用");
  assert.equal(popularityTag(499).text, "成长中");
  assert.equal(popularityTag(100).text, "成长中");
  assert.equal(popularityTag(99).text, "小众");
  assert.equal(popularityTag(0).text, "小众");
});

test("每个插件固定四个标签且顺序固定,缺数据也不少", () => {
  for (const p of ALL) {
    const tags = cardTags(p, NOW);
    assert.equal(tags.length, 4);
    assert.deepEqual(tags.map((t) => t.slot), ["category", "compat", "activity", "popularity"]);
    assert.ok(tags.every((t) => t.text.length > 0));
  }
  assert.equal(cardTags(C, NOW)[1].text, "兼容范围未声明");
  assert.equal(cardTags(D, NOW)[2].text, "更新未知");
});

test("版本比较:支持通配符与不等长", () => {
  assert.equal(compareVersions("2.4.8", "2.3.16"), 1);
  assert.equal(compareVersions("10.0", "10.0.0"), 0);
  assert.equal(compareVersions("8.0.*", "8.0.9"), 1);
  assert.equal(compareVersions("7.9.9", "8"), -1);
});

test("下载直链白名单:只认 github.com / gitee.com 的 https .xpi", () => {
  assert.equal(isAllowedXpiUrl("https://github.com/o/r/releases/download/v1/a.xpi"), true);
  assert.equal(isAllowedXpiUrl("https://gitee.com/o/r/releases/download/v1/a.xpi"), true);
  assert.equal(isAllowedXpiUrl("http://github.com/o/r/a.xpi"), false);
  assert.equal(isAllowedXpiUrl("https://evil.com/github.com/a.xpi"), false);
  assert.equal(isAllowedXpiUrl("https://github.com.evil.com/o/r/a.xpi"), false);
  assert.equal(isAllowedXpiUrl("https://github.com/o/r/a.zip"), false);
  assert.equal(isAllowedXpiUrl("https://github.com/o/r/a.xpi?x=1"), false);
  assert.equal(downloadHost("https://github.com/o/r/a.xpi"), "github.com");
  assert.equal(downloadFilename("https://github.com/o/r/releases/download/v1/my%20plugin.xpi"), "my plugin.xpi");
});

test("选安装包:按 Zotero 大版本取覆盖它的最新版;未声明范围或不覆盖就不给", () => {
  const dl = [
    { t: 7, v: "2.3.16", u: "https://github.com/o/r/releases/download/v2.3.16/a.xpi", min: "6.9.9", max: "8.0.*" },
    { t: 8, v: "2.4.8", u: "https://github.com/o/r/releases/download/v2.4.8/a.xpi", min: "7.9.9", max: "10.9.9" },
    { t: 9, v: "9.9.9", u: "https://evil.com/a.xpi", min: "9", max: "9.9" },
    { t: 10, v: "1.0.0", u: "https://github.com/o/r/releases/download/v1/b.xpi" },
  ];
  const p = mk({ id: "o/r", downloads: dl });
  assert.equal(pickDownload(p, 7)?.v, "2.3.16"); // 2.4.8 的最低版本是 7.9.9,不覆盖 Zotero 7
  assert.equal(pickDownload(p, 8)?.v, "2.4.8");
  assert.equal(pickDownload(p, 10)?.v, "2.4.8");
  assert.equal(pickDownload(p, 9)?.v, "2.4.8"); // 白名单之外的直链不会被选中
  assert.equal(pickDownload(mk({ id: "o/s" }), 10), null);
  assert.equal(pickDownload(mk({ id: "o/s", downloads: [dl[3]] }), 10), null);
  assert.equal(pickDownload(mk({ id: "o/s", downloads: [dl[0]] }), 10), null);
});
