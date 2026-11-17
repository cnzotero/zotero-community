---
title: "中文文献的元数据怎么填：作者、语言、Extra 与期刊字段"
description: "按 Zotero 官方文档与 CSL 规范，说明中文条目的作者双字段、语言代码、标题、期刊卷期页码、DOI 与 Extra 字段的填法和注意点。"
slug: "chinese-metadata-fields"
category: "library"
order: 590
published: "2026-11-17"
updated: "2026-11-17"
sources:
  - "https://www.zotero.org/support/kb/item_types_and_fields"
  - "https://www.zotero.org/support/adding_items_to_zotero"
  - "https://www.zotero.org/support/kb/preventing_title_casing_for_non-english_titles"
  - "https://www.zotero.org/support/kb/sentence_casing"
  - "https://www.zotero.org/support/kb/journal_abbreviations"
  - "https://www.zotero.org/support/word_processor_plugin_usage"
  - "https://docs.citationstyles.org/en/stable/specification.html"
  - "https://github.com/zotero-chinese/styles"
---

# 中文文献的元数据怎么填：作者、语言、Extra 与期刊字段

> 适用范围：按 Zotero 官方文档的当前版本整理（《Zotero Item Types and Fields》页面标注最后更新于 2026-05-18），CSL 部分依据 CSL 1.0.2 规范。文中所有操作都**未实测**，菜单和字段在中文界面里的名称可能不同，以你的 Zotero 为准。最后核对于 2026-11-17。

## 你要解决什么

引用样式只会照着条目里的字段输出参考文献：姓名拆错、语言字段空着或写成“中文”、期刊名和页码放错了地方，换哪个样式都救不回来。官方文档对此说得很直接：引文不对或缺内容时，先确认 Zotero 里的条目数据正确完整，再到文字处理软件插件里点 Refresh 更新文档。

本文只讲“字段该怎么填”，每条都注明依据来自 Zotero 官方文档、CSL 规范，还是中文样式仓库的说明。某个具体样式最后输出成什么样，由样式本身和学校、期刊的要求决定，本文不替任何样式下结论。

## 第一步：选对条目类型

官方文档说，条目类型应按“这条文献该怎么被引用”来选，类型是宽泛的大类。中文文献里常见的几种：

- 期刊论文：Journal Article，发表在学术期刊上的文章（纸本或网络版都算）。
- 学位论文：Thesis，学生为申请学位提交的论文，无论是否正式出版。
- 会议论文：Conference Paper，指已收入正式会议论文集的论文；只在会上报告、没有出版的，官方建议用 Presentation。
- 报纸文章：Newspaper Article。
- 标准：Standard，描述标准或类似的行业、政府规范的出版文件。
- 报告：Report，机构、政府部门等发布的报告，也可用于工作论文。
- 预印本：Preprint。

官方特别提醒，Document（通用文档）这个类型可用字段少，引用样式对它的支持也差，一般应当避免。实在找不到合适的类型时，官方建议选字段比较全的 Book、Report 或 Manuscript 来改用。

## 第二步：作者姓名用双字段

官方文档的规定是：**个人姓名用双字段（姓 Last/Family、名 First/Given），机构或组织名称用单字段。**每个姓名框末尾有“Switch to single field / Switch to two fields”按钮切换模式；只有一个名字的人（官方举的例子是 Socrates），在双字段模式下填进“姓”。如果姓和名填反了，可以右键该姓名，选“Swap First/Last Names”对调。

按这条规定，中文作者“张三”应在双字段模式下姓填“张”、名填“三”，而不是把“张三”整个塞进单字段。不用担心顺序被颠倒：CSL 规范写明，亚洲文字书写的姓名总是“姓在前、名在后”显示，样式里“姓名倒置”“倒置后加逗号”这类设置只作用于拉丁字母等“名在前”的文字。

其他要点：

- 作者按应被引用的先后顺序录入。
- 译者选 Translator，编者选 Editor；同一个人既是编者又是译者，官方建议分两行各录一次。
- 学会、课题组、政府部门等机构作者用单字段，整名填入。
- 英文文献里的中国作者用拼音时，同样按双字段，姓填姓、名填名。

## 第三步：填写语言字段

语言字段（Language）决定样式按哪种语言的规则处理这条文献，对中英文混排的样式尤其重要。三个来源的说法如下：

- Zotero 官方文档：建议填“两位 ISO 语言代码 + 两位国家或地区代码”，例如 `en-US`、`de-DE`。语言字段用来判断是否对标题套用英文的标题大小写规则；条目数据是英文的（例如翻译过来的标题），就填 `en-US` 或 `en-UK`。
- CSL 1.0.2 规范：language 应使用 ISO 639-1 两位语言代码（例如 `en`、`zh`），可以再加两位地区代码。规范还规定：样式的默认语言**不是**英文时（中文样式通常是 `zh-CN`），条目默认被当作非英文，只有语言字段以 `en` 开头的才算英文条目。
- zotero-chinese/styles 仓库说明：使用中英文混排的样式（中文作者超过 3 个写“等”、英文写“et al.”）时，要为每个条目设置语言：中文条目可填 `zh-CN`，英文条目可填 `en-US`，**不能写成 English、中文等**。

合在一起，稳妥的做法是：中文条目填 `zh-CN`，英文条目填 `en-US`（或 `en-GB`）。改完语言字段后，到 Word 或 LibreOffice 插件里点 Refresh。

## 第四步：标题、简短标题与原题名

