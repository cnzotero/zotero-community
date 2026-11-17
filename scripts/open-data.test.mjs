import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLUGIN_KEYS, RELEASE_KEYS, validateFeed } from "./catalog-feed.mjs";
import { STYLE_KEYS, STYLES_FILE } from "./styles-index.mjs";
import { build } from "./prerender.mjs";
import {
  CATALOG_EXAMPLE, CATALOG_PLUGIN, CATALOG_RELEASE, CATALOG_TOP, CURL_EXAMPLE, FETCH_EXAMPLE, STYLES_ITEM, STYLES_TOP,
} from "../src/content/open-data.ts";
import { STATIC_PAGES } from "../src/seo/pages.ts";

const names = (list) => list.map((f) => f.name).sort();
const STYLES = JSON.parse(readFileSync(STYLES_FILE, "utf8"));

test("字段表与生成脚本一一对应:不漏写、不多写", () => {
  assert.deepEqual(names(CATALOG_TOP), ["categories", "count", "generatedAt", "plugins", "schema", "site"]);
  assert.deepEqual(names(CATALOG_PLUGIN), [...PLUGIN_KEYS].sort());
  assert.deepEqual(names(CATALOG_RELEASE), [...RELEASE_KEYS].sort());
  assert.deepEqual(names(STYLES_TOP), Object.keys(STYLES).sort());
  assert.deepEqual(names(STYLES_ITEM), [...STYLE_KEYS].sort());
  for (const f of [...CATALOG_TOP, ...CATALOG_PLUGIN, ...CATALOG_RELEASE, ...STYLES_TOP, ...STYLES_ITEM]) {
    for (const k of ["type", "empty", "desc", "source"]) assert.ok(f[k], `${f.name} 缺 ${k}`);
  }
});

test("示例条目是一份合法的目录源条目,示例请求读的是本站的公开文件", () => {
  const feed = { schema: 1, generatedAt: "2026-11-17", site: "https://zoterocn.org", count: 1, categories: [{ key: "reading", label: "阅读" }], plugins: [CATALOG_EXAMPLE] };
  assert.deepEqual(validateFeed(feed), []);
  for (const code of [CURL_EXAMPLE, FETCH_EXAMPLE]) assert.match(code, /https:\/\/zoterocn\.org\/data\/catalog\.json/);
  assert.match(CURL_EXAMPLE, /https:\/\/zoterocn\.org\/data\/styles\.json/);
});

test("开放数据页:路由、页脚入口、可收录,正文列出两份文件与全部字段", async () => {
  // 不在这里直接导入 src/router.ts:先在测试进程里加载它会让随后打包的服务端渲染包拿不到页面组件。
  // 路由是否生效看渲染结果:/open-data 渲染出本页正文,页脚有入口。
  const meta = STATIC_PAGES.find((m) => m.path === "/open-data");
  assert.ok(meta && meta.indexable !== false);
  const dir = mkdtempSync(join(tmpdir(), "open-data-"));
  writeFileSync(join(dir, "index.html"), `<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>`);
  const entries = await build(dir, [], "2026-11-17", [], { dateOf: () => null });
  assert.ok(entries.some((e) => e.path === "/open-data"), "进 sitemap");
  const html = readFileSync(join(dir, "open-data/index.html"), "utf8");
  assert.match(html, /<h1 class="page-title">开放数据<\/h1>/);
  assert.match(html, /<nav aria-label="页脚导航"[\s\S]*href="\/open-data"/);
  for (const f of ["/data/catalog.json", "/data/styles.json"]) assert.ok(html.includes(`href="${f}"`), f);
  for (const f of [...CATALOG_PLUGIN, ...CATALOG_RELEASE, ...STYLES_ITEM]) assert.ok(html.includes(`<code>${f.name}</code>`), f.name);
  assert.match(html, /字段只增不改/);
  assert.match(html, /欢迎自由引用,请注明来源/);
  assert.match(html, /THIRD_PARTY_NOTICES\.md/);
  assert.ok(readFileSync(join(dir, "llms.txt"), "utf8").includes("https://zoterocn.org/open-data"));
  // 引用样式页链到开放数据页
  assert.match(readFileSync(join(dir, "styles/index.html"), "utf8"), /href="\/open-data"/);
});
