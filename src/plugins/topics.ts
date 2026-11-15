import type { Plugin } from "./lib.ts";

/**
 * 功能专题:按「想做什么」找插件(翻译、引用、笔记……)。
 * 与分类不同:一个插件只有一个主分类,却可能同时属于多个专题。
 * 收录规则公开且对所有插件一视同仁——插件名称或简介里出现该专题的关键词就收录,不看星标、不看作者,没有任何人工指定。
 */
export type Topic = {
  key: string;
  /** 用户的说法,页面标题写作「Zotero ${label}插件」 */
  label: string;
  /** 关键词(不分大小写)。纯英文短词按整词匹配,避免 ai 命中 main 之类。 */
  terms: string[];
  /** 页面开头的选择指引:只讲怎么挑,不点名任何插件,不写功能承诺。 */
  intro: string;
};

/** 专题至少要有这么多款在架插件才生成页面,避免内容单薄的空壳页。 */
export const MIN_TOPIC_PLUGINS = 3;

export const TOPICS: Topic[] = [
  {
    key: "translate",
    label: "翻译",
    terms: ["翻译", "translat", "bilingual", "双语", "沉浸"],
    intro: "翻译类插件覆盖划词翻译、标题与摘要翻译、整篇 PDF 全文翻译等不同范围。选择时可先确认要翻译的是一句话、一篇论文还是整批文献，再核对支持的翻译服务、是否需要自备密钥、译文如何保存，以及适配的 Zotero 版本。",
  },
  {
    key: "ai-chat",
    label: "AI 问答",
    terms: ["问答", "对话", "ai assistant", "ai 助手", "ai助手", "chat", "llm", "大模型", "gpt", "claude", "deepseek", "gemini", "ollama"],
    intro: "这类插件把大模型接入文献阅读，用于提问、总结或讲解论文。选择时可核对支持的模型与服务商、数据会发送到哪里、费用如何计算，以及回答能否回到原文核对；重要结论仍需自己对照原文确认。",
  },
  {
    key: "search",
    label: "文献检索",
    terms: ["文献检索", "检索", "搜索", "literature search", "paper search", "discover", "semantic scholar", "openalex"],
    intro: "文献检索类插件在 Zotero 内查找、发现或导入新文献。可比较它连接的数据库范围、是否支持中文检索词、结果如何导入文库，并留意各数据来源的使用条件。",
  },
  {
    key: "citation",
    label: "引用与参考文献",
    terms: ["引用", "参考文献", "citation", "bibliograph", "citekey", "csl", "bibtex", "biblatex", "cite"],
    intro: "引用类插件处理引用键、参考文献格式与引用关系。选择时可按写作环境（Word、LaTeX、Markdown）和目标期刊的格式要求筛选，并核对适配的 Zotero 版本；投稿前仍应以目标期刊最新要求为准。",
  },
  {
    key: "notes",
    label: "笔记与批注",
    terms: ["笔记", "note", "annotation", "批注", "标注", "highlight", "摘录"],
    intro: "笔记与批注类插件扩展摘录、笔记编辑、批注管理或导出。可查看笔记保存在哪里、支持哪些格式，以及停用插件后已有内容是否仍能读取。",
  },
  {
    key: "metadata",
    label: "元数据补全",
    terms: ["元数据", "metadata", "doi", "isbn", "抓取", "scrap", "补全"],
    intro: "元数据类插件补全或校对题名、作者、标识符等条目信息。使用前请了解信息来源和修改范围，批量处理前先用少量条目试一遍，重要字段仍需结合原文核对。",
  },
  {
    key: "chinese",
    label: "中文文献与知网",
    terms: ["知网", "cnki", "万方", "维普", "中文文献", "中文题录", "中文 pdf", "中文pdf", "caj", "中文期刊"],
    intro: "中文文献类插件针对知网、万方等中文来源的题录抓取、中文 PDF 识别和姓名整理。选择时可核对支持的网站与文件格式，以及网站改版后项目的维护情况。",
  },
  {
    key: "journal",
    label: "期刊分区与影响因子",
    terms: ["期刊", "journal", "影响因子", "分区", "impact factor", "jcr", "easyscholar"],
    intro: "这类插件在文献列表里显示期刊的分区、影响因子或收录情况。选择时可核对指标来源与数据版本，不同来源口径并不相同；选刊和投稿前请以期刊官方及目标机构的最新要求为准。",
  },
  {
    key: "sync",
    label: "同步与备份",
    terms: ["同步", "sync", "备份", "backup", "webdav"],
    intro: "同步与备份类插件处理文库、附件或设置在设备之间的同步与备份。使用前请先确认数据存放位置和恢复办法，并在重要数据上保留独立备份。",
  },
  {
    key: "dedup",
    label: "去重与清理",
    terms: ["去重", "重复条目", "duplicate", "清理", "同标题"],
    intro: "去重与清理类插件查找并处理重复条目、无效附件或空条目。批量合并或删除前建议先备份文库，再在少量条目上确认结果。",
  },
  {
    key: "organize",
    label: "整理与重命名",
    terms: ["标签", "tag", "整理", "重命名", "rename", "归档", "organiz", "分类"],
    intro: "整理类插件帮助打标签、分类、归档或批量重命名附件。选择时可看它改动的是条目还是文件、能否撤销，批量处理前先在测试条目上验证。",
  },
  {
    key: "ocr",
    label: "OCR 与扫描件",
    terms: ["ocr", "扫描"],
    intro: "OCR 类插件把扫描版 PDF 转为可检索文字，或识别图片中的内容。可比较支持的语言、识别质量、是否改写原文件，以及处理大批量文件的速度。",
  },
  {
    key: "visual",
    label: "可视化与图谱",
    terms: ["可视化", "visuali", "图谱", "graph", "思维导图", "mind map", "mindmap", "network"],
    intro: "可视化类插件把文献之间的联系或文库信息转成图形。选择时可关注关系数据从何而来、图形支持哪些操作；图中联系只表示其数据与规则所定义的关系，不等同研究结论。",
  },
  {
    key: "export",
    label: "导入导出",
    terms: ["导出", "export", "导入", "import", "markdown", "obsidian", "notion", "logseq", "latex", "overleaf"],
    intro: "导入导出类插件连接 Zotero 与其他笔记、写作或知识管理工具。可按目标工具查找，并核对支持的格式、内容范围（条目、笔记、批注）和同步方向。",
  },
  {
    key: "attachment",
    label: "附件与全文下载",
    terms: ["附件", "attachment", "全文下载", "full text", "fulltext", "unpaywall", "open access", "pdf 下载", "查找 pdf", "find pdf"],
    intro: "附件类插件查找、下载或管理文献的全文与附件。使用前请阅读它对文件和路径的处理方式，并留意下载来源的版权与使用条件。",
  },
  {
    key: "automation",
    label: "自动化与 MCP",
    terms: ["mcp", "agent", "自动化", "automation", "脚本", "workflow", "工作流"],
    intro: "自动化类插件用规则、脚本或外部程序接口批量处理文库。使用前请了解它会读取和修改哪些内容，先在少量条目上测试，再用于整个文库。",
  },
  {
    key: "reader",
    label: "PDF 阅读增强",
    terms: ["阅读器", "pdf reader", "reader", "预览", "preview", "阅读模式", "pdf 阅读", "pdf阅读"],
    intro: "阅读增强类插件改进 PDF 阅读体验，例如预览、阅读界面、页面显示或阅读辅助。可先确认它作用于文库列表还是阅读器，再核对适配的 Zotero 版本。",
  },
];

