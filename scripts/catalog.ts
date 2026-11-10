// 构建期插件数据的唯一入口:读取插件数据,按构建日期分出「在架」与「下架」。
// Vite(浏览器用的数据模块、首页榜单、版本目录)与预渲染脚本都只从这里取数据,
// 所以全站(页面、sitemap、llms.txt、计数文案、搜索)看到的都是同一份在架名单,不在各页面各自过滤。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "../src/plugins/lib.ts";
import { splitCatalog, type DelistedPlugin } from "../src/plugins/lifecycle.ts";
import { delistedRecords, updateDelistedLedger, type DelistedData, type DelistedLedger } from "../src/plugins/delisted.ts";

export const PLUGINS_FILE = fileURLToPath(new URL("../src/data/plugins.json", import.meta.url));
/** 下架台账:记录每个下架插件从哪天起下架;由预渲染脚本更新,与数据一起提交回仓库。 */
export const DELISTED_FILE = fileURLToPath(new URL("../src/data/delisted.json", import.meta.url));

/**
 * 构建日期(YYYY-MM-DD,UTC)。预渲染脚本会把它写进这个环境变量,
 * 让同一次构建里的各个环节(浏览器数据模块、服务端渲染包、预渲染)用同一天判断在架与否。
 */
export const BUILD_DATE_ENV = "CNZOTERO_BUILD_DATE";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function buildDay(env: Record<string, string | undefined> = process.env): string {
  const v = env[BUILD_DATE_ENV];
  return v && DAY_RE.test(v) ? v : new Date().toISOString().slice(0, 10);
}

/** 写进 index.html 的构建日期标记:浏览器数据模块按哪一天算的,预渲染就按哪一天算。 */
export const BUILD_DATE_META = "cnzotero-build-date";
export function readBuildDateMeta(html: string): string | null {
  const m = new RegExp(`<meta name="${BUILD_DATE_META}" content="(\\d{4}-\\d{2}-\\d{2})"\\s*/?>`).exec(html);
  return m ? m[1] : null;
}
export const stripBuildDateMeta = (html: string): string => html.replace(new RegExp(`\\s*<meta name="${BUILD_DATE_META}"[^>]*>`, "g"), "");

export interface Catalog {
  day: string;
  generatedAt: string;
  /** 全部插件数(在架 + 下架) */
  total: number;
  listed: Plugin[];
  delisted: DelistedPlugin[];
  currentMajor: number | null;
  /** 按本次判断更新后的下架台账(调用方决定是否写回文件) */
  ledger: DelistedLedger;
  /** /delisted 页面用的数据 */
  delistedData: DelistedData;
}

/** 由插件数据与旧的下架台账算出某一天的在架名单与下架记录。纯函数,便于测试。 */
export function catalogOf(data: { generatedAt: string; plugins: Plugin[] }, day: string, oldLedger: DelistedLedger = {}): Catalog {
  const { listed, delisted, currentMajor } = splitCatalog(data.plugins, new Date(day));
  const ledger = updateDelistedLedger(oldLedger, delisted, day);
  const delistedData = { listed: listed.length, current: currentMajor, records: delistedRecords(delisted, ledger, day) };
  return { day, generatedAt: data.generatedAt, total: data.plugins.length, listed, delisted, currentMajor, ledger, delistedData };
}

export function readDelistedLedger(file: string = DELISTED_FILE): DelistedLedger {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function loadCatalog(day: string = buildDay(), file: string = PLUGINS_FILE, ledgerFile: string = DELISTED_FILE): Catalog {
  return catalogOf(JSON.parse(readFileSync(file, "utf8")), day, readDelistedLedger(ledgerFile));
}
