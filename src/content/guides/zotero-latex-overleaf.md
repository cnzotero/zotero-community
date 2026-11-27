---
title: "Zotero 配合 LaTeX 和 Overleaf 写论文：自动导出 BibTeX 与引用键配置指南"
description: "梳理 Zotero 与 LaTeX、Overleaf 协作的标准流程：导出 .bib 文件、保持稳定引用键（Citekey）、解决中文与特殊符号转义以及自动同步更新方法。"
slug: "zotero-latex-overleaf"
category: "writing"
order: 608
published: "2026-11-27"
updated: "2026-11-27"
sources:
  - "https://www.zotero.org/support/kb/exporting"
  - "https://www.zotero.org/support/creating_bibliographies"
---

# Zotero 配合 LaTeX 和 Overleaf 写论文：自动导出 BibTeX 与引用键配置指南

适用 Zotero 版本：桌面版 7、8、10；本地 LaTeX 编译器（TeX Live / MiKTeX）及 Overleaf。

最后核对于 2026-11-27。核对方式：Zotero 官方导出与参考文献生成文档。

## 一句话结论

用 LaTeX 或 Overleaf 写论文时，Zotero 最核心的价值是**自动维护一份干净、引用键永不漂移的 `.bib` 文件**。少量引用可以直接右键分类导出 `BibTeX` / `BibLaTeX`；长期写期刊或学位论文，强烈建议在 [LaTeX 与 BibTeX 插件专题](/topics/latex) 里选用支持**固定引用键（Citekey）+ 增删条目自动更新 `.bib` 文件**的插件。

## 一、标准协作四步走

1. **按论文建独立分类**：在 Zotero 中为当前稿件新建一个分类（例如 `Paper-2026-IEEE`），把正文要引用的文献全部拖进该分类，避免导出整个大文库导致 `.bib` 冗长和键名冲突。
2. **统一固定引用键规则**：常见的引用键格式为 `第一作者姓氏 + 年份 + 标题首实词`（如 `vaswani2017attention`）。一旦正文里写下 `\cite{vaswani2017attention}`，后续修改题录细节时应保持引用键固定不变，防止整篇论文编译报未定义引用。
3. **导出并开启自动更新**：
   - **本地 LaTeX（VS Code / TeXstudio 等）**：将分类导出为 `references.bib` 放到论文 `.tex` 同目录；若安装了自动导出类插件，勾选「保持更新（Keep updated）」，以后在 Zotero 新增或改错一条文献，本地 `.bib` 会自动刷新。
   - **Overleaf 在线写作**：可定期上传更新后的 `references.bib`，或通过支持云端同步 / Git 仓库的方式自动拉取最新 `.bib`。
4. **在 `.tex` 中加载并编译**：根据期刊模板要求选择 `bibtex`（`\bibliography{references}`）或 `biblatex`（`\addbibresource{references.bib}`），按照「编译主文件 → 编译参考文献 → 再编译主文件两次」的顺序消除 `[?]` 占位符。

## 二、写英文与中文 LaTeX 论文常见踩坑排查

- **英文标题里的缩写（如 DNA、IEEE、Transformer）被自动变小写**：BibTeX 默认会把标题中间的大写字母转成小写；在插件导出设置中保留专有名词大小写保护（用花括号 `{IEEE}` 包裹）即可解决。
- **期刊名或摘要里带 `&`、`%`、`_` 导致编译报错**：原生导出偶尔漏转义特殊字符，导出前核对或使用专业 BibTeX 导出插件自动转义，可大幅减少编译报错；同时建议取消导出无用的 `abstract`、`file` 等超长字段，让 `.bib` 更清爽。
- **中文学位论文参考文献出现乱码或“et al.”**：使用 `XeLaTeX` 编译并确保 `.bib` 为 **UTF-8 无 BOM** 编码；在中文条目中按模板要求填写 `language = {zh}` 并配合 `gbt7714` 宏包或 `biblatex-gb7714-2015` 样式。

## 常见问题

**BibTeX 和 BibLaTeX 导出应该选哪一个？** 先看目标期刊或学校提供的 `.tex` 模板里用的是 `\bibliographystyle{...}`（选 BibTeX）还是 `\usepackage{biblatex}`（选 BibLaTeX）。两者日期和字段格式略有差异，选对模板对应项最省心。

**在 Overleaf 里怎么免手工反复上传 `.bib`？** Overleaf 付费方案支持直接关联 Zotero 账号或 GitHub 仓库自动同步；免费方案可借助导出插件把 `.bib` 同步到公开链接或定期一键覆盖上传，交稿前务必核对一次参考文献总数。

**修改了 Zotero 里的页码或年份，编译 PDF 没变怎么办？** 确认 `.bib` 文件已被更新，然后清理 `.aux` / `.bbl` 临时文件后重新执行完整编译链路。

## 相关教程

- [导入与导出文献：RIS、BibTeX、CSL JSON、Zotero RDF 怎么选](/guides/import-export-formats)
- [在 Word 里插入引文与参考文献](/guides/word-insert-citations)
- [Zotero LaTeX 与 BibTeX 插件专题](/topics/latex)
