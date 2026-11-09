// 各页面的 SEO 元信息(标题、描述、规范路径)与插件详情页的生成规则。
// 预渲染脚本(构建时)和前端路由(浏览器里切换页面时)共用这一份,保证两边一致。
import { CATEGORIES, authorOf, cadenceText, compatSummary, downloadsText, formatStars, speedText, type Plugin } from "../plugins/lib.ts";

export const SITE = "https://zoterocn.org";
export const SITE_NAME = "Zotero 中文社区";
export const OG_IMAGE = `${SITE}/images/plugins/og-plugins.png`;

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  h1: string;
  /** 不希望被搜索引擎收录的页面 */
  noindex?: boolean;
}

export const STATIC_PAGES: PageMeta[] = [
  { path: "/", title: "Zotero 中文社区 - Zotero 插件、教程与期刊查询", description: "Zotero 中文社区:收录 Zotero 插件并提供下载,查询期刊分区与影响因子,整理教程与插件开发指南,一视同仁、公开透明。", h1: "把 Zotero 用顺手" },
  { path: "/plugins", title: "Zotero 插件广场 - 插件下载、适配版本与更新速度", description: "收录常用 Zotero 插件,按星标、下载、更新速度排序,查看适配的 Zotero 版本并直接下载安装包。数据来自各项目公开信息,每天更新。", h1: "插件广场" },
  { path: "/plugins/charts", title: "Zotero 插件数据看板 - 星标、下载与更新榜单", description: "Zotero 插件的星标榜、下载榜、更新最勤榜、分类分布与 Zotero 版本适配统计,基于 GitHub 公开数据,每天自动更新。", h1: "插件数据看板" },
  { path: "/journals", title: "期刊查询 - 影响因子、JCR 与中科院分区", description: "按期刊名称、缩写或 ISSN 查询影响因子、JCR 分区、中科院分区,以及 SCIE、SSCI、EI、CCF、北大核心、CSSCI 等收录与榜单。", h1: "期刊查询" },
  { path: "/submission", title: "投稿建议 - 选刊、改稿与回复审稿意见", description: "从选刊、投稿前检查到回复审稿意见的经验整理,正在筹备中。", h1: "投稿建议" },
  { path: "/guides", title: "Zotero 教程 - 从入门到插件开发", description: "Zotero 中文教程:安装与日常使用、插件使用技巧,以及 Zotero 插件开发入门到发布的完整指南。", h1: "教程" },
  { path: "/styles", title: "引用样式 - 常用期刊与学位论文格式", description: "常用期刊与学位论文的 Zotero 引用样式整理,正在筹备中。", h1: "引用样式" },
  { path: "/forum", title: "问答讨论 - Zotero 使用交流", description: "Zotero 使用问题的问答与讨论,正在筹备中。", h1: "问答讨论" },
  { path: "/rules", title: "收录规则 - 插件收录、排序与下架说明", description: "Zotero 插件广场的收录范围、标准、排序与标签规则、数据来源,以及申请收录、更正和下架的办法。", h1: "收录规则" },
  { path: "/about", title: "关于本站 - Zotero 中文社区", description: "Zotero 中文社区是社区自发运营的非官方站点,公开透明、一视同仁,说明站点内容、原则与反馈方式。", h1: "关于本站" },
];

const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<string, string>;

/** 插件详情页的元信息。描述只用事实字段拼出,不夸大、不对任何插件特殊对待。 */
export function pluginMeta(p: Plugin): PageMeta {
  const compat = compatSummary(p).text;
  const facts = [`作者 ${authorOf(p.id)}`, `${formatStars(p.stars)} 星标`, cadenceText(p), downloadsText(p)].filter(Boolean).join(",");
  return {
    path: `/plugins/${p.id}`,
    title: `${p.name} - Zotero 插件(${CAT[p.category] ?? "插件"})· ${compat}`,
    description: `${p.summary} ${facts}。${compat}。可在页面直接下载安装包。`.slice(0, 200),
    h1: p.name,
  };
}

/** 供预渲染写进页面正文的事实列表(爬虫可读),与前端详情页展示的事实一致。 */
export function pluginFacts(p: Plugin): [string, string][] {
  const rows: [string, string][] = [
    ["分类", CAT[p.category] ?? "插件"],
    ["作者", authorOf(p.id)],
    ["适配 Zotero", compatSummary(p).text],
    ["GitHub 星标", p.stars.toLocaleString("zh-CN")],
  ];
  if (p.latest) rows.push(["最新版本", `v${p.latest.version}(${p.latest.date})`]);
  const dl = downloadsText(p);
  if (dl) rows.push(["累计下载", dl.replace(/\s?次下载$/, " 次")]);
  rows.push(["更新节奏", [cadenceText(p), speedText(p)].filter(Boolean).join(",")]);
  return rows;
}
