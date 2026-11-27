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
import { guideCategoryLabel } from "../src/guides/categories.ts";
import { HOME_FAQS, JOURNALS_FAQS, OFFICIAL_PLUGIN_FAQS, STYLES_FAQS, extractGuideFaqs } from "../src/seo/faqs.ts";
import {
  CATEGORY_KEYS, SITE, SITE_NAME, STATIC_PAGES, categoryIntro, categoryLabel, categoryMeta, categoryPath, categoryStableFacts, compatMeta, duplicateNames, isIndexable, ogImage, pageUrl, pluginMeta, topicIntro, topicMeta,
} from "../src/seo/pages.ts";
import { STYLE_SOURCE_LIST } from "../src/content/styles.ts";
import { ZOTERO_VERSIONS, compatIndex, compatList, pickDownload } from "../src/plugins/lib.ts";
import { activeTopics, topicList } from "../src/plugins/topics.ts";
import { BUILD_DATE_ENV, DELISTED_FILE, buildDay, loadCatalog, readBuildDateMeta, stripBuildDateMeta } from "./catalog.ts";
import { delistedLedgerJson } from "../src/plugins/delisted.ts";
import { OFFICIAL } from "../src/official/official.ts";
import { FEED_FILE, buildFeed, droppedSummary, validateFeed } from "./catalog-feed.mjs";
import { ADDON_IDS_FILE } from "./import-addon-ids.mjs";
import { STYLES_FEED_FILE, STYLES_FILE, stylesFeed, stylesJson } from "./styles-index.mjs";

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
  const img = ogImage(meta.kind);
  const isArticle = meta.kind === "guide";
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<link rel="sitemap" type="application/xml" title="Sitemap" href="${SITE}/sitemap.xml" />`,
    `<link rel="alternate" type="text/plain" title="LLMs" href="${SITE}/llms.txt" />`,
    isIndexable(meta) ? `<meta name="robots" content="index,follow,max-image-preview:large" />` : `<meta name="robots" content="noindex,follow" />`,
    `<meta property="og:type" content="${isArticle ? "article" : "website"}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:image:alt" content="${esc(meta.title)}" />`,
    ...(isArticle && meta.published ? [`<meta property="article:published_time" content="${esc(meta.published)}" />`] : []),
    ...(isArticle && meta.updated ? [`<meta property="article:modified_time" content="${esc(meta.updated)}" />`] : []),
    ...(isArticle && meta.section ? [`<meta property="article:section" content="${esc(meta.section)}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    extra,
  ].filter(Boolean).join("\n    ");
}


// 每种页面要用到的代码块与数据块(构建产物文件名 = 名字 + 内容哈希)。写进页面头部的 modulepreload,
// 让浏览器一打开页面就把这些文件和主脚本并行下载;否则要等主脚本跑起来、再逐层发现下一批,多出几轮往返。
const PLUGIN_DATA = ["_virtual_plugin-catalog"];
const ROUTE_CHUNKS = {
  home: ["Home"],
  guides: ["GuidesPages", "content"],
  guide: ["GuidesPages", "content"],
  plugins: ["PluginsPage", ...PLUGIN_DATA],
  plugin: ["PluginsPage", ...PLUGIN_DATA],
  category: ["CategoryPage", "PluginsPage", ...PLUGIN_DATA],
  compat: ["CompatPage", "PluginsPage", ...PLUGIN_DATA],
  topic: ["TopicPage", "PluginsPage", ...PLUGIN_DATA],
  charts: ["ChartsPage", "history", ...PLUGIN_DATA],
  journals: ["JournalsPage"],
  styles: ["StylesPage", "styles-index"],
  rules: ["StaticPages", "_virtual_delisted"],
  about: ["StaticPages"],
  submission: ["StaticPages"],
  openData: ["OpenDataPage"],
  delisted: ["DelistedPage", "_virtual_delisted"],
  official: ["OfficialPluginPage", "official"],
};

/** 页面路径 → 页面类型(与 src/router.ts 的 routeFromPath 对应;这里不引入它,免得把前端路由模块带进构建脚本)。 */
function routeOf(path) {
  const p = path.replace(/\/+$/, "") || "/";
  const exact = { "/": "home", "/guides": "guides", "/plugins": "plugins", "/plugins/charts": "charts", "/journals": "journals", "/styles": "styles", "/rules": "rules", "/about": "about", "/submission": "submission", "/open-data": "openData", "/delisted": "delisted", "/plugin": "official" };
  if (exact[p]) return exact[p];
  if (/^\/guides\/[^/]+$/.test(p)) return "guide";
  if (/^\/plugins\/[^/]+\/[^/]+$/.test(p)) return "plugin";
  if (/^\/categories\/[^/]+$/.test(p)) return "category";
  if (/^\/compat\/[^/]+$/.test(p)) return "compat";
  if (/^\/topics\/[^/]+$/.test(p)) return "topic";
  return null;
}

