import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, esc, ld, robotsTxt, sitemapXml } from "./prerender.mjs";

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
