import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertExternalLinks, bestDownload, build, computeLedger, esc, ld, loadArticleSources, loadArticles, pluginPrint, robotsTxt, sitemapXml, ssrModule, updateLedger,
} from "./prerender.mjs";
import { CATEGORIES } from "../src/plugins/lib.ts";
import { STATIC_PAGES } from "../src/seo/pages.ts";
import { STYLE_LINKS, STYLE_SOURCE_LIST } from "../src/content/styles.ts";

const TEMPLATE = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="description" content="旧描述" /><meta property="og:title" content="旧" /><title>旧标题</title></head><body><div id="root"></div><script type="module" src="/x.js"></script></body></html>`;
const PLUGINS = [
  { id: "a/evil", name: 'Evil <script>alert(1)</script> & "q"', summary: "简介 </script><img src=x onerror=1>", category: "reading", author: "a", homepage: "https://github.com/a/evil", stars: 1200, updated: "2026-11-01", zotero: { declared: true, majors: [7, 8, 9, 10] }, latest: { version: "1.0", date: "2026-11-01", releaseUrl: "https://github.com/a/evil/releases/tag/v1" }, downloads: [{ t: 10, v: "1.0", u: "https://github.com/a/evil/releases/download/v1/e.xpi", min: "7", max: "10" }] },
  { id: "b/plain", name: "Plain", summary: "普通插件", category: "ai", author: "b", homepage: "https://github.com/b/plain", stars: 3, updated: "", zotero: { declared: false, majors: [] } },
  { id: "c/read", name: "Reader Two", summary: "第二个阅读插件", category: "reading", author: "c", homepage: "https://github.com/c/read", stars: 50, updated: "2026-10-01", zotero: { declared: true, majors: [7] } },
];
const GUIDES_DIR = new URL("../src/content/guides", import.meta.url).pathname;
const ARTICLES = loadArticles(GUIDES_DIR);
const noGit = () => null;

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "prerender-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  return dir;
}

async function run(plugins = PLUGINS, articles = []) {
  const dir = tmp();
  const entries = await build(dir, plugins, "2026-11-10", articles, { dateOf: noGit });
  return { dir, entries };
}

const read = (dir, path) => readFileSync(path === "/" ? join(dir, "index.html") : join(dir, path, "index.html"), "utf8");
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const h1s = (html) => [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<!-- -->/g, "").replace(/<[^>]+>/g, ""));

test("转义:特殊字符不会破坏 HTML,也不会逃出 JSON-LD 的 script", async () => {
  assert.equal(esc('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
  assert.ok(!ld({ a: "</script><script>alert(1)" }).slice(10, -9).includes("</script>"));
  const { dir } = await run();
  const html = read(dir, "/plugins/a/evil");
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(!/<img src=x onerror/.test(html));
  assert.match(html, /Evil &lt;script&gt;/);
  assert.ok(jsonLd(html).some((j) => j["@type"] === "SoftwareApplication" && j.name.includes("Evil")));
});

test("每页都有唯一的标题、描述、规范链接,且旧标签被替换而不是重复", async () => {
  const { dir, entries } = await run();
  const titles = new Set();
  for (const e of entries) {
    const file = e.path === "/" ? join(dir, "index.html") : join(dir, e.path, "index.html");
    assert.ok(existsSync(file), e.path);
    const html = readFileSync(file, "utf8");
    assert.equal((html.match(/<title>/g) ?? []).length, 1, `${e.path} title 数量`);
    assert.equal((html.match(/name="description"/g) ?? []).length, 1);
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
    assert.ok(!html.includes("旧标题") && !html.includes("旧描述"));
    assert.match(html, new RegExp(`rel="canonical" href="https://zoterocn.org${e.path === "/" ? "/" : e.path}"`));
    titles.add(html.match(/<title>([^<]*)<\/title>/)[1]);
  }
  assert.equal(titles.size, entries.length, "标题必须各不相同");
});

test("静态页面就是真正渲染的完整页面:页头导航、页脚、唯一且与页面一致的 h1,脚本标签保留", async () => {
  const { dir } = await run(PLUGINS, ARTICLES);
  const pages = [...STATIC_PAGES.map((m) => [m.path, m.h1]), ["/plugins/a/evil", PLUGINS[0].name], ["/categories/reading", "Zotero 阅读插件"], ["/compat/zotero-7", "Zotero 7 兼容的插件"], [`/guides/${ARTICLES[0].slug}`, ARTICLES[0].title]];
  for (const [path, h1] of pages) {
    const html = read(dir, path);
    assert.match(html, new RegExp(`<div id="root" data-ssr="${path.replace(/\//g, "\\/")}" data-now="2026-11-10"><header class="topbar">`), path);
    assert.match(html, /<nav aria-label="主导航"[\s\S]*href="\/guides"[\s\S]*href="\/plugins"/, `${path} 页头导航`);
    assert.match(html, /<nav aria-label="页脚导航"[\s\S]*href="\/rules"[\s\S]*href="\/about"/, `${path} 页脚链接`);
    assert.deepEqual(h1s(html), [h1.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")], `${path} 的 h1`);
    assert.match(html, /<script type="module" src="\/x\.js">/);
  }
  // 栏目页正文是完整内容,不是一句话
  assert.match(read(dir, "/rules"), /<h2>8\. 免责声明<\/h2>/);
  assert.match(read(dir, "/about"), /<h2>参与和反馈<\/h2>/);
  // 期刊查询不在构建时请求数据:只输出搜索框外壳与说明文字
  const journals = read(dir, "/journals");
  assert.match(journals, /aria-label="搜索期刊"/);
  assert.match(journals, /输入至少 2 个字符开始查询/);
});

test("内链:插件广场链接全部插件,首页链接全部分类,详情页有分类、相关插件与三级面包屑", async () => {
  const { dir } = await run();
  const list = read(dir, "/plugins");
  for (const p of PLUGINS) assert.ok(list.includes(`href="/plugins/${p.id}"`), p.id);
  const home = read(dir, "/");
  for (const c of CATEGORIES) assert.ok(home.includes(`href="/categories/${c.key}"`), c.key);
  const detail = read(dir, "/plugins/a/evil");
  assert.match(detail, /<nav aria-label="面包屑" class="crumbs"><a href="\/">首页<\/a>[\s\S]*?<a href="\/categories\/reading">[\s\S]*?<span aria-current="page">Evil &lt;script&gt;/);
  assert.match(detail, /<h2>相关插件<\/h2>[\s\S]*href="\/plugins\/c\/read"/); // 同分类的相关插件
  assert.ok(!detail.includes('href="/plugins/b/plain"')); // 别的分类不算相关
  const bc = jsonLd(detail).find((j) => j["@type"] === "BreadcrumbList");
  assert.deepEqual(bc.itemListElement.map((x) => x.item), ["https://zoterocn.org/", "https://zoterocn.org/categories/reading", "https://zoterocn.org/plugins/a/evil"]);
});

test("sitemap 与 robots", async () => {
  const { dir, entries } = await run();
  const sm = readFileSync(join(dir, "sitemap.xml"), "utf8");
  assert.equal((sm.match(/<loc>/g) ?? []).length, entries.length);
  assert.match(sm, /<loc>https:\/\/zoterocn\.org\/plugins\/a\/evil<\/loc><lastmod>2026-11-01<\/lastmod>/);
  assert.match(sm, /<loc>https:\/\/zoterocn\.org\/plugins\/b\/plain<\/loc><lastmod>2026-11-10<\/lastmod>/); // 没有更新日期就用今天
  assert.equal(sitemapXml([{ path: "/x&y" }]).includes("/x&amp;y"), true);
  assert.match(readFileSync(join(dir, "robots.txt"), "utf8"), /Disallow: \/api\/[\s\S]*Sitemap: https:\/\/zoterocn\.org\/sitemap\.xml/);
  assert.match(robotsTxt(), /User-agent: \*/);
});

test("筹备中的占位页:带 noindex、不进 sitemap 与 llms.txt;其它栏目页照常收录", async () => {
  const { dir, entries } = await run();
  const sm = readFileSync(join(dir, "sitemap.xml"), "utf8");
  const llms = readFileSync(join(dir, "llms.txt"), "utf8");
  for (const path of ["/forum", "/submission"]) {
    assert.match(read(dir, path), /<meta name="robots" content="noindex,follow" \/>/, path);
    assert.ok(!entries.some((e) => e.path === path));
    assert.ok(!sm.includes(`zoterocn.org${path}<`));
    assert.ok(!llms.includes(`zoterocn.org${path})`));
  }
  for (const path of ["/", "/plugins", "/rules", "/about", "/styles", "/guides", "/journals"]) {
    assert.match(read(dir, path), /<meta name="robots" content="index,follow/, path);
    assert.ok(entries.some((e) => e.path === path), path);
  }
});

test("同名不同作者的插件:标题加作者区分,页面标题不重复", async () => {
  const mk = (id) => ({ id, name: "Same Name", summary: "s", category: "ai", author: "x", homepage: "https://github.com/" + id, stars: 1, updated: "2026-11-01", zotero: { declared: false, majors: [] } });
  const { dir } = await run([mk("alice/same"), mk("bob/same"), { ...mk("carol/other"), name: "Other" }]);
  const t = (p) => readFileSync(join(dir, "plugins", p, "index.html"), "utf8").match(/<title>([^<]*)<\/title>/)[1];
  assert.match(t("alice/same"), /^Same Name\(alice\/same\)｜/);
  assert.match(t("bob/same"), /^Same Name\(bob\/same\)｜/);
  assert.ok(!t("carol/other").includes("(")); // 不重名的不加
  // 同一作者的两个同名插件也能区分
  const r2 = await run([mk("alice/one"), mk("alice/two")]);
  const t2 = (p) => readFileSync(join(r2.dir, "plugins", p, "index.html"), "utf8").match(/<title>([^<]*)<\/title>/)[1];
  assert.notEqual(t2("alice/one"), t2("alice/two"));
});

test("结构化数据:都能解析;插件不标成浏览器应用、不写价格;没有安装包的不写下载地址", async () => {
  const { dir, entries } = await run(PLUGINS, ARTICLES);
  for (const e of entries) for (const j of jsonLd(read(dir, e.path))) assert.equal(typeof j["@type"], "string", e.path);
  const app = jsonLd(read(dir, "/plugins/a/evil")).find((j) => j["@type"] === "SoftwareApplication");
  assert.notEqual(app.applicationCategory, "BrowserApplication");
  assert.ok(!("offers" in app));
  assert.ok(!read(dir, "/plugins/b/plain").includes("downloadUrl"));
});

test("教程文章:全文进入静态页面、带作者与日期的 TechArticle、显示发布与更新日期、进入 sitemap", async () => {
  const { dir, entries } = await run([], ARTICLES);
  for (const a of ARTICLES) {
    const path = `/guides/${a.slug}`;
    assert.ok(entries.some((e) => e.path === path));
    const html = read(dir, path);
    assert.match(html, /<h2>[^<]+<\/h2>/);
    assert.match(html, new RegExp(`发布于 <time dateTime="${a.published}">`));
    assert.match(html, new RegExp(`更新于 <time dateTime="${a.updated}">`));
    const art = jsonLd(html).find((j) => j["@type"] === "TechArticle");
    assert.deepEqual(art.author, { "@type": "Organization", name: "Zotero 中文社区", url: "https://zoterocn.org/" });
    assert.equal(art.datePublished, a.published);
    assert.equal(art.dateModified, a.updated);
    for (const m of html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g)) assert.match(m[0], /rel="noopener noreferrer"/);
  }
  // /guides 列表页里带有文章链接,方便爬虫发现
  for (const a of ARTICLES) assert.match(read(dir, "/guides"), new RegExp(`href="/guides/${a.slug}"`));
});

test("真实教程目录能被预渲染读取", () => {
  assert.ok(ARTICLES.length >= 5);
  assert.deepEqual(ARTICLES.map((a) => a.order), ARTICLES.map((a) => a.order).sort((a, b) => a - b));
  for (const a of ARTICLES) assert.ok(a.published && a.updated && a.published <= a.updated, a.slug);
});

test("预渲染页面里所有外链都新标签打开;下载链接和「最新版本」指向同一个兼容包,不会拿旧包充数", async () => {
  const p = {
    id: "w/tr", name: "Tr", summary: "s", category: "reading", author: "w", homepage: "https://github.com/w/tr", stars: 5, updated: "2026-10-03",
    zotero: { declared: true, majors: [7, 8, 9, 10] },
    latest: { version: "2.4.8", date: "2026-10-03", releaseUrl: "https://github.com/w/tr/releases/tag/v2.4.8" },
    downloads: [
      { t: 7, v: "2.3.16", u: "https://github.com/w/tr/releases/download/v2.3.16/t.xpi", min: "6.9.9", max: "8.0.*" },
      { t: 10, v: "2.4.8", u: "https://github.com/w/tr/releases/download/v2.4.8/t.xpi", min: "7.9.9", max: "10.9.9" },
    ],
  };
  assert.equal(bestDownload(p).v, "2.4.8");
  assert.equal(bestDownload(p).major, 10);
  assert.equal(bestDownload({ ...p, downloads: [] }), null);
  const { dir, entries } = await run([p], ARTICLES);
  for (const e of entries) {
    for (const m of read(dir, e.path).matchAll(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g)) {
      assert.match(m[0], /target="_blank"/, `${e.path}: ${m[0]}`);
      assert.match(m[0], /rel="noopener noreferrer"/, `${e.path}: ${m[0]}`);
    }
  }
  const html = read(dir, "/plugins/w/tr");
  assert.match(html, /<dt>最新版本<\/dt><dd>v2\.4\.8<\/dd>/); // 事实表里的最新版本
  assert.match(html, /<dt>发布日期<\/dt><dd[^>]*>2026-10-03/);
  assert.match(html, /releases\/download\/v2\.4\.8\/t\.xpi/); // 下载链接是同一个版本
  assert.ok(!html.includes("v2.3.16"));
  assert.match(html, /"downloadUrl":"https:\/\/github\.com\/w\/tr\/releases\/download\/v2\.4\.8/);
});

test("构建期保险:漏掉新标签属性的外链会让构建失败", () => {
  assert.doesNotThrow(() => assertExternalLinks('<a href="https://a.com" target="_blank" rel="noopener noreferrer">x</a><a href="/plugins">内链</a>', "t"));
  assert.throws(() => assertExternalLinks('<a href="https://github.com/x">x</a>', "t"), /target=_blank/);
  assert.throws(() => assertExternalLinks('<a href="https://a.com" target="_blank">x</a>', "t"), /noopener/);
});

test("分类落地页:每个有插件的分类一页、进 sitemap;404 页面禁止收录且不进 sitemap", async () => {
  const { dir, entries } = await run();
  assert.ok(entries.some((e) => e.path === "/categories/reading"));
  assert.ok(entries.some((e) => e.path === "/categories/ai"));
  assert.ok(!entries.some((e) => e.path === "/categories/notes")); // 没有插件的分类不生成空页
  const html = read(dir, "/categories/reading");
  assert.match(html, /<h1 class="page-title">Zotero 阅读插件<\/h1>/);
  // 标题里的数量来自数据;只有 2 款不叫「大全」;结构化数据的名称与 h1 一致
  assert.match(html, /<title>Zotero 阅读插件\(2 款\):用途、适配版本与下载<\/title>/);
  const coll = jsonLd(html).find((j) => j["@type"] === "CollectionPage");
  assert.equal(coll.name, "Zotero 阅读插件");
  assert.equal(coll.mainEntity.numberOfItems, 2);
  assert.equal(jsonLd(html).find((j) => j["@type"] === "BreadcrumbList").itemListElement[2].name, "Zotero 阅读插件");
  assert.match(html, /href="\/plugins\/a\/evil"/);
  assert.match(html, /href="\/plugins\/c\/read"/);
  assert.ok(!html.includes("b/plain")); // 别的分类的插件不会混进来
  assert.match(html, /"@type":"CollectionPage"/);
  assert.match(html, /"@type":"ItemList"/);
  const nf = readFileSync(join(dir, "404.html"), "utf8");
  assert.match(nf, /noindex/);
  assert.match(nf, /页面不存在/);
  assert.ok(!readFileSync(join(dir, "sitemap.xml"), "utf8").includes("/404"));
});

test("版本兼容页:只为有插件声明的大版本生成,成员即声明支持的插件,进 sitemap、llms.txt,首页、插件广场与详情页都能链到", async () => {
  const { dir, entries } = await run();
  const sm = readFileSync(join(dir, "sitemap.xml"), "utf8");
  const llms = readFileSync(join(dir, "llms.txt"), "utf8");
  // a/evil 声明 7–10,c/read 只声明 7,b/plain 未声明:7 有两款,8–10 各一款,其它版本不生成
  const expect = { 7: ["a/evil", "c/read"], 8: ["a/evil"], 9: ["a/evil"], 10: ["a/evil"] };
  for (const [major, ids] of Object.entries(expect)) {
    const path = `/compat/zotero-${major}`;
    assert.ok(entries.some((e) => e.path === path), path);
    assert.ok(sm.includes(`<loc>https://zoterocn.org${path}</loc>`), path);
    assert.ok(llms.includes(`(https://zoterocn.org${path})`), path);
    const html = read(dir, path);
    assert.match(html, new RegExp(`<title>Zotero ${major} 兼容的插件\\(${ids.length} 款\\):适配范围与下载</title>`));
    assert.deepEqual(h1s(html), [`Zotero ${major} 兼容的插件`]);
    assert.match(html, /以各插件在公开发布说明中声明的适配范围为准,未声明的不计入。/);
    for (const id of ids) assert.ok(html.includes(`href="/plugins/${id}"`), `${path} 缺 ${id}`);
    assert.ok(!html.includes('href="/plugins/b/plain"'), "未声明的插件不计入");
    const list = jsonLd(html).find((j) => j["@type"] === "CollectionPage").mainEntity;
    assert.equal(list.numberOfItems, ids.length);
    assert.deepEqual(list.itemListElement.map((x) => x.url.replace("https://zoterocn.org/plugins/", "")), ids);
    const bc = jsonLd(html).find((j) => j["@type"] === "BreadcrumbList");
    assert.deepEqual(bc.itemListElement.map((x) => x.name), ["首页", `Zotero ${major} 兼容的插件`]);
    assert.match(html, /<nav aria-label="面包屑" class="crumbs"><a href="\/">首页<\/a>[\s\S]*?<span aria-current="page">Zotero \d+ 兼容的插件<\/span>/);
  }
  // 没有插件声明的版本不生成空页
  assert.ok(!entries.some((e) => e.path.startsWith("/compat/") && !(e.path.replace("/compat/zotero-", "") in expect)));
  assert.ok(!existsSync(join(dir, "compat/zotero-6/index.html")));
  // 内链:首页、插件广场链到每个版本页;详情页只链该插件声明过的版本
  for (const major of Object.keys(expect)) {
    assert.ok(read(dir, "/").includes(`href="/compat/zotero-${major}"`), `首页缺 ${major}`);
    assert.ok(read(dir, "/plugins").includes(`href="/compat/zotero-${major}"`), `插件广场缺 ${major}`);
    assert.ok(read(dir, "/plugins/a/evil").includes(`href="/compat/zotero-${major}"`));
  }
  const reader = read(dir, "/plugins/c/read");
  assert.ok(reader.includes('href="/compat/zotero-7"'));
  assert.ok(!/href="\/compat\/zotero-(8|9|10)"/.test(reader.replace(/<footer[\s\S]*$/, "")));
  assert.ok(!read(dir, "/plugins/b/plain").includes('href="/compat/'));
});

