import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OFFICIAL, STYLES_FEED_FILE, STYLES_FILE, buildStylesIndex, collect, gbtEdition, parseCslInfo, sortStyles, styleEntry, stylesFeed, stylesJson, useOf, validateStylesIndex, zoteroLibraryPage,
} from "./styles-index.mjs";
import { writeStylesFeed } from "./prerender.mjs";

const csl = ({ title = "China National Standard GB/T 7714-2015 (numeric, 中文)", id = "http://www.zotero.org/styles/x", locale = ' default-locale="zh-CN"', rights = '<rights license="http://creativecommons.org/licenses/by-sa/3.0/">This work is licensed under a Creative Commons Attribution-ShareAlike 3.0 License</rights>', extra = "" } = {}) => `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0"${locale}>
  <info>
    <title>${title}</title>
    <!-- 注释不算标题 -->
    <id>${id}</id>
    <link href="${id}" rel="self"/>
    <link href="http://www.zotero.org/styles/base" rel="template"/>
    <link href="https://example.org/guide?a=1&amp;b=2" rel="documentation"/>
    <author><name>某作者</name><email>a@example.org</email></author>
    <category citation-format="numeric"/>
    <category field="generic-base"/>
    ${extra}
    <summary>The Chinese GB/T 7714-2015 numeric style</summary>
    <updated>2024-01-22T22:07:03+08:00</updated>
    ${rights}
  </info>
  <macro name="author"><names variable="author"/></macro>
  <citation><layout><text macro="author"/></layout></citation>
</style>`;

const entry = (o = {}, opts = {}) => styleEntry(parseCslInfo(csl(o)), { source: "csl", path: "x.csl", page: zoteroLibraryPage("x"), ...opts });

test("文件头解析:标题、ID、默认语言、引文方式、类别、链接、许可;实体解码,注释不混进来", () => {
  const info = parseCslInfo(csl({ extra: "<title-short>GB</title-short>" }));
  assert.equal(info.title, "China National Standard GB/T 7714-2015 (numeric, 中文)");
  assert.equal(info.titleShort, "GB");
  assert.equal(info.id, "http://www.zotero.org/styles/x");
  assert.equal(info.defaultLocale, "zh-CN");
  assert.equal(info.class, "in-text");
  assert.equal(info.citationFormat, "numeric");
  assert.deepEqual(info.fields, ["generic-base"]);
  assert.deepEqual(info.links.find((l) => l.rel === "documentation"), { rel: "documentation", href: "https://example.org/guide?a=1&b=2" });
  assert.equal(info.license.url, "http://creativecommons.org/licenses/by-sa/3.0/");
  assert.match(info.license.text, /Attribution-ShareAlike 3\.0/);
  assert.equal(parseCslInfo("<html></html>"), null);
  assert.equal(parseCslInfo(undefined), null);
});

test("国标版本:破折号、连字符都认;适用场景只用标题或名单里写明的用途", () => {
  assert.equal(gbtEdition("GB/T 7714—2025（顺序编码，双语）"), "2025");
  assert.equal(gbtEdition("China National Standard GB/T 7714-1987 (numeric, 中文)"), "1987");
  assert.equal(gbtEdition("Acta Physica Sinica (物理学报)"), null);
  assert.equal(useOf({ title: "GB/T 7714-2015 x" }, "被忽略"), "国家标准 GB/T 7714—2015");
  assert.equal(useOf({ title: "Some Journal" }, "期刊投稿:某刊"), "期刊投稿:某刊");
  assert.equal(useOf({ title: "Some Journal" }), null);
});

test("一览记录只有元数据:不带作者邮箱、不带任何样式规则;缺字段或不是中文就报错", () => {
  const e = entry();
  assert.equal(e.standard, "GB/T 7714—2015");
  assert.equal(e.use, "国家标准 GB/T 7714—2015");
  assert.equal(e.file, "https://github.com/citation-style-language/styles/blob/master/x.csl");
  assert.equal(e.page, "https://www.zotero.org/styles/?q=id%3Ax");
  assert.deepEqual(e.documentation, ["https://example.org/guide?a=1&b=2"]);
  const text = JSON.stringify(e);
  assert.ok(!text.includes("@example.org") && !text.includes("某作者"), "不收作者信息");
  assert.ok(!/macro|layout|names/.test(text), "不收样式规则");
  assert.throws(() => entry({ locale: ' default-locale="en-US"' }), /默认语言不是中文/);
  assert.throws(() => entry({ locale: "" }), /缺少 defaultLocale/);
  assert.throws(() => entry({ rights: "" }), /没有写许可/);
  assert.throws(() => entry({ title: "Some Journal (中文)" }), /说不出适用场景/);
  assert.equal(entry({ title: "Some Journal (中文)" }, { use: "期刊投稿:某刊" }).use, "期刊投稿:某刊");
  assert.throws(() => styleEntry(null, { source: "csl", path: "y.csl", page: "" }), /不是 CSL 样式文件/);
});

