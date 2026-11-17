---
title: "在 Word 里插入引文与参考文献：Zotero Word 插件基本用法"
description: "用 Zotero 的 Word 插件添加和编辑引文、插入参考文献表、刷新与设置文档首选项，以及定稿前要注意什么。"
slug: "word-insert-citations"
order: 601
published: "2026-11-17"
updated: "2026-11-17"
category: "writing"
sources:
  - "https://www.zotero.org/support/word_processor_plugin_usage"
  - "https://www.zotero.org/support/word_processor_integration"
  - "https://www.zotero.org/support/system_requirements"
  - "https://www.zotero.org/support/preferences/cite"
  - "https://www.zotero.org/support/word_processor_plugin_shortcuts"
  - "https://www.zotero.org/support/kb/word_field_codes"
  - "https://www.zotero.org/support/word_processor_plugin_troubleshooting"
  - "https://github.com/zotero/zotero/tree/main/chrome/locale/zh-CN/zotero"
---

# 在 Word 里插入引文与参考文献：Zotero Word 插件基本用法

适用版本：Zotero 桌面版 7 及以上。Word 版本以[官方系统要求](https://www.zotero.org/support/system_requirements)为准：Windows 版为 Word 2010–2024 或 Office 365（不含 Word 2010 入门版），Mac 版为 Word 2016–2024 或 Office 365。

最后核对于 2026-11-17。核对方式：逐条对照 Zotero 官方文档。本文所有操作**未实测**，没有配真机截图；按钮和窗口名称以你电脑上的实际显示为准。

## 你要解决什么

写论文时，你希望正文里的引文和文末的参考文献表都由 Zotero 生成，而不是手工敲。这样改了某条文献的题录，或者换了学校要求的样式，点一下就能整篇更新。官方把这类文字处理插件称为能生成“动态”参考文献的方式：在正文插入新引文，参考文献表会自动补上这一条；在 Zotero 里改正某条的标题，点一下按钮，文档里也会跟着改。[官方说明](https://www.zotero.org/support/word_processor_integration)

关于按钮名称：Windows 版 Word 插件的官方源码里，这些按钮名是英文，所以下文以英文名为主，括号里附上 Zotero 简体中文翻译文件里对应窗口的中文名。不同版本的翻译可能有出入，拿不准时以界面实际显示为准。

## 操作步骤

### 1. 确认 Word 里出现了 Zotero 选项卡

Word 插件随 Zotero 一起提供。按官方说明，首次启动 Zotero 时，插件会自动安装到电脑上受支持的文字处理软件里。装好后，Word 顶部会多出一个 Zotero 选项卡。官方文档介绍的按钮有五个：

- Add/Edit Citation：在光标处添加引文，或编辑光标所在的引文。
- Add/Edit Bibliography：在光标处插入参考文献表，或编辑已有的参考文献表。
- Document Preferences：打开“文档首选项”，比如更换引用样式。
- Refresh：刷新全文引文和参考文献表，把 Zotero 里改过的题录同步进来。
- Unlink Citations：去掉域代码，把引文变成普通文字。此后不再自动更新。

如果找不到这个选项卡，可以到 Zotero 设置的“引用”面板，在“文档编辑软件”（Word Processors）标签页里重新安装插件。仍不行再看[官方排错页面](https://www.zotero.org/support/word_processor_plugin_troubleshooting)。

### 2. 先设好这份文档的“文档首选项”

点 Document Preferences。官方说明这里的设置只对当前文档生效，可以设：

- 引用样式。
- 引文和参考文献表使用的语言。
- 如果是脚注类样式（比如 Chicago 的 note 版本），选择插入脚注还是尾注。脚注、尾注本身的格式由 Word 控制，不归 Zotero 管。
- 引文的存储方式：字段（Fields）或书签（Bookmarks）。官方建议：除非要和用 LibreOffice 的合作者共用文档，否则一律选字段。
- 对于会缩写期刊名的样式，是否使用 MEDLINE 期刊缩写表。这一项默认勾选，勾选后 Zotero 条目里的“期刊缩写”字段会被忽略。

语言选项有时是灰的，选不了，原因见[中文文献的语言与本地化](/guides/chinese-references-language)。

### 3. 插入第一条引文

1. 把光标放在要插入引文的位置，点 Add/Edit Citation，弹出引用对话框。
2. 输入标题的一部分、一位或几位作者的姓，或者年份。匹配的条目会立刻列在下面，按文库分组（“我的文库”和你加入的群组）。本文档已经引用过的条目，会排在最上方的 Cited 一组里。
3. 点击条目，或用方向键选中后按回车。条目会以一个带底色的“气泡”出现在输入框里。
4. 再按一次回车，引文就插入文档，对话框关闭。

同一处要引多篇（比如编号样式的“[2,4-6]”或著者-出版年样式的“(Smith 1776, Schumpeter 1962)”）：选好第一篇后先别按回车，直接接着输入下一篇的作者、标题或年份，再选中。样式如果规定了同一处多篇的排序，Zotero 会自动排好。

要标页码，可以在按回车插入之前直接输入“p.34”“p34”或“34”；页码范围可以输入“p.45-48”或“:45-48”。输入“ibid”会自动选中上一篇引用过的文献；官方说明，这个输入不受所用样式是否真的使用“ibid”影响。

### 4. 给单条引文加页码、前后缀，或省略作者

点一下文档里已有的引文，再点 Add/Edit Citation，然后点对话框里的气泡，打开该条的引用选项：

- 定位符：下拉框选类型（默认“页”），旁边的框里填数值，比如“4-7”。列表里没有的类型（比如“表”），写在后缀里。
- 前缀（Prefix）和后缀（Suffix）：在自动生成的引文前后加文字，比如“参见”。可以用 `<i>`、`<b>`、`<sub>`、`<sup>` 四种标签设置斜体、粗体、下标、上标。
- 省略作者（Omit Author）：用于著者-出版年样式里作者名已经写进句子的情况，比如“Smith（1776）认为……”。勾选后引文只剩年份，作者名由你在正文里自己写。

如果某个样式规定了同一处多篇的排序，而你想按自己的顺序排：在对话框里拖动气泡调整，或者点对话框左侧的“Z”图标，取消“保持文献自动排序”（Keep Sources Sorted）。同一个菜单里还能切换到“经典视图”（Classic View），便于按分类浏览文库。想一直使用经典视图，在设置的“引用”面板里勾选对应选项。

### 5. 插入参考文献表，必要时增删条目

把光标放到文末，点 Add/Edit Bibliography，就会插入参考文献表。以后增删正文引文，这张表会自动跟着变，一般不用再管。

少数情况下，你需要列入一篇正文没有引用的文献，或者去掉正文引了但不该进表的条目（比如个人通信），这时再点一次 Add/Edit Bibliography，打开“编辑参考文献表”窗口，用箭头按钮添加或移除。

这个窗口也能直接改某条参考文献的文字，但官方不建议这么做：改过的条目不会随文库数据更新，官方还提到有用户反馈这类修改有时保存不住。直接在 Word 里手改参考文献表也不行，下次刷新会被覆盖。

### 6. 题录有错，回 Zotero 改，再点刷新

引文缺信息或者写错了，先在 Zotero 里把这条题录补全、改对，再点 Refresh，整篇文档就会更新。

也可以直接在 Word 里改引文文字，但这样 Zotero 就不能再自动更新这条引文了（比如“同上”或同姓作者的区分）。手改后 Zotero 会弹窗让你确认。官方建议：先在正文里记下想改什么，等到准备提交时，在副本里解除关联后再改。

### 7. 定稿时，在副本里再“解除关联”

Unlink Citations 会删掉域代码，把所有引文和参考文献表变成普通文字。这一步**不可撤销**，官方建议一般只在最终副本上做。如果投稿前确实要手工调整参考文献表（比如给综述纳入的文献加星号、给某位作者加粗、加小节标题），做法是：先另存一份备份，然后在副本里点 Unlink Citations，最后再改文字。

样式本身的格式问题应该改 CSL 样式；条目数据的错误应该在 Zotero 文库里改。手工修改只用来做样式实现不了的少量调整。

## 常见问题

**Word 里没有 Zotero 选项卡怎么办？** 先在 Zotero 设置的“引用 → 文档编辑软件”里重装插件，再按[官方排错页面](https://www.zotero.org/support/word_processor_plugin_troubleshooting)逐项排查。换样式解决不了这个问题。

**正文里出现一串以 ADDIN ZOTERO_ITEM CSL_CITATION 开头的代码，是坏了吗？** 一般不是，这是 Word 把域代码显示出来了。官方给的办法：Windows 按 Alt-F9，Mac 按 Option-Fn-F9 切换回来；如果反复出现，到 Word 选项里关掉“显示域代码而非域值”。[官方说明](https://www.zotero.org/support/kb/word_field_codes)

**能给这些按钮设快捷键吗？** 能。官方说明在 Word 的自定义键盘设置里，到“宏”类别下找 Zotero 开头的条目来绑定，Windows 和 Mac 的入口不同。[官方步骤](https://www.zotero.org/support/word_processor_plugin_shortcuts)

**合作者用的是 LibreOffice 或 Google Docs 怎么办？** 看[Word 以外的写作场景](/guides/libreoffice-google-docs)。字段和书签的取舍、在不同软件间转移文档的做法都在那篇。

**WPS 能用吗？** Zotero 官方文档没有提到 WPS，本文不作判断，详见[Word 以外的写作场景](/guides/libreoffice-google-docs)里的说明。

## 相关教程

- [在 Word 里更换引用样式](/guides/word-switch-style)
- [引用样式怎么安装](/guides/install-styles)
- [GB/T 7714 中文样式怎么找](/guides/gb-t-7714)
- [顺序编码制与著者-出版年制：在 Zotero 里怎么选样式](/guides/numeric-vs-author-date)
- [不开 Word 也能拿到格式化的引文与参考文献](/guides/quick-copy-bibliography)
- [Word 以外的写作场景：LibreOffice 与 Google Docs](/guides/libreoffice-google-docs)