test("引用样式页:正文完整、每段注明来源、外链都新标签打开并带 noopener,结构化数据只引用页面上出现的来源", async () => {
  const { dir } = await run();
  const html = read(dir, "/styles");
  assert.deepEqual(h1s(html), ["Zotero 引用样式"]);
  for (const h of ["1. 引用样式是什么", "2. 在 Zotero 里添加样式", "3. 在 Word 和 LibreOffice 里选择样式", "4. 中文样式(GB/T 7714 等)", "5. 样式不对怎么办,投稿前核对什么"]) assert.ok(html.includes(`<h2>${h}</h2>`), h);
  assert.ok(!html.includes("正在整理中"), "占位文案已移除");
  assert.match(html, /投稿前以目标期刊的最新要求为准/);
  assert.match(html, /核对日期:2026-11-10/); // 构建日期
  assert.equal((html.match(/<p class="source-line">来源:/g) ?? []).length, 5, "每段末尾都有来源");
  const main = /<main class="container">([\s\S]*)<\/main>/.exec(html)[1];
  const ext = [...main.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]*)"[^>]*>/g)];
  assert.ok(ext.length >= STYLE_SOURCE_LIST.length);
  for (const m of ext) {
    assert.match(m[0], /target="_blank"/, m[0]);
    assert.match(m[0], /rel="noopener noreferrer"/, m[0]);
  }
  const hrefs = new Set(ext.map((m) => m[1]));
  for (const s of STYLE_SOURCE_LIST) assert.ok(hrefs.has(s.url), `来源未出现在页面上:${s.url}`);
  for (const u of Object.values(STYLE_LINKS)) assert.ok(hrefs.has(u), u);
  // 不托管、不直链任何样式文件
  assert.ok(![...hrefs].some((u) => /\.csl($|\?)/.test(u)));
  const art = jsonLd(html).find((j) => j["@type"] === "TechArticle");
  assert.equal(art.headline, "Zotero 引用样式");
  for (const c of art.citation) assert.ok(hrefs.has(c), `结构化数据引用了页面上没有的来源:${c}`);
  assert.deepEqual(jsonLd(html).find((j) => j["@type"] === "BreadcrumbList").itemListElement.map((x) => x.name), ["首页", "Zotero 引用样式"]);
});

