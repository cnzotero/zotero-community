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
} satisfies Record<string, StyleSource>;

/** 正文里直接链接的其他页面(不作为「来源」,只是导航)。 */
export const STYLE_LINKS = {
  repository: "https://www.zotero.org/styles",
  requestStyles: "https://github.com/citation-style-language/styles/wiki/Requesting-Styles",
};

export const STYLE_SOURCE_LIST: StyleSource[] = Object.values(STYLE_SOURCES);
