---
title: "Zotero 官方下载与安装常见问题：Windows / macOS / Linux 版本选择与排查"
description: "梳理 Zotero 7、8、10 桌面版与浏览器 Connector 的官方下载途径、系统版本选择、安装卡顿排查与安全注意事项，避免误装不明整合包。"
slug: "zotero-download-install-faq"
category: "start"
order: 105
published: "2026-11-27"
updated: "2026-11-27"
sources:
  - "https://www.zotero.org/download/"
  - "https://www.zotero.org/support/installation"
  - "https://www.zotero.org/support/system_requirements"
  - "https://www.zotero.org/support/kb/updating_zotero"
---

# Zotero 官方下载与安装常见问题：Windows / macOS / Linux 版本选择与排查

适用 Zotero 版本：桌面版 7、8、10（Windows、macOS、Linux）。

最后核对于 2026-11-27。核对方式：Zotero 官方下载页、系统要求与安装文档。

## 一句话结论

下载 Zotero 始终以 [Zotero 官方下载页](https://www.zotero.org/download/) 为准，**分别安装两样东西**：桌面主程序（Zotero）和浏览器扩展（Zotero Connector）。不要从搜索引擎广告位或不明网盘下载所谓“破解整合版”，以免捆绑广告或破坏后续自动更新。

## 一、不同操作系统怎么选安装包

1. **Windows 用户**：官方下载页会自动识别系统并推荐安装程序；64 位 Windows 优先选择 64 位版本，处理大型 PDF 文库时内存空间更充裕。如果单位电脑没有管理员权限，可在官网查看便携压缩包或普通用户目录安装说明。
2. **macOS 用户**：官方提供通用 `.dmg` 安装包，兼容 Apple Silicon（M 系列芯片）与 Intel 处理器。双击挂载后将 Zotero 拖入「应用程序（Applications）」文件夹再启动，不要直接在磁盘映像窗口里长期运行。
3. **Linux 用户**：官方提供打包好的压缩包及社区维护的 Flatpak / 发行版仓库方式，具体系统库要求请核对 [官方系统要求](https://www.zotero.org/support/system_requirements)。

## 二、Zotero 7、8、10 应该装哪个版本

- **新手首次安装**：直接安装官网首页当前的正式稳定版即可，新特性与安全修复最完整，也能直接参考[安装 Zotero 与第一个文库](/guides/install-zotero)快速建库。
- **重度依赖特定插件的用户**：如果研究工作离不开几款刚需第三方插件，安装或升级主版本前，先在[Zotero 10 兼容的插件](/compat/zotero-10)、[Zotero 8 兼容的插件](/compat/zotero-8)或[Zotero 7 兼容的插件](/compat/zotero-7)页面确认这些插件是否已声明适配。
- **老版本（Zotero 6）用户升级**：升级前务必先彻底退出 Zotero，完整备份本地数据目录，再覆盖安装新版，具体排查步骤见[Zotero 8 / 10 更新后插件提示不兼容怎么办](/guides/zotero-upgrade-plugin-incompatible)。

## 三、常见下载与安装问题排查

### 1. 官网下载速度慢或中断怎么办

- 优先检查本地网络或切换有线网络与常规浏览器自带下载器，避免使用会自动改写文件名的下载工具。
- 下载完成后检查文件大小是否完整；如果打开安装包报错提示文件损坏，通常是下载未完整，重新下载即可。
- 浏览器扩展（Zotero Connector）在 Edge、Chrome、Firefox 或 Safari 的官方扩展商店获取，不需要把 `.xpi` 桌面插件拖进浏览器。

### 2. 安装时系统弹出“未知开发者”或安全提醒

- 仅在确认安装包来自 `zotero.org` 官方域名时允许运行；Windows 上若出现 SmartScreen 提示，可右键安装包属性核对数字签名后再放行。
- 切勿为了省事关闭整机杀毒软件或从第三方聚合下载站获取安装包。

### 3. 装完桌面版后，Word 里没有出现 Zotero 选项卡

- Zotero 桌面版首次启动时会自动尝试注册 Word 与 LibreOffice 加载项；如果安装时 Word 正处于打开状态，可能注册不完整。
- 彻底关闭 Word 后，在 Zotero「设置 → 引用 → 文字处理软件」里点击重新安装插件，详细步骤见[Zotero 在 Word 和 WPS 里不显示插件怎么办](/guides/zotero-word-wps-plugin)。

## 常见问题

**Zotero 桌面版收费吗？** Zotero 桌面程序本身开源免费，本地添加文献、做笔记、插引文均不限制数量。只有使用 Zotero 官方云端附件存储超过 300MB 免费额度时，才需要考虑扩容或改用第三方 WebDAV 同步。

**安装 Zotero 时需要同时装插件吗？** 不必一口气装很多插件。建议先用纯净版体验几天，明确自己需要翻译、期刊分区或笔记增强等具体需求后，再从[插件广场](/plugins)或[社区插件市场](/plugin)按需安装。

**能不能在同一台电脑上保留旧版和新版？** 跨主版本升级可能会升级本地数据库结构，导致旧版无法直接读取新版数据库。切勿随意混用同一个数据目录，测试新版前请先按[同步、备份与附件有什么区别](/guides/sync-vs-backup)做好完整备份。

## 相关教程

- [安装 Zotero 与第一个文库](/guides/install-zotero)
- [怎么安装 Zotero 插件](/guides/install-plugins)
- [Zotero 8 / 10 更新后插件提示不兼容怎么办](/guides/zotero-upgrade-plugin-incompatible)
- [Zotero 在 Word 和 WPS 里不显示插件怎么办](/guides/zotero-word-wps-plugin)
