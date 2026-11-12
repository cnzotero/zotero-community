import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILD_DATE_ENV, buildDay, catalogOf, loadCatalog, readBuildDateMeta, stripBuildDateMeta } from "./catalog.ts";
import { build } from "./prerender.mjs";

const root = new URL("..", import.meta.url).pathname;
const TEMPLATE = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="cnzotero-build-date" content="2026-11-10"><title>t</title></head><body><div id="root"></div></body></html>`;
const xpi = (id) => [{ t: 10, v: "1.0", u: `https://github.com/${id}/releases/download/v1/a.xpi`, min: "7", max: "10.*" }];
const mk = (id, date, majors, o = {}) => ({
  id, name: id.toUpperCase(), summary: "s", category: "reading", author: id.split("/")[0], homepage: `https://github.com/${id}`, stars: 10, updated: date ?? "",
  zotero: majors ? { declared: true, majors } : { declared: false, majors: [] },
  ...(date ? { latest: { version: "1.0", date, releaseUrl: `https://github.com/${id}/releases/tag/v1` }, downloads: xpi(id) } : {}),
  ...o,
});
const DATA = {
  generatedAt: "2026-11-09",
  plugins: [
    mk("fresh/one", "2026-10-01", [7, 8, 9, 10]),
    mk("fresh/two", "2026-09-01", [10], { category: "notes" }),
    mk("old/stale", "2023-01-01", [7, 8, 9, 10]), // 超过 2 年
    mk("old/unadapted", "2025-06-01", [7, 8]), // 超过 1 年且没声明适配 10
    mk("none/pkg", null, [10], { category: "writing" }), // 没有安装包;它所在的分类因此变空
  ],
};

test("构建日期:环境变量里的合法日期优先,否则取当天(UTC);index.html 里的标记可读出、可去掉", () => {
  assert.equal(buildDay({ [BUILD_DATE_ENV]: "2026-01-02" }), "2026-01-02");
  assert.equal(buildDay({ [BUILD_DATE_ENV]: "bad" }), new Date().toISOString().slice(0, 10));
  assert.equal(buildDay({}), new Date().toISOString().slice(0, 10));
  assert.equal(readBuildDateMeta(TEMPLATE), "2026-11-10");
  assert.equal(readBuildDateMeta('<meta name="cnzotero-build-date" content="2026-11-10" />'), "2026-11-10");
  assert.equal(readBuildDateMeta("<head></head>"), null);
  assert.ok(!stripBuildDateMeta(TEMPLATE).includes("cnzotero-build-date"));
});

test("数据入口:按构建日期分出在架与下架,数量守恒", () => {
  const c = catalogOf(DATA, "2026-11-10");
  assert.deepEqual(c.listed.map((p) => p.id), ["fresh/one", "fresh/two"]);
  assert.deepEqual(c.delisted.map((d) => [d.plugin.id, d.reason]), [["old/stale", "stale-2y"], ["old/unadapted", "stale-1y-unadapted"], ["none/pkg", "stale-1y-no-package"]]);
  assert.equal(c.total, 5);
  assert.equal(c.currentMajor, 10);
  // 真实数据也守恒
  const real = loadCatalog("2026-11-10");
  assert.equal(real.listed.length + real.delisted.length, real.total);
});

test("管理下架覆盖作者全部插件:刷新或新版本不恢复,保留原始数据与下架日期,解除后重新判断", () => {
  const real = loadCatalog("2026-11-12");
  const targets = real.delisted.filter((d) => d.plugin.id.startsWith("l0o0/"));
  assert.deepEqual(targets.map((d) => d.plugin.id).sort(), [
    "l0o0/garden-for-zotero", "l0o0/jasminum", "l0o0/magiczotero", "l0o0/scholar-sketch", "l0o0/tara",
  ]);
  assert.ok(targets.every((d) => d.reason === "manual"));
  assert.ok(!real.listed.some((p) => p.id.startsWith("l0o0/")));
  const data = { generatedAt: "2026-11-12", plugins: [
    mk("L0O0/new-plugin", "2026-11-12", [10], { author: "Display name" }),
    mk("other/project", "2026-11-12", [10], { author: "L0O0" }),
    mk("other/untouched", "2026-11-12", [10]),
  ] };
  const before = structuredClone(data);
  const first = catalogOf(data, "2026-11-12");
  assert.deepEqual(first.listed.map((p) => p.id), ["other/untouched"]);
  assert.equal(first.delisted.length, 2);
  assert.equal(first.delisted[0].facts.lastRelease, "2026-11-12");
  assert.equal(first.delisted[0].facts.days, 0);
  const next = catalogOf(data, "2026-11-13", first.ledger);
  assert.ok(next.delisted.every((d) => next.ledger[d.plugin.id].since === "2026-11-12"));
  assert.ok(next.delistedData.records.every((r) => r.reason === "manual" && !JSON.stringify(r).includes(".xpi")));
  const restored = catalogOf(data, "2026-11-13", next.ledger, { authors: {} });
  assert.equal(restored.listed.length, 3);
  assert.deepEqual(restored.ledger, {});
  assert.deepEqual(data, before);
});

