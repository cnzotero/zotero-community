#!/usr/bin/env node
// 构建后预渲染:为每个页面生成带标题、描述、规范链接、Open Graph、结构化数据和正文摘要的静态 HTML,
// 并生成 sitemap.xml 与 robots.txt。搜索引擎抓到的就是完整内容;浏览器加载后由前端接管。
// 用法:node --experimental-strip-types scripts/prerender.mjs [dist目录]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OG_IMAGE, SITE, SITE_NAME, STATIC_PAGES, pluginFacts, pluginMeta } from "../src/seo/pages.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** JSON-LD 内嵌进 <script>:把 < 转义,杜绝 </script> 注入。 */
export const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

export function head(meta, extra = "") {
  const url = `${SITE}${meta.path === "/" ? "/" : meta.path}`;
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    meta.noindex ? `<meta name="robots" content="noindex,follow" />` : `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    extra,
  ].filter(Boolean).join("\n    ");
}

/** 把模板里已有的 title / description / OG 标签去掉,换成每页自己的。 */
export function applyTemplate(template, meta, headExtra, bodyHtml) {
  let html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:card"[^>]*>\s*/gi, "");
  html = html.replace("</head>", `    ${head(meta, headExtra)}\n  </head>`);
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${bodyHtml}</div>`);
  return html;
}

const crumbs = (items) => ld({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}${path}` })),
});

function staticBody(meta) {
  return `<main class="container"><section class="section prerender"><h1 class="page-title">${esc(meta.h1)}</h1><p class="lead">${esc(meta.description)}</p></section></main>`;
}

function pluginBody(p, meta) {
  const rows = pluginFacts(p).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  const dl = (p.downloads ?? []).find((d) => /^https:\/\/(github\.com|gitee\.com)\//.test(d.u));
  return `<main class="container"><article class="section prerender"><nav aria-label="面包屑"><a href="/plugins">插件广场</a></nav>` +
    `<h1 class="page-title">${esc(p.name)}</h1><p class="lead">${esc(p.summary)}</p>` +
    `<table><tbody>${rows}</tbody></table>` +
    `<p><a href="${esc(p.homepage)}" rel="noopener noreferrer">GitHub 仓库</a>${dl ? ` · <a href="${esc(dl.u)}" rel="noopener noreferrer">下载安装包</a>` : ""}</p></article></main>`;
}

function pluginLd(p, meta) {
  const dl = (p.downloads ?? []).find((d) => /^https:\/\/(github\.com|gitee\.com)\//.test(d.u));
  return [
    ld({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: p.name,
      description: p.summary,
      applicationCategory: "BrowserApplication",
      operatingSystem: "Windows, macOS, Linux",
      url: `${SITE}${meta.path}`,
      author: { "@type": "Person", name: p.id.split("/")[0] },
      ...(p.latest ? { softwareVersion: p.latest.version, dateModified: p.latest.date } : {}),
      ...(dl ? { downloadUrl: dl.u } : {}),
      sameAs: [p.homepage],
    }),
    crumbs([["首页", "/"], ["插件广场", "/plugins"], [p.name, meta.path]]),
  ].join("\n    ");
}

export function sitemapXml(entries) {
  const rows = entries.map((e) => `  <url><loc>${esc(SITE + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`;

export function build(distDir, plugins, today = new Date().toISOString().slice(0, 10)) {
  const template = readFileSync(join(distDir, "index.html"), "utf8");
  const write = (path, html) => {
    const file = path === "/" ? join(distDir, "index.html") : join(distDir, path, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  };
  const entries = [];
  const websiteLd = ld({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE}/`,
    inLanguage: "zh-CN",
    potentialAction: { "@type": "SearchAction", target: `${SITE}/plugins?q={search_term_string}`, "query-input": "required name=search_term_string" },
  });
  for (const meta of STATIC_PAGES) {
    const extra = meta.path === "/" ? websiteLd : crumbs([["首页", "/"], [meta.h1, meta.path]]);
    write(meta.path, applyTemplate(template, meta, extra, staticBody(meta)));
    entries.push({ path: meta.path, lastmod: today });
  }
  for (const p of plugins) {
    const meta = pluginMeta(p);
    write(meta.path, applyTemplate(template, meta, pluginLd(p, meta), pluginBody(p, meta)));
    entries.push({ path: meta.path, lastmod: p.updated || today });
  }
  writeFileSync(join(distDir, "sitemap.xml"), sitemapXml(entries));
  writeFileSync(join(distDir, "robots.txt"), robotsTxt());
  return entries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = resolve(process.argv[2] ?? join(root, "dist"));
  const data = JSON.parse(readFileSync(join(root, "src/data/plugins.json"), "utf8"));
  const entries = build(dist, data.plugins);
  console.log(`预渲染完成:${entries.length} 个页面(含 ${data.plugins.length} 个插件详情页),已生成 sitemap.xml 与 robots.txt`);
}