export const TOPIC_KEYS = TOPICS.map((t) => t.key);
export const topicOf = (key: string): Topic | undefined => TOPICS.find((t) => t.key === key);

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const regexCache = new Map<string, RegExp>();

/** 一个专题的匹配正则:纯英文数字且不长于 4 个字符的词按整词匹配,其余按子串匹配。 */
function regexOf(t: Topic): RegExp {
  let re = regexCache.get(t.key);
  if (!re) {
    const parts = t.terms.map((w) => (/^[A-Za-z0-9]{1,4}$/.test(w) ? `\\b${escapeRe(w)}\\b` : escapeRe(w)));
    re = new RegExp(parts.join("|"), "i");
    regexCache.set(t.key, re);
  }
  return re;
}

export const matchesTopic = (p: Pick<Plugin, "name" | "summary">, t: Topic): boolean => regexOf(t).test(`${p.name} ${p.summary ?? ""}`);

/** 专题内的插件:与分类页同一排序(GitHub 星标从高到低,同星标按名称)。 */
export function topicList(plugins: Plugin[], key: string): Plugin[] {
  const t = topicOf(key);
  if (!t) return [];
  return plugins
    .filter((p) => matchesTopic(p, t))
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

/** 有页面的专题(在架插件数不少于下限),保持 TOPICS 里的顺序。 */
export function activeTopics(plugins: Plugin[]): { topic: Topic; count: number }[] {
  return TOPICS.map((topic) => ({ topic, count: topicList(plugins, topic.key).length })).filter((x) => x.count >= MIN_TOPIC_PLUGINS);
}

/** 页面上公开展示的收录规则。 */
export const topicRule = (t: Topic): string => `收录规则：插件名称或简介中出现「${t.terms.slice(0, 6).join("」「")}」等词。所有插件按同一规则判断，不看作者、不看星标，没有人工指定。`;

export type TopicIndexItem = { key: string; label: string; count: number };
/** 首页、插件广场的「按功能找插件」入口:只含有页面的专题。 */
export const topicIndex = (plugins: Plugin[]): TopicIndexItem[] => activeTopics(plugins).map(({ topic, count }) => ({ key: topic.key, label: topic.label, count }));
