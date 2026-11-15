import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Plugin } from "./lib.ts";
import { MIN_TOPIC_PLUGINS, TOPICS, TOPIC_KEYS, activeTopics, matchesTopic, topicIndex, topicList, topicOf, topicRule } from "./topics.ts";
import { routeFromPath } from "../router.ts";

const mk = (id: string, name: string, summary: string, stars = 0): Plugin =>
  ({ id, name, summary, category: "utility", author: id.split("/")[0], homepage: "", stars, updated: "", zotero: { declared: false, majors: [] } }) as unknown as Plugin;

test("专题定义完整:键唯一(小写字母数字与连字符)、都有名称、关键词与选择指引", () => {
  assert.equal(new Set(TOPIC_KEYS).size, TOPICS.length);
  for (const t of TOPICS) {
    assert.match(t.key, /^[a-z0-9-]+$/);
    assert.ok(t.label.trim() && t.terms.length > 0 && t.intro.length > 30, t.key);
    assert.ok(t.terms.every((w) => w === w.trim() && w.length > 0), `${t.key} 关键词不能有首尾空白或空串`);
  }
});

test("匹配规则:名称或简介里出现关键词即收录,不分大小写;短英文词按整词匹配", () => {
  const ocr = topicOf("ocr")!;
  assert.ok(matchesTopic(mk("a/a", "Zotero OCR", ""), ocr));
  assert.ok(matchesTopic(mk("a/b", "Scan", "run ocr on pdf"), ocr));
  assert.ok(matchesTopic(mk("a/c", "x", "把扫描件变成可检索文字"), ocr));
  assert.ok(!matchesTopic(mk("a/d", "Rocr", "docrate"), ocr), "ocr 不能命中 Rocr、docrate 这类单词的一部分");
  const tr = topicOf("translate")!;
  assert.ok(matchesTopic(mk("a/e", "Translate for X", ""), tr));
  assert.ok(matchesTopic(mk("a/f", "x", "支持双语对照"), tr));
});

test("专题内与分类页同一排序(星标从高到低,同星标按名称),不看作者;未知专题为空", () => {
  const list = [mk("z/z", "Zed", "翻译", 5), mk("a/a", "Alpha", "翻译", 5), mk("m/m", "Mid", "翻译", 900), mk("n/n", "None", "笔记")];
  assert.deepEqual(topicList(list, "translate").map((p) => p.id), ["m/m", "a/a", "z/z"]);
  assert.deepEqual(topicList(list, "nope"), []);
});

test(`在架插件不足 ${MIN_TOPIC_PLUGINS} 款的专题不生成页面`, () => {
  const two = [mk("a/a", "A", "OCR"), mk("b/b", "B", "OCR")];
  assert.deepEqual(activeTopics(two), []);
  assert.deepEqual(topicIndex(two), []);
  const three = [...two, mk("c/c", "C", "OCR")];
  assert.deepEqual(topicIndex(three).map((x) => [x.key, x.count]), [["ocr", 3]]);
});

test("路由:专题页只认已定义的专题键,其余一律 404", () => {
  assert.equal(routeFromPath("/topics/translate"), "topic");
  assert.equal(routeFromPath("/topics/translate/"), "topic");
  assert.equal(routeFromPath("/topics/not-a-topic"), "notfound");
  assert.equal(routeFromPath("/topics"), "notfound");
  assert.equal(routeFromPath("/topics/translate/x"), "notfound");
});

test("收录规则公开展示关键词,并声明一视同仁", () => {
  const rule = topicRule(topicOf("translate")!);
  assert.match(rule, /「翻译」/);
  assert.match(rule, /不看作者、不看星标，没有人工指定/);
});

test("中立:专题定义里不出现任何单个插件或品牌的名字(用途词与选择指引只讲通用做法)", () => {
  const src = readFileSync(new URL("./topics.ts", import.meta.url), "utf8");
  for (const word of ["ai4paper", "阅读宇宙", "better bibtex", "zotero-style", "jasminum", "茉莉花"]) {
    assert.ok(!src.toLowerCase().includes(word), `topics.ts 不应出现 ${word}`);
  }
});
