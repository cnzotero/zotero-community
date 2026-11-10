// 插件数据的加载与缓存。浏览器里按需加载(数据较大,只有用到的页面才加载);
// 预渲染时由入口直接注入,保证静态页面与前端接管时用的是同一份数据。
// 这里拿到的只有「在架」的插件:构建时已在唯一的数据入口(scripts/catalog.ts)按收录规则第 3 章过滤,
// 页面里不再各自过滤。
import type { History } from "./charts-lib.ts";
import type { DelistedData } from "./delisted.ts";
import { compatIndex, homeBoards, type HomeBoards, type Plugin } from "./lib.ts";
import { currentZoteroMajor } from "./lifecycle.ts";

export interface PluginData {
  generatedAt: string;
  plugins: Plugin[];
}

let plugins: PluginData | null = null;
let history: History | null = null;
let boards: HomeBoards | null = null;
let compat: { major: number; count: number }[] | null = null;
let pending: Promise<PluginData> | null = null;
let pendingHistory: Promise<History> | null = null;
let delisted: DelistedData | null = null;
let pendingDelisted: Promise<DelistedData> | null = null;

/** 预渲染入口调用:注入构建时的数据(plugins 是在架名单;delisted 是下架记录,缺省为没有下架)。 */
export function setServerData(d: { generatedAt: string; plugins: Plugin[]; history: History; delisted?: DelistedData }): void {
  plugins = { generatedAt: d.generatedAt, plugins: d.plugins };
  history = d.history;
  boards = homeBoards(d.plugins);
  compat = compatIndex(d.plugins);
  delisted = d.delisted ?? { listed: d.plugins.length, current: currentZoteroMajor(d.plugins), records: [] };
}

export const cachedPluginData = (): PluginData | null => plugins;
export const cachedHistory = (): History | null => history;
export const cachedDelisted = (): DelistedData | null => delisted;
/** 预渲染时由注入数据算出的首页榜单;浏览器里为 null,改用构建期产出的小份数据。 */
export const serverHomeBoards = (): HomeBoards | null => boards;
/** 预渲染时由注入数据算出的版本兼容页目录;浏览器里为 null,改用构建期产出的小份数据。 */
export const serverCompatIndex = (): { major: number; count: number }[] | null => compat;

export function loadPluginData(): Promise<PluginData> {
  if (plugins) return Promise.resolve(plugins);
  pending ??= import("virtual:plugin-catalog")
    .then((m) => (plugins = (m.default ?? m) as unknown as PluginData))
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}

export function loadHistory(): Promise<History> {
  if (history) return Promise.resolve(history);
  pendingHistory ??= import("../data/history.json")
    .then((m) => (history = (m.default ?? m) as unknown as History))
    .catch((e) => {
      pendingHistory = null;
      throw e;
    });
  return pendingHistory;
}

/** 下架记录(很小,构建时算好):下架记录页与收录规则页用。 */
export function loadDelisted(): Promise<DelistedData> {
  if (delisted) return Promise.resolve(delisted);
  pendingDelisted ??= import("virtual:delisted")
    .then((m) => (delisted = (m.default ?? m) as DelistedData))
    .catch((e) => {
      pendingDelisted = null;
      throw e;
    });
  return pendingDelisted;
}
