#!/usr/bin/env node
// 中文引用样式一览的数据(只有元数据,不含样式文件本身):src/content/styles-index.json。
// 引用样式页的「中文引用样式一览」与公开的 /data/styles.json 都只读这一份文件。
//
// 数据怎么来:逐个读取样式文件头里的 <info>(标题、简称、ID、引文方式、类别、许可、更新时间)与 <style> 上的默认语言。
//   1. CSL 官方样式仓库(citation-style-language/styles,即 Zotero 样式库的来源):OFFICIAL 里列出的、默认语言为中文的样式;
//      每一个还要在 Zotero 样式库的公开索引(styles.json)里找得到,找不到就报错,不写入。
//   2. zotero-chinese/styles 社区仓库:src/ 下名称以「GB-T-7714」开头的样式目录(国标 GB/T 7714 的各种变体)。
// 读不到、缺字段、默认语言不是中文的,一律报错,不猜测、不手填。
//
// 用法(需要联网,只在手动刷新时运行;构建不联网,只读已提交的文件):
//   npm run refresh:styles(即 node scripts/styles-index.mjs)读取来源并写回 src/content/styles-index.json
//   node scripts/styles-index.mjs --check    只读取并与已提交的文件比较,不写文件
// schema 1 的字段只增不改。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const STYLES_SCHEMA = 1;
export const STYLES_FILE = fileURLToPath(new URL("../src/content/styles-index.json", import.meta.url));
/** 构建时写出的公开文件(相对构建目录)。 */
export const STYLES_FEED_FILE = "data/styles.json";
export const SITE = "https://zoterocn.org";

const CSL_REPO = "citation-style-language/styles";
const CSL_BRANCH = "master";
const ZC_REPO = "zotero-chinese/styles";
const ZC_BRANCH = "main";
const ZOTERO_INDEX = "https://www.zotero.org/styles-files/styles.json";

export const SOURCES = {
  csl: { label: "CSL 官方样式仓库(Zotero 样式库)", repo: `https://github.com/${CSL_REPO}`, site: "https://www.zotero.org/styles" },
  "zotero-chinese": { label: "zotero-chinese/styles 中文样式仓库", repo: `https://github.com/${ZC_REPO}`, site: "https://zotero-chinese.com/styles/" },
};

/**
 * 官方仓库里默认语言为中文(default-locale="zh-CN")的独立样式。
 * 名单按官方仓库根目录全部样式文件核对得到;刷新时脚本会逐个确认默认语言,不符就报错。
 * use:适用场景,只写样式文件头(标题、摘要、文档链接)里能直接看出来的用途。
 */
export const OFFICIAL = [
  { name: "china-national-standard-gb-t-7714-2025-numeric" },
  { name: "china-national-standard-gb-t-7714-2025-author-date" },
  { name: "china-national-standard-gb-t-7714-2025-note" },
  { name: "china-national-standard-gb-t-7714-2015-numeric" },
  { name: "china-national-standard-gb-t-7714-2015-author-date" },
  { name: "china-national-standard-gb-t-7714-2015-note" },
  { name: "chinese-gb7714-2005-numeric" },
  { name: "chinese-gb7714-2005-author-date" },
  { name: "chinese-gb7714-1987-numeric" },
  { name: "acta-physica-sinica", use: "期刊投稿:物理学报" },
  { name: "building-structure", use: "期刊投稿:Building Structure(ISSN 1002-848X)" },
  { name: "law-citation-manual", use: "法学论文注释" },
  { name: "national-natural-science-foundation-of-china", use: "基金申请书:国家自然科学基金" },
];

/** 社区仓库里收进一览的样式目录:国标 GB/T 7714 的各种变体。 */
export const ZC_PREFIX = "GB-T-7714";

const FORMATS = new Set(["numeric", "author-date", "note", "author", "label"]);

const unxml = (s) => s
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&")
  .trim();

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], unxml(m[2])]));

/**
 * 解析样式文件头:<style> 的属性与 <info> 里的元数据。只读文件头,不保留任何样式规则。
 * 返回 null 表示不是 CSL 样式文件。
 */
