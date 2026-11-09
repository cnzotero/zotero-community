---
title: "十分钟认识第一个 Zotero 插件：模板与构建"
description: "从可核对的模板快照开始，修改插件身份、安装依赖并生成安装包。"
slug: "dev-02-first-plugin"
order: 2
sources:
  - "https://github.com/windingwind/zotero-plugin-template/tree/15f7538c854d5f9751a470bf846389f744f9e920"
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/.env.example"
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/addon/manifest.json"
  - "https://github.com/zotero-plugin-dev/zotero-plugin-scaffold"
---

# 十分钟认识第一个 Zotero 插件：模板与构建

本篇的“十分钟”是熟悉流程的练习目标，不保证下载或安装依赖所需时间。你将拿到一个可继续修改的模板，完成一次构建，并知道运行前还需要配置什么。正式开发建议在模板仓库点击 Use this template 创建自己的仓库；下面直接下载原模板只用于本地实验，不替别人项目发布版本。

## 先固定参考版本

本文核对模板3.1.0、提交15f7538c854d5f9751a470bf846389f744f9e920。该快照清单声明 Zotero 8.0–11.*，不是现成的 Zotero 7 模板。实际新功能仍须逐版本测试。以下安装与构建于2026年11月10日在 macOS、Node.js26.4.0、npm11.17.0跑通；这是一组验证环境，不表示其他版本一定不可用。日常安装优先参考 Node.js 当前长期支持版本及依赖要求。

```sh
# 仅取得模板并切换到本文核对快照；目录名可自定
# 验证范围：macOS / Node.js 26.4.0 / npm 11.17.0
# clone、checkout 均为读取公开源码的操作
 git clone https://github.com/windingwind/zotero-plugin-template.git zotero-first-plugin
 cd zotero-first-plugin
 git checkout 15f7538c854d5f9751a470bf846389f744f9e920
 npm ci
 npm run build
```

构建成功后查看 .scaffold/build/，其中有安装包及构建后的资源。源码目录便于阅读与修改，安装包则供应用安装；不要把两者混用，也不要手动编辑构建产物来代替修改源码。本文实际执行了同一快照的依赖安装和构建，尚未用该模板安装包做 Zotero 真机运行验收。终端显示成功只能证明构建路径通过，不能代替功能测试。依赖安装若出现版本冲突，先核对锁文件与运行环境，不要第一步就强制安装或自动大幅升级依赖。

## 把模板改成自己的身份

在自己的项目修改 package.json 中名称、描述、作者和仓库地址，尤其要换 addonID、addonRef、addonInstance 与 prefsPrefix。这些字段应保持项目内部一致，避免菜单、偏好项或实例与其他插件冲突。不要只换界面名称就把模板直接发布。

从 src/hooks.ts 找到生命周期入口，再沿调用关系读 src/modules/examples.ts。先保留一个能看懂的示例，逐项移除无关演示；每移除一项，同时确认它的注册和退出清理是否成对。第一步可以只修改某段可见提示，用它区分自己构建的安装包与下载的旧版本。

## 运行之前配置隔离环境

复制 .env.example 为 .env，填写开发用 Zotero 程序、独立配置目录和独立数据目录。三个路径承担不同用途；数据目录留空可能继续使用默认资料，不能因为配置目录是新的就省略核对。Windows 读者按示例处理路径分隔符。配置文件不应提交到公开仓库。

下面命令已核对上游脚本，但本篇未执行真机启动：

```sh
# 待核实：填写隔离开发路径后，在目标 Zotero 版本上验证
npm start
```

它应完成开发构建、启动配置的 Zotero，并观察源码变化。若启动的是日常实例，立即停止这次实验，先纠正路径。成功看到自己的功能后，再测试禁用、启用和窗口重开，记录实际支持的版本。下一篇介绍如何读条目与缩小调试范围。
