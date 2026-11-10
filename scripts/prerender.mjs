#!/usr/bin/env node
// 构建后预渲染:把每个页面的 React 组件真正渲染成 HTML(与浏览器里看到的是同一套组件、同一份内容),
// 再写上每页自己的标题、描述、规范链接、Open Graph 与结构化数据;浏览器加载后由前端直接接管。
// 同时生成 sitemap.xml、robots.txt、llms.txt、404.html,并维护「内容指纹台账」(sitemap 的 lastmod 只在内容真正变化时更新)。
// 用法:
//   node --experimental-strip-types scripts/prerender.mjs [dist目录]   构建后预渲染
//   node --experimental-strip-types scripts/prerender.mjs --ledger-only 只更新内容指纹台账与下架台账(每日数据刷新后、提交数据前运行)
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArticle, wordCount } from "../src/guides/markdown.ts";
import {
  CATEGORY_KEYS, SITE, SITE_NAME, STATIC_PAGES, categoryIntro, categoryLabel, categoryMeta, categoryPath, categoryStableFacts, compatMeta, duplicateNames, isIndexable, ogImage, pageUrl, pluginMeta,
} from "../src/seo/pages.ts";
import { STYLE_SOURCE_LIST } from "../src/content/styles.ts";
import { ZOTERO_VERSIONS, compatIndex, compatList, pickDownload } from "../src/plugins/lib.ts";
import { BUILD_DATE_ENV, DELISTED_FILE, buildDay, loadCatalog, readBuildDateMeta, stripBuildDateMeta } from "./catalog.ts";
import { delistedLedgerJson } from "../src/plugins/delisted.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LEDGER_FILE = join(root, "src/data/lastmod.json");

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 与前端详情页同一逻辑:从高到低找第一个有兼容安装包的 Zotero 大版本,取该版本能装的最新包。 */
export function bestDownload(p) {
  for (const v of [...ZOTERO_VERSIONS].reverse()) {
    const d = pickDownload(p, v);
    if (d) return { ...d, major: v };
  }
  return null;
}

/** JSON-LD 内嵌进 <script>:把 < 转义,杜绝 </script> 注入。 */
export const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

export function head(meta, extra = "") {
  const url = pageUrl(meta.path);
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    isIndexable(meta) ? `<meta name="robots" content="index,follow,max-image-preview:large" />` : `<meta name="robots" content="noindex,follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(ogImage(meta.kind))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    extra,
  ].filter(Boolean).join("\n    ");
}

/**
 * 把模板里已有的 title / description / OG 标签去掉,换成每页自己的;正文放进 #root。
 * data-ssr 记下这是哪个地址的预渲染结果,浏览器只在地址一致时接管;data-now 是渲染时用的日期。
 */
export function applyTemplate(template, meta, headExtra, bodyHtml, now = "") {
  let html = stripBuildDateMeta(template)
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:card"[^>]*>\s*/gi, "");
  html = html.replace("</head>", () => `    ${head(meta, headExtra)}\n  </head>`);
  html = html.replace(/<div id="root"><\/div>/, () => `<div id="root" data-ssr="${esc(meta.path)}" data-now="${esc(now)}">${bodyHtml}</div>`);
  return html;
}

const crumbs = (items) => ld({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: pageUrl(path) })),
});

function pluginLd(p, meta) {
  const dl = bestDownload(p);
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: p.name,
      description: p.summary,
      // 文献管理软件的扩展;不写价格(并非所有插件都免费)
      applicationCategory: "ReferenceApplication",
      applicationSubCategory: "Zotero 插件",
      operatingSystem: "Windows, macOS, Linux",
      url: `${SITE}${meta.path}`,
      author: { "@type": "Person", name: p.id.split("/")[0] },
      ...(p.latest ? { softwareVersion: p.latest.version, dateModified: p.latest.date } : {}),
      ...(dl ? { downloadUrl: dl.u } : {}),
      sameAs: [p.homepage],
    }),
    // 与页面上的面包屑一致:首页 › 分类 › 插件名
    crumbs([["首页", "/"], [`${categoryLabel(p.category) || "插件"}类插件`, categoryPath(p.category)], [p.name, meta.path]]),
  ].join("\n    ");
}

/** 插件列表页(分类页、版本兼容页)的结构化数据:CollectionPage + ItemList(前 50 个)+ 面包屑。 */
function collectionLd(meta, list, trail) {
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: meta.h1,
      description: meta.description,
      url: `${SITE}${meta.path}`,
      inLanguage: "zh-CN",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: list.length,
        itemListElement: list.slice(0, 50).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/plugins/${p.id}`, name: p.name })),
      },
    }),
    crumbs(trail),
  ].join("\n    ");
}