export function parseCslInfo(xml) {
  if (typeof xml !== "string") return null;
  const style = /<style\b[^>]*>/.exec(xml);
  const info = /<info>([\s\S]*?)<\/info>/.exec(xml);
  if (!style || !info) return null;
  const s = attrs(style[0]);
  const body = info[1];
  const text = (tag) => {
    const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(body);
    return m ? unxml(m[1]) : null;
  };
  const links = [...body.matchAll(/<link\b[^>]*\/?>/g)].map((m) => attrs(m[0]));
  const cats = [...body.matchAll(/<category\b[^>]*\/?>/g)].map((m) => attrs(m[0]));
  const rights = /<rights\b([^>]*)>([\s\S]*?)<\/rights>/.exec(body);
  return {
    class: s.class ?? null,
    version: s.version ?? null,
    defaultLocale: s["default-locale"] ?? null,
    title: text("title"),
    titleShort: text("title-short"),
    id: text("id"),
    summary: text("summary"),
    updated: text("updated"),
    citationFormat: cats.find((c) => c["citation-format"])?.["citation-format"] ?? null,
    fields: cats.filter((c) => c.field).map((c) => c.field),
    links: links.filter((l) => l.href && l.rel).map((l) => ({ rel: l.rel, href: l.href })),
    license: rights ? { url: attrs(`<x ${rights[1]}>`).license ?? null, text: unxml(rights[2]) } : null,
  };
}

/** 从标题里认出国标 GB/T 7714 的版本年份(「GB/T 7714-2015」「GB/T 7714—2015」都算);认不出返回 null。 */
export function gbtEdition(title) {
  const m = /GB\/T\s*7714\s*[-—–]\s*(\d{4})/.exec(title ?? "");
  return m ? m[1] : null;
}

/** 适用场景:标题是国标的写「国家标准 GB/T 7714—年份」,其余用名单里写明的用途。 */
export function useOf(info, use) {
  const ed = gbtEdition(info.title);
  if (ed) return `国家标准 GB/T 7714—${ed}`;
  return use ?? null;
}

const ghBlob = (repo, branch, path) => `https://github.com/${repo}/blob/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`;
const ghRaw = (repo, branch, path) => `https://raw.githubusercontent.com/${repo}/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`;

/** 官方样式在 Zotero 样式库里的页面:样式库支持用「id:样式名」检索单个样式(打开的是网页,不是样式文件)。 */
export const zoteroLibraryPage = (name) => `https://www.zotero.org/styles/?q=${encodeURIComponent(`id:${name}`)}`;

/**
 * 由样式文件头生成一条一览记录。缺字段或默认语言不是中文就抛错。
 * source:"csl" | "zotero-chinese";path:样式文件在仓库里的路径;page:样式的介绍页(网页)。
 */
export function styleEntry(info, { source, path, page, use }) {
  const where = `${source}:${path}`;
  if (!info) throw new Error(`${where} 不是 CSL 样式文件`);
  for (const k of ["title", "id", "citationFormat", "updated", "defaultLocale"]) if (!info[k]) throw new Error(`${where} 缺少 ${k}`);
  if (!/^zh\b/.test(info.defaultLocale)) throw new Error(`${where} 默认语言不是中文:${info.defaultLocale}`);
  if (!FORMATS.has(info.citationFormat)) throw new Error(`${where} 引文方式不认识:${info.citationFormat}`);
  if (!info.license?.url) throw new Error(`${where} 文件头没有写许可`);
  const u = useOf(info, use);
  if (!u) throw new Error(`${where} 说不出适用场景(不是国标样式,名单里也没写用途)`);
  const repo = source === "csl" ? CSL_REPO : ZC_REPO;
  const branch = source === "csl" ? CSL_BRANCH : ZC_BRANCH;
  const documentation = info.links.filter((l) => l.rel === "documentation").map((l) => l.href);
  const template = info.links.find((l) => l.rel === "template")?.href;
  return {
    id: info.id,
    title: info.title,
    ...(info.titleShort ? { titleShort: info.titleShort } : {}),
    source,
    use: u,
    ...(gbtEdition(info.title) ? { standard: `GB/T 7714—${gbtEdition(info.title)}` } : {}),
    citationFormat: info.citationFormat,
    fields: info.fields,
    defaultLocale: info.defaultLocale,
    updated: info.updated,
    license: info.license,
    page,
    file: ghBlob(repo, branch, path),
    ...(documentation.length ? { documentation } : {}),
    ...(template ? { template } : {}),
  };
}

