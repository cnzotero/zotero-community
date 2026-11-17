---
title: "不开 Word 也能拿到格式化的引文与参考文献：快速复制与创建参考文献表"
description: "用快速复制、拖放和右键“用所选条目创建参考文献表”，把选中的文献直接变成格式化的引文或参考文献，粘贴到任何地方。"
slug: "quick-copy-bibliography"
order: 602
published: "2026-11-17"
updated: "2026-11-17"
category: "writing"
sources:
  - "https://www.zotero.org/support/creating_bibliographies"
  - "https://www.zotero.org/support/preferences/export"
  - "https://www.zotero.org/support/supported_languages"
  - "https://www.zotero.org/support/word_processor_integration"
  - "https://www.zotero.org/support/rtf_scan"
  - "https://github.com/zotero/zotero/tree/main/chrome/locale/zh-CN/zotero"
---

# 不开 Word 也能拿到格式化的引文与参考文献：快速复制与创建参考文献表

适用版本：Zotero 桌面版 7 及以上。

最后核对于 2026-11-17。核对方式：逐条对照 Zotero 官方文档；中文菜单名取自 Zotero 官方源码里的简体中文翻译文件。本文所有操作**未实测**，不同版本的菜单名称可能略有出入，以实际显示为准。

## 你要解决什么

有时你只要几条格式化好的参考文献：贴进邮件、组会幻灯片、基金申请表或网页表单，又或者导师要一份某个主题的文献清单。这时没必要开 Word 插件。Zotero 自带几种办法，选中条目就能直接得到按某个样式排好的文字。

先说清楚它和 Word 插件的区别。官方把文字处理插件称为能自动更新的“动态”参考文献；而本文这几种办法得到的是一段粘贴出来的文字。按官方描述推断，之后你在 Zotero 里改了题录，已经粘贴出去的文字不会跟着变。写长论文、需要反复修改时，还是用[Word 插件](/guides/word-insert-citations)更省事。

## 操作步骤

### 1. 先设好快速复制用的默认格式

打开 Zotero 设置（Windows/Linux 在“编辑”菜单，macOS 在“Zotero”菜单；旧版本里叫“首选项”），进入“导出”（Export）面板，找到“快速复制”（Quick Copy）一节：

- “条目格式”（Item Format）：选一个引用样式（比如你学校要求的样式），也可以选一种文献数据格式（比如 BibTeX、RIS）。选样式，复制出来的是格式化的文字；选数据格式，复制出来的是可以被其他软件导入的数据。
- “语言”：快速复制生成引文和参考文献时用的语言。
- “复制为 HTML”：默认复制普通文字，官方说这通常是推荐做法；勾选后复制 HTML，适合往网页里粘贴。
- “网站专属设置”：浏览器装了 Zotero Connector 时，可以给特定网站指定另一种默认格式，比如往维基百科粘贴时用维基百科的引用模板。
- “禁用快速复制，当拖动超过……”：默认 50 条。一次拖动太多条目时，这项设置能避免 Zotero 变慢。

### 2. 用快捷键或“编辑”菜单复制

在中间的条目列表里选中一条或多条，然后：

- 按 Ctrl-Shift-C（macOS 是 Cmd-Shift-C），或者用“编辑 → 复制参考文献表”（Copy Bibliography），复制的是完整的参考文献条目。
- 按 Ctrl-Shift-A（macOS 是 Cmd-Shift-A），或者用“编辑 → 复制引注”（Copy Citation），复制的是正文引文；如果是脚注类样式，复制的是脚注内容。官方的说法是：默认格式设为引用样式时，用这个快捷键得到正文引文或脚注。

然后到目标位置粘贴即可。

### 3. 直接拖过去

在条目列表里选中条目，拖到其他程序的任意文本框里，Zotero 会按快速复制的默认格式生成参考文献。想要正文引文而不是参考文献条目，在开始拖动的那一刻按住 Shift。

### 4. 右键“用所选条目创建参考文献表”

如果想临时换个样式、换种语言，或者把结果存成文件，用这个窗口更合适：

1. 选中一条或多条，右键，选“用所选条目创建参考文献表…”（英文界面是 Create Bibliography from Item(s)…）。
2. 在弹出的“创建引注/参考文献表”窗口里，选“参考文献样式”和“语言”。
3. 在“输出模式”里选“引注/注释”或“参考文献表”。
4. 在“输出方法”里四选一：“另存为 RTF”保存成富文本文件；“另存为 HTML”保存成网页文件，官方说明这种文件还内嵌了元数据，别的 Zotero 用户浏览时可以抓取题录；“复制到剪贴板”可以粘贴到任何文本框；“打印”直接送打印机。

新版界面里，部分选项可能收在“高级选项”里（简体中文翻译文件里有这个词条），名称和位置以实际显示为准。

### 5. 粘贴后对照要求检查

不管用哪种办法，粘贴后都要对照学校或期刊的要求看一遍：作者、年份、题名、卷期、页码和标点是否正确。条目信息不对，回 Zotero 改题录再重新复制，不要只在粘贴后的文字上修补，否则下次复制还会错。

## 常见问题

**按了快捷键，粘贴出来的却是一串 BibTeX 或 RIS 代码？** 说明快速复制的“条目格式”设成了数据格式。官方说明快速复制也支持 BibTeX、RIS 这类导出格式。想要格式化文字，就把它改回一个引用样式。

**“语言”下拉框是灰的，选不了？** 一般是所选样式自己固定了输出语言，具体原因和影响见[中文文献的语言与本地化](/guides/chinese-references-language)。

**界面是中文，参考文献却想要英文（或者反过来）？** 官方说明界面语言和引文语言可以分开设：在“创建引注/参考文献表”窗口、Word 插件的“文档首选项”、“导出”面板的快速复制设置这三处都能选引文语言。[官方说明](https://www.zotero.org/support/supported_languages)

**不想边写边点插件，能先写完再统一生成引文吗？** 官方提供 RTF Scan 功能：在 RTF 格式的文档里，按约定写法标出引用，比如 `{Smith, 2009}`；写完后在 Zotero 的“工具”菜单里选 RTF Scan，逐条确认对应的条目，再选样式，Zotero 会另存一份排好引文和参考文献表的文件。约定写法的完整列表和注意事项见[官方说明](https://www.zotero.org/support/rtf_scan)。

## 相关教程

- [在 Word 里插入引文与参考文献](/guides/word-insert-citations)
- [引用样式怎么安装](/guides/install-styles)
- [GB/T 7714 中文样式怎么找](/guides/gb-t-7714)
- [中文文献的语言与本地化](/guides/chinese-references-language)
- [导入与导出文献：RIS、BibTeX、CSL JSON、Zotero RDF 怎么选](/guides/import-export-formats)
