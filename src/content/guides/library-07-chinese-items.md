---
title: "中文文献入库要注意什么"
description: "中文网站能不能用连接器保存、怎样查看实际用的是哪个转换器、官方转换器覆盖了哪些中文站点，以及中文题录常见缺漏怎么补。"
slug: "chinese-items"
category: "library"
order: 507
published: "2026-11-17"
updated: "2026-11-17"
sources:
  - "https://www.zotero.org/support/translators"
  - "https://github.com/zotero/translators"
  - "https://www.zotero.org/support/troubleshooting_translator_issues"
  - "https://www.zotero.org/support/kb/default_translators"
  - "https://www.zotero.org/support/adding_items_to_zotero"
  - "https://www.zotero.org/support/retrieve_pdf_metadata"
  - "https://www.zotero.org/support/kb/name_parsing"
  - "https://www.zotero.org/support/kb/preventing_title_casing_for_non-english_titles"
  - "https://www.zotero.org/support/supported_languages"
  - "https://www.zotero.org/blog/zotero-10/"
  - "https://github.com/zotero/zotero/tree/main/chrome/locale/zh-CN/zotero"
---

# 中文文献入库要注意什么

适用 Zotero 版本：桌面版 7 及以上，浏览器端需要安装 Zotero Connector。

最后核对于 2026-11-17。核对方式：Zotero 官方文档，以及官方转换器仓库在 2026-11-13 的公开内容。以下操作均**未实测**，本文**没有**逐一测试各中文网站当前能否正常保存。网站一旦改版，原本可用的转换器就可能失效，请以自己实际保存的结果为准。

## 你要解决什么

从中文数据库保存文献时，常见的情况是：保存按钮只显示灰色网页图标；存下来的条目缺作者、缺期刊名；作者姓名挤在一个框里；做中英文混排的参考文献时，中文标题被改了大小写或格式不对。

这些问题大多和两件事有关：这个网站有没有可用的**转换器**，以及保存后有没有**核对和补全题录**。本文只写能在官方文档和官方仓库中核实的内容。

## 操作步骤

### 1. 先弄懂「转换器」是什么

