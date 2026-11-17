---
title: "顺序编码制与著者-出版年制：区别在哪，Zotero 里怎么选样式"
description: "从正文引文的样子分清编号制与著者-出版年制，在官方样式库里找对应的 GB/T 7714 样式，并知道切换后该检查什么。"
slug: "numeric-vs-author-date"
order: 604
published: "2026-11-17"
updated: "2026-11-17"
category: "writing"
sources:
  - "https://docs.citationstyles.org/en/stable/primer.html"
  - "https://docs.citationstyles.org/en/stable/specification.html"
  - "https://www.zotero.org/support/styles"
  - "https://www.zotero.org/support/word_processor_plugin_usage"
  - "https://www.zotero.org/styles"
  - "https://std.samr.gov.cn/gb/search/gbDetailed?id=4507EFE13D37CB6AE06397BE0A0A601F"
  - "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=C6CE52E55AC09B9C79A20AEA77CEDD14"
  - "https://github.com/citation-style-language/styles/blob/master/china-national-standard-gb-t-7714-2025-numeric.csl"
  - "https://github.com/citation-style-language/styles/blob/master/china-national-standard-gb-t-7714-2025-author-date.csl"
---

# 顺序编码制与著者-出版年制：区别在哪，Zotero 里怎么选样式

适用版本：Zotero 桌面版 7 及以上。

最后核对于 2026-11-17。核对方式：Citation Style Language（CSL）官方文档、Zotero 官方文档、全国标准信息公共服务平台的标准信息，以及官方样式库中样式文件的源码。本文所有操作和样式输出**未实测**，不能代替你对照学校或期刊要求的逐条检查。

## 你要解决什么

格式要求里写着“顺序编码制”或“著者-出版年制”，而 Zotero 样式库里的样式名是英文，比如 numeric、author-date。你需要弄清楚两者分别对应哪种，选对样式，并知道切换后要检查哪些地方。