/** 某个页面路径需要预加载的构建产物(assets 目录下的 .js 文件名列表);没有对应文件的名字跳过。 */
export function preloadFiles(path, assetFiles) {
  const names = ROUTE_CHUNKS[routeOf(path)] ?? [];
  return names.flatMap((n) => assetFiles.filter((f) => f.startsWith(`${n}-`) && f.endsWith(".js") && /^[-\w.]+$/.test(f)).slice(0, 1));
}

/** 把预加载标签写进页面头部。 */
export function withPreloads(html, path, assetFiles) {
  const links = preloadFiles(path, assetFiles).map((f) => `<link rel="modulepreload" crossorigin href="/assets/${f}" />`);
  return links.length ? html.replace("</head>", () => `    ${links.join("\n    ")}\n  </head>`) : html;
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

export const faqLd = (items) => (items && items.length > 0 ? ld({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((x) => ({
    "@type": "Question",
    name: x.q,
    acceptedAnswer: { "@type": "Answer", text: x.a },
  })),
}) : "");

function pluginLd(p, meta) {
  const dl = bestDownload(p);
  const reqs = p.zotero?.declared && p.zotero.majors?.length
    ? [...p.zotero.majors].sort((a, b) => a - b).map((v) => `Zotero ${v}`).join(", ")
    : null;
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
      ...(reqs ? { softwareRequirements: reqs } : {}),
      ...(p.latest ? { softwareVersion: p.latest.version, dateModified: p.latest.date } : {}),
      ...(dl ? { downloadUrl: dl.u } : {}),
      ...(p.homepage ? { codeRepository: p.homepage, sameAs: [p.homepage] } : {}),
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
// 功能专题页:首页 › 插件广场 › 专题(与页面上的面包屑一致)
const topicLd = (meta, list) => collectionLd(meta, list, [["首页", "/"], ["插件广场", "/plugins"], [meta.h1, meta.path]]);

function articleLd(a, path) {
  const faqs = extractGuideFaqs(a.blocks);
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: a.title,
      description: a.description,
      image: ogImage("guide"),
      inLanguage: "zh-CN",
      url: `${SITE}${path}`,
      mainEntityOfPage: `${SITE}${path}`,
      wordCount: wordCount(a.blocks),
      ...(a.published ? { datePublished: a.published } : {}),
      ...(a.updated ? { dateModified: a.updated } : {}),
      ...(a.category ? { articleSection: guideCategoryLabel(a.category) } : {}),
      // 开发类是连续的系列;其他分类只标所属栏目
      isPartOf: a.category === "dev" ? { "@type": "CreativeWorkSeries", name: "Zotero 插件开发系列" } : { "@type": "CollectionPage", name: "Zotero 使用教程", url: `${SITE}/guides` },
      author: { "@type": "Organization", name: SITE_NAME, url: `${SITE}/` },
      publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE}/brand/icon-512.png` } },
      citation: a.sources,
    }),
    faqLd(faqs),
    crumbs([["首页", "/"], ["教程", "/guides"], [a.title, path]]),
  ].filter(Boolean).join("\n    ");
}

/** 引用样式页:说明性文章 + FAQPage + 面包屑,citation 列出页面上每段「来源」里的官方页面。 */
function stylesLd(meta) {
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: meta.h1,
      description: meta.description,
      image: ogImage(meta.kind),
      inLanguage: "zh-CN",
      url: pageUrl(meta.path),
      mainEntityOfPage: pageUrl(meta.path),
      author: { "@type": "Organization", name: SITE_NAME, url: `${SITE}/` },
      publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE}/brand/icon-512.png` } },
      citation: STYLE_SOURCE_LIST.map((s) => s.url),
    }),
    faqLd(STYLES_FAQS),
    crumbs([["首页", "/"], [meta.h1, meta.path]]),
  ].filter(Boolean).join("\n    ");
}

