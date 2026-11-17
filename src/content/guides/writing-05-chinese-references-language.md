---
title: "中文文献的语言与本地化：“等”与“et al.”、中文作者名、语言字段"
description: "弄清 Zotero 用哪种语言生成引文、“等”和“et al.”从哪里来、条目“语言”字段实际起什么作用，以及中文作者名该怎么录入。"
slug: "chinese-references-language"
order: 605
published: "2026-11-17"
updated: "2026-11-17"
category: "writing"
sources:
  - "https://www.zotero.org/support/supported_languages"
  - "https://www.zotero.org/support/kb/preventing_title_casing_for_non-english_titles"
  - "https://www.zotero.org/support/kb/name_parsing"
  - "https://www.zotero.org/support/word_processor_plugin_usage"
  - "https://docs.citationstyles.org/en/stable/specification.html"
  - "https://docs.citationstyles.org/en/stable/primer.html"
  - "https://github.com/citation-style-language/locales"
  - "https://github.com/zotero/zotero/blob/ef04265b622a6f3eb9149b806842bf9319567388/chrome/content/zotero/xpcom/style.js"
  - "https://github.com/citation-style-language/styles/blob/master/china-national-standard-gb-t-7714-2025-numeric.csl"
  - "https://github.com/citation-style-language/styles/blob/master/china-national-standard-gb-t-7714-2015-numeric.csl"
  - "https://citeproc-js.readthedocs.io/en/latest/csl-m/index.html"
---

# 中文文献的语言与本地化：“等”与“et al.”、中文作者名、语言字段

适用版本：Zotero 桌面版 7 及以上。

最后核对于 2026-11-17。核对方式：Zotero 官方文档、CSL 1.0.2 官方规范，以及 Zotero 和官方样式仓库的公开源码。本文所有结论**未实测**；凡是从源码和规范推出来的，文中都会注明。请用你自己的文档实际生成一次，再对照要求检查。

## 你要解决什么

中文论文的参考文献表里，中文、英文条目经常混在一起。常见的困惑有：英文文献的作者省略时，显示的是“等”还是“et al.”？文档首选项里的“语言”为什么有时是灰的？条目里的“语言”字段要不要填，填了有什么用？中文作者名为什么显示得不对？

先说结论：在 Zotero 官方文档和 CSL 1.0.2 规范里，**没有找到“按每条文献的语言自动切换‘等’和‘et al.’”的官方说明**。能确认的是下面几件事。

## 先弄清四件事

### 1. 引文用哪种语言生成，由谁决定

