---
title: "导入与导出文献：RIS、BibTeX、CSL JSON、Zotero RDF 怎么选"
description: "常见文献数据格式各自能带走什么、什么场合用哪一种，以及在 Zotero 里导入、导出和从剪贴板导入的步骤。"
slug: "import-export-formats"
order: 603
published: "2026-11-17"
updated: "2026-11-17"
category: "writing"
sources:
  - "https://www.zotero.org/support/kb/importing_standardized_formats"
  - "https://www.zotero.org/support/kb/exporting"
  - "https://www.zotero.org/support/kb/field_mappings"
  - "https://www.zotero.org/support/moving_to_zotero"
  - "https://www.zotero.org/support/kb/import_from_clipboard"
  - "https://www.zotero.org/support/adding_items_to_zotero"
  - "https://www.zotero.org/support/preferences/export"
  - "https://www.zotero.org/support/kb/annotations_in_database"
  - "https://www.zotero.org/support/dev/translators"
  - "https://www.zotero.org/support/kb/transferring_a_library"
  - "https://docs.citationstyles.org/en/stable/primer.html"
  - "https://github.com/citation-style-language/schema"
  - "https://ctan.org/pkg/bibtex"
  - "https://ctan.org/pkg/biblatex"
  - "https://www.loc.gov/standards/mods/"
  - "https://github.com/zotero/zotero/tree/main/chrome/locale/zh-CN/zotero"
---

# 导入与导出文献：RIS、BibTeX、CSL JSON、Zotero RDF 怎么选

适用版本：Zotero 桌面版 7 及以上。

最后核对于 2026-11-17。核对方式：Zotero 官方文档，以及各格式的官方说明页；中文菜单名取自 Zotero 官方源码里的简体中文翻译文件。本文所有操作**未实测**，菜单名称以实际显示为准。

## 你要解决什么

你可能遇到这些情况：从数据库批量导出了一批题录，要放进 Zotero；用 LaTeX 写论文，需要一个 .bib 文件；要把一个分类里的文献连同笔记一起交给同门；或者从别的文献管理软件换到 Zotero。这些都要靠导入、导出，而第一步是选对格式。

