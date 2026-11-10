// 插件数据的加载与缓存。浏览器里按需加载(数据较大,只有用到的页面才加载);
// 预渲染时由入口直接注入,保证静态页面与前端接管时用的是同一份数据。
import type { History } from "./charts-lib.ts";
import { homeBoards, type HomeBoards, type Plugin } from "./lib.ts";

export interface PluginData {
  generatedAt: string;
  plugins: Plugin[];
}

let plugins: PluginData | null = null;
let history: History | null = null;
let boards: HomeBoards | null = null;
let pending: Promise<PluginData> | null = null;
let pendingHistory: Promise<History> | null = null;

/** 预渲染入口调用:注入构建时的数据。 */
export function setServerData(d: { generatedAt: string; plugins: Plugin[]; history: History }): void {
  plugins = { generatedAt: d.generatedAt, plugins: d.plugins };
  history = d.history;
  boards = homeBoards(d.plugins);
}

export const cachedPluginData = (): PluginData | null => plugins;
export const cachedHistory = (): History | null => history;
/** 预渲染时由注入数据算出的首页榜单;浏览器里为 null,改用构建期产出的小份数据。 */
export const serverHomeBoards = (): HomeBoards | null => boards;

export function loadPluginData(): Promise<PluginData> {
  if (plugins) return Promise.resolve(plugins);
  pending ??= import("../data/plugins.json")
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