test("llms.txt:站点介绍、主要栏目、全部分类与教程,链接都指向可收录页面,不逐个列插件", async () => {
  const { dir, entries } = await run(PLUGINS, ARTICLES);
  const llms = readFileSync(join(dir, "llms.txt"), "utf8");
  assert.match(llms, /^# Zotero 中文社区\n\n> /);
  const links = [...llms.matchAll(/\]\((https:\/\/zoterocn\.org[^)]*)\)/g)].map((m) => m[1].replace("https://zoterocn.org", "") || "/");
  const listed = new Set(entries.map((e) => e.path));
  for (const l of links) assert.ok(listed.has(l), `llms.txt 链接到了不可收录的页面:${l}`);
  for (const a of ARTICLES) assert.ok(links.includes(`/guides/${a.slug}`));
  assert.ok(links.includes("/categories/reading") && links.includes("/categories/ai"));
  assert.ok(!links.some((l) => l.startsWith("/plugins/") && l !== "/plugins/charts"));
});

// ---------- 内容指纹台账 ----------

test("台账:指纹不变沿用旧日期,变了才写当天;新页面用首次日期;已删除的页面移除", () => {
  const old = { "/a": { hash: "h1", lastmod: "2026-01-01" }, "/b": { hash: "h2", lastmod: "2026-02-02" }, "/gone": { hash: "x", lastmod: "2025-01-01" } };
  const prints = new Map([["/a", { hash: "h1", initial: "2020-01-01" }], ["/b", { hash: "h2-new", initial: null }], ["/c", { hash: "h3", initial: "2026-03-03" }], ["/d", { hash: "h4", initial: null }]]);
  assert.deepEqual(updateLedger(old, prints, "2026-11-10"), {
    "/a": { hash: "h1", lastmod: "2026-01-01" },
    "/b": { hash: "h2-new", lastmod: "2026-11-10" },
    "/c": { hash: "h3", lastmod: "2026-03-03" },
    "/d": { hash: "h4", lastmod: "2026-11-10" },
  });
});