先记住一条官方提醒：**导出不是备份**。官方明确说明，导出不能当作正规备份，也不建议用它在电脑之间搬整个文库，更不能代替群组协作。重新导入的条目会有新的“添加日期”和“修改日期”；已有 Word 文档里的引文和这些条目之间的关联会断开；少数字段可能有细微变化，某些格式甚至会整个丢掉部分字段。[官方说明](https://www.zotero.org/support/kb/exporting)搬家和备份请看[同步、备份与附件有什么区别](/guides/sync-vs-backup)。

## 常见格式各能带走什么

下面每种格式只写 Zotero 官方文档和格式官方说明能证实的内容。

### Zotero RDF：Zotero 用户之间交换，信息最全

官方字段对照页说明，Zotero RDF 总体上是丢失信息最少的导出格式，也是唯一能保留分类结构、附件文件和笔记的格式。把条目交给另一位 Zotero 用户时，官方建议选 Zotero RDF，并带上文件和笔记，这样转移得最完整。[字段对照页](https://www.zotero.org/support/kb/field_mappings)

### RIS：结构简单、通用性强

RIS 是带标签的纯文本格式，很多数据库和文献管理软件都能导出。Zotero 官方在可导入格式列表里提到，RIS 结构简单，适合“导出、改几处、再导入”这种快速编辑。官方字段对照页说明，RIS 和 MODS 会导入导出笔记，但不含附件文件和分类。

关于 RIS 规范：我没有找到由格式维护方公开、可以直接核对的现行规范文本。Zotero 官方字段对照页给 RIS 的说明链接指向维基百科条目。遇到字段对不上的问题，以实际导入结果为准，并对照 Zotero 官方的字段对照资料排查。

### BibTeX 与 BibLaTeX：配合 LaTeX 写作

BibTeX 用来为 LaTeX 等排版系统处理参考文献，文献数据存在 .bib 文件里；BibLaTeX 是 LaTeX 里另一套处理参考文献的宏包。两者的官方说明都在 CTAN：[BibTeX](https://ctan.org/pkg/bibtex)、[BibLaTeX](https://ctan.org/pkg/biblatex)。Zotero 能导入这两种格式，也能导出。按官方字段对照页的说法，除 Zotero RDF、RIS、MODS 以外的格式，一般只包含条目的元数据字段，不包含分类、附件和笔记。

如果你用 LaTeX 写作，需要的往往就是一份 .bib 文件：选中条目或分类，导出为 BibTeX 或 BibLaTeX 即可。

### CSL JSON：给引文处理程序用的数据格式

CSL 官方入门文档介绍，citeproc-js 引入了一种基于 JSON 的题录数据格式，之后其他 CSL 处理程序也采用了它，这就是 CSL JSON（也叫 citeproc JSON）。它的结构定义在 CSL 官方的 [schema 仓库](https://github.com/citation-style-language/schema)里。Zotero 官方把 CSL JSON 列为可导入的标准格式之一；从别的工具迁移时，官方也提到可以先导出成 RIS、BibTeX 或 CSL JSON，再导入 Zotero。

### MODS 及其他格式

MODS 是美国国会图书馆维护的元数据描述标准，[官方说明页](https://www.loc.gov/standards/mods/)在其网站上。Zotero 官方列出的可导入格式还有 EndNote XML、Citavi XML、RefWorks Tagged、PubMed XML、MEDLINE/nbib、Web of Science Tagged、MARC 等。其中官方特别标注：EndNote XML 是从 EndNote 导出的最佳格式，Citavi XML 是从 Citavi 导出的最佳格式，RefWorks Tagged 是从 RefWorks 导出的最佳格式；Refer/BibIX 能不用就不用。[完整列表](https://www.zotero.org/support/kb/importing_standardized_formats)

## 操作步骤

### 1. 导入一个文件

1. 在 Zotero 里点“文件 → 导入…”（Import…）。
2. 在“您想从哪里导入？”里选“文件（BibTeX，RIS，Zotero RDF等）”，然后选中你的文件。
3. 按向导继续。向导里可以选择“将导入的分类和条目放入新分类”，方便导入后集中检查。

导入后建议抽查几条：作者是否拆成了姓和名，题名、期刊名、年份、卷期、页码是否完整。官方提醒，无论用哪种文献管理软件，保存进来的题录都应该核对一遍。

### 2. 从剪贴板导入

如果你在网页或文件里看到一段原始题录数据（RIS、BibTeX、CSL JSON 等），可以先复制，然后在 Zotero 里选“文件 → 从剪贴板导入”，或者按快捷键 Ctrl-Alt-Shift-I（macOS 是 Cmd-Option-Shift-I）。[官方说明](https://www.zotero.org/support/kb/import_from_clipboard)

官方同时提醒：在大多数网站上，更好的办法是用浏览器里 Zotero Connector 的保存按钮，它能保存更完整的数据，还能附上文件。

### 3. 批量导入数据库检索结果

做系统综述这类大批量收集时，官方提醒：如果太频繁地用保存按钮、或者一次保存太多条，Google 学术、ProQuest、Web of Science 等数据库可能会暂时封锁你的访问。这种情况下，更好的做法是在数据库里批量导出成 BibTeX 或 RIS 等标准格式，再导入 Zotero。[官方说明](https://www.zotero.org/support/adding_items_to_zotero)

### 4. 导出文库、分类或选中的条目

- 导出整个文库：在左侧右键文库，选“导出文献库…”（Export Library…）；也可以从“文件”菜单进入。
- 导出一个分类：右键这个分类，选导出（英文界面为 Export Collection…）。
- 导出部分条目：在条目列表里选中，右键，选“导出条目…”（Export Items…）。

在弹出的窗口里选择格式。窗口里出现哪些勾选项，取决于所选格式：Zotero 的格式转换程序声明支持哪些内容，窗口里就会出现对应的“导出笔记”“导出文件”等选项。如果导出 BibTeX、RIS 等格式时勾选了“导出文件”，下面还有“包括注释”一项，勾选后会把注释嵌入导出的 PDF 里。[官方说明](https://www.zotero.org/support/kb/annotations_in_database)

### 5. 导入后中文乱码时检查编码

官方说明，导入题录时 Zotero 默认自动识别字符编码。如果某个文件识别得不对，可以在设置的“导出”面板里，在“字符编码”一节指定“导入字符编码”，再重新导入。[官方说明](https://www.zotero.org/support/preferences/export)

## 常见问题

**换新电脑，想把整个文库搬过去，用导出导入行吗？** 官方不建议。官方给出的办法是用 Zotero 同步，或者在两台电脑都关闭 Zotero 后，复制整个 Zotero 数据目录。[官方说明](https://www.zotero.org/support/kb/transferring_a_library)也可以看[文库不见了，如何准备恢复](/guides/restore-library)。

**只想临时复制几条 BibTeX，不想导出文件？** 可以把快速复制的默认格式设成 BibTeX，选中条目后按复制快捷键即可，见[不开 Word 也能拿到格式化的引文与参考文献](/guides/quick-copy-bibliography)。

**从 EndNote、Mendeley 等软件迁移，用哪种格式？** 官方为几种常见软件写了单独的迁移说明，比如 Mendeley 有内置导入工具，EndNote 建议用 EndNote XML。先看[官方迁移总页](https://www.zotero.org/support/moving_to_zotero)，再决定是否走通用格式。

**导入后引文和原来的 Word 文档还连着吗？** 不连着。重新导入的条目和原有文档里的引文没有关联，见上文“导出不是备份”的官方说明。

## 相关教程

- [同步、备份与附件有什么区别](/guides/sync-vs-backup)
- [文库不见了，如何准备恢复](/guides/restore-library)
- [不开 Word 也能拿到格式化的引文与参考文献](/guides/quick-copy-bibliography)
- [在 Word 里插入引文与参考文献](/guides/word-insert-citations)
- [安装 Zotero 与第一个文库](/guides/install-zotero)
