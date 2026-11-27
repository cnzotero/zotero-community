---
title: "换新电脑怎么把 Zotero 文献库、PDF 附件和插件完整迁过去"
description: "对比拷贝本地数据目录与云端同步两种换机迁移路线，给出不丢笔记、不丢 PDF、不破坏 Word 引文的无损迁移步骤与核验清单。"
slug: "zotero-migration-new-computer"
category: "sync"
order: 415
published: "2026-11-27"
updated: "2026-11-27"
sources:
  - "https://www.zotero.org/support/kb/transferring_a_library"
  - "https://www.zotero.org/support/zotero_data"
  - "https://www.zotero.org/support/kb/profile_directory"
---

# 换新电脑怎么把 Zotero 文献库、PDF 附件和插件完整迁过去

适用 Zotero 版本：桌面版 7、8、10（Windows / macOS / Linux 跨系统均适用）。

最后核对于 2026-11-27。核对方式：Zotero 官方文库迁移、数据目录与配置目录文档。

## 一句话结论

换电脑迁移 Zotero **千万不要用「导出文库再导入」**（会改写条目内部编号，导致旧 Word 论文里的引用全部脱钩）。最稳妥且速度最快的方法是：**彻底关闭旧电脑 Zotero → 用移动硬盘完整拷贝「数据目录（Data Directory）」→ 在新电脑安装 Zotero 后指向或覆盖该目录**，几千篇 PDF 与全部高亮笔记原封不动保留。

## 一、两种官方推荐迁移路线怎么选

- **路线 A：拷贝本地数据目录（最推荐，适合文献多、PDF 大、换机立等可用）**：不依赖网盘速度和 300MB 空间限制，能 100% 保留条目标识、Word 引文关联、PDF 标注与本地附件。
- **路线 B：账号 + WebDAV 云端同步（适合老电脑已不在身边、且平时一直开着完整同步）**：新电脑装好 Zotero 后登录同一 Zotero 账号与 WebDAV 参数，等待自动拉取即可。

## 二、拷贝数据目录无损迁移 5 步操作

1. **在旧电脑找到数据目录位置**：打开旧电脑 Zotero，进入「设置 → 高级 → 文件和文件夹」，点击 **「打开数据目录」**。确认该文件夹里包含 `zotero.sqlite` 数据库文件和 `storage` 附件文件夹。
2. **彻底退出旧电脑 Zotero 后整包复制**：务必完全退出 Zotero（切忌开着软件直接复制，否则容易拷出损坏的数据库），将整个数据目录完整复制到 U 盘或移动硬盘。
3. **在新电脑安装新版 Zotero 并先启动一次**：从官方下载页安装 Zotero，详细步骤见 [Zotero 官方下载与安装常见问题](/guides/zotero-download-install-faq)。启动看到空白文库后**先不要登录同步**，立即彻底退出 Zotero。
4. **把旧数据目录放进新电脑**：打开新电脑刚才生成的空数据目录（默认在用户主目录下的 `Zotero` 文件夹），将其清空后把旧数据目录的全部内容粘贴进去（或在高级设置中直接将「数据目录位置」指到新放好的文件夹）。
5. **启动核验，再按需装插件与开同步**：重新打开 Zotero，检查分类数量、笔记内容、随机抽查 3–5 篇 PDF 是否能正常打开，并打开一篇旧 Word 论文点一下 `Refresh` 确认引文链接完好；确认无误后，再登录同步账号和按需重装适配新版本的插件。

## 三、插件和自定义引用样式需要一起拷吗？

- **引用样式（`.csl`）**：保存在数据目录的 `styles` 子文件夹里，随数据目录一起迁过去后**自动保留**，无需重装。
- **第三方插件（`.xpi`）**：保存在「配置目录（Profile Directory）」而非数据目录里。换新电脑尤其是跨系统（Windows 换 Mac）或跨大版本时，**不建议硬拷旧配置目录**，推荐在新电脑装好 [Zotero 中文社区插件市场](/plugin) 后重新安装对应最新版本的插件，既干净又能避开旧配置残留报错。
- **链接的附件（Linked Files）**：如果你在旧电脑把 PDF 放在独立目录并通过相对路径链接，除了拷贝数据目录外，还需一并拷贝那个 PDF 文件夹，并在新电脑「设置 → 高级 → 文件和文件夹」里重新设置 **「链接附件的根目录」**。

## 常见问题

**为什么不能用“导出为 Zotero RDF / RIS 再导入”来换电脑？** 导出再导入会给每条文献分配全新的内部编号，不仅可能丢失部分关联关系和添加日期，还会导致你之前在 Word / WPS 里已经插入的引文找不到对应条目。

**Windows 换到 Mac（或 Mac 换到 Windows）能直接拷数据目录吗？** 可以。`zotero.sqlite` 与 `storage` 附件目录结构跨平台完全通用，直接整包复制过去即可正常打开。

**迁完后老电脑上的备份什么时候可以删？** 建议在新电脑稳定使用至少一周、并确认同步与论文写作全部正常后，再整理旧电脑上的副本；平时也建议定期按 [Zotero 同步、备份与附件有什么区别](/guides/sync-vs-backup) 保留一份历史备份。

## 相关教程

- [Zotero 同步、备份与附件有什么区别](/guides/sync-vs-backup)
- [Zotero 文库不见了，如何准备恢复](/guides/restore-library)
- [Zotero 官方下载与安装常见问题](/guides/zotero-download-install-faq)
- [用「Zotero中文社区」插件市场安装与更新](/guides/community-plugin-market)