test("排序与校验:官方在前、按国标版本从新到旧;多字段、重复、非介绍页链接都不通过", () => {
  const a = entry({ id: "http://www.zotero.org/styles/a", title: "GB/T 7714-2015 a" });
  const b = entry({ id: "http://www.zotero.org/styles/b", title: "GB/T 7714-2025 b" });
  const c = { ...entry({ id: "https://zotero-chinese.com/styles/c", title: "GB/T 7714—2025 c" }), source: "zotero-chinese", page: "https://zotero-chinese.com/styles/c/", file: "https://github.com/zotero-chinese/styles/blob/main/src/c/c.csl" };
  assert.deepEqual(sortStyles([c, a, b]).map((s) => s.id), [b.id, a.id, c.id]);
  const idx = buildStylesIndex({ styles: [a, b, c], checkedAt: "2026-11-17", counts: { csl: 10, "zotero-chinese": 3 } });
  assert.deepEqual(validateStylesIndex(idx), []);
  assert.equal(idx.count, 3);
  assert.equal(idx.sources.find((s) => s.key === "zotero-chinese").styleCount, 3);
  const broken = { ...idx, styles: [...idx.styles, { ...a }, { ...b, id: "http://www.zotero.org/styles/z", extra: 1 }, { ...b, id: "http://www.zotero.org/styles/y", page: "https://www.zotero.org/styles/y" }, { ...b, id: "http://www.zotero.org/styles/w", license: { text: "<macro name=\"x\"/>", url: "x" } }] };
  const errs = validateStylesIndex(broken).join("\n");
  assert.match(errs, /count 与 styles 条数不一致/);
  assert.match(errs, /重复/);
  assert.match(errs, /多出字段 extra/);
  assert.match(errs, /page 不是样式库或社区仓库的介绍页/);
  assert.match(errs, /含有样式规则/);
  assert.throws(() => stylesFeed(broken), /引用样式一览校验失败/);
});

test("联网读取的流程:样式库索引里找不到或是从属样式就报错;社区仓库只收 GB-T-7714 开头的样式目录", async () => {
  const lib = OFFICIAL.map((o) => ({ name: o.name, dependent: 0 }));
  const zcTree = { truncated: false, tree: [
    { path: "src/GB-T-7714—2015（顺序编码，双语）", type: "tree" }, { path: "src/GB-T-7714—2015（顺序编码，双语）/GB-T-7714—2015（顺序编码，双语）.csl", type: "blob" },
    { path: "src/some-university", type: "tree" }, { path: "src/some-university/some-university.csl", type: "blob" },
    { path: "src/empty-dir", type: "tree" },
  ] };
  const fetchJson = async (u) => (u.includes("styles.json") ? lib : zcTree);
  const fetchText = async (u) => {
    if (u.includes("zotero-chinese")) return csl({ title: "GB/T 7714—2015（顺序编码，双语）", id: "https://zotero-chinese.com/styles/GB-T-7714—2015（顺序编码，双语）" });
    const name = decodeURIComponent(u.split("/").pop()).replace(/\.csl$/, "");
    const o = OFFICIAL.find((x) => x.name === name);
    return csl({ title: o.use ? `${name} (中文)` : `GB/T 7714-2015 ${name}`, id: `http://www.zotero.org/styles/${name}` });
  };
  const { styles, counts } = await collect({ fetchJson, fetchText });
  assert.equal(styles.length, OFFICIAL.length + 1);
  assert.deepEqual(counts, { csl: OFFICIAL.length, "zotero-chinese": 2 });
  const zc = styles.find((s) => s.source === "zotero-chinese");
  assert.match(zc.page, /^https:\/\/zotero-chinese\.com\/styles\/GB-T-7714%E2%80%942015.*\/$/);
  assert.deepEqual(validateStylesIndex(buildStylesIndex({ styles, checkedAt: "2026-11-17", counts })), []);
  await assert.rejects(collect({ fetchJson: async (u) => (u.includes("styles.json") ? lib.slice(1) : zcTree), fetchText }), /公开索引里没有/);
  await assert.rejects(collect({ fetchJson: async (u) => (u.includes("styles.json") ? lib.map((x) => ({ ...x, dependent: 1 })) : zcTree), fetchText }), /从属样式/);
  await assert.rejects(collect({ fetchJson: async (u) => (u.includes("styles.json") ? lib : { ...zcTree, truncated: true }), fetchText }), /被截断/);
});

test("已提交的一览:通过校验;每一条都有许可、介绍页与来源文件;官方名单全部在列", () => {
  const idx = JSON.parse(readFileSync(STYLES_FILE, "utf8"));
  assert.deepEqual(validateStylesIndex(idx), []);
  assert.ok(idx.count > 0);
  for (const o of OFFICIAL) assert.ok(idx.styles.some((s) => s.id === `http://www.zotero.org/styles/${o.name}`), o.name);
  for (const s of idx.styles) {
    assert.ok(s.license.url && s.license.text, s.id);
    assert.ok(!/\.csl($|\?)/.test(s.page), `介绍页不能是样式文件:${s.page}`);
  }
  assert.equal(stylesJson(idx), readFileSync(STYLES_FILE, "utf8"), "文件格式与脚本输出一致(两空格缩进、末尾换行)");
});

test("构建时写出 /data/styles.json:内容与已提交的一览相同;一览坏了就让构建失败", () => {
  const dir = mkdtempSync(join(tmpdir(), "styles-feed-"));
  const idx = writeStylesFeed(dir);
  assert.equal(readFileSync(join(dir, STYLES_FEED_FILE), "utf8"), readFileSync(STYLES_FILE, "utf8"));
  assert.equal(idx.schema, 1);
  const bad = join(dir, "bad.json");
  writeFileSync(bad, JSON.stringify({ ...idx, count: idx.count + 1 }));
  assert.throws(() => writeStylesFeed(dir, bad), /校验失败/);
});