test("下架的插件从全站消失:没有详情页、不进 sitemap、不进分类页与版本页,空分类不生成页面", async () => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  const c = catalogOf(DATA, "2026-11-10");
  const entries = await build(dir, c.listed, "2026-11-10", [], { dateOf: () => null, generatedAt: c.generatedAt, delisted: c.delistedData });
  const sm = readFileSync(join(dir, "sitemap.xml"), "utf8");
  for (const id of ["old/stale", "old/unadapted", "none/pkg"]) {
    assert.ok(!existsSync(join(dir, "plugins", id, "index.html")), id);
    assert.ok(!sm.includes(`/plugins/${id}<`), id);
  }
  // 在架数 = 详情页数 = sitemap 里的插件条数
  const pluginEntries = entries.filter((e) => /^\/plugins\/[^/]+\/[^/]+$/.test(e.path));
  assert.equal(pluginEntries.length, c.listed.length);
  assert.equal((sm.match(/<loc>https:\/\/zoterocn\.org\/plugins\/[^/<]+\/[^/<]+<\/loc>/g) ?? []).length, c.listed.length);
  // 下架插件不出现在任何页面里
  const all = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".html") || f.endsWith(".txt") || f.endsWith(".xml")) all.push(p); } };
  walk(dir);
  for (const f of all) for (const id of ["old/stale", "old/unadapted", "none/pkg"]) assert.ok(!readFileSync(f, "utf8").includes(`/plugins/${id}`), `${f} 链到了下架插件 ${id}`);
  // 下架插件的安装包地址不出现在任何页面里
  for (const f of all) for (const id of ["old/stale", "old/unadapted"]) assert.ok(!readFileSync(f, "utf8").includes(`${id}/releases/download`), `${f} 含有下架插件 ${id} 的下载地址`);
  // 「writing」分类只有一个下架插件:不生成空页;版本页的款数只算在架的
  assert.ok(!existsSync(join(dir, "categories/writing/index.html")));
  assert.match(readFileSync(join(dir, "compat/zotero-7/index.html"), "utf8"), /<title>Zotero 7 兼容的插件\(1 款\)/);
  assert.match(readFileSync(join(dir, "plugins/index.html"), "utf8"), /收录 <b>2<\/b> 款/);
  // 构建日期标记不出现在静态页面里
  assert.ok(!readFileSync(join(dir, "index.html"), "utf8").includes("cnzotero-build-date"));
});

