import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertExternalLinks, bestDownload, build, esc, ld, loadArticles, robotsTxt, sitemapXml } from "./prerender.mjs";
import { parseArticle } from "../src/guides/markdown.ts";

const TEMPLATE = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="description" content="旧描述" /><meta property="og:title" content="旧" /><title>旧标题</title></head><body><div id="root"></div><script type="module" src="/x.js"></script></body></html>`;
const PLUGINS = [
  { id: "a/evil", name: 'Evil <script>alert(1)</script> & "q"', summary: "简介 </script><img src=x onerror=1>", category: "reading", author: "a", homepage: "https://github.com/a/evil", stars: 1200, updated: "2026-11-01", zotero: { declared: true, majors: [7, 8, 9, 10] }, latest: { version: "1.0", date: "2026-11-01", releaseUrl: "https://github.com/a/evil/releases/tag/v1" }, downloads: [{ t: 10, v: "1.0", u: "https://github.com/a/evil/releases/download/v1/e.xpi", min: "7", max: "10" }] },
  { id: "b/plain", name: "Plain", summary: "普通插件", category: "ai", author: "b", homepage: "https://github.com/b/plain", stars: 3, updated: "", zotero: { declared: false, majors: [] } },
];

function run() {
  const dir = mkdtempSync(join(tmpdir(), "prerender-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  const entries = build(dir, PLUGINS, "2026-11-10");
  return { dir, entries };
}

test("转义:特殊字符不会破坏 HTML,也不会逃出 JSON-LD 的 script", () => {
  assert.equal(esc('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
  assert.ok(!ld({ a: "</script><script>alert(1)" }).slice(10, -9).includes("</script>"));
  const { dir } = run();
  const html = readFileSync(join(dir, "plugins/a/evil/index.html"), "utf8");
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(!/<img src=x onerror/.test(html));
  assert.match(html, /Evil &lt;script&gt;/);
  const jsonld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.ok(jsonld.some((j) => j["@type"] === "SoftwareApplication" && j.name.includes("Evil")));
});

test("每页都有唯一的标题、描述、规范链接,且旧标签被替换而不是重复", () => {
  const { dir, entries } = run();
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

test("正文摘要写进 #root,脚本标签保留", () => {
  const { dir } = run();
  const html = readFileSync(join(dir, "plugins/b/plain/index.html"), "utf8");
  assert.match(html, /<div id="root"><main class="container"><article[\s\S]*Plain[\s\S]*<\/div>/);
  assert.match(html, /兼容范围未声明/);
  assert.match(html, /<script type="module" src="\/x\.js">/);
});

test("sitemap 与 robots", () => {
  const { dir, entries } = run();
  const sm = readFileSync(join(dir, "sitemap.xml"), "utf8");
  assert.equal((sm.match(/<loc>/g) ?? []).length, entries.length);
  assert.match(sm, /<loc>https:\/\/zoterocn\.org\/plugins\/a\/evil<\/loc><lastmod>2026-11-01<\/lastmod>/);
  assert.match(sm, /<loc>https:\/\/zoterocn\.org\/plugins\/b\/plain<\/loc><lastmod>2026-11-10<\/lastmod>/); // 没有更新日期就用今天
  assert.equal(sitemapXml([{ path: "/x&y" }]).includes("/x&amp;y"), true);
  assert.match(readFileSync(join(dir, "robots.txt"), "utf8"), /Disallow: \/api\/[\s\S]*Sitemap: https:\/\/zoterocn\.org\/sitemap\.xml/);
  assert.match(robotsTxt(), /User-agent: \*/);
});

test("同名不同作者的插件:标题加作者区分,页面标题不重复", () => {
  const dir = mkdtempSync(join(tmpdir(), "prerender-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  const mk = (id) => ({ id, name: "Same Name", summary: "s", category: "ai", author: "x", homepage: "https://github.com/" + id, stars: 1, updated: "2026-11-01", zotero: { declared: false, majors: [] } });
  build(dir, [mk("alice/same"), mk("bob/same"), { ...mk("carol/other"), name: "Other" }], "2026-11-10");
  const t = (p) => readFileSync(join(dir, "plugins", p, "index.html"), "utf8").match(/<title>([^<]*)<\/title>/)[1];
  assert.match(t("alice/same"), /^Same Name\(alice\/same\)｜/);
  assert.match(t("bob/same"), /^Same Name\(bob\/same\)｜/);
  assert.ok(!t("carol/other").includes("(")); // 不重名的不加
  // 同一作者的两个同名插件也能区分
  build(dir, [mk("alice/one"), mk("alice/two")], "2026-11-10");
  assert.notEqual(t("alice/one"), t("alice/two"));
});

test("没有声明兼容范围的插件,结构化数据里不写下载地址", () => {
  const { dir } = run();
  const html = readFileSync(join(dir, "plugins/b/plain/index.html"), "utf8");
  assert.ok(!html.includes("downloadUrl"));
});

test("教程文章:全文进入静态页面、带 TechArticle 结构化数据、进入 sitemap、危险内容被转义", () => {
  const dir = mkdtempSync(join(tmpdir(), "prerender-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  const art = parseArticle('---\ntitle: "教程 <b>一</b>"\ndescription: "描述"\nslug: "dev-x"\norder: 1\nsources:\n  - "https://www.zotero.org/support/dev"\n---\n\n# 标题\n\n## 小节\n正文 <script>alert(1)</script> `npm start` [官方](https://www.zotero.org/x) [坏](javascript:1)\n\n```sh\necho "<hi>"\n```\n');
  const entries = build(dir, [], "2026-11-10", [art]);
  assert.ok(entries.some((e) => e.path === "/guides/dev-x"));
  const html = readFileSync(join(dir, "guides/dev-x/index.html"), "utf8");
  assert.match(html, /<title>教程 &lt;b&gt;一&lt;\/b&gt;｜Zotero 中文社区<\/title>/);
  assert.match(html, /<h2>小节<\/h2>/);
  assert.match(html, /<code>npm start<\/code>/);
  assert.match(html, /<a href="https:\/\/www\.zotero\.org\/x" target="_blank" rel="noopener noreferrer">官方<\/a>/);
  assert.ok(!html.includes("<script>alert(1)") && !html.includes("javascript:1"));
  assert.match(html, /"@type":"TechArticle"/);
  assert.match(readFileSync(join(dir, "sitemap.xml"), "utf8"), /\/guides\/dev-x/);
  // /guides 列表页里带有文章链接,方便爬虫发现
  assert.match(readFileSync(join(dir, "guides/index.html"), "utf8"), /href="\/guides\/dev-x"/);
});

test("真实教程目录能被预渲染读取", () => {
  const arts = loadArticles(new URL("../src/content/guides", import.meta.url).pathname);
  assert.ok(arts.length >= 5);
  assert.deepEqual(arts.map((a) => a.order), arts.map((a) => a.order).sort((a, b) => a - b));
});

test("预渲染页面里所有外链都新标签打开;下载链接和「最新版本」指向同一个兼容包,不会拿旧包充数", () => {
  const dir = mkdtempSync(join(tmpdir(), "prerender-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
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
  const art = parseArticle('---\ntitle: "T"\ndescription: "D"\nslug: "x-1"\norder: 1\nsources:\n  - "https://www.zotero.org/s"\n---\n\n## A\n[外链](https://example.com/x)\n');
  build(dir, [p], "2026-11-10", [art]);
  const pages = [join(dir, "plugins/w/tr/index.html"), join(dir, "guides/x-1/index.html"), join(dir, "index.html"), join(dir, "guides/index.html")];
  for (const f of pages) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g)) {
      assert.match(m[0], /target="_blank"/, `${f}: ${m[0]}`);
      assert.match(m[0], /rel="noopener noreferrer"/, `${f}: ${m[0]}`);
    }
  }
  const html = readFileSync(pages[0], "utf8");
  assert.match(html, /v2\.4\.8\(2026-10-03\)/); // 事实表里的最新版本
  assert.match(html, /releases\/download\/v2\.4\.8\/t\.xpi/); // 下载链接是同一个版本
  assert.ok(!html.includes("v2.3.16"));
  assert.match(html, /"downloadUrl":"https:\/\/github\.com\/w\/tr\/releases\/download\/v2\.4\.8/);
});

test("构建期保险:漏掉新标签属性的外链会让构建失败", () => {
  assert.doesNotThrow(() => assertExternalLinks('<a href="https://a.com" target="_blank" rel="noopener noreferrer">x</a><a href="/plugins">内链</a>', "t"));
  assert.throws(() => assertExternalLinks('<a href="https://github.com/x">x</a>', "t"), /target=_blank/);
  assert.throws(() => assertExternalLinks('<a href="https://a.com" target="_blank">x</a>', "t"), /noopener/);
});
