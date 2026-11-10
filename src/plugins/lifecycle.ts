// 插件「在架 / 下架」的判断。纯函数:不读写文件,也不自己取当前时间(由调用方传入构建日期)。
// 规则对所有插件一视同仁:只看发布记录、安装包与适配声明这些公开数据,
// 判断里没有任何按插件 id、作者或名称区分的分支(有测试扫描本文件守住这一点)。
// 每次构建都重新计算:作者发布新版本、数据刷新后满足条件,就自动重新上架。
import { daysSince, declaredMajors, isAllowedXpiUrl, type Plugin } from "./lib.ts";

/**
 * 当前 Zotero 最新大版本。
 * 默认 null:取数据集中所有插件声明过的最大大版本(见 currentZoteroMajor)。
 * 只有自动取值明显不对时(例如数据里出现了尚未正式发布的大版本),才在这里写一个具体数字。
 */
export const ZOTERO_CURRENT_MAJOR: number | null = null;

/** 超过这么多天没有发布就下架(2 年)。 */
export const STALE_DAYS = 730;
/** 超过这么多天没有发布(1 年),且没有可下载的安装包、或适配声明没跟上当前 Zotero,就下架。 */
export const UNADAPTED_DAYS = 365;

export type DelistReason = "stale-1y-no-package" | "stale-2y" | "stale-1y-unadapted";

/** 下架原因的简短名称(与收录规则第 3 章的措辞一致)。 */
export const DELIST_REASONS: Record<DelistReason, string> = {
  "stale-1y-no-package": "超过 1 年未发布,且没有可下载的安装包",
  "stale-2y": "最近一次发布超过 2 年",
  "stale-1y-unadapted": "超过 1 年未发布,且未声明适配当前 Zotero 版本",
};

export interface DelistFacts {
  /** 最近一次发布日期 YYYY-MM-DD;没有发布记录为 null */
  lastRelease: string | null;
  /** 最近一次发布距构建日期的天数 */
  days: number | null;
  /** 作者声明适配的最高 Zotero 大版本;未声明或声明里没有版本为 null */
  declaredMax: number | null;
  /** 判断时采用的当前 Zotero 最新大版本 */
  currentMajor: number | null;
  /** 仓库已归档(只作事实附注,本身不是下架理由) */
  archived: boolean;
}

export type Verdict =
  | { listed: true }
  | { listed: false; reason: DelistReason; reasonText: string; facts: DelistFacts };

export interface DelistedPlugin {
  plugin: Plugin;
  reason: DelistReason;
  reasonText: string;
  facts: DelistFacts;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 当前 Zotero 最新大版本:优先用 ZOTERO_CURRENT_MAJOR,否则取数据集中声明过的最大大版本;都没有返回 null。 */
export function currentZoteroMajor(plugins: Plugin[]): number | null {
  if (ZOTERO_CURRENT_MAJOR !== null) return ZOTERO_CURRENT_MAJOR;
  const majors = declaredMajors(plugins);
  return majors.length ? majors[majors.length - 1] : null;
}

/** 最近一次发布日期:最新版本的发布日期与发布记录里最近一次正式发布,取较晚的一个;都没有返回 null。 */
export function lastReleaseDate(p: Plugin): string | null {
  const dates = [p.latest?.date, p.cadence?.last].filter((d): d is string => typeof d === "string" && DATE.test(d));
  dates.sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** 有可安装的发布:有最新版本,且至少有一个 github.com / gitee.com 上的 .xpi 安装包地址。 */
export function hasInstallableRelease(p: Plugin): boolean {
  return !!p.latest && (p.downloads ?? []).some((d) => typeof d?.u === "string" && isAllowedXpiUrl(d.u));
}

/** 作者声明适配的最高 Zotero 大版本;未声明、或声明了但没有版本,返回 null。 */
export function declaredMaxMajor(p: Plugin): number | null {
  if (!p.zotero?.declared || p.zotero.majors.length === 0) return null;
  return Math.max(...p.zotero.majors);
}

/**
 * 判断一个插件是否在架。now 是构建日期;currentMajor 是当前 Zotero 最新大版本(由 currentZoteroMajor 算出)。
 * 依次检查:1 超过 1 年未发布(或没有任何发布记录)且没有可安装的发布 → 2 超过 2 年未发布
 * → 3 超过 1 年未发布且适配声明没跟上当前版本。
 * 近 1 年内有发布的插件,即使数据里缺最新版本或安装包地址也不下架(数据可能还没跟上作者的新发布)。
 * 有安装包但发布日期缺失或无法解析时,规则 2、3 无从判断,不推断、不下架。
 */
export function evaluatePlugin(p: Plugin, now: Date, currentMajor: number | null): Verdict {
  const lastRelease = lastReleaseDate(p);
  const days = lastRelease ? daysSince(lastRelease, now) : null;
  const declaredMax = declaredMaxMajor(p);
  const facts: DelistFacts = { lastRelease, days, declaredMax, currentMajor, archived: p.archived === true };
  const off = (reason: DelistReason, reasonText: string): Verdict => ({ listed: false, reason, reasonText, facts });

  if (!hasInstallableRelease(p) && (days === null || days > UNADAPTED_DAYS)) {
    return off("stale-1y-no-package", lastRelease ? `最近一次发布于 ${lastRelease},距今超过 1 年,且本站没有找到可下载的 .xpi 安装包` : "没有发布记录,本站也没有找到可下载的 .xpi 安装包");
  }
  if (lastRelease === null || days === null) return { listed: true };
  if (days > STALE_DAYS) return off("stale-2y", `最近一次发布于 ${lastRelease},距今超过 2 年`);
  if (days > UNADAPTED_DAYS) {
    if (declaredMax === null) return off("stale-1y-unadapted", `最近一次发布于 ${lastRelease},距今超过 1 年,且没有声明适配的 Zotero 版本`);
    if (currentMajor !== null && declaredMax < currentMajor) {
      return off("stale-1y-unadapted", `最近一次发布于 ${lastRelease},距今超过 1 年;声明适配的最高版本是 Zotero ${declaredMax},不含当前的 Zotero ${currentMajor}`);
    }
  }
  return { listed: true };
}

/** 把全部插件分成在架与下架两组(各自保持原顺序)。当前 Zotero 大版本按全部插件(含下架的)算出。 */
export function splitCatalog(plugins: Plugin[], now: Date): { listed: Plugin[]; delisted: DelistedPlugin[]; currentMajor: number | null } {
  const currentMajor = currentZoteroMajor(plugins);
  const listed: Plugin[] = [];
  const delisted: DelistedPlugin[] = [];
  for (const p of plugins) {
    const v = evaluatePlugin(p, now, currentMajor);
    if (v.listed) listed.push(p);
    else delisted.push({ plugin: p, reason: v.reason, reasonText: v.reasonText, facts: v.facts });
  }
  return { listed, delisted, currentMajor };
}
