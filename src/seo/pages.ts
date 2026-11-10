// 各页面的 SEO 元信息(标题、描述、规范路径)与插件详情页的生成规则。
// 预渲染脚本(构建时)和前端路由(浏览器里切换页面时)共用这一份,保证两边一致。
import { CATEGORIES, authorOf, cadenceText, compatSummary, downloadsText, formatStars, type Plugin } from "../plugins/lib.ts";

import categoryCopy from "../content/category-copy.json" with { type: "json" };

export const SITE = "https://zoterocn.org";
export const SITE_NAME = "Zotero 中文社区";
export const OG_IMAGE = `${SITE}/images/plugins/og-plugins.png`;

/** 页面类型:决定分享图等按类型区分的设置。 */
export type PageKind = "home" | "section" | "plugin" | "category" | "guide" | "notfound";

/**
 * 各类页面的分享图(og:image)。目前只有一张通用图,全部回退到它;
 * 以后有了某类页面的专用图,在这里加一行即可,例如 plugin: `${SITE}/images/og/plugin.png`。
 */
export const OG_IMAGES: Partial<Record<PageKind, string>> = {};
export const ogImage = (kind: PageKind | undefined): string => (kind && OG_IMAGES[kind]) || OG_IMAGE;

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  h1: string;
  kind?: PageKind;
  /**
   * 是否允许搜索引擎收录,默认允许。设为 false 时页面带 noindex、不进 sitemap 与 llms.txt。
   * 筹备中的占位页先设为 false,有了实质内容后删掉这个字段即可。
   */
  indexable?: boolean;
}

export const isIndexable = (m: PageMeta): boolean => m.indexable !== false;
export const pageUrl = (path: string): string => `${SITE}${path === "/" ? "/" : path}`;

// 标题与描述由独立的文案调研产出,逐条核对过字数与事实;不夸大、不给任何插件特殊对待。
// h1 就是页面上显示的大标题,页面组件直接读这里,保证静态页面与浏览器里看到的一致。
export const STATIC_PAGES: PageMeta[] = ([
  { path: "/", title: "Zotero 中文社区｜插件、教程与期刊查询", description: "查找 Zotero 插件、阅读中文教程、查询期刊信息与引用样式。按自己的研究需要选择工具，查看兼容范围和公开更新记录。", h1: "让 Zotero 更顺手,让研究更有条理", kind: "home" },
  { path: "/plugins", title: "Zotero 插件广场｜用途、兼容与更新", description: "按用途、Zotero 版本和更新时间筛选插件，查看适配范围、公开发布记录及下载入口。所有插件按同一规则展示。", h1: "Zotero 插件广场" },
  { path: "/plugins/charts", title: "Zotero 插件数据看板｜星标、下载与更新", description: "查看已收录插件的公开星标、安装包下载次数、版本适配与发布节奏。结合统计日期和数据说明，了解社区插件的变化。", h1: "Zotero 插件数据看板" },
  { path: "/journals", title: "期刊查询｜收录、分区与期刊指标", description: "输入期刊名称、缩写或 ISSN，查询收录、分区与期刊指标。查看数据版本，缺失项目显示暂无，帮助核对期刊信息。", h1: "期刊查询" },
  { path: "/submission", title: "投稿建议｜了解期刊与投稿准备", description: "了解投稿前需要核对的期刊信息与准备事项。本栏目正在筹备，可先使用期刊查询核对收录、分区和相关指标。", h1: "投稿建议", indexable: false },
  { path: "/guides", title: "Zotero 教程｜从入门使用到插件开发", description: "阅读 Zotero 中文教程，了解插件开发准备、首个插件、调试与发布流程。每篇附参考来源，便于继续查证和实践。", h1: "Zotero 中文教程" },
  { path: "/styles", title: "Zotero 引用样式｜查找与安装指南", description: "了解 Zotero 引用样式的查找与安装方法，前往官方样式库核对期刊要求。投稿前请以目标期刊的最新说明为准。", h1: "Zotero 引用样式" },
  { path: "/forum", title: "Zotero 问答讨论｜使用问题与交流入口", description: "查找 Zotero 使用问题的交流入口，了解如何描述问题、提供版本与复现步骤，便于与其他使用者共同排查。", h1: "Zotero 问答讨论", indexable: false },
  { path: "/rules", title: "收录与数据规则｜Zotero 中文社区", description: "了解插件收录、兼容范围、公开数据和排序规则。所有插件一视同仁，不设付费置顶或推荐位，未声明的兼容范围不作推定。", h1: "收录与数据规则" },
  { path: "/about", title: "关于本站｜Zotero 中文社区", description: "了解 Zotero 中文社区的用途与参与方式。本站由社区自发运营，提供插件信息、中文教程及期刊查询，与 Zotero 官方无隶属关系。", h1: "关于 Zotero 中文社区" },
] as PageMeta[]).map((m): PageMeta => ({ kind: "section", ...m }));

/** 栏目页的元信息;页面组件用它取标题。 */
export function pageMeta(path: string): PageMeta {
  const m = STATIC_PAGES.find((x) => x.path === path);
  if (!m) throw new Error(`没有这个栏目页: ${path}`);
  return m;
}

const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<string, string>;

/** 插件详情页的元信息。描述只用事实字段拼出,不夸大、不对任何插件特殊对待。 */
/** 出现不止一次的插件名(同名不同作者);这些插件的标题要加上作者区分,避免页面标题重复。 */
export function duplicateNames(list: Plugin[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const p of list) (seen.has(p.name) ? dup : seen).add(p.name);
  return dup;
}

export function pluginMeta(p: Plugin, dup = false): PageMeta {
  const compat = compatSummary(p).text;
  // 动态字段缺失就整句省略,不填 0、不猜测;星标只是热度,不代表质量
  const facts = [`${formatStars(p.stars)} 星标`, p.cadence ? cadenceText(p) : null, downloadsText(p)].filter(Boolean).join(",");
  return {
    path: `/plugins/${p.id}`,
    title: `${p.name}${dup ? `(${p.id})` : ""}｜Zotero ${CAT[p.category] ?? ""}插件`,
    description: `${p.summary} 作者 ${authorOf(p.id)}。适配范围:${compat}。${facts ? facts + "。" : ""}查看发布记录与下载入口。`.slice(0, 200),
    h1: p.name,
    kind: "plugin",
  };
}

// ---------- 分类落地页 ----------

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key as string);
export const categoryPath = (key: string) => `/categories/${key}`;
export const categoryIntro = (key: string): string => (categoryCopy as Record<string, string>)[key] ?? "";

export function categoryMeta(key: string): PageMeta | null {
  const c = CATEGORIES.find((x) => x.key === key);
  if (!c) return null;
  return {
    path: categoryPath(key),
    title: `${c.label}类 Zotero 插件｜用途、适配与下载`,
    description: categoryIntro(key).slice(0, 160),
    h1: `${c.label}类 Zotero 插件`,
    kind: "category",
  };
}

export const categoryLabel = (key: string): string => CAT[key] ?? "";