/** 社区官方插件介绍页:SoftwareApplication(版本号与下载地址取自插件 manifest)+ FAQPage + 面包屑。 */
export function officialLd(meta) {
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: OFFICIAL.name,
      description: OFFICIAL.summary,
      applicationCategory: "ReferenceApplication",
      applicationSubCategory: "Zotero 插件",
      operatingSystem: "Windows, macOS, Linux",
      softwareRequirements: `Zotero ${OFFICIAL.minMajor}–${OFFICIAL.maxMajor}`,
      url: pageUrl(meta.path),
      softwareVersion: OFFICIAL.version,
      downloadUrl: `https://github.com/cnzotero/zotero-community/releases/download/plugin-v${OFFICIAL.version}/zotero-community.xpi`,
      installUrl: OFFICIAL.releaseUrl,
      codeRepository: OFFICIAL.sourceUrl,
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      author: { "@type": "Organization", name: SITE_NAME, url: `${SITE}/` },
      sameAs: [OFFICIAL.sourceUrl],
    }),
    faqLd(OFFICIAL_PLUGIN_FAQS),
    crumbs([["首页", "/"], [meta.h1, meta.path]]),
  ].filter(Boolean).join("\n    ");
}

/** 期刊查询页:WebPage + FAQPage + 面包屑。 */
function journalsLd(meta) {
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: meta.h1,
      description: meta.description,
      url: pageUrl(meta.path),
      inLanguage: "zh-CN",
    }),
    faqLd(JOURNALS_FAQS),
    crumbs([["首页", "/"], [meta.h1, meta.path]]),
  ].filter(Boolean).join("\n    ");
}

/** 开放数据页:Dataset JSON-LD + 面包屑。 */
function openDataLd(meta) {
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Zotero 中文社区开放数据（插件目录与中文引用样式一览）",
      description: meta.description,
      url: pageUrl(meta.path),
      inLanguage: "zh-CN",
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: SITE_NAME, url: `${SITE}/` },
      distribution: [
        { "@type": "DataDownload", name: "Zotero 插件目录 JSON", encodingFormat: "application/json", contentUrl: `${SITE}/data/catalog.json` },
        { "@type": "DataDownload", name: "中文引用样式一览 JSON", encodingFormat: "application/json", contentUrl: `${SITE}/data/styles.json` },
      ],
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

export const robotsTxt = () => [
  "# Zotero 中文社区 (zoterocn.org) — 欢迎搜索引擎与 AI 检索爬虫索引公开页面",
  `# LLMs: ${SITE}/llms.txt`,
  `# LLMs-Full: ${SITE}/llms-full.txt`,
  "",
  "User-agent: *",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: Baiduspider",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: Bytespider",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: Bingbot",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: Googlebot",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: OAI-SearchBot",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: GPTBot",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: ChatGPT-User",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: PerplexityBot",
  "Allow: /",
  "Disallow: /api/",
  "",
  "User-agent: ClaudeBot",
  "Allow: /",
  "Disallow: /api/",
  "",
  `Sitemap: ${SITE}/sitemap.xml`,
  "",
].join("\n");

