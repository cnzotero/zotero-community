// 社区官方插件「Zotero中文社区」的展示信息。版本号与适配范围在构建时从插件自己的 manifest 读取,不手写。
// 它在插件广场顶部单独展示,不进插件目录、不参与任何筛选、排序与计数(见收录规则第 4 章)。
import manifest from "../../plugin/addon/manifest.json" with { type: "json" };

const REPO = "https://github.com/cnzotero/zotero-community";
const z = manifest.applications.zotero;
const major = (v: string): number => Number.parseInt(v, 10);

export interface OfficialPlugin {
  name: string;
  badge: string;
  summary: string;
  version: string;
  minMajor: number;
  maxMajor: number;
  compatText: string;
  /** 该版本的 GitHub 发布页(下载安装包) */
  releaseUrl: string;
  /** 站内介绍与安装教程 */
  pagePath: string;
  /** 仓库里的使用教程 */
  docUrl: string;
  sourceUrl: string;
}

export const OFFICIAL: OfficialPlugin = {
  name: manifest.name,
  badge: "社区官方插件 · 由本社区维护",
  summary: "在 Zotero 里直接浏览、搜索本站收录的插件,核对来源后一键安装或更新。",
  version: manifest.version,
  minMajor: major(z.strict_min_version),
  maxMajor: major(z.strict_max_version),
  compatText: `适配 Zotero ${major(z.strict_min_version)}–${major(z.strict_max_version)}`,
  releaseUrl: `${REPO}/releases/tag/plugin-v${manifest.version}`,
  pagePath: "/plugin",
  docUrl: `${REPO}/blob/main/docs/plugins/community-plugin-market.md`,
  sourceUrl: `${REPO}/tree/main/plugin`,
};