test("下架记录页:完整正文进静态页面、noindex、不进 sitemap 与 llms.txt;列出原因与日期,没有下载按钮", async () => {
  const dir = mkdtempSync(join(tmpdir(), "delisted-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  const c = catalogOf(DATA, "2026-11-10", { "old/stale": { since: "2026-10-01", reason: "stale-2y" }, "gone/back": { since: "2026-01-01", reason: "stale-2y" } });
  // 台账:沿用旧日期、新下架记当天、已不在下架名单里的删除
  assert.deepEqual(c.ledger, { "old/stale": { since: "2026-10-01", reason: "stale-2y" }, "old/unadapted": { since: "2026-11-10", reason: "stale-1y-unadapted" }, "none/pkg": { since: "2026-11-10", reason: "stale-1y-no-package" } });
  const entries = await build(dir, c.listed, "2026-11-10", [], { dateOf: () => null, generatedAt: c.generatedAt, delisted: c.delistedData });
  const html = readFileSync(join(dir, "delisted/index.html"), "utf8");
  assert.match(html, /<meta name="robots" content="noindex,follow" \/>/);
  assert.match(html, /<title>已下架插件与原因｜Zotero 中文社区<\/title>/);
  assert.match(html, /<div id="root" data-ssr="\/delisted" data-now="2026-11-10">/);
  assert.match(html, /<h1 class="page-title">已下架插件与原因<\/h1>/);
  for (const h of ["判断口径", "如何恢复", "已下架的插件"]) assert.ok(html.includes(`<h2>${h}</h2>`), h);
  assert.match(html, /目前共 <!-- -->3<!-- --> 款插件下架,在架 <!-- -->2<!-- --> 款/);
  for (const name of ["OLD/STALE", "OLD/UNADAPTED", "NONE/PKG"]) assert.ok(html.includes(`<b>${name}</b>`), name);
  assert.match(html, /最近一次发布于 2023-01-01,距今超过 2 年/);
  assert.match(html, /下架日期:<!-- -->2026-10-01/); // 台账里的旧日期
  assert.match(html, /href="https:\/\/github\.com\/old\/stale" target="_blank" rel="noopener noreferrer"/);
  assert.ok(!/href="[^"]*(\.xpi|releases\/download)[^"]*"/.test(html), "下架记录页不提供下载");
  assert.ok(!html.includes("btn-download") && !/<a[^>]*>[^<]*下载/.test(html), "下架记录页没有下载按钮");
  assert.ok(!entries.some((e) => e.path === "/delisted"));
  assert.ok(!readFileSync(join(dir, "sitemap.xml"), "utf8").includes("/delisted"));
  assert.ok(!readFileSync(join(dir, "llms.txt"), "utf8").includes("/delisted"));
  // 页脚不放下架记录页的入口
  assert.ok(!/<footer[\s\S]*href="\/delisted"/.test(readFileSync(join(dir, "index.html"), "utf8")));
});

test("收录规则:第 3 章写明三条自动下架条件、恢复自动、链到下架记录;数量由数据算出;不再说标签不会让插件被隐藏", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rules-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  const c = catalogOf(DATA, "2026-11-10");
  await build(dir, c.listed, "2026-11-10", [], { dateOf: () => null, generatedAt: c.generatedAt, delisted: c.delistedData });
  const html = readFileSync(join(dir, "rules/index.html"), "utf8");
  const text = html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");
  for (const t of ["超过 1 年未发布,且没有可下载的安装包:", "最近一次发布超过 2 年:", "超过 1 年未发布,且未声明适配当前 Zotero 版本:", "恢复是自动的:"]) assert.ok(text.includes(t), t);
  assert.ok(text.includes("(目前是 Zotero 10)"));
  assert.ok(text.includes("目前在架 2 款,已下架 3 款。"));
  assert.match(html, /<a href="\/delisted"[^>]*>已下架插件与原因<\/a>/);
  assert.ok(text.includes("标签只是提示;是否下架只看第 3 章写明的条件。"));
  assert.ok(!text.includes("不会让任何插件被隐藏"));
  assert.ok(!text.includes("长期未更新的插件仍会收录"));
  // llms.txt 说明只计在架插件,但不链到下架记录页
  const llms = readFileSync(join(dir, "llms.txt"), "utf8");
  assert.match(llms, /只列出在架的插件/);
  assert.ok(!llms.includes("/delisted"));
});

test("近 1 年内有发布但数据里缺安装包的插件仍在架:详情页只给仓库链接,没有下载按钮,兼容范围显示未声明", async () => {
  const recent = mk("recent/nopkg", null, null, { updated: "2026-10-20", cadence: { r12: 1, days12: 1, monthly: [], medianDays: null, last: "2026-10-20" } });
  const c = catalogOf({ generatedAt: "2026-11-09", plugins: [...DATA.plugins, recent] }, "2026-11-10");
  assert.ok(c.listed.some((p) => p.id === "recent/nopkg"));
  assert.equal(c.delisted.length, 3);
  const dir = mkdtempSync(join(tmpdir(), "nopkg-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  await build(dir, c.listed, "2026-11-10", [], { dateOf: () => null, generatedAt: c.generatedAt, delisted: c.delistedData });
  const html = readFileSync(join(dir, "plugins/recent/nopkg/index.html"), "utf8");
  const main = /<main class="container">([\s\S]*)<\/main>/.exec(html)[1];
  const head = /<header class="detail-head">[\s\S]*?<\/header>/.exec(main)[0];
  const box = /<section class="download"[\s\S]*?<\/section>/.exec(main)[0];
  for (const part of [head, box]) {
    assert.ok(!/href="[^"]*\.xpi"/.test(part), "没有安装包地址");
    assert.ok(!/下载 v/.test(part), "没有空的下载按钮");
  }
  assert.match(head, /GitHub 仓库/);
  assert.ok(!box.includes('aria-label="选择 Zotero 版本"'), "不显示版本选择");
  assert.match(main, /本站暂未收录这个插件的安装包/);
  assert.match(main, /href="https:\/\/github\.com\/recent\/nopkg" target="_blank" rel="noopener noreferrer"/);
  assert.match(main, /兼容范围未声明/);
  assert.ok(!readFileSync(join(dir, "delisted/index.html"), "utf8").includes("RECENT/NOPKG"));
});

test("只有一个数据入口:页面代码与预渲染都不直接读取插件原始数据", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|mjs)$/.test(f) && !/\.test\./.test(f)) files.push(p); } };
  walk(join(root, "src"));
  walk(join(root, "scripts"));
  files.push(join(root, "vite.config.ts"));
  const readers = files.filter((f) => readFileSync(f, "utf8").includes("plugins.json")).map((f) => f.slice(root.length));
  // 刷新脚本负责写数据;catalog.ts 是唯一的读取入口。
  // import-addon-ids.mjs 只在上游目录的地址里出现这个文件名(上游的文件也叫 plugins.json),本站数据仍经 catalog.ts 读取
  assert.deepEqual(readers.sort(), ["scripts/catalog.ts", "scripts/import-addon-ids.mjs", "scripts/refresh-plugins.mjs"]);
  const importer = readFileSync(join(root, "scripts/import-addon-ids.mjs"), "utf8");
  assert.deepEqual(importer.match(/[^\s"'`]*plugins\.json/g), ["https://raw.githubusercontent.com/zotero-chinese/zotero-plugins/gh-pages/plugins.json"]);
  assert.match(importer, /import \{ PLUGINS_FILE \} from "\.\/catalog\.ts"/);
});
