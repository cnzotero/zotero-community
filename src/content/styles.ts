// 引用样式页引用的出处。页面每段末尾的「来源」与结构化数据里的 citation 都取自这一份,保证两边一致。
// 每条说明都要能在对应页面里找到;新增内容前先核对原文,读不到的不写。

export interface StyleSource {
  label: string;
  url: string;
}

export const STYLE_SOURCES = {
  styles: { label: "Zotero 文档:Citation Styles", url: "https://www.zotero.org/support/styles" },
  cite: { label: "Zotero 文档:Cite 设置", url: "https://www.zotero.org/support/preferences/cite" },
  wordPlugins: { label: "Zotero 文档:Word Processor Plugins", url: "https://www.zotero.org/support/word_processor_integration" },
  word: { label: "Zotero 文档:Using the Zotero Word Plugin", url: "https://www.zotero.org/support/word_processor_plugin_usage" },
  libreoffice: { label: "Zotero 文档:Using the Zotero LibreOffice Plugin", url: "https://www.zotero.org/support/libreoffice_writer_plugin_usage" },
  cnRepo: { label: "zotero-chinese/styles 仓库说明", url: "https://github.com/zotero-chinese/styles" },
  cnSite: { label: "中文 CSL 样式页面", url: "https://zotero-chinese.com/styles/" },
  cslRepo: { label: "CSL 官方样式仓库", url: "https://github.com/citation-style-language/styles" },
  styleEditing: { label: "Zotero 文档:Style Editing Step-by-Step", url: "https://www.zotero.org/support/dev/citation_styles/style_editing_step-by-step" },
  zoteroIndex: { label: "Zotero 样式库公开索引", url: "https://www.zotero.org/styles-files/styles.json" },
} satisfies Record<string, StyleSource>;

/** 正文里直接链接的其他页面(不作为「来源」,只是导航)。 */
export const STYLE_LINKS = {
  repository: "https://www.zotero.org/styles",
  requestStyles: "https://github.com/citation-style-language/styles/wiki/Requesting-Styles",
};

export const STYLE_SOURCE_LIST: StyleSource[] = Object.values(STYLE_SOURCES);

/** 引文方式(CSL 文件头 <category citation-format>)的中文说法。 */
export const CITATION_FORMAT_LABELS: Record<string, string> = {
  numeric: "数字编号",
  "author-date": "著者-出版年",
  note: "注释",
  author: "著者",
  label: "标签",
};

/** 常见许可地址的简称;不认识的直接显示地址。 */
export function licenseLabel(url: string): string {
  const m = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)\/?$/.exec(url);
  return m ? `CC ${m[1].toUpperCase()} ${m[2]}` : url;
}