/** 给大模型等自动读取工具的站点说明:只列事实与可收录页面的链接,不列单个插件。 */
export function llmsTxt({ pages, categories, compat = [], topics = [], articles, pluginCount = 0 }) {
  const line = (title, path, desc) => `- [${title}](${pageUrl(path)})${desc ? `: ${desc}` : ""}`;
  return [
    `# ${SITE_NAME}`,
    "",
    "> 社区自发运营的非官方中文站点（zoterocn.org），集中整理 Zotero 插件商店与版本兼容速查、中文使用与插件开发教程、期刊收录与分区查询、中文引用样式指南及开放 JSON 目录数据。本站与 Zotero 官方无隶属关系，全部规则与代码公开在 github.com/cnzotero/zotero-community。",
    "",
    "适合回答的高频问题：Zotero 中文社区（zoterocn.org）是什么网站；Zotero 官方版怎么下载安装；Zotero 7 / 8 / 10 升级后哪些插件兼容、不兼容怎么排查；Zotero 翻译、AI、期刊分区、Obsidian、LaTeX、中文文献等插件怎么按用途查找；Zotero 文献列表怎么显示中科院分区与影响因子；Zotero 怎么配置 GB/T 7714 中文引用样式并在 Word / WPS 里恢复插件；Zotero 300MB 空间满怎么配 WebDAV 与备份。",
    "",
    `当前数据概况：${pluginCount ? `在架插件 ${pluginCount} 款，` : ""}中文教程 ${articles.length} 篇，功能专题 ${topics.length} 个，版本兼容清单 ${compat.length} 个。插件广场只列出在架的插件：超过 1 年未发布且没有可下载的安装包、最近一次发布超过 2 年、或超过 1 年未发布且未声明适配当前 Zotero 版本的插件按收录规则自动下架，作者发布新版本后自动恢复。下面的数量只计在架插件。`,
    "",
    `完整版说明与高频问答（含可直接引用的结构化解答）：${SITE}/llms-full.txt`,
    "",
    "## 主要栏目",
    "",
    ...pages.map((m) => line(m.path === "/" ? "首页" : m.h1, m.path, m.description)),
    "",
    "## 插件分类",
    "",
    ...categories.map(({ meta, count }) => line(meta.h1, meta.path, `收录 ${count} 款,列出用途、适配版本与下载入口`)),
    "",
    ...(topics.length ? ["## 按功能找插件", "", ...topics.map(({ meta, count }) => line(meta.h1, meta.path, `收录 ${count} 款,按插件名称或简介里的用途词收录`)), ""] : []),
    ...(compat.length ? ["## 按 Zotero 版本", "", ...compat.map(({ meta, count }) => line(meta.h1, meta.path, `${count} 款插件声明适配;未声明适配范围的不计入`)), ""] : []),
    "## 教程",
    "",
    ...articles.map((a) => line(a.title, `/guides/${a.slug}`, a.description)),
    "",
  ].join("\n");
}

