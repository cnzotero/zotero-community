import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Plugin } from "./lib.ts";
import { PACK_KEYS, STAGE_PACKS, packAllPlugins, packOf, selectSlotPlugins } from "./packs.ts";
import { TOPIC_KEYS } from "./topics.ts";
import { routeFromPath } from "../router.ts";

const mk = (id: string, name: string, summary: string, opts: Partial<Plugin> = {}): Plugin =>
  ({
    id,
    name,
    summary,
    category: "utility",
    author: id.split("/")[0],
    homepage: `https://github.com/${id}`,
    stars: 10,
    updated: "2026-11-01",
    zotero: { declared: true, majors: [7, 8, 9, 10] },
    ...opts,
  }) as unknown as Plugin;

test("科研阶段方案定义完整:键唯一、每个环节绑定已有专题、教程列表非空", () => {
  assert.equal(new Set(PACK_KEYS).size, STAGE_PACKS.length);
  assert.ok(STAGE_PACKS.length >= 4);
  for (const p of STAGE_PACKS) {
    assert.match(p.key, /^[a-z0-9-]+$/);
    assert.ok(p.label && p.subtitle && p.description && p.tips.length >= 2 && p.slots.length >= 4, p.key);
    for (const s of p.slots) {
      assert.ok(TOPIC_KEYS.includes(s.topicKey), `${p.key} 引用了不存在的专题 ${s.topicKey}`);
    }
  }
});

test("按统一规则挑选插件:优先声明适配最新 Zotero 版本且近一年活跃的高星插件", () => {
  const now = new Date("2026-11-27");
  const list = [
    mk("old/high", "Old High", "PDF 翻译", { stars: 9000, updated: "2024-01-01", zotero: { declared: true, majors: [7] } }),
    mk("fresh/ten", "Fresh Ten", "PDF 翻译", { stars: 300, updated: "2026-10-01", zotero: { declared: true, majors: [7, 8, 9, 10] } }),
    mk("fresh/low", "Fresh Low", "PDF 翻译", { stars: 100, updated: "2026-09-01", zotero: { declared: true, majors: [10] } }),
    mk("undecl/mid", "Undecl", "PDF 翻译", { stars: 500, updated: "2026-11-01", zotero: { declared: false, majors: [] } }),
  ];
  assert.deepEqual(selectSlotPlugins(list, "translate", 2, now).map((p) => p.id), ["fresh/ten", "fresh/low"]);
  assert.deepEqual(selectSlotPlugins(list, "translate", 3, now).map((p) => p.id), ["fresh/ten", "fresh/low", "old/high"]);
  assert.ok(packAllPlugins(list, packOf("undergrad")!, now).length >= 2);
});

test("路由:只认 /packs 与已定义的阶段键,其余 404", () => {
  assert.equal(routeFromPath("/packs"), "packs");
  assert.equal(routeFromPath("/packs/phd"), "pack");
  assert.equal(routeFromPath("/packs/master/"), "pack");
  assert.equal(routeFromPath("/packs/unknown"), "notfound");
});

test("中立:packs.ts 与 PacksPage.tsx 源码中不硬编码任何单个插件名或品牌", () => {
  for (const file of ["./packs.ts", "./PacksPage.tsx"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8").toLowerCase();
    for (const word of ["ai4paper", "阅读宇宙", "better bibtex", "zotero-style", "jasminum", "茉莉花", "pdf2zh", "better-notes"]) {
      assert.ok(!src.includes(word), `${file} 不应硬编码 ${word}`);
    }
  }
});
