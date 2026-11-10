# Zotero 中文社区

Zotero 中文社区站:教程、插件广场、引用样式、问答讨论。

首版为内容驱动的静态站,账号与讨论功能后续接入。

## 开发

```bash
npm install
npm run dev        # 本地预览
npm run typecheck  # 类型检查
npm test           # 单元测试
npm run build      # 构建
```

## 目录数据与社区插件

- 构建时生成 `/data/catalog.json`:在架插件的机器可读目录(`schema: 1`,字段只增不改)。它不是页面,不进 sitemap。
- 社区插件的自动更新清单不由站点提供,放在本仓库 GitHub 上 tag 为 `release` 的条目里(见 `plugin/RELEASING.md`)。
- `npm test` 同时运行 `plugin/` 的测试。
- 安装包的插件标识存在 `src/data/addon-ids.json`,用 `node --experimental-strip-types scripts/import-addon-ids.mjs` 重新生成。
- `plugin/`:Zotero 插件「Zotero中文社区」(插件市场),自带测试与打包脚本,见 `plugin/README.md`。

## 说明

Zotero 是 Corporation for Digital Scholarship 的商标。本站为社区自发运营的非官方站点,与 Zotero 官方无隶属关系。
