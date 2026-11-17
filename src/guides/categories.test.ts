import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDE_CATEGORIES, ORDER_RANGES, categoryAnchor, groupArticles, guideCategoryLabel, homePicks, sameCategory } from "./categories.ts";
import type { Article } from "./markdown.ts";

const art = (slug: string, order: number, category?: Article["category"], updated?: string): Article => ({ title: slug, description: "", slug, order, sources: [], blocks: [], ...(category ? { category } : {}), ...(updated ? { updated } : {}) });

test("分类:取值、顺序与 order 区间固定", () => {
  assert.deepEqual(GUIDE_CATEGORIES.map((c) => c.key), ["start", "plugins", "styles", "sync", "library", "writing", "dev"]);
  assert.deepEqual(GUIDE_CATEGORIES.map((c) => c.label), ["入门", "插件", "样式与引用", "同步与备份", "文库整理与阅读", "写作与引用", "开发"]);
  assert.deepEqual(ORDER_RANGES, { dev: [1, 5], start: [100, 199], plugins: [200, 299], styles: [300, 399], sync: [400, 499], library: [500, 599], writing: [600, 699] });
  assert.equal(guideCategoryLabel("sync"), "同步与备份");
  assert.equal(guideCategoryLabel(undefined), "其他");
  assert.equal(categoryAnchor("dev"), "cat-dev");
});

test("分组:按固定分类顺序,没有文章的分类不出现,组内按 order,没写分类的放最后", () => {
  const list = [art("d2", 2, "dev"), art("s2", 310, "styles"), art("d1", 1, "dev"), art("x", 900), art("st", 100, "start"), art("s1", 300, "styles")];
  const g = groupArticles(list);
  assert.deepEqual(g.map((x) => x.key), ["start", "styles", "dev", "other"]);
  assert.deepEqual(g.map((x) => x.articles.map((a) => a.slug)), [["st"], ["s1", "s2"], ["d1", "d2"], ["x"]]);
  assert.deepEqual(groupArticles([]), []);
});

test("同分类:只含同一分类,按 order", () => {
  const list = [art("s2", 310, "styles"), art("d1", 1, "dev"), art("s1", 300, "styles")];
  assert.deepEqual(sameCategory(list, list[0]).map((a) => a.slug), ["s1", "s2"]);
  assert.deepEqual(sameCategory(list, list[1]).map((a) => a.slug), ["d1"]);
});

test("首页挑选:每类最多两篇,先是该类第一篇,再是其余里最近更新的", () => {
  const list = [
    art("p1", 200, "plugins", "2026-01-01"), art("p2", 210, "plugins", "2026-03-01"), art("p3", 220, "plugins", "2026-05-01"),
    art("s1", 300, "styles"),
    art("d1", 1, "dev", "2026-01-01"), art("d2", 2, "dev", "2026-02-01"), art("d3", 3, "dev", "2026-02-01"),
  ];
  const picks = homePicks(list);
  assert.deepEqual(picks.map((g) => [g.key, g.articles.map((a) => a.slug)]), [["plugins", ["p1", "p3"]], ["styles", ["s1"]], ["dev", ["d1", "d2"]]]);
  assert.ok(picks.every((g) => g.articles.length >= 1 && g.articles.length <= 2));
});
