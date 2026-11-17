---
title: "Word 以外的写作场景：在 LibreOffice 与 Google Docs 里用 Zotero 引用"
description: "Zotero 官方支持的另外两种写作环境：LibreOffice 插件和 Google Docs 集成的要求、基本用法、协作注意事项，以及文档在不同软件之间怎么转移。"
slug: "libreoffice-google-docs"
order: 606
published: "2026-11-17"
updated: "2026-11-17"
category: "writing"
sources:
  - "https://www.zotero.org/support/word_processor_integration"
  - "https://www.zotero.org/support/system_requirements"
  - "https://www.zotero.org/support/libreoffice_writer_plugin_usage"
  - "https://www.zotero.org/support/google_docs"
  - "https://www.zotero.org/support/preferences/cite"
  - "https://www.zotero.org/support/kb/moving_documents_between_word_processors"
  - "https://www.zotero.org/support/word_processor_plugin_shortcuts"
  - "https://www.zotero.org/support/quick_start_guide"
  - "https://github.com/zotero/zotero-docs"
---

# Word 以外的写作场景：在 LibreOffice 与 Google Docs 里用 Zotero 引用

适用版本：Zotero 桌面版 7 及以上；LibreOffice 和浏览器的版本要求见下文，以[官方系统要求](https://www.zotero.org/support/system_requirements)为准。

最后核对于 2026-11-17。核对方式：Zotero 官方文档。本文所有操作**未实测**，菜单和按钮名称以实际显示为准。

## 你要解决什么

不是每个人都用 Word：有人用免费的 LibreOffice，有人和合作者在 Google Docs 上一起写。Zotero 官方的文字处理集成支持三种软件：Microsoft Word、LibreOffice 和 Google Docs。这三者都能生成“动态”引文和参考文献表，也就是插入新引文，参考文献表自动更新。[官方说明](https://www.zotero.org/support/word_processor_integration)本文介绍后两种的要求和与 Word 不同的地方。基本的引用操作和 Word 大体一致，可以先读[在 Word 里插入引文与参考文献](/guides/word-insert-citations)。

## 操作步骤：LibreOffice

### 1. 先确认环境满足要求

官方系统要求：LibreOffice 5.2 或更高版本，并且需要 Java 运行环境（JRE）或 Java 开发工具包（JDK）。通常安装时如有需要会自动提示安装 JRE；部分 Linux 用户可能需要安装发行版自带的 JRE；在 macOS 上，LibreOffice 需要的是 JDK 而不是 JRE。[官方系统要求](https://www.zotero.org/support/system_requirements)

和 Word 一样，插件随 Zotero 提供，首次启动 Zotero 时会自动安装。需要重装时，到 Zotero 设置的“引用”面板、“文档编辑软件”（Word Processors）标签页里操作。官方提到，升级 LibreOffice 后如果程序路径变了，重装插件可能有帮助。[官方说明](https://www.zotero.org/support/preferences/cite)

### 2. 使用 Zotero 工具栏

装好后，LibreOffice 里会出现一条 Zotero 工具栏，按钮和 Word 版一样：Add/Edit Citation、Add/Edit Bibliography、Document Preferences、Refresh、Unlink Citations。插入引文、加页码、加前后缀、省略作者、编辑参考文献表的做法，官方文档的描述与 Word 版基本相同。[官方说明](https://www.zotero.org/support/libreoffice_writer_plugin_usage)

几处不同：

- 引文的存储方式是“引用标记”（ReferenceMarks）或“书签”（Bookmarks）。官方建议：除非要和用 Word 的合作者共用文档，否则一律选引用标记。
- 打开某条引文的选项窗口，快捷键是 Ctrl-↓（macOS 是 Cmd-↓）。
- 给工具栏按钮设快捷键：在 LibreOffice 的“工具 → 自定义”里，到 LibreOffice 宏下的 Zotero 分组中找到对应的宏（比如 ZoteroAddCitation）来绑定。[官方步骤](https://www.zotero.org/support/word_processor_plugin_shortcuts)

### 3. 定稿前同样在副本上解除关联

Unlink Citations 会把引文变成普通文字，不可撤销。和 Word 一样，先备份，再在最终副本上操作。

## 操作步骤：Google Docs

### 1. 弄清它靠什么工作

官方说明，Google Docs 的支持由浏览器里的 Zotero Connector 提供，支持 Chrome、Firefox、Edge 和 Safari，并且需要同时运行 Zotero 桌面程序。装好后，Google Docs 界面里会多出一个 Zotero 菜单，工具栏上还有一个一键引用的按钮。[官方说明](https://www.zotero.org/support/google_docs)

### 2. 第一次使用时授权

在一份文档里第一次使用 Zotero 功能时，会弹出 Google 账号授权。官方提醒两点：

1. 选择创建这份文档的 Google 账号，或者已经被文档创建者授予编辑权限的账号。这和你是否有 Zotero 账号无关，使用 Zotero 或 Google Docs 集成都不需要 Zotero 账号。
2. 授予“查看、编辑、创建和删除你所有 Google Docs 文档”这一权限（官方原文为英文）。官方解释，插件需要这个权限才能插入和修改引文，不会对文档内容做别的事，只访问你触发插件的那份文档；集成完全在你的电脑本地运行，不会把内容发送到 Zotero 服务器。

### 3. 插入引文和参考文献表

点工具栏上的 Zotero 引用按钮，或者从 Zotero 菜单选 Add/Edit Citation，打开和 Word 版相同的引用对话框。插入参考文献表用 Zotero 菜单里的 Add/Edit Bibliography。官方给的插入引文快捷键：macOS 是 Ctrl-Cmd-C，Windows/Linux 是 Ctrl-Alt-C，可以在 Zotero Connector 设置的“高级”面板里修改。

Google Docs 的文档首选项里，比 Word 版多一项：是否自动更新引文。关掉后，新插入的引文会带灰色底色，表示尚未定稿；点 Zotero 菜单里的 Refresh 后才最终更新，灰底也随之去掉。官方建议，引文很多的长文档关掉自动更新：引文达到 100 条以上时，单次更新可能长达 10 秒。

### 4. 和合作者一起写时注意

- 所有修改文档的人都应安装 Zotero Connector。没装 Connector 的人剪切粘贴了一条引文，这条引文就会与 Zotero 断开关联，并从参考文献表中消失。
- 官方建议，大型合作项目使用群组文库，这样所有合作者都能修改被引条目的题录；如果某人从自己的个人文库引用条目，只有他本人能更新这条的题录。
- 避免几个人同时插入或编辑引文。官方说明有防护机制，但受技术限制，不能保证绝对安全。
- 不要在文档里拖动引文，拖动会让引文断开关联；装了 Connector 时剪切粘贴没有问题。

### 5. 提交前复制一份再解除关联

官方给的流程：用“文件 → 创建副本”复制文档，在副本里用 Zotero 菜单的 Unlink Citations 把引文和参考文献表变成普通文字，再下载这份副本（比如存成 PDF）。原文档保留活动引文，以备后续修改。官方说明，如果你直接下载原文档，Zotero 会提示你先创建副本。

## 在 Word、LibreOffice 与 Google Docs 之间转移文档

官方说明，直接用另一种软件打开带 Zotero 引文的文档，引文关联会丢失。正确做法是用插件先把文档转成一种可以安全转移的临时格式。以 Word 转 Google Docs 为例：

1. 在 Word 里用“另存为”，以新文件名存一份 .docx 副本。
2. 在副本里点 Zotero 的 Document Preferences，选“改用其他的文档编辑软件…”（英文为 Switch to a Different Word Processor…）。
3. 转换完成后保存。
4. 在 Google Docs 里用“文件 → 打开”上传这个文件。
5. 在打开的文档里，从 Zotero 菜单选 Refresh，就可以继续使用。

其他方向（Google Docs 转 Word、LibreOffice 与 Google Docs 互转、Word 与 LibreOffice 互转）的步骤略有不同，请按[官方转移说明](https://www.zotero.org/support/kb/moving_documents_between_word_processors)逐步操作。官方还提到，Word 和 LibreOffice 之间也可以在文档首选项里改用“书签”存储，这样两边都能直接编辑同一份文档；但书签方式不支持脚注样式，偶尔还可能导致引文损坏。不打算长期两边同时用的，官方建议走上面的转换流程。

## 常见问题

**WPS 能用吗？** Zotero 官方文档没有提到 WPS。2026-11-17 核对时，在 [Zotero 官方文档仓库](https://github.com/zotero/zotero-docs)里检索不到相关内容，官方系统要求里列出的文字处理软件也只有 Word 和 LibreOffice（Google Docs 的支持来自 Connector，见上文）。因此只能说**官方文档未明确支持**。本站没有实测，不对能否使用下结论。

**用 LaTeX、Markdown 或其他写作工具怎么办？** 官方文档提到，其他文字处理软件和写作系统有第三方插件可以接入 Zotero，官方入门指南也提到借助社区插件可以在 LaTeX、Scrivener 等工具里使用 Zotero。挑选插件前，先看[怎么挑插件](/guides/choose-plugins)，再按[怎么安装插件](/guides/install-plugins)操作。如果只需要 .bib 文件，见[导入与导出文献](/guides/import-export-formats)。

**Google Docs 里点 Zotero 菜单没有反应？** 官方建议依次尝试：重启 Zotero 和浏览器；停用其他浏览器扩展后重新加载 Google Docs（官方特别提到 Google Docs 离线版扩展曾被报告会干扰）；检查 Zotero Connector 是否获准在网站上运行；换一个新的浏览器配置或换个浏览器。[官方排错](https://www.zotero.org/support/google_docs)

**Google Docs 提示“所选 Google 账号没有编辑这份文档的权限”？** 多半是授权时选错了账号，重新选择有编辑权限的账号即可。

## 相关教程

- [在 Word 里插入引文与参考文献](/guides/word-insert-citations)
- [在 Word 里更换引用样式](/guides/word-switch-style)
- [导入与导出文献：RIS、BibTeX、CSL JSON、Zotero RDF 怎么选](/guides/import-export-formats)
- [怎么挑插件：先看需求和公开依据](/guides/choose-plugins)
- [怎么安装插件](/guides/install-plugins)