/** 面向大模型与 AI 搜索引擎的完整版站点说明（llms-full.txt）：实体定位、实时统计口径、高频问答与开放数据入口。 */
export function llmsFullTxt({ pages, categories, compat = [], topics = [], articles, pluginCount = 0, today = "" }) {
  const line = (title, path, desc) => `- [${title}](${pageUrl(path)})${desc ? `: ${desc}` : ""}`;
  const qa = (items) => items.flatMap((x) => [`**${x.q}**`, x.a, ""]);
  const compatSummaryLine = compat.map(({ meta, count }) => `${meta.h1.replace("兼容的插件", "").trim()}：${count} 款`).join("；");
  return [
    `# ${SITE_NAME}（zoterocn.org）完整说明`,
    "",
    `> 本文件面向 AI 助手与检索服务生成，内容与 ${SITE}/ 页面及公开规则保持一致${today ? `（构建日期 ${today}）` : ""}。本站是由社区自发运营的非官方开源中文站点，与 Zotero 官方（Corporation for Digital Scholarship）及同类第三方站点无隶属关系。`,
    "",
    "## 站点定位与实时数据口径",
    "",
    `- 站点名称：${SITE_NAME}（常用简称：zoterocn、zoterocn.org）`,
    `- 官网地址：${SITE}/`,
    "- 开源仓库：https://github.com/cnzotero/zotero-community （MIT 协议，代码、收录脚本与下架记录均公开）",
    `- 当前在架插件：${pluginCount} 款（只统计满足活跃与适配条件的在架插件；目录内无付费置顶、无推荐位、无广告位）`,
    ...(compatSummaryLine ? [`- 按 Zotero 大版本声明适配：${compatSummaryLine}（未声明适配范围的不作推定）`] : []),
    `- 站内中文教程：${articles.length} 篇（覆盖入门安装、插件挑选与排查、GB/T 7714 引用样式、Word/WPS 排错、WebDAV 同步与备份、文库整理、插件开发系列，每篇附官方参考来源）`,
    `- 开放 JSON 数据：插件目录 ${SITE}/data/catalog.json ；中文引用样式一览 ${SITE}/data/styles.json`,
    "",
    "## 社区与插件市场高频问答（可直接引用）",
    "",
    ...qa(HOME_FAQS),
    "## Zotero中文社区插件（客户端内插件市场）问答",
    "",
    ...qa(OFFICIAL_PLUGIN_FAQS),
    "## 期刊收录、中科院与 JCR 分区查询问答",
    "",
    ...qa(JOURNALS_FAQS),
    "## GB/T 7714 与中文引用样式问答",
    "",
    ...qa(STYLES_FAQS),
    "## 高频使用问题直达指南",
    "",
    "- Zotero 官方版怎么下载安装、如何避开不明整合包：https://zoterocn.org/guides/zotero-download-install-faq",
    "- Zotero 7 / 8 / 10 升级后旧插件提示不兼容怎么排查：https://zoterocn.org/guides/zotero-upgrade-plugin-incompatible",
    "- Zotero 文献列表怎么显示中科院分区、JCR 分区与影响因子：https://zoterocn.org/guides/zotero-journal-ranking-column",
    "- Zotero 怎么给英文 PDF 做划词与保留排版全文对照翻译：https://zoterocn.org/guides/zotero-pdf-bilingual-translate",
    "- Zotero AI 插件怎么按检索、精读、问答与综述环节挑选：https://zoterocn.org/guides/zotero-ai-plugins-guide",
    "- Zotero 在 Word 和 WPS 里不显示插件怎么恢复：https://zoterocn.org/guides/zotero-word-wps-plugin",
    "- Zotero 300MB 免费同步空间满了怎么配置 WebDAV 与备份：https://zoterocn.org/guides/zotero-webdav-sync",
    "",
    "## 全站可收录栏目、专题与教程索引",
    "",
    "### 主要栏目",
    ...pages.map((m) => line(m.path === "/" ? "首页" : m.h1, m.path, m.description)),
    "",
    "### 插件分类",
    ...categories.map(({ meta, count }) => line(meta.h1, meta.path, `收录 ${count} 款`)),
    "",
    ...(topics.length ? ["### 功能专题", ...topics.map(({ meta, count }) => line(meta.h1, meta.path, `收录 ${count} 款`)), ""] : []),
    ...(compat.length ? ["### Zotero 版本兼容清单", ...compat.map(({ meta, count }) => line(meta.h1, meta.path, `${count} 款声明适配`)), ""] : []),
    "### 中文教程全集",
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
  "/open-data": "src/pages/OpenDataPage.tsx",
  "/about": "src/pages/StaticPages.tsx",
  "/submission": "src/pages/StaticPages.tsx",
  "/plugin": "src/official/OfficialPluginPage.tsx",
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
  // 功能专题页:成员名单、标题或选择指引变了才算变化
  const topicsDate = dateOf(join(root, "src/plugins/topics.ts"));
  for (const { topic } of activeTopics(plugins)) {
    const list = topicList(plugins, topic.key);
    const meta = topicMeta(topic.key, plugins);
    add(meta.path, fingerprint({ meta: [meta.title, meta.h1], copy: topicIntro(topic.key), members: list.map((p) => p.id).sort() }), topicsDate);
  }
  // 教程首次进台账时用文件头的更新日期;没写再用文件在 git 里的最后修改日期
  for (const s of articleSources) add(`/guides/${s.article.slug}`, fingerprint(s.raw), s.article.updated ?? (s.file ? dateOf(s.file) : null));
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
  const assetFiles = existsSync(join(distDir, "assets")) ? readdirSync(join(distDir, "assets")) : [];
  const page = (meta, extra, file) => {
    const html = withPreloads(applyTemplate(template, meta, extra, render(meta.path), today), meta.path, assetFiles);
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
    alternateName: ["zoterocn", "zoterocn.org"],
    description: STATIC_PAGES[0].description,
    url: `${SITE}/`,
    inLanguage: "zh-CN",
    image: `${SITE}/brand/icon-512.png`,
    potentialAction: { "@type": "SearchAction", target: `${SITE}/plugins?q={search_term_string}`, "query-input": "required name=search_term_string" },
  });
  const orgLd = ld({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: ["zoterocn", "zoterocn.org"],
    description: "社区自发运营的非官方 Zotero 中文站点，整理开源插件目录、版本兼容清单、中文使用教程、引用样式指南与期刊查询。",
    url: `${SITE}/`,
    logo: `${SITE}/brand/icon-512.png`,
    sameAs: ["https://github.com/cnzotero/zotero-community"],
  });
  const pluginsHubLd = (meta) => [
    ld({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: meta.h1,
      description: meta.description,
      url: pageUrl(meta.path),
      inLanguage: "zh-CN",
      mainEntity: { "@type": "ItemList", numberOfItems: plugins.length },
    }),
    crumbs([["首页", "/"], [meta.h1, meta.path]]),
  ].join("\n    ");
  const staticExtra = (meta) => {
    if (meta.path === "/") return [websiteLd, orgLd, faqLd(HOME_FAQS)].filter(Boolean).join("\n    ");
    if (meta.path === "/plugins") return pluginsHubLd(meta);
    if (meta.path === "/styles") return stylesLd(meta);
    if (meta.path === "/journals") return journalsLd(meta);
    if (meta.path === "/open-data") return openDataLd(meta);
    if (meta.path === OFFICIAL.pagePath) return officialLd(meta);
    return crumbs([["首页", "/"], [meta.h1, meta.path]]);
  };
  for (const meta of STATIC_PAGES) {
    page(meta, staticExtra(meta));
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
  const topics = [];
  for (const { topic } of activeTopics(plugins)) {
    const list = topicList(plugins, topic.key);
    const meta = topicMeta(topic.key, plugins);
    page(meta, topicLd(meta, list));
    listed(meta);
    topics.push({ meta, count: list.length });
  }
  for (const a of articles) {
    const meta = {
      path: `/guides/${a.slug}`,
      title: `${a.title}｜${SITE_NAME}`,
      description: a.description,
      h1: a.title,
      kind: "guide",
      published: a.published,
      updated: a.updated,
      section: a.category ? guideCategoryLabel(a.category) : undefined,
    };
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
  const llmsPayload = { pages: STATIC_PAGES.filter(isIndexable), categories, compat, topics, articles, pluginCount: plugins.length, today };
  writeFileSync(join(distDir, "llms.txt"), llmsTxt(llmsPayload));
  writeFileSync(join(distDir, "llms-full.txt"), llmsFullTxt(llmsPayload));
  return entries;
}

/**
 * 写出机器可读的目录源 data/catalog.json(不是页面,不进 sitemap)。
 * 社区插件的更新清单不在站点上发布(放在 GitHub 的固定 release 条目里),站点被入侵也不能借插件自动更新推送代码。
 * 目录源只含在架插件;写出前校验格式,并核对条数与 sitemap 里的插件详情页数一致,不一致就让构建失败。
 */
export function writeFeeds(distDir, { listed, delistedIds = [], today, history = {}, addonIds = {}, entries = null }) {
  const dropped = [];
  const feed = buildFeed({ listed, day: today, addonIds, history, dropped });
  const errs = validateFeed(feed, { excludedIds: delistedIds });
  if (errs.length) throw new Error(`目录源校验失败:\n${errs.slice(0, 20).join("\n")}`);
  if (entries) {
    const pages = entries.filter((e) => /^\/plugins\/[^/]+\/[^/]+$/.test(e.path)).length;
    if (pages !== feed.count) throw new Error(`目录源条数 ${feed.count} 与 sitemap 里的插件详情页数 ${pages} 不一致`);
  }
  const feedOut = join(distDir, FEED_FILE);
  mkdirSync(dirname(feedOut), { recursive: true });
  writeFileSync(feedOut, JSON.stringify(feed));
  return { feed, dropped: droppedSummary(dropped, feed) };
}

/**
 * 写出中文引用样式一览 data/styles.json(只有元数据,不含样式文件)。
 * 内容就是已提交的 src/content/styles-index.json,构建时不联网;校验不过就让构建失败。
 */
export function writeStylesFeed(distDir, file = STYLES_FILE) {
  const idx = stylesFeed(JSON.parse(readFileSync(file, "utf8")));
  const out = join(distDir, STYLES_FEED_FILE);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, stylesJson(idx));
  return idx;
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
    const addonIds = existsSync(ADDON_IDS_FILE) ? JSON.parse(readFileSync(ADDON_IDS_FILE, "utf8")) : {};
    const { feed, dropped } = writeFeeds(dist, { listed: catalog.listed, delistedIds: catalog.delisted.map((d) => d.plugin.id), today, history, addonIds, entries });
    console.log(`目录源已生成:/${FEED_FILE}(${feed.count} 个在架插件)`);
    const styles = writeStylesFeed(dist);
    console.log(`引用样式一览已生成:/${STYLES_FEED_FILE}(${styles.count} 个样式,核对于 ${styles.checkedAt})`);
    if (dropped.releases) {
      console.log(`  未进目录的安装包 ${dropped.releases} 个(涉及 ${dropped.plugins} 个插件;因此没有任何安装包的 ${dropped.lostAll.length} 个),按原因:${JSON.stringify(dropped.byReason)}`);
      for (const d of dropped.examples) console.log(`    ${d.reason} ${d.id} ${d.u}`);
    }
    console.log(`预渲染完成:${entries.length} 个可收录页面(含 ${catalog.listed.length} 个在架插件详情页、${articles.length} 篇教程;下架 ${catalog.delisted.length} 个),已生成 sitemap.xml、robots.txt、llms.txt 与 404.html`);
  }
}
