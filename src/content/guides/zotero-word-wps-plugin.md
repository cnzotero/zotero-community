---
title: "Zotero 在 Word 和 WPS 里不显示插件怎么办：排查与恢复步骤"
description: "解决安装了 Zotero 却在 Microsoft Word 或 WPS 菜单栏看不到 Zotero 选项卡的问题：从内置重装、Zotero.dotm 模板路径核对到加载项信任设置逐项排查。"
slug: "zotero-word-wps-plugin"
category: "writing"
order: 607
published: "2026-11-27"
updated: "2026-11-27"
sources:
  - "https://www.zotero.org/support/word_processor_plugin_troubleshooting"
  - "https://www.zotero.org/support/word_processor_integration"
  - "https://www.zotero.org/support/word_processor_plugin_manual_installation"
---

# Zotero 在 Word 和 WPS 里不显示插件怎么办：排查与恢复步骤

适用 Zotero 版本：桌面版 7、8、10（Microsoft Word Windows / macOS、WPS 文字）。

最后核对于 2026-11-27。核对方式：Zotero 官方文字处理插件集成与排错文档。

## 一句话结论

在 Word 或 WPS 菜单栏找不到「Zotero」选项卡，最常见的原因有三类：安装时文档软件未彻底关闭导致模板未写入、Word 将 `Zotero.dotm` 加载项禁用，或 WPS 个人版默认未开启加载项支持。按下面四步顺序排查，大多数情况 5 分钟内可恢复。

## 一、第一步：彻底关闭 Word / WPS，在 Zotero 内重新安装加载项

1. 保存正在编辑的文档，**彻底退出 Microsoft Word 或 WPS**（Windows 可在任务管理器确认没有残留进程，macOS 需使用 `Cmd + Q` 完整退出）。
2. 打开 Zotero，进入「设置（Settings）→ 引用（Cite）→ 文字处理软件（Word Processors）」。
3. 点击 **「重新安装 Microsoft Word 加载项」**（Reinstall Microsoft Word Add-in），等待提示成功。
4. 重新打开 Word，检查顶部菜单栏是否出现「Zotero」选项卡。

## 二、第二步：检查 Word 是否把 Zotero.dotm 模板禁用了

如果重新安装后仍不显示，通常是 Word 安全设置或上次崩溃自动禁用了加载项：

1. 在 Windows 版 Word 中，依次打开 **「文件 → 选项 → 加载项」**。
2. 先在底部「管理」下拉框中选择 **「禁用项目」**，点「转到」——如果列表里出现 `Zotero.dotm`，选中并点击启用。
3. 再回到「管理」下拉框选择 **「Word 加载项」**，点「转到」，勾选列表中的 `Zotero.dotm` 并确认。
4. 在 **「文件 → 选项 → 信任中心 → 信任中心设置 → 加载项」** 中，核对是否误勾选了「禁用所有应用程序加载项」。

## 三、第三步：手动核对 Zotero.dotm 模板文件位置

如果 Word 的「Word 加载项」列表里根本没有 `Zotero.dotm`，可以按 [官方手动安装说明](https://www.zotero.org/support/word_processor_plugin_manual_installation) 复制模板文件：

1. 打开 Word 的 **「文件 → 选项 → 高级 → 文件位置」**（macOS 在「Word → 偏好设置 → 文件位置」），查看 **「启动（Startup）」** 对应的文件夹路径。
2. 在 Zotero 安装目录下的 `integration/word-for-windows`（或 macOS 应用包内的 `Contents/Resources/integration/word-for-mac`）中找到 `Zotero.dotm`。
3. 关闭 Word，将 `Zotero.dotm` **复制**（不要剪切）到上一步查看到的 Word「启动（Startup）」文件夹里，再重启 Word。

## 四、WPS 文字使用 Zotero 插件的注意事项

Zotero 官方原生支持 Microsoft Word、LibreOffice 与 Google Docs；在 **WPS 文字** 中使用 `Zotero.dotm` 依赖 WPS 对 Word 宏模板的兼容能力，排查重点如下：

1. **确认是否安装 VBA 支持模块**：部分精简版或个人版 WPS 默认未启用宏与加载项功能，导致无法加载 `.dotm` 模板，需要确保当前 WPS 版本支持 Word 加载项与宏功能。
2. **检查 WPS 的启动模板目录**：在 WPS 文字中打开「开发工具 → 加载项」查看是否能手动添加 `Zotero.dotm`；如果 WPS 升级后按钮消失，通常重新勾选加载项或再次把 `Zotero.dotm` 放进 WPS 模板目录即可。
3. **跨软件混编注意备份**：如果同一篇学位论文需要在 WPS 和 Microsoft Word 之间来回修改，务必在 Zotero 的「Document Preferences」中保持使用 **`.docx` 格式与默认「字段（Fields）」模式**，切换软件前先备份文档副本。

## 常见问题

**点了 Zotero 选项卡里的「Add/Edit Citation」没反应或提示无法通信怎么办？** 先确认 Zotero 桌面程序已经启动并在后台运行；若 Zotero 与 Word 以不同权限运行（例如一个勾选了“以管理员身份运行”，另一个没有），操作系统会阻断两者通信，取消管理员运行设置后同时重启即可。

**macOS 升级系统或 Word 后 Zotero 工具栏消失怎么办？** macOS 上 Word 升级有时会重置权限或启动目录，先在 Zotero 的「Cite → 文字处理软件」里重新安装一次，再在系统「隐私与安全性 → 自动化」中确认允许 Microsoft Word 与 Zotero 交互。

**插入引文后怎么更换成 GB/T 7714 等中文样式？** 在文档的 Zotero 选项卡中点击「Document Preferences」即可切换样式，详细步骤见[在 Word 里更换 Zotero 引用样式](/guides/word-switch-style)与[GB/T 7714 中文引用样式怎么找](/guides/gb-t-7714)。

## 相关教程

- [在 Word 里插入引文与参考文献](/guides/word-insert-citations)
- [在 Word 里更换 Zotero 引用样式](/guides/word-switch-style)
- [在 LibreOffice 与 Google Docs 里用 Zotero 引用](/guides/libreoffice-google-docs)
- [Zotero 引用样式总览](/styles)
