import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../data/plugins.json" with { type: "json" };
import { CATEGORIES, type Plugin } from "../plugins/lib.ts";
import { categoryMeta, categoryTopic } from "./pages.ts";

const PLUGINS = (data as unknown as { plugins: Plugin[] }).plugins;

test("分类页标题:用途词取分类名,数量与数据一致,1~2 款的不叫「大全」", () => {
  for (const c of CATEGORIES) {
    const n = PLUGINS.filter((p) => p.category === c.key).length;
    const meta = categoryMeta(c.key, PLUGINS);
    assert.ok(meta, c.key);
    const topic = categoryTopic(c.label);
    assert.equal(meta.h1, topic);
    assert.equal(meta.title, `${topic}${n > 2 ? "大全" : ""}(${n} 款):用途、适配版本与下载`, c.key);
    assert.ok(meta.description.startsWith(`收录 ${n} 款 ${topic}`), c.key);
    assert.ok(meta.description.length <= 160, `${c.key} 描述过长`);
  }
  assert.equal(categoryTopic("AI"), "Zotero AI 插件");
  assert.equal(categoryTopic("阅读"), "Zotero 阅读插件");
  assert.equal(categoryMeta("nope", PLUGINS), null);
});

test("分类页描述只用事实:适配范围按声明算,算不出就整句省略", () => {
  const mk = (id: string, o: Partial<Plugin>): Plugin => ({ id, name: id, summary: "", category: "writing", author: "a", homepage: "", stars: 0, updated: "", zotero: { declared: false, majors: [] }, ...o });
  const undeclared = categoryMeta("writing", [mk("a/a", {}), mk("b/b", { updated: "2026-10-01" })])!;
  assert.equal(undeclared.title, "Zotero 写作插件(2 款):用途、适配版本与下载");
  assert.ok(!undeclared.description.includes("覆盖"), "没有声明就不写适配范围");
  assert.match(undeclared.description, /最近一次发布于 2026-10-01/);
  const ranged = categoryMeta("writing", [mk("a/a", { zotero: { declared: true, majors: [8, 9] } }), mk("b/b", { zotero: { declared: true, majors: [10] } }), mk("c/c", {})])!;
  assert.match(ranged.title, /^Zotero 写作插件大全\(3 款\)/);
  assert.match(ranged.description, /其中 2 款声明了适配版本,覆盖 Zotero 8–10/);
  assert.ok(!ranged.description.includes("最近一次发布"), "没有发布日期就不写");
});