Zotero 官方说明，界面语言和引文语言可以分开设，引文语言可以在三处选：“创建引注/参考文献表”窗口、Word 等文字处理插件的“文档首选项”、设置里“导出”面板的快速复制部分。[官方说明](https://www.zotero.org/support/supported_languages)

但样式本身也可以指定语言。CSL 规范允许样式在根元素上用 default-locale 设定默认语言。Zotero 源码里写得很清楚：如果所选样式定义了语言，语言下拉框会被禁用，并自动选成样式指定的那种；只有样式没定义语言时，你才能自己选。[Zotero 源码](https://github.com/zotero/zotero/blob/ef04265b622a6f3eb9149b806842bf9319567388/chrome/content/zotero/xpcom/style.js)

官方样式库里按 GB/T 7714 编写的样式（2025 版和 2015 版都是），源码里都写了 `default-locale="zh-CN"`。所以选这些样式时，语言固定为简体中文，下拉框选不了，这是正常现象。

### 2. “等”和“et al.”从哪里来

按 CSL 规范，作者太多时，样式只列出前几位，后面接上一个叫 et-al 的“术语”。术语的具体文字来自语言文件：CSL 官方的简体中文语言文件（zh-CN）里，这个术语是“等”；美国英语文件（en-US）里是“et al.”。[CSL 语言文件仓库](https://github.com/citation-style-language/locales)

至于列几位作者才省略，由样式自己规定。以官方样式库里的 GB/T 7714-2025 编号式样式为例，源码设置是：参考文献表里作者达到 4 位时，只列前 3 位，再接术语。

把这两点合起来：CSL 1.0.2 规范在讲语言回退时，说的是“所选的输出语言”，我在规范里没有找到按条目语言切换术语的机制。因此可以推断，用官方 GB/T 7714 样式时，英文条目的作者省略也会用简体中文的“等”。**这是根据规范和源码做的推断，未实测。**

如果你的学校或期刊要求英文文献用“et al.”，请先确认要求原文，再看下面的“常见问题”。

### 3. 条目的“语言”字段实际起什么作用

Zotero 官方文档只明确了“语言”字段的一个作用：有些样式会把题名转换成英文式的“标题大小写”（每个实词首字母大写），这种转换只适用于英语。为了不让非英语题名被这样转换，官方建议在条目的“语言”字段里标明语言，用两位代码，比如德语“de”、法语“fr”、日语“ja”，也可以用“de-DE”这样的四位代码；英文条目可以标“en”“en-GB”或“en-US”。[官方说明](https://www.zotero.org/support/kb/preventing_title_casing_for_non-english_titles)

CSL 1.0.2 规范的规则是：样式默认语言是英语或没设时，条目默认当作英文，只有语言字段填了、且不以“en”开头，才当作非英文；样式默认语言不是英语时（比如 zh-CN），条目默认当作非英文，只有语言字段以“en”开头，才当作英文。规范还说明，语言字段应填 ISO 639-1 两位代码，例子里就有中文的“zh”。[CSL 规范](https://docs.citationstyles.org/en/stable/specification.html)

所以，中文条目填“zh”或“zh-CN”、英文条目填“en”，是有依据、也不会出错的做法。但按现有官方说明，**不能指望它在官方样式里切换“等”和“et al.”**。

### 4. 中文作者名怎么录才对

Zotero 的作者栏有两种模式。官方说明：

- 双栏模式（姓、名分开填）：生成引文时会进一步拆分处理，人名一般都应该用这种模式，官方特别注明包括亚洲人名。官方 Zotero 能正确排版中文和日文姓名，前提是数据录得对。
- 单栏模式：生成引文时原样输出，不做拆分，通常用于机构名称。不要为了“凑出”某种显示效果，把人名强行改成单栏。

切换方法：作者名右侧、加减号前面有一个小方形图标，点一下就在单栏和双栏之间切换（简体中文翻译里写作“显示一个输入框”“显示两个输入框”）。[官方说明](https://www.zotero.org/support/kb/name_parsing)

CSL 规范规定，用亚洲文字书写的人名总是姓在前、名在后；简短形式只显示姓。规范举的例子是“毛泽东”，简短形式为“毛”。所以中文作者应该把姓填进“姓”栏、名填进“名”栏，不要整个名字塞进一栏。

## 操作步骤

### 1. 看一眼文档用的是什么语言

在 Word 里点 Zotero 选项卡的 Document Preferences，看“语言”一项。如果是灰的，说明样式自己固定了语言，这时改语言只能换样式。如果能选，再按要求选。快速复制和“创建引注/参考文献表”窗口里的“语言”同理。

### 2. 给条目补上语言字段

在 Zotero 右侧的条目信息里找到“语言”字段：中文文献填“zh”或“zh-CN”，英文文献填“en”。已经填了别的写法的，可以按官方建议统一改成语言代码。这主要影响非英语题名会不会被转成标题大小写，不会改变“等”和“et al.”。

### 3. 检查中文作者是不是双栏、姓名分对

抽查几条中文条目：作者是否是双栏，“姓”栏里是不是姓。整个名字挤在一栏的，切换成双栏后重新分好。机构作者保持单栏。

### 4. 生成后逐条核对

插入参考文献表后，重点看：中英文条目的作者省略方式（“等”还是“et al.”）是否符合要求；中文作者是否姓在前；英文题名的大小写是否符合要求。发现不符，先判断是题录问题还是样式问题。

## 常见问题

**文档首选项里的“语言”是灰的，选不了？** 所选样式在源码里固定了语言。Zotero 的设计是：样式定义了语言，就用样式的语言，并禁用下拉框。官方 GB/T 7714 样式都固定为 zh-CN。

**要求英文文献写“et al.”，样式却输出“等”，怎么办？** 先确认要求原文，确实如此的话：一是向学校或期刊询问是否提供了符合要求的样式文件，拿到后保留来源，用测试文档核对输出；二是按[样式纠错的官方流程](https://www.zotero.org/support/styles)报告；三是在投稿前的最终副本里，按官方建议先备份、再解除关联，然后手工修改，见[在 Word 里插入引文与参考文献](/guides/word-insert-citations)第 7 步。日常写作的工作稿不要解除关联。

**听说改样式源码就能按语言输出“et al.”？** 官方样式库里 GB/T 7714-2015 样式的源码中，有一段被注释掉的写法，旁边注明“取消这部分注释可以开启 CSL-M 的多语言功能”，用来按文献语言输出“et al.”等术语。但 CSL-M 不是 CSL 官方规范的一部分。Zotero 使用的引文处理程序 citeproc-js 有一份介绍 CSL-M 的文档（写于 CSL 1.0.1 时期），里面说，用了这类扩展写法的样式无法通过官方 CSL 校验，只能用于多语言版 Zotero（Multilingual Zotero）。[citeproc-js 文档](https://citeproc-js.readthedocs.io/en/latest/csl-m/index.html)Zotero 官方文档没有说明官方版本是否支持，本文无法确认，也不建议你在正式稿件上改样式源码。2025 版样式源码里已经没有这段注释。

**有没有支持多语言的 Zotero 版本？** Zotero 官方文档提到一个由社区开发的非官方版本 Juris-M（原名 Multilingual Zotero），可以存储姓名、题名等字段的音译和翻译。本站没有评估过它，不作推荐。是否使用、怎样迁移数据，请自行核实它的说明。[官方提及处](https://www.zotero.org/support/supported_languages)

**中文作者的姓名显示得不对？** 先看这位作者是不是单栏、姓名是否填反。CSL 规范规定亚洲文字人名姓在前，前提是姓、名分别填对了栏位。

## 相关教程

- [GB/T 7714 中文样式怎么找](/guides/gb-t-7714)
- [顺序编码制与著者-出版年制：在 Zotero 里怎么选样式](/guides/numeric-vs-author-date)
- [在 Word 里插入引文与参考文献](/guides/word-insert-citations)
- [在 Word 里更换引用样式](/guides/word-switch-style)
- [不开 Word 也能拿到格式化的引文与参考文献](/guides/quick-copy-bibliography)
