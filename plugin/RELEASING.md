# 发布「Zotero中文社区」插件

发布物都放在本仓库的 GitHub Release 上,不放在 zoterocn.org:

| 内容 | 地址 |
| --- | --- |
| 某个版本的安装包 | `https://github.com/cnzotero/zotero-community/releases/download/plugin-v<版本号>/zotero-community.xpi` |
| 更新清单(固定地址) | `https://github.com/cnzotero/zotero-community/releases/download/release/update.json` |

- 更新清单是 tag 为 `release` 的那个 Release 条目里的唯一附件,每次发版时替换。插件 manifest 的 `update_url` 指向它,已安装的用户由 Zotero 按它自动更新。
- 为什么不放在站点上:站点一旦被入侵,攻击者就能改清单里的下载地址(连同哈希),让 Zotero 静默装入任意代码。放在 GitHub 上,只有能往本仓库发 Release 的人才能改。
- `npm run build` 会在 `plugin/dist/` 里同时生成 `zotero-community.xpi` 与 `update.json`(含安装包的 SHA-256,Zotero 下载更新后会核对)。

## 发布顺序与理由

**合并 → 用合并后的 main 提交构建 → 发布该版本的 Release 并核对安装包 → 更新 `release` 条目里的 update.json → 再核对一次。**

- 安装包必须由合并后的 main 上的那个提交构建:Release 对应的代码与仓库主线完全一致。打包是可复现的(见 README「开发」),同一版本的 `zip` 工具从同一个提交能打出逐字节相同的包,便于他人核对。
- 先上传安装包、核对能下载,**最后**才替换更新清单:更新清单任何时候都只指向已经存在、核对过的安装包,不会出现清单指向 404 的时段。
- 合并本身不会影响已安装的用户:站点不再提供更新清单,合并后站点重新构建与插件更新无关。

## 步骤

1. **改版本号**(在一个分支上):同时改 `plugin/package.json` 与 `plugin/addon/manifest.json` 的 `version`,两处必须一致(测试会检查)。版本号用 `主.次.修订`,只增不减。
2. **测试**:在站点根目录跑 `npm test`(同时运行 `plugin/` 的测试)与 `npm run build`。用临时配置试装一次(见 README「开发」一节):全新的临时配置与数据目录,不要用日常的 Zotero 配置。
3. **合并到 main**。
4. **用合并后的 main 提交构建**:
   ```bash
   git fetch origin && git checkout --detach origin/main
   cd plugin && npm test && npm run build        # 产出 dist/zotero-community.xpi 与 dist/update.json
   ```
5. **发布该版本的 Release**(只上传安装包):
   ```bash
   git tag plugin-v0.1.0 && git push origin plugin-v0.1.0
   gh release create plugin-v0.1.0 dist/zotero-community.xpi \
     --title "Zotero中文社区 插件 0.1.0" \
     --notes "首个版本:在 Zotero 里浏览、搜索、安装与更新 zoterocn.org 收录的插件。"
   ```
   上传的文件名必须是 `zotero-community.xpi`。说明只写用户能感知到的变化。
6. **核对安装包**(此时还没动更新清单):
   ```bash
   node scripts/verify-release.mjs 0.1.0 --xpi-only
   ```
   检查该版本的下载地址返回 200、文件大小与 SHA-256 与本地构建一致、包里的版本号与插件标识正确。不通过就删除这个附件,查明原因后重新上传,**不要**进行下一步。
7. **更新 `release` 条目里的 update.json**:
   ```bash
   # 第一次发布时创建这个固定条目(标为预发布,不会显示成「最新版本」)
   gh release create release dist/update.json --prerelease --title "更新清单" \
     --notes "Zotero 自动更新用的清单,请勿删除。安装包请到各版本的 Release 下载。"
   # 之后每次发版:替换附件
   gh release upload release dist/update.json --clobber
   ```
8. **再核对一次**:
   ```bash
   node scripts/verify-release.mjs 0.1.0
   ```
   检查固定地址的 update.json 能下载、里面有这个版本、`update_link` 正是该版本的 Release 地址、`update_hash` 与本地构建一致,并再下载一次它指向的安装包核对大小、哈希与版本号。任何一项不通过都以非零状态退出并写明原因;此时把 `release` 条目里的 update.json 换回上一个版本的,再排查。

## 提高适配上限

Zotero 发布新的大版本后:用临时配置在新版本上验证 → 把 `manifest.json` 的 `strict_max_version` 改到新的大版本(如 `11.*`)→ 按上面的步骤发一个新版本。更新清单里的适配范围随 manifest 一起生成。

## 说明

- 现有的站点构建发布流程(`.github/workflows/build-deploy.yml`)不负责打包或发布插件;插件的 Release 按本文手动发布。
- 不要删除或改名 tag 为 `release` 的条目,也不要在里面放别的附件。
- 不要把令牌、本机路径或服务器地址写进仓库或 Release 说明。