/** 一览的排序:官方在前、社区在后;各自按国标版本从新到旧,同版本按标题。 */
export function sortStyles(list) {
  const rank = (s) => (s.source === "csl" ? 0 : 1);
  const year = (s) => Number(gbtEdition(s.title) ?? 0);
  return [...list].sort((a, b) => rank(a) - rank(b) || year(b) - year(a) || a.title.localeCompare(b.title, "zh-Hans-CN"));
}

export function buildStylesIndex({ styles, checkedAt, counts }) {
  return {
    schema: STYLES_SCHEMA,
    checkedAt,
    site: SITE,
    note: "只含样式的元数据,不含样式文件;样式文件请到 page 或 file 所指的来源获取,并遵守 license 所写的许可。",
    sources: Object.entries(SOURCES).map(([key, s]) => ({ key, ...s, ...(counts?.[key] != null ? { styleCount: counts[key] } : {}) })),
    count: styles.length,
    styles: sortStyles(styles),
  };
}

const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHttps = (v) => typeof v === "string" && /^https:\/\/[^\s"<>]+$/.test(v);
export const STYLE_KEYS = new Set(["id", "title", "titleShort", "source", "use", "standard", "citationFormat", "fields", "defaultLocale", "updated", "license", "page", "file", "documentation", "template"]);
const PAGE_HOSTS = /^https:\/\/(www\.zotero\.org\/styles\/\?q=|zotero-chinese\.com\/styles\/)/;

/** 校验一览数据;返回问题清单(空数组表示通过)。只放元数据:任何像样式规则的内容都算错。 */
export function validateStylesIndex(idx) {
  const errs = [];
  const bad = (m) => errs.push(m);
  if (idx?.schema !== STYLES_SCHEMA) bad("schema 不是 1");
  if (!isDay(idx?.checkedAt)) bad("checkedAt 不是日期");
  if (idx?.site !== SITE) bad("site 不对");
  if (!Array.isArray(idx?.sources) || idx.sources.some((s) => !SOURCES[s?.key] || !isHttps(s.repo) || !isHttps(s.site))) bad("sources 格式不对");
  if (!Array.isArray(idx?.styles)) return [...errs, "styles 不是数组"];
  if (idx.count !== idx.styles.length) bad("count 与 styles 条数不一致");
  const seen = new Set();
  for (const s of idx.styles) {
    const at = `样式 ${s?.id}`;
    for (const k of Object.keys(s ?? {})) if (!STYLE_KEYS.has(k)) bad(`${at} 多出字段 ${k}`);
    if (typeof s?.id !== "string" || !/^https?:\/\/\S+$/.test(s.id)) bad(`${at} id 不对`);
    if (seen.has(s?.id)) bad(`${at} 重复`);
    seen.add(s?.id);
    if (!SOURCES[s?.source]) bad(`${at} source 不对`);
    if (typeof s?.title !== "string" || !s.title) bad(`${at} 缺标题`);
    if (typeof s?.use !== "string" || !s.use) bad(`${at} 缺适用场景`);
    if (!FORMATS.has(s?.citationFormat)) bad(`${at} 引文方式不对`);
    if (!Array.isArray(s?.fields) || s.fields.some((f) => typeof f !== "string")) bad(`${at} fields 不对`);
    if (typeof s?.defaultLocale !== "string" || !/^zh\b/.test(s.defaultLocale)) bad(`${at} 默认语言不是中文`);
    if (typeof s?.updated !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(s.updated)) bad(`${at} updated 不对`);
    if (!/^https?:\/\/\S+$/.test(s?.license?.url ?? "") || typeof s?.license?.text !== "string") bad(`${at} 许可不对`);
    if (!PAGE_HOSTS.test(s?.page ?? "")) bad(`${at} page 不是样式库或社区仓库的介绍页`);
    const repo = s?.source === "csl" ? CSL_REPO : ZC_REPO;
    if (!String(s?.file ?? "").startsWith(`https://github.com/${repo}/blob/`)) bad(`${at} file 不在对应仓库`);
    if ("documentation" in s && (!Array.isArray(s.documentation) || s.documentation.some((u) => !/^https?:\/\/\S+$/.test(u)))) bad(`${at} documentation 不对`);
    if (/<(macro|citation|bibliography|layout|style)\b/.test(JSON.stringify(s))) bad(`${at} 含有样式规则,一览只能放元数据`);
  }
  return errs;
}

/** 由已提交的一览生成公开文件 /data/styles.json(与一览完全相同,校验不过就让构建失败)。 */
export function stylesFeed(idx) {
  const errs = validateStylesIndex(idx);
  if (errs.length) throw new Error(`引用样式一览校验失败:\n${errs.slice(0, 20).join("\n")}`);
  return idx;
}

export const stylesJson = (idx) => `${JSON.stringify(idx, null, 2)}\n`;

// ---------- 联网读取(只在手动刷新时运行) ----------

async function get(url, as = "text") {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { "user-agent": "zotero-community-styles-index", accept: as === "json" ? "application/json" : "*/*" } });
    if (r.ok) return as === "json" ? r.json() : r.text();
    if (r.status === 404) throw new Error(`读取失败 404:${url}`);
    await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
  }
  throw new Error(`读取失败:${url}`);
}

