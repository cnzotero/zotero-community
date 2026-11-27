---
title: "iPad / 手机端怎么用 Zotero 读论文：官方 App 与 WebDAV 跨设备同步配置"
description: "说明如何在 iPad、iPhone 和 Android 设备上安装 Zotero 官方移动客户端，配合 WebDAV 与桌面端同步 PDF 附件和高亮批注，并排查常见打不开附件的问题。"
slug: "zotero-ipad-mobile-sync"
category: "sync"
order: 408
published: "2026-11-27"
updated: "2026-11-27"
sources:
  - "https://www.zotero.org/support/ios"
  - "https://www.zotero.org/support/android"
  - "https://www.zotero.org/support/sync"
---

# iPad / 手机端怎么用 Zotero 读论文：官方 App 与 WebDAV 跨设备同步配置

适用 Zotero 版本：桌面版 7、8、10；iOS / iPadOS 与 Android 官方客户端。

最后核对于 2026-11-27。核对方式：Zotero 官方 iOS、Android 及同步文档。

## 一句话结论

在 iPad 或手机上读论文、用 Apple Pencil / 手写笔划线并自动回到电脑 Zotero，直接装 **Zotero 官方 App** 即可——数据同步登录同一个 Zotero 账号，PDF 附件容量超过免费 300MB 时，在桌面端和移动端同时配置**同一套 WebDAV 参数**，高亮批注与原文就能双向实时同步。

## 一、三步打通电脑与平板 / 手机

1. **在桌面端先跑通同步**：确认电脑上的 Zotero 已登录官方账号，且 PDF 附件已完整上传到 Zotero Storage 或 WebDAV 空间；若桌面端尚未配置 WebDAV，请先按 [Zotero 同步空间满 300MB 怎么办：WebDAV 附件同步配置](/guides/zotero-webdav-sync) 验证通过。
2. **安装官方移动客户端并登录同一账号**：在 App Store（iPad / iPhone）或 Google Play / 官方渠道（Android）搜索由 **Corporation for Digital Scholarship** 发布的 Zotero 官方应用，登录同一个 Zotero 账号后，分类目录与文献题录会在数分钟内同步出现。
3. **在移动端设置相同的附件同步方式**：如果桌面端使用 WebDAV，打开移动端 Zotero「设置 → 账号 / 文件同步」，将个人文库附件同步切换为 **WebDAV**，填入与桌面端完全一致的服务器地址、用户名与专用应用密码并点击验证。

## 二、平板阅读与标注的实用建议

- **用内置阅读器直接高亮与手写批注**：在官方 App 中做的文字高亮、墨水手写与批注会作为标准 Zotero 标注随数据同步回电脑，不改写原始 PDF 文件，回到电脑打开条目即可直接看到并一键生成笔记。
- **轻装空间选「按需下载」**：几百上千篇 PDF 没必要全部离线塞满平板存储，在移动端设置中保持按需下载，点开哪篇就下载哪篇；离线出差或坐高铁前，可提前点开要读的几篇缓存到本机。
- **区分“存储的副本”与“链接的文件”**：官方文档明确指出，使用「链接的文件（Linked Files）」存放在本地自定义文件夹里的 PDF 不会通过官方云端或标准 WebDAV 同步到移动端；需要跨平板阅读的文献应保持为 Zotero 存储副本。

## 三、移动端常见同步问题排查

- **条目看得到，但点开 PDF 提示找不到文件**：先确认这篇 PDF 在桌面端不是「链接文件」；再检查桌面端右上角是否已彻底同步完成（无红色感叹号），以及移动端 WebDAV 地址末尾路径是否与桌面端一致。
- **平板划完线，电脑端没立刻看到**：退出阅读界面回到文库列表下拉刷新一次，再在电脑端点击右上角绿色同步按钮，通常几秒内即可拉取最新标注。
- **群组文库在平板上打不开 PDF**：群组文库附件只能使用 Zotero 官方存储配额，不走个人 WebDAV。

## 常见问题

**iPad 上的 Zotero 官方 App 收费吗？** 官方 App 免费下载使用，基础阅读、高亮、手写批注和题录同步均免费；仅当使用 Zotero 官方云端附件存储超出 300MB 时才涉及官方扩容，个人文库可免费改用自有 WebDAV 服务。

**在 iPad 上安装桌面版 `.xpi` 插件可以用吗？** 不能。`.xpi` 扩展仅适用于 Windows / macOS / Linux 桌面版 Zotero，移动端不加载桌面插件。

**换新 iPad 需要手工导出数据吗？** 只要日常已开启同步且在电脑端保留了完整备份，新平板登录同一 Zotero 账号与 WebDAV 配置即可自动恢复文库。

## 相关教程

- [Zotero 同步空间满 300MB 怎么办：WebDAV 附件同步配置与报错排查](/guides/zotero-webdav-sync)
- [Zotero 同步、备份与附件有什么区别](/guides/sync-vs-backup)
- [附件管理：存储文件、链接文件与自动重命名](/guides/manage-attachments)