const categoryLd = (meta, list) => collectionLd(meta, list, [["首页", "/"], ["插件广场", "/plugins"], [meta.h1, meta.path]]);
// 与页面上的面包屑一致:首页 › 本页(「版本兼容」没有独立页面,不单列一级)
const compatLd = (meta, list) => collectionLd(meta, list, [["首页", "/"], [meta.h1, meta.path]]);

function articleLd(a, path) {
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: a.title,
      description: a.description,
      inLanguage: "zh-CN",
      url: `${SITE}${path}`,
      mainEntityOfPage: `${SITE}${path}`,
      wordCount: wordCount(a.blocks),
      ...(a.published ? { datePublished: a.published } : {}),
      ...(a.updated ? { dateModified: a.updated } : {}),
      isPartOf: { "@type": "CreativeWorkSeries", name: "Zotero 插件开发系列" },
      author: { "@type": "Organization", name: SITE_NAME, url: `${SITE}/` },
      publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE}/brand/icon-512.png` } },
      citation: a.sources,
    }),
    crumbs([["首页", "/"], ["教程", "/guides"], [a.title, path]]),
  ].join("\n    ");
}

/** 引用样式页:说明性文章,citation 列出页面上每段「来源」里的官方页面。 */
function stylesLd(meta) {
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: meta.h1,
      description: meta.description,
      inLanguage: "zh-CN",
      url: pageUrl(meta.path),
      mainEntityOfPage: pageUrl(meta.path),
      author: { "@type": "Organization", name: SITE_NAME, url: `${SITE}/` },
      publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE}/brand/icon-512.png` } },
      citation: STYLE_SOURCE_LIST.map((s) => s.url),
    }),
    crumbs([["首页", "/"], [meta.h1, meta.path]]),
  ].join("\n    ");
}

/** 读取教程文稿目录(含原文,用于内容指纹);不存在时返回空数组。 */
export function loadArticleSources(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => {
      const raw = readFileSync(join(dir, f), "utf8");
      return { file: join(dir, f), raw, article: parseArticle(raw) };
    }).sort((a, b) => a.article.order - b.article.order);
  } catch {
    return [];
  }
}

/** 读取教程文稿目录;不存在时返回空数组。 */
export const loadArticles = (dir) => loadArticleSources(dir).map((s) => s.article);

export function sitemapXml(entries) {
  const rows = entries.map((e) => `  <url><loc>${esc(SITE + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`;

/** 给大模型等自动读取工具的站点说明:只列事实与可收录页面的链接,不列单个插件。 */
export function llmsTxt({ pages, categories, compat = [], articles }) {
  const line = (title, path, desc) => `- [${title}](${pageUrl(path)})${desc ? `: ${desc}` : ""}`;
  return [
    `# ${SITE_NAME}`,
    "",
    "> 社区自发运营的非官方站点,整理 Zotero 插件的公开信息、中文教程与期刊查询。本站与 Zotero 官方无隶属关系。",
    "",
    "插件广场只列出在架的插件:超过 1 年未发布且没有可下载的安装包、最近一次发布超过 2 年、或超过 1 年未发布且未声明适配当前 Zotero 版本的插件按收录规则自动下架,作者发布新版本后自动恢复。下面的数量只计在架插件。",
    "",
    "## 主要栏目",
    "",
    ...pages.map((m) => line(m.path === "/" ? "首页" : m.h1, m.path, m.description)),
    "",
    "## 插件分类",
    "",
    ...categories.map(({ meta, count }) => line(meta.h1, meta.path, `收录 ${count} 款,列出用途、适配版本与下载入口`)),
    "",
    ...(compat.length ? ["## 按 Zotero 版本", "", ...compat.map(({ meta, count }) => line(meta.h1, meta.path, `${count} 款插件声明适配;未声明适配范围的不计入`)), ""] : []),
    "## 教程",
    "",
    ...articles.map((a) => line(a.title, `/guides/${a.slug}`, a.description)),
    "",
  ].join("\n");
}

/** 构建期保险:预渲染页面里任何外链(http/https)都必须新标签打开并带 noopener,否则构建失败。 */
export function assertExternalLinks(html, where) {
  for (const m of html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g)) {
    if (!/target="_blank"/.test(m[0]) || !/rel="noopener noreferrer"/.test(m[0])) throw new Error(`预渲染外链缺少 target=_blank 或 rel=noopener:${where} ${m[0].slice(0, 120)}`);
  }
}

// ---------- 服务端渲染 ----------

let renderer = null;

/** 用 Vite 把预渲染入口打成 Node 可直接运行的包(放在 node_modules 下,不进仓库与发布产物)。 */
export function ssrModule(outDir = join(root, "node_modules/.ssr")) {
  return (renderer ??= (async () => {
    const { build: viteBuild } = await import("vite");
    await viteBuild({
      root,
      configFile: join(root, "vite.config.ts"),
      logLevel: "warn",
      build: { ssr: "src/entry-server.tsx", outDir, emptyOutDir: true, copyPublicDir: false, minify: false },
    });
    return import(pathToFileURL(join(outDir, "entry-server.js")).href);
  })());
}

// ---------- 内容指纹台账:sitemap 的 lastmod 只在内容真正变化时更新 ----------

export const fingerprint = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);