连接器能从网页上抓到题录，靠的是 Zotero 的转换器（translator）：一段专门识别某类网站、提取题录的脚本。官方说明 Zotero 现有 600 多个转换器，完整列表和代码公开在 GitHub 的官方转换器仓库中。[官方说明：转换器](https://www.zotero.org/support/translators)

要知道某一页用的是哪个转换器，把鼠标停在浏览器的 Zotero 保存按钮上，提示文字会显示它的名称。[官方排错说明](https://www.zotero.org/support/troubleshooting_translator_issues)

### 2. 官方仓库里有哪些面向中文站点的转换器

截至 2026-11-13，[官方转换器仓库](https://github.com/zotero/translators)中，适用网址明确指向中文学术或图书站点的转换器有以下几个（括号里是转换器文件自己写明的「最后更新」日期）：

- **CNKI**：适用于 cnki.net 域名下的页面，即中国知网（2023-11-27）。
- **Wanfang Data**：适用于 d.wanfangdata.com.cn、s.wanfangdata.com.cn 等万方数据页面（2019-06-10）。
- **Baidu Scholar**：适用于 xueshu.baidu.com，即百度学术（2021-06-16）。
- **Douban**：适用于豆瓣（www.douban.com、book.douban.com）的条目页、豆列等页面（2024-08-07）。
- **Superlib**：适用于 book.ucdrs.superlib.net、jour.ucdrs.superlib.net 的检索与详情页（2021-08-18）。
- **Airiti**：适用于 airitilibrary.com 的文献详情页，即华艺线上图书馆（2023-08-04）。

怎么理解这份清单：

- 仓库里**有**某个转换器，只说明 Zotero 会尝试用它识别这些网址，**不代表现在一定能抓全题录**。上面几个转换器的最后更新日期有的已是数年前，对应网站在此之后若有改版，就可能出现识别不到或字段缺漏。
- 本文没有逐一测试它们当前的效果，这里只列出公开仓库中可核实的事实。
- 清单以外的中文网站，并不意味着一定不能保存。如果网页本身嵌入了标准格式的元数据，或页面上有 DOI，通用转换器也可能抓到部分信息（见下一步）。

### 3. 看懂「通用转换器」的结果

没有专用转换器时，Zotero 会尝试几个通用转换器。据官方说明：[官方说明：默认转换器](https://www.zotero.org/support/kb/default_translators)

- **DOI**：识别页面上像 DOI 的文字，再到 Crossref 查题录。官方特别说明，这种方式得到的数据**不含全文和摘要**，Crossref 数据不全时也会失败。
- **Embedded Metadata**、**COinS**、**unAPI**：读取网页里按开放标准嵌入的元数据。Embedded Metadata 常常只能抓到很少的信息，存下来的条目往往不太有用。

官方排错说明还提醒：主转换器出问题时，Zotero 可能会退而使用这些通用转换器。所以如果你在某个原本有专用转换器的网站上，看到提示里显示的是通用转换器的名称，说明专用转换器这次没有生效，需要特别留意题录是否完整。

### 4. 保存不顺时，按官方步骤排查

在中文网站上点保存没反应、只有灰色网页图标时，官方排错说明中与此相关的几条是：

1. 刷新页面，确认页面已完全加载完毕。
2. 先打开桌面版 Zotero 再保存。
3. 检查浏览器和连接器是否为最新版本，确认已允许连接器访问所有网站。
4. 鼠标停在保存按钮上，看实际使用的转换器名称。

仍然不行时，可以到 Zotero 官方论坛反馈，附上出问题的具体网址、连接器生成的调试编号（Debug ID）、保存弹窗里显示的内容和转换器名称。

暂时没法从网页保存时，可以换别的入口：文章有 DOI 时用「通过标识符添加条目」；图书有 ISBN 时也可以试试，但官方说明 ISBN 查询依靠美国国会图书馆、WorldCat 等目录，并不保证每本中文书都能查到。这些方法的详细步骤见[把文献加进 Zotero 的几种方式](/guides/add-items)。

### 5. 拖入中文 PDF 时，别对自动识别期望过高

官方说明，PDF 元数据识别会把前几页文字发送到 Zotero 的服务，结合 Crossref 数据和 DOI、ISBN 查询来生成条目。对于没有 DOI、也不在这些数据源中的文献，识别不出来是正常的。此时可以右键选「创建上级条目…」输入编号，或点「手动录入」自己填写。[官方说明：检索 PDF 元数据](https://www.zotero.org/support/retrieve_pdf_metadata)

### 6. 保存后，重点核对这几项

**作者姓名：** 每个作者栏可以在「单栏」和「两栏（姓、名分开）」之间切换。官方知识库明确建议：个人姓名应使用两栏模式，**这也包括亚洲人名**；Zotero 能正确处理中文和日文姓名的格式，但前提是数据录入正确，不要为了让某种格式「看起来对」而不必要地改成单栏。单栏模式适合机构作者，例如「某某研究所」。[官方说明：姓名字段](https://www.zotero.org/support/kb/name_parsing)

- 姓和名放反时，右键点击姓名，选「交换 名字/姓氏」。
- 栏位模式通过作者栏末尾的切换按钮改变（中文界面提示为「显示一个输入框」等，以实际显示为准）。

**语言字段：** 有些引文样式会把标题转成英文的「标题大写」格式，但这一规则只适用于英语。官方建议在条目的「语言」字段中填写语言代码，避免非英文标题被套用这一规则；代码可用两位（如 zh）或带地区的形式（如 zh-CN）。中英文文献混排时，这一项尤其值得检查。[官方说明](https://www.zotero.org/support/kb/preventing_title_casing_for_non-english_titles)

**其他常见缺漏：** 对照原网页检查条目类型（期刊文章、学位论文、报纸文章等）是否选对，期刊名、年、卷、期、页码、摘要是否齐全。Zotero 没有专门字段的信息，官方建议存放在「其他」（英文为 Extra）字段中。[官方说明：编辑条目](https://www.zotero.org/support/adding_items_to_zotero)

### 7. 检索中文内容

Zotero 10 起，在快速搜索栏中搜索中文、日文、韩文时，会按**完整词组**匹配附件全文，且速度更快；更早的版本中，不加引号的中日韩文字搜索可能会匹配到只含其中个别字的内容。[Zotero 10 发布说明](https://www.zotero.org/blog/zotero-10/)

另外，Zotero 界面语言默认跟随操作系统，也可以在设置中手动切换为简体中文；引文和参考文献的语言则在生成参考文献的对话框、文字处理软件插件的文档设置等处单独选择。[官方说明：语言支持](https://www.zotero.org/support/supported_languages)

## 常见问题

**为什么同一篇论文，从不同网站保存的题录不一样？** 官方说明：导入数据的质量取决于网页提供的信息，同一篇文献在不同网站上的题录质量可能不同。能从原始出处（如期刊官网、数据库的文章详情页）保存，就尽量不要从聚合检索页保存。

**一次要从中文数据库导入很多篇，怎么办？** 官方说明提醒，短时间内频繁保存可能被一些数据库暂时限制访问，建议批量导出为 RIS、BibTeX 等标准格式后再导入 Zotero。各中文数据库是否提供这些导出格式、导出的字段是否完整，请以数据库自己的说明为准，本文未核实。

**清单里的网站保存失败了，是 Zotero 坏了吗？** 不一定。先用官方建议的方法自测：试着保存一篇维基百科文章或亚马逊上的图书。如果这些都能保存，问题多半出在这个网站的转换器上，可以按第 4 步收集信息后到官方论坛反馈。

## 相关教程

- [把文献加进 Zotero 的几种方式](/guides/add-items)
- [查找并合并重复条目](/guides/merge-duplicates)
- [GB/T 7714 中文样式怎么找](/guides/gb-t-7714)
- [在 Word 里更换引用样式](/guides/word-switch-style)
