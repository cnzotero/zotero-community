import assert from "node:assert/strict";
import test from "node:test";
import { GUIDES, PLUGINS } from "./content.ts";
import { filterGuides, filterPlugins, searchAll } from "./search.ts";

test("空查询返回全部,分类过滤只留该类", () => {
  assert.equal(filterPlugins(PLUGINS, {}).length, PLUGINS.length);
  const meta = filterPlugins(PLUGINS, { category: "metadata" });
  assert.ok(meta.length > 0 && meta.every((p) => p.category === "metadata"));
});

test("多个关键词需同时命中,大小写与全角不敏感", () => {
  assert.deepEqual(
    filterPlugins(PLUGINS, { query: "ＢＥＴＴＥＲ  notes" }).map((p) => p.id),
    ["better-notes"],
  );
  assert.equal(filterPlugins(PLUGINS, { query: "不存在的词语xyz" }).length, 0);
});

test("教程按主题过滤并可搜索", () => {
  const w = filterGuides(GUIDES, { query: "word" });
  assert.ok(w.some((g) => g.id === "word-cite"));
  assert.ok(filterGuides(GUIDES, { topic: "整理文库" }).every((g) => g.topic === "整理文库"));
});

test("searchAll 同时搜教程与插件", () => {
  const r = searchAll(PLUGINS, GUIDES, "翻译");
  assert.ok(r.plugins.some((p) => p.id === "pdf-translate"));
});

test("内容数据:id 唯一,外链为 https", () => {
  for (const list of [PLUGINS, GUIDES]) {
    assert.equal(new Set(list.map((x) => x.id)).size, list.length);
  }
  for (const x of [...PLUGINS.map((p) => p.homepage), ...GUIDES.map((g) => g.href)]) {
    assert.ok(x.startsWith("https://"), x);
  }
});