/**
 * 按新指纹更新台账。指纹没变沿用旧日期;变了写 today;台账里没有的页面用 initial(首次生成时的日期);
 * 已不存在的页面从台账移除。纯函数,不读写文件。
 */
export function updateLedger(old, prints, today) {
  const next = {};
  for (const [path, { hash, initial }] of prints) {
    const prev = old?.[path];
    next[path] = { hash, lastmod: prev ? (prev.hash === hash ? prev.lastmod : today) : initial || today };
  }
  return next;
}

export function ledgerJson(ledger) {
  const keys = Object.keys(ledger).sort();
  return `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(ledger[k])}`).join(",\n")}\n}\n`;
}

export function readLedger(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/** 文件在 git 里最后一次提交的日期;拿不到返回 null。 */
export function gitDate(file) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", relative(root, file)], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

/** 栏目页的文案在哪个源文件里:首次生成台账时用该文件在 git 里的最后修改日期。 */
const PAGE_SOURCES = {
  "/": "src/pages/Home.tsx",
  "/plugins": "src/plugins/PluginsPage.tsx",
  "/plugins/charts": "src/plugins/ChartsPage.tsx",
  "/journals": "src/journals/JournalsPage.tsx",
  "/guides": "src/guides/GuidesPages.tsx",
  "/styles": "src/pages/StylesPage.tsx",
  "/forum": "src/App.tsx",
  "/rules": "src/pages/StaticPages.tsx",
  "/about": "src/pages/StaticPages.tsx",
  "/submission": "src/pages/StaticPages.tsx",
};

/** 插件页指纹只算有意义的内容:名称、简介、分类、兼容范围、最新版本号与发布日期(不算每天都在变的星标、下载数)。 */
export const pluginPrint = (p) => fingerprint({ name: p.name, summary: p.summary, category: p.category, zotero: p.zotero, version: p.latest?.version ?? null, date: p.latest?.date ?? null });

/** 栏目页正文里的可见文字与链接(不含页头页脚),用来算栏目页的内容指纹。 */
export function mainContent(html) {
  const m = /<main class="container">([\s\S]*)<\/main>/.exec(html);
  const body = m ? m[1] : html;
  const hrefs = [...body.matchAll(/href="([^"]*)"/g)].map((x) => x[1]);
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return JSON.stringify({ text, hrefs });
}

/** 去掉每天都在变的数字(星标、下载、发布节奏等),只留下「有意义的内容」,用来渲染栏目页算指纹。 */
const stablePlugin = (p) => ({ id: p.id, name: p.name, summary: p.summary, category: p.category, tags: p.tags, author: p.author, homepage: p.homepage, stars: 0, latest: p.latest, updated: p.updated, zotero: p.zotero, downloads: p.downloads });
const STABLE_NOW = "2000-01-01";

function categoryList(plugins, key) {
  return plugins.filter((p) => p.category === key).sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

/**
 * 算出每个可收录页面的指纹与「首次生成日期」,并按台账给出 lastmod。
 * 返回 { ledger, prints }:prints 是 Map<path, {hash, initial}>,顺序即 sitemap 顺序。
 */
export async function computeLedger({ plugins, articleSources, today, prepare, old, dateOf = gitDate }) {
  const prints = new Map();
  const add = (path, hash, initial) => prints.set(path, { hash, initial });
  // 栏目页:用去掉日常波动数据后的渲染结果算指纹,文案、链接或收录名单变了才算变化
  const renderStable = await prepare({ generatedAt: "", plugins: plugins.map(stablePlugin), history: {}, now: STABLE_NOW });
  for (const meta of STATIC_PAGES.filter(isIndexable)) {
    const src = PAGE_SOURCES[meta.path];
    add(meta.path, fingerprint({ meta: [meta.title, meta.description, meta.h1], main: mainContent(renderStable(meta.path)) }), src ? dateOf(join(root, src)) : null);
  }
  for (const p of plugins) add(`/plugins/${p.id}`, pluginPrint(p), p.updated || null);
  const copyDate = dateOf(join(root, "src/content/category-copy.json"));
  for (const key of CATEGORY_KEYS) {
    const meta = categoryMeta(key, plugins);
    const list = categoryList(plugins, key);
    if (!meta || list.length === 0) continue;
    // 描述里的「最近一次发布」日期几乎天天变,不算进指纹;数量与适配范围变了才算变化
    add(meta.path, fingerprint({ meta: [meta.title, meta.h1], facts: categoryStableFacts(key, plugins), copy: categoryIntro(key), members: list.map((p) => p.id).sort() }), copyDate);
  }
  // 版本兼容页:成员名单变了才算变化
  for (const { major } of compatIndex(plugins)) {
    const list = compatList(plugins, major);
    const meta = compatMeta(major, list.length);
    add(meta.path, fingerprint({ meta: [meta.title, meta.description, meta.h1], members: list.map((p) => p.id).sort() }), null);
  }
  for (const s of articleSources) add(`/guides/${s.article.slug}`, fingerprint(s.raw), s.file ? dateOf(s.file) : null);
  return { prints, ledger: updateLedger(old, prints, today) };
}

/**
 * 预渲染全部页面。opts:
 *   generatedAt / history:页面上显示的数据日期与历史快照
 *   delisted:下架记录页用的数据(在架数与下架记录);plugins 只传在架的插件
 *   prepare:服务端渲染入口(默认用 Vite 现场打包 src/entry-server.tsx)
 *   ledgerFile:内容指纹台账文件(传 null 则只在内存里算,不写文件)
 */
export async function build(distDir, plugins, today = new Date().toISOString().slice(0, 10), articles = [], opts = {}) {
  const prepare = opts.prepare ?? (await ssrModule()).prepare;
  const articleSources = opts.articleSources ?? articles.map((a) => ({ file: null, raw: JSON.stringify(a), article: a }));
  const ledgerFile = opts.ledgerFile === undefined ? null : opts.ledgerFile;
  const { prints, ledger } = await computeLedger({ plugins, articleSources, today, prepare, old: ledgerFile ? readLedger(ledgerFile) : opts.ledger ?? {}, dateOf: opts.dateOf });
  if (ledgerFile) writeFileSync(ledgerFile, ledgerJson(ledger));

  const render = await prepare({ generatedAt: opts.generatedAt ?? today, plugins, history: opts.history ?? {}, delisted: opts.delisted, now: today });
  const template = readFileSync(join(distDir, "index.html"), "utf8");
  const page = (meta, extra, file) => {
    const html = applyTemplate(template, meta, extra, render(meta.path), today);
    assertExternalLinks(html, meta.path);
    const out = file ?? (meta.path === "/" ? join(distDir, "index.html") : join(distDir, meta.path, "index.html"));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
  };
  const entries = [];
  const listed = (meta) => {
    if (isIndexable(meta)) entries.push({ path: meta.path, lastmod: ledger[meta.path]?.lastmod ?? today });
  };

  const websiteLd = ld({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE}/`,
    inLanguage: "zh-CN",
    image: `${SITE}/brand/icon-512.png`,
    potentialAction: { "@type": "SearchAction", target: `${SITE}/plugins?q={search_term_string}`, "query-input": "required name=search_term_string" },
  });
  const orgLd = ld({ "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: `${SITE}/`, logo: `${SITE}/brand/icon-512.png` });
  for (const meta of STATIC_PAGES) {
    page(meta, meta.path === "/" ? `${websiteLd}\n    ${orgLd}` : meta.path === "/styles" ? stylesLd(meta) : crumbs([["首页", "/"], [meta.h1, meta.path]]));
    listed(meta);
  }
  const dups = duplicateNames(plugins);
  for (const p of plugins) {
    const meta = pluginMeta(p, dups.has(p.name));
    page(meta, pluginLd(p, meta));
    listed(meta);
  }
  const categories = [];
  for (const key of CATEGORY_KEYS) {
    const meta = categoryMeta(key, plugins);
    const list = categoryList(plugins, key);
    if (!meta || list.length === 0) continue;
    page(meta, categoryLd(meta, list));
    listed(meta);
    categories.push({ meta, count: list.length });
  }
  const compat = [];
  for (const { major } of compatIndex(plugins)) {
    const list = compatList(plugins, major);
    const meta = compatMeta(major, list.length);
    page(meta, compatLd(meta, list));
    listed(meta);
    compat.push({ meta, count: list.length });
  }
  for (const a of articles) {
    const meta = { path: `/guides/${a.slug}`, title: `${a.title}｜${SITE_NAME}`, description: a.description, h1: a.title, kind: "guide" };
    page(meta, articleLd(a, meta.path));
    listed(meta);
  }
  // 404 页面:服务器对不存在的路径返回真正的 404 状态码并展示它;不进 sitemap,禁止收录
  page({ path: "/404", title: `页面不存在｜${SITE_NAME}`, description: "你访问的页面不存在,可以回到首页、插件广场或教程继续浏览。", h1: "页面不存在", kind: "notfound", indexable: false }, "", join(distDir, "404.html"));

  // sitemap 顺序与台账一致;防止两边漏算同一页
  const missing = entries.filter((e) => !prints.has(e.path)).map((e) => e.path);
  if (missing.length) throw new Error(`内容指纹台账漏算了这些页面:${missing.join(", ")}`);
  writeFileSync(join(distDir, "sitemap.xml"), sitemapXml(entries));
  writeFileSync(join(distDir, "robots.txt"), robotsTxt());
  writeFileSync(join(distDir, "llms.txt"), llmsTxt({ pages: STATIC_PAGES.filter(isIndexable), categories, compat, articles }));
  return entries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ledgerOnly = process.argv.includes("--ledger-only");
  const dist = resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? join(root, "dist"));
  // 构建日期:优先用浏览器数据模块打包时记下的那一天,保证静态页面与前端接管时的在架名单一致
  const template = !ledgerOnly && existsSync(join(dist, "index.html")) ? readFileSync(join(dist, "index.html"), "utf8") : "";
  const today = readBuildDateMeta(template) ?? buildDay();
  process.env[BUILD_DATE_ENV] = today; // 随后打包的服务端渲染包也用同一天
  // 唯一的数据入口:之后的页面、sitemap、llms.txt、台账都只看在架的插件
  const catalog = loadCatalog(today);
  // 下架台账:仍在下架的沿用旧日期、新下架的记今天、恢复上架的删除;与数据一起提交回仓库
  writeFileSync(DELISTED_FILE, delistedLedgerJson(catalog.ledger));
  const historyFile = join(root, "src/data/history.json");
  const history = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, "utf8")) : {};
  const articleSources = loadArticleSources(join(root, "src/content/guides"));
  if (ledgerOnly) {
    const { prepare } = await ssrModule();
    const { ledger } = await computeLedger({ plugins: catalog.listed, articleSources, today, prepare, old: readLedger(LEDGER_FILE) });
    writeFileSync(LEDGER_FILE, ledgerJson(ledger));
    console.log(`内容指纹台账已更新:${Object.keys(ledger).length} 个页面(在架插件 ${catalog.listed.length} 个,下架 ${catalog.delisted.length} 个)`);
  } else {
    const articles = articleSources.map((s) => s.article);
    const entries = await build(dist, catalog.listed, today, articles, { generatedAt: catalog.generatedAt, history, articleSources, ledgerFile: LEDGER_FILE, delisted: catalog.delistedData });
    console.log(`预渲染完成:${entries.length} 个可收录页面(含 ${catalog.listed.length} 个在架插件详情页、${articles.length} 篇教程;下架 ${catalog.delisted.length} 个),已生成 sitemap.xml、robots.txt、llms.txt 与 404.html`);
  }
}
