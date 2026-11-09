// 社区站首版内容:全部为公开信息的整理,不编造用户数据。
// 论坛等需要真实用户产出的板块在后端接入前显示「筹备中」,不放假帖子。

export type PluginCategory = "citation" | "reading" | "notes" | "metadata" | "translate" | "other";

export interface PluginEntry {
  id: string;
  name: string;
  author: string;
  summary: string;
  category: PluginCategory;
  /** 项目主页(开源仓库)。上线前需逐条核验链接可用。 */
  homepage: string;
}

export const PLUGIN_CATEGORIES: Record<PluginCategory, string> = {
  citation: "引用与写作",
  reading: "阅读与标注",
  notes: "笔记",
  metadata: "题录整理",
  translate: "翻译",
  other: "其他",
};

export const PLUGINS: PluginEntry[] = [
  {
    id: "better-bibtex",
    name: "Better BibTeX",
    author: "retorquere",
    summary: "为每条文献生成稳定的引用键,并支持与 LaTeX 写作流程自动同步导出。",
    category: "citation",
    homepage: "https://github.com/retorquere/zotero-better-bibtex",
  },
  {
    id: "jasminum",
    name: "茉莉花 Jasminum",
    author: "l0o0",
    summary: "中文文献元数据抓取与补全,适合知网等中文来源的条目整理。",
    category: "metadata",
    homepage: "https://github.com/l0o0/jasminum",
  },
  {
    id: "pdf-translate",
    name: "Translate for Zotero",
    author: "windingwind",
    summary: "在阅读器里选中文字即时翻译,也支持条目标题和摘要翻译。",
    category: "translate",
    homepage: "https://github.com/windingwind/zotero-pdf-translate",
  },
  {
    id: "better-notes",
    name: "Better Notes",
    author: "windingwind",
    summary: "更强的笔记编辑与模板能力,支持笔记间链接与大纲视图。",
    category: "notes",
    homepage: "https://github.com/windingwind/zotero-better-notes",
  },
  {
    id: "zotero-style",
    name: "Zotero Style",
    author: "MuiseDestiny",
    summary: "在文献列表里加入阅读进度、标签、评分等可视化列,一眼看清文库状态。",
    category: "reading",
    homepage: "https://github.com/MuiseDestiny/zotero-style",
  },
  {
    id: "zotero-reference",
    name: "Zotero Reference",
    author: "MuiseDestiny",
    summary: "在条目旁展示参考文献列表,并可一键把参考文献加入文库。",
    category: "reading",
    homepage: "https://github.com/MuiseDestiny/zotero-reference",
  },
  {
    id: "format-metadata",
    name: "Linter for Zotero",
    author: "northword",
    summary: "批量规范题录格式:期刊缩写、大小写、页码范围等。",
    category: "metadata",
    homepage: "https://github.com/northword/zotero-format-metadata",
  },
];

export interface GuideEntry {
  id: string;
  title: string;
  summary: string;
  level: "入门" | "进阶";
  topic: "安装与设置" | "整理文库" | "引用与写作" | "阅读与笔记";
  /** 正文外链;自有教程上线前先指向官网文档。 */
  href: string;
}

export const GUIDES: GuideEntry[] = [
  {
    id: "first-steps",
    title: "第一次用 Zotero:安装、导入第一批文献",
    summary: "从安装到把手头的 PDF 变成可检索、可引用的文库,按顺序走一遍。",
    level: "入门",
    topic: "安装与设置",
    href: "https://www.zotero.org/support/quick_start_guide",
  },
  {
    id: "collections-tags",
    title: "分类与标签:文库越大越不乱的整理办法",
    summary: "集合管主题、标签管属性,避免一篇文献只能放一处的困扰。",
    level: "入门",
    topic: "整理文库",
    href: "https://www.zotero.org/support/collections_and_tags",
  },
  {
    id: "word-cite",
    title: "在 Word 里插入引用和参考文献",
    summary: "装好 Word 插件后,边写边引,一键生成参考文献列表并切换格式。",
    level: "入门",
    topic: "引用与写作",
    href: "https://www.zotero.org/support/word_processor_integration",
  },
  {
    id: "annotate",
    title: "PDF 标注与笔记:读完不白读",
    summary: "高亮、批注、摘录到笔记,让阅读痕迹留在文库里随时回看。",
    level: "进阶",
    topic: "阅读与笔记",
    href: "https://www.zotero.org/support/pdf_reader",
  },
];

export const FORUM_STATE = {
  open: false,
  note: "问答讨论正在筹备中:开放后登录即可发帖、回复和收藏。",
} as const;