先说明本文的边界。现行的参考文献著录国家标准是 GB/T 7714-2025《信息与文献 参考文献著录规则》：按全国标准信息公共服务平台的信息，它于 2025-12-02 发布，2026-07-01 实施，全部代替 GB/T 7714-2015。[标准信息页](https://std.samr.gov.cn/gb/search/gbDetailed?id=4507EFE13D37CB6AE06397BE0A0A601F)国家标准全文公开系统对 2025 版注明：由于涉及版权保护，暂不提供在线阅读服务；2015 版已废止，也不提供文本阅读。我没能核对标准原文，所以本文**不复述任何条文**，只讲怎么从格式要求给的示例判断类型、怎么在 Zotero 里选样式。具体规则以你拿到的标准原文、学校或期刊的书面要求为准。

## 两种正文引文长什么样

CSL 是 Zotero 所有引用样式使用的描述语言。CSL 官方入门文档把正文引文样式分成几类，其中跟本文有关的两类是：

- 编号式（numeric）：正文里是数字，比如“[1, 2]”“[3]”。文末参考文献通常按作者字母排序，或者按在文中第一次被引用的先后排序。
- 著者-出版年式（author-date）：正文里写作者和出版年份，比如“(Van der Klei et al. 1991; Zwart et al. 1983)”。文末参考文献通常按作者字母排序。

另外还有一大类是注释式（note）：正文里放一个标记，指向脚注或尾注，完整信息写在注里。[CSL 官方入门文档](https://docs.citationstyles.org/en/stable/primer.html)

所以判断方法很简单：**看格式要求里的正文示例**。正文是方括号数字（常见为上标），按文中出现顺序编号的，对应编号式；正文是作者加年份的，对应著者-出版年式。不要只看样式名称。

## 操作步骤

### 1. 从格式要求里找出三样东西

拿到学校或期刊的格式要求后，先记下：正文引文的示例长什么样；文末参考文献怎么排序；标准名称和年份（比如写的是 GB/T 7714-2015 还是 GB/T 7714-2025）。三样都对上，再去找样式。如果要求本身前后矛盾，先问发布要求的单位，不要自己猜。

### 2. 在官方样式库里找对应样式

打开 [Zotero 样式库](https://www.zotero.org/styles)，或者在 Zotero 设置“引用”面板的样式管理器里点“获取更多样式…”。官方说明，样式库可以按名称搜索，还可以按样式类型和学科筛选。[官方说明](https://www.zotero.org/support/styles)

以 GB/T 7714 为例，搜索“7714”，截至核对日，样式库里有按 2025 版编写的三个样式，名称分别是：

- China National Standard GB/T 7714-2025 (numeric, 中文)：编号式。
- China National Standard GB/T 7714-2025 (author-date, 中文)：著者-出版年式。
- China National Standard GB/T 7714-2025 (note, 中文)：注释式。

同一个库里还保留着按 2015 版等旧版编写的样式。名称里的年份要和你的格式要求一致。安装方法见[引用样式怎么安装](/guides/install-styles)，更多挑选建议见[GB/T 7714 中文样式怎么找](/guides/gb-t-7714)。

### 3. 了解样式的大致行为（来自样式源码）

样式文件是公开的，可以直接看源码。以下是从官方样式仓库里 2025 版两个样式的源码读出来的设置，**并非实测输出**：

- 编号式样式：正文引文是上标、方括号里的编号。文末参考文献没有另设排序规则；按 CSL 规范，这种情况下条目按被引用的先后排列，而编号就是条目在参考文献表里的序号，所以编号随首次引用的先后递增。样式还设置了合并连续编号，CSL 规范举的例子是把“[1, 2, 3, 5]”合并为“[1–3, 5]”。
- 著者-出版年式样式：正文引文用全角括号，作者和年份之间用全角逗号，多篇之间用全角分号；文末先按作者、再按年份排序。同一作者同一年有多篇时，样式开启了在年份后加字母区分的设置。

这些细节是否符合你的要求，最终要对照格式要求里的示例逐项核对。

### 4. 在 Word 文档里切换

在 Word 里点 Zotero 选项卡的 Document Preferences，选中刚安装的样式。如果选的是注释式样式，还要在同一窗口里选择脚注或尾注；脚注、尾注本身的格式由 Word 控制。具体步骤见[在 Word 里更换引用样式](/guides/word-switch-style)。

### 5. 切换后重点检查这几处

- 编号式：正文编号是否从 1 开始、按首次出现顺序递增；同一处引用多篇时是否合并成范围；文末是否按编号排列。
- 著者-出版年式：同一处多篇的排列顺序；同一作者同一年多篇的区分；作者已经写进句子时，是否给这条引文勾选了“省略作者”。Zotero 官方说明，“省略作者”用于著者-出版年样式里作者名放进正文的情况。
- 两种都要查：中文和外文条目的作者、题名、出版信息是否完整；文末条目数和正文引用的文献数是否一致。

## 常见问题

**写到一半能从编号式换成著者-出版年式吗？** 可以在文档首选项里换样式，Zotero 插入的引文会按新样式重新生成。但你自己在句子里手写的作者名、年份，以及手工改过的引文，不会跟着变，换完要通读一遍。

**样式输出和格式要求的示例不一致怎么办？** 先排除题录本身的问题：信息缺失或文献类型选错，回 Zotero 改正后刷新。确认是样式和规范不符时，官方建议先更新到最新版 Zotero 和最新版样式，再到 Zotero 论坛发帖报告，标题写成“Style Error: [样式名]”，并附上能说明样式错误的规范链接或摘录。[官方说明](https://www.zotero.org/support/styles)

**样式库里找不到我们学校的样式？** 先看学校是否在公开页面提供了 CSL 样式文件，并保留来源页面。也可以按官方说明向样式库申请新样式。不要随意使用来历不明的样式文件。

**为什么英文文献在中文样式里显示“等”而不是“et al.”？** 这跟样式的语言设置有关，见[中文文献的语言与本地化](/guides/chinese-references-language)。

## 相关教程

- [GB/T 7714 中文样式怎么找](/guides/gb-t-7714)
- [引用样式怎么安装](/guides/install-styles)
- [在 Word 里更换引用样式](/guides/word-switch-style)
- [在 Word 里插入引文与参考文献](/guides/word-insert-citations)
- [中文文献的语言与本地化](/guides/chinese-references-language)