test("插件页指纹只看有意义的内容:星标、下载、发布节奏变化不改日期,版本变化才改", () => {
  const p = PLUGINS[0];
  assert.equal(pluginPrint({ ...p, stars: 99999, dl: { total: 5, at: "2026-11-10" }, cadence: { r12: 3, monthly: [], medianDays: 1, last: "x" }, issues: 7 }), pluginPrint(p));
  assert.notEqual(pluginPrint({ ...p, latest: { ...p.latest, version: "1.1" } }), pluginPrint(p));
  assert.notEqual(pluginPrint({ ...p, summary: "新简介" }), pluginPrint(p));
});

test("连续两次构建台账与 sitemap 零变化;只改一篇教程时只有那一页日期变", async () => {
  const { prepare } = await ssrModule();
  const sources = loadArticleSources(GUIDES_DIR);
  const day1 = await computeLedger({ plugins: PLUGINS, articleSources: sources, today: "2026-11-10", prepare, old: {}, dateOf: noGit });
  // 第二天数据只有星标变化:台账不变
  const busier = PLUGINS.map((p) => ({ ...p, stars: p.stars + 100, dl: { total: 9, at: "2026-11-11" } }));
  const day2 = await computeLedger({ plugins: busier, articleSources: sources, today: "2026-11-11", prepare, old: day1.ledger, dateOf: noGit });
  assert.deepEqual(day2.ledger, day1.ledger);
  // 改一篇教程:只有那一页日期变
  const edited = sources.map((s, i) => (i === 1 ? { ...s, raw: s.raw + "\n补充一段。\n" } : s));
  const day3 = await computeLedger({ plugins: busier, articleSources: edited, today: "2026-11-12", prepare, old: day2.ledger, dateOf: noGit });
  const changed = Object.keys(day3.ledger).filter((k) => day3.ledger[k].lastmod !== day2.ledger[k].lastmod);
  assert.deepEqual(changed, [`/guides/${sources[1].article.slug}`]);
  assert.equal(day3.ledger[changed[0]].lastmod, "2026-11-12");
  // 分类成员变化只影响该分类页(以及列出全部插件的栏目页)
  const moved = busier.map((p) => (p.id === "c/read" ? { ...p, category: "ai" } : p));
  const day4 = await computeLedger({ plugins: moved, articleSources: edited, today: "2026-11-13", prepare, old: day3.ledger, dateOf: noGit });
  const changed4 = Object.keys(day4.ledger).filter((k) => day4.ledger[k].lastmod !== day3.ledger[k].lastmod);
  assert.ok(changed4.includes("/categories/ai") && changed4.includes("/categories/reading") && changed4.includes("/plugins/c/read"));
  assert.ok(!changed4.some((k) => k.startsWith("/guides") || k === "/rules" || k === "/about" || k === "/plugins/a/evil"));
});

test("构建写出的台账再构建一次不变,sitemap 也不变", async () => {
  const dir = tmp();
  const ledgerFile = join(dir, "lastmod.json");
  await build(dir, PLUGINS, "2026-11-10", ARTICLES, { dateOf: noGit, ledgerFile });
  const l1 = readFileSync(ledgerFile, "utf8");
  const s1 = readFileSync(join(dir, "sitemap.xml"), "utf8");
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  await build(dir, PLUGINS.map((p) => ({ ...p, stars: p.stars + 1 })), "2026-11-11", ARTICLES, { dateOf: noGit, ledgerFile });
  assert.equal(readFileSync(ledgerFile, "utf8"), l1);
  assert.equal(readFileSync(join(dir, "sitemap.xml"), "utf8"), s1);
});