export async function collect({ fetchText = (u) => get(u), fetchJson = (u) => get(u, "json") } = {}) {
  const zoteroIndex = await fetchJson(ZOTERO_INDEX);
  const inLibrary = new Map(zoteroIndex.map((s) => [s.name, s]));
  const styles = [];
  for (const o of OFFICIAL) {
    const lib = inLibrary.get(o.name);
    if (!lib) throw new Error(`Zotero 样式库的公开索引里没有 ${o.name}`);
    if (lib.dependent !== 0) throw new Error(`${o.name} 在样式库里是从属样式,一览只收独立样式`);
    const path = `${o.name}.csl`;
    const info = parseCslInfo(await fetchText(ghRaw(CSL_REPO, CSL_BRANCH, path)));
    styles.push(styleEntry(info, { source: "csl", path, page: zoteroLibraryPage(o.name), use: o.use }));
  }
  const tree = await fetchJson(`https://api.github.com/repos/${ZC_REPO}/git/trees/${ZC_BRANCH}?recursive=1`);
  if (tree.truncated) throw new Error("社区仓库的文件列表被截断,无法确认全部样式");
  const dirs = tree.tree.filter((t) => t.type === "tree" && /^src\/[^/]+$/.test(t.path)).map((t) => t.path.slice(4));
  const files = new Set(tree.tree.filter((t) => t.type === "blob").map((t) => t.path));
  const zcStyles = dirs.filter((d) => files.has(`src/${d}/${d}.csl`));
  for (const d of zcStyles.filter((x) => x.startsWith(ZC_PREFIX))) {
    const path = `src/${d}/${d}.csl`;
    const info = parseCslInfo(await fetchText(ghRaw(ZC_REPO, ZC_BRANCH, path)));
    const self = info?.links.find((l) => l.rel === "self")?.href;
    styles.push(styleEntry(info, { source: "zotero-chinese", path, page: self ? encodeURI(self).replace(/\/?$/, "/") : "" }));
  }
  const counts = { csl: zoteroIndex.length, "zotero-chinese": zcStyles.length };
  return { styles, counts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  const { styles, counts } = await collect();
  const idx = buildStylesIndex({ styles, checkedAt: new Date().toISOString().slice(0, 10), counts });
  const errs = validateStylesIndex(idx);
  if (errs.length) {
    console.error(errs.join("\n"));
    process.exit(1);
  }
  if (check) {
    const old = JSON.parse(readFileSync(STYLES_FILE, "utf8"));
    const strip = (x) => JSON.stringify({ ...x, checkedAt: "" });
    console.log(strip(old) === strip(idx) ? "与已提交的一览一致" : "来源有变化,请运行 node scripts/styles-index.mjs 更新并提交");
  } else {
    writeFileSync(STYLES_FILE, stylesJson(idx));
    console.log(`已写入 ${idx.count} 个样式(官方 ${styles.filter((s) => s.source === "csl").length} 个,社区 ${styles.filter((s) => s.source === "zotero-chinese").length} 个)`);
  }
}