- **标题（Title）**：条目的主标题。官方建议英文标题一律按句首大写（sentence case）保存，需要时让样式自动转成标题大小写；反过来从标题大小写转回句首大写，程序没法做到完全可靠。
- **简短标题（Short Title）**：通常是去掉副标题的短标题，主要用于脚注样式里再次引用同一文献时。官方还建议：有些样式要求副标题首字母大写，标题里有多个冒号或破折号时，把主标题填进 Short Title，标明副标题从哪里开始。
- **原题名**：Zotero 没有专门的“原题名”字段。引用译著时，标题填译本的书名，原书名可以写在 Extra 字段里，写法是 `Original Title: 原书名`。官方说明这个变量就是“作品的原始标题（例如未翻译的标题）”，对应 CSL 的 original-title。样式是否输出原题名，取决于样式本身。

中文论文同时带有的英文题名，既不是译著的“原题名”，Zotero 和 CSL 1.0.2 也没有对应的标准字段，本文没有找到可靠依据，不推荐具体写法。

## 第五步：期刊名、卷、期、页码与出版信息

- **刊名（Publication）**：期刊、报纸等连续出版物的名称，写全称。
- **刊名缩写（Journal Abbr）**：期刊名的缩写。官方说明，在 Word 或 LibreOffice 插件的 Document Preferences 里可以开启按 MEDLINE 格式自动缩写；关闭时 Zotero 使用这个字段里的缩写。
- **卷（Volume）**：卷号是数字时只填数字。
- **期（Issue）**：期号。官方说明，期刊只有卷号、没有期号时，期字段留空。
- **页码（Pages）**：文章所在的页码范围；电子期刊的文章编号也填在这里。
- **日期（Date）**：出版日期。
- **版次（Edition）**：是数字时填阿拉伯数字，例如填 `2`，不要写“第二版”。
- **出版地（Place）、出版者（Publisher）**：照实填写。
- **学位论文**：类型字段（Type）填论文类别，大学字段（University）填授予学位的院校。官方举的类别都是英文示例，例如 “Doctoral dissertation”“Master thesis”；中文条目这里怎么写才符合要求，取决于所用样式和学校规定，本文未实测。
- **报告编号（Report Number）**：只填编号本身，不要写“No.”“Number”之类的字样，样式会自动加上。

## 第六步：DOI 与网址

- **DOI**：期刊论文直接填进 DOI 字段。官方文档说，其他类型的条目可以把 DOI 写在 Extra 里，见下一步。CSL 规范对 DOI 的示例是 `10.1128/AEM.02591-07` 这种不带网址前缀的形式，并规定生成链接时由程序加上 `https://doi.org/`，所以只填 DOI 本身即可。
- **网址（URL）**：获取全文的网址。官方特别说明，图书馆目录记录（例如图书馆或 Google Books 的页面）或摘要页面的链接不要填在这里，应当另外作为链接添加到条目下。
- **访问日期（Accessed）**：访问电子资源的日期，一般会自动填写；手动输入时可以写 today、yesterday 快速填入。

## 第七步：用 Extra 补上缺少的字段

条目类型缺少引用需要的字段时，可以写进 Extra 字段。官方规定的写法：

1. 每个变量单独一行，写在 Extra 字段的**最上面**。
2. 格式是 `变量名: 值`，变量名用官方列出的英文名称。
3. 日期用 ISO 格式（年-月-日），日期区间写成 `Issued: 2001-12-15/2001-12-31` 这样。
4. 人名类变量按双字段写，姓和名之间用两个竖线 `||` 隔开。

官方给出的示例：

```
DOI: 10.1128/AEM.02591-07
Original Date: 1824
PMCID: PMC3531190
Editorial Director: De Gaulle || Charles
```

官方列出的可用变量还包括 Status（出版状态，例如 in press）、Original Title（原题名）、Original Publisher（原出版者）、Original Author（原作者）、Event Place（会议地点）、Chapter Number（章节号）等。

两条容易忽略的规则：除了条目类型和日期类变量，**Extra 里的值不会覆盖条目里已有的正式字段**；而日期写在 Extra 里，会覆盖 Date 字段的值。样式最终用不用这些变量，同样取决于样式本身。

## 常见问题

### 语言字段填了“中文”或“Chinese”会怎样？

按 CSL 规范和中文样式仓库的说明，语言字段应当填语言代码，“中文”“English”这类写法不符合要求。中英文混排的样式靠这个字段区分中英文条目，填错了，“等”和“et al.”可能用反。改成 `zh-CN` 或 `en-US` 后，在 Word 插件里点 Refresh。（未实测）

### 改了条目，Word 里的参考文献没有变？

官方文档说明，Word 插件的 Refresh 会刷新全部引文和参考文献，并带入 Zotero 文库里已修改的条目数据。中文样式仓库的说明补充：改完语言字段先点 Refresh，仍不正常时，可以删除该引文后重新插入。另外，手工改动参考文献表的内容，会在下一次刷新时被覆盖，应当回到 Zotero 里改条目。

### 正文引文里只显示了姓，是不是姓名填错了？

不一定。CSL 规范规定，样式用短格式输出姓名时只输出姓（及姓前的冠词）；样式在正文引文里用的若是短格式，就只会显示姓。只要按官方建议用双字段录入，姓名在引文和参考文献表里怎样显示由样式决定；请用所需样式预览，再对照学校或期刊的要求核对。

### Extra 里写了变量，但参考文献里没有出现？

依次检查：变量是否写在 Extra 的最上面、是否一行一个；变量名是否与官方列表一致；条目的正式字段里是否已有同名的值（Extra 不会覆盖它）；以及所用样式是否用到了这个变量。

## 相关教程

- [安装 Zotero](/guides/install-zotero)
- [安装与切换引用样式](/guides/install-styles)
- [GB/T 7714 参考文献格式](/guides/gb-t-7714)
- [Zotero 引用样式说明与中文样式一览](/styles)
