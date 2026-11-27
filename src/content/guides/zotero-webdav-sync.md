---
title: "Zotero 同步空间满 300MB 怎么办：WebDAV 附件同步配置与常见报错排查"
description: "解释 Zotero 300MB 免费空间上限只针对附件文件，梳理使用 WebDAV 同步 PDF 附件的配置步骤、多设备验证方法与 401/403/503 常见报错排查。"
slug: "zotero-webdav-sync"
category: "sync"
order: 405
published: "2026-11-27"
updated: "2026-11-27"
sources:
  - "https://www.zotero.org/support/sync"
  - "https://www.zotero.org/support/kb/file_sync_errors"
  - "https://www.zotero.org/support/kb/storage_quota_and_publishing"
---

# Zotero 同步空间满 300MB 怎么办：WebDAV 附件同步配置与常见报错排查

适用 Zotero 版本：桌面版 7、8、10。

最后核对于 2026-11-27。核对方式：Zotero 官方同步文档、配额说明与文件同步排错指南。

## 一句话结论

Zotero 官方账号的 **300MB 免费额度只计算 PDF 等附件文件**，文献题录、笔记、标签与分类的数据同步不限容量。空间满了后，不必花高价买官方大容量存储，最常见的做法是保持**「数据同步走 Zotero 官方账号 + 附件同步改走支持 WebDAV 的网盘」**，并在本地保留独立定期备份。

## 一、先分清两层同步，避免越配越乱

在 Zotero「设置（Settings）→ 同步（Sync）」里，同步明确分成上下两部分：

1. **数据同步（Data Syncing）**：同步标题、作者、年份、标签、分类结构、笔记和 PDF 高亮标注。这部分体积很小，官方免费不限量，登录自己的 Zotero 账号即可。
2. **文件同步（File Syncing）**：同步你存进文库的 PDF、图片等附件文件。默认使用 Zotero Storage（免费 300MB），达到上限后，新加入的 PDF 无法传到另一台设备，界面右上角会出现红色感叹号。

## 二、配置 WebDAV 同步个人文库附件的四步操作

1. **准备支持 WebDAV 的存储服务并生成专用应用密码**：在任意支持标准 WebDAV 协议的网盘或私有云（NAS）账户安全设置中，开启 WebDAV 功能，记下 **服务器地址（URL）**、**用户名** 与 **独立应用密码**（通常不是网页登录密码）。
2. **在 Zotero 中切换文件同步方式**：打开 Zotero「设置 → 同步」，在「文件同步」区域勾选「使用如下方式同步个人文库中的附件」，将下拉菜单从 `Zotero` 切换为 **`WebDAV`**。
3. **填写连接信息并验证服务器**：依次填入协议（`https`）、服务器地址（部分服务需注意是否自带 `/dav` 路径）、用户名和应用密码，点击 **「验证服务器（Verify Server）」**。看到提示已创建 `zotero` 目录并验证成功，说明通道已打通。
4. **按需选择下载时机并在第二台设备填入相同配置**：如果电脑硬盘空间充裕，选「同步时」下载附件；如果轻薄本空间紧张，可选「需要时」下载。另一台电脑或平板填入完全相同的 Zotero 账号与 WebDAV 参数，同步后抽查 2–3 篇刚新增的 PDF 确认能正常打开。

## 三、常见报错与坑点排查

- **401 Unauthorized（认证失败）**：绝大多数是因为填成了网盘网页登录密码，而不是专门生成的 WebDAV 应用密码；或服务器路径多写/少写了尾部目录（如 `/dav`）。
- **403 Forbidden 或路径创建失败**：检查网盘空间是否已满、账户是否开启了第三方应用访问权限，或服务器根目录是否允许 Zotero 自动新建 `zotero` 子文件夹。
- **503 Service Unavailable（请求过于频繁）**：首次同步上千篇 PDF 时容易触发部分免费网盘的短时限流。不必删除重来，暂停几十分钟后再点右上角绿色同步按钮，Zotero 会从中断处继续传。
- **群组文库（Group Libraries）无法走 WebDAV**：按 [官方说明](https://www.zotero.org/support/sync#file_syncing)，WebDAV 仅支持「我的文库（My Library）」，群组文库附件只能走官方存储配额。
- **切勿直接把整个 Zotero 数据目录放进云盘同步文件夹**：把正在运行的 `zotero.sqlite` 数据库放进普通网盘自动同步目录，极易引发数据库损坏，官方明确禁止该做法。

## 常见问题

**切换成 WebDAV 后，以前传到 Zotero 官方空间的旧 PDF 会自动转过去吗？** 新同步的附件会按 WebDAV 通道上传；如果要确保旧附件全部推送到新的 WebDAV 空间，可在确认本地 PDF 完整且做好备份后，在「设置 → 同步 → 重置」中谨慎按官方说明操作，或检查附件是否已在新设备可用。

**用 WebDAV 同步以后还需要本地备份吗？** 仍然需要。同步会把误删操作一并同步到所有设备，不能替代历史备份。重要论文阶段建议定期按[Zotero 同步、备份与附件有什么区别](/guides/sync-vs-backup)完整备份本地数据目录。

**同步完成后提示找不到 PDF 文件怎么办？** 先检查报错条目的附件是「存储的副本」还是「链接的文件」——链接文件默认不参与 WebDAV 同步，需要配合附件管理插件或在多设备保持一致的相对路径，详见[附件管理：存储文件、链接文件与自动重命名](/guides/manage-attachments)。

## 相关教程

- [Zotero 同步、备份与附件有什么区别](/guides/sync-vs-backup)
- [Zotero 文库不见了，如何准备恢复](/guides/restore-library)
- [附件管理：存储文件、链接文件与自动重命名](/guides/manage-attachments)
- [Zotero 同步与备份插件专题](/topics/sync)
