// 本站下载次数:点本站的「下载」按钮时,向本站发一个不带内容的请求,只在地址里带插件 id 和版本号;
// 服务器按请求条数汇总,写出只含数字的 /dl-stats.json,卡片与详情页显示「本站下载 N 次」。
// 不使用第三方统计,请求里不带任何访问者标识;下载本身照常直接走作者发布页的地址,不经本站中转。
// 口径:算经本站发起的下载(本站按钮,以及作者通过自己的下载入口汇总给本站的数字,见 deploy/dl_stats.py),不含从 GitHub 直接下载;从本站开始统计之日起累计。
import { useEffect, useState, type MouseEvent } from "react";

const HIT_URL = "/api/dl";
const STATS_URL = "/dl-stats.json";
/** 同一个按钮在这段时间内连点(例如双击)只记一次。 */
const DEDUP_MS = 1500;

// 与服务器汇总脚本同一套格式:不合格式的不上报,服务器那边也不计。
// 插件 id 即 GitHub 的 owner/repo(本站数据里已统一为小写)。
const ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9._-]{1,100}$/;
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/;

/** 上报地址;插件 id 或版本号格式不对时返回 null(不上报)。 */
export function dlBeaconUrl(id: string, version: string): string | null {
  if (!ID_RE.test(id) || !VERSION_RE.test(version)) return null;
  return `${HIT_URL}?p=${encodeURIComponent(id)}&v=${encodeURIComponent(version)}`;
}

type Send = (url: string) => void;

const defaultSend: Send = (url) => {
  try {
    // keepalive:点了下载后页面马上跳走或关闭,这个请求也能发完
    void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    /* 发不出去就算了,不影响下载 */
  }
};

/**
 * 记一次下载的上报器。同一插件同一版本在 DEDUP_MS 内重复触发只发一次(一次点击不会重复上报)。
 * now / send 可注入,便于测试。
 */
export function createDownloadReporter(send: Send = defaultSend, now: () => number = Date.now) {
  const last = new Map<string, number>();
  return (id: string, version: string): boolean => {
    const url = dlBeaconUrl(id, version);
    if (!url) return false;
    const t = now();
    const prev = last.get(url);
    if (prev !== undefined && t - prev < DEDUP_MS) return false;
    last.set(url, t);
    try {
      send(url);
    } catch {
      /* 上报失败不影响下载 */
    }
    return true;
  };
}

const report = createDownloadReporter();

type LinkEvent = Pick<MouseEvent<HTMLAnchorElement>, "button">;

/**
 * 下载链接上要挂的事件:左键点击(含 Ctrl/⌘/Shift 点击在新标签或新窗口打开)走 onClick,
 * 中键点击走 onAuxClick。只上报,不阻止默认行为,下载地址不变。
 * 右键菜单里选「在新标签页打开 / 链接另存为」浏览器不会通知页面,无法区分是否真的下载,不计入(宁少勿多)。
 */
export function downloadLinkHandlers(id: string, version: string, rep: (id: string, v: string) => boolean = report) {
  return {
    onClick: (e: LinkEvent) => {
      if (e.button === 0) rep(id, version);
    },
    onAuxClick: (e: LinkEvent) => {
      if (e.button === 1) rep(id, version);
    },
  };
}

export interface SiteDownloadStats {
  total: number;
  today: number;
  plugins: Record<string, { total: number; today: number }>;
}

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** 服务器给的内容不可信任其形状:整体不对就当作没有;单个插件条目不对就跳过这一条。 */
export function parseDlStats(raw: unknown): SiteDownloadStats | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { total, today, plugins } = raw as Record<string, unknown>;
  if (!isCount(total) || !isCount(today) || !plugins || typeof plugins !== "object" || Array.isArray(plugins)) return null;
  const out: SiteDownloadStats["plugins"] = {};
  for (const [id, v] of Object.entries(plugins as Record<string, unknown>)) {
    if (!ID_RE.test(id) || !v || typeof v !== "object") continue;
    const { total: t, today: d } = v as Record<string, unknown>;
    if (isCount(t) && isCount(d)) out[id] = { total: t, today: d };
  }
  return { total, today, plugins: out };
}

/**
 * 某个插件的本站下载次数;没有数据或为 0 时返回 null(页面上不显示这一项)。
 * 页面读到的实时汇总里有这个插件时以它为准(比每日刷新写进插件数据的数更新);没有时用 fallback(插件数据里的 siteDl.total)。
 */
export function siteDownloadsOf(stats: SiteDownloadStats | null, id: string, fallback = 0): number | null {
  const n = stats && Object.hasOwn(stats.plugins, id) ? stats.plugins[id].total : fallback;
  return n && n > 0 ? n : null;
}

// 一个页面上有很多卡片,只取一次。
let pending: Promise<SiteDownloadStats | null> | null = null;
function loadDlStats(): Promise<SiteDownloadStats | null> {
  pending ??= fetch(STATS_URL)
    .then((r) => (r.ok ? r.json() : null))
    .then(parseDlStats)
    .catch(() => null);
  return pending;
}

/**
 * 本站下载次数汇总;取不到(本地预览、服务器还没生成)返回 null,页面不显示这一项。
 * 只在浏览器里挂载后读取:预渲染的静态页面里没有这些数字,接管后才出现。
 */
export function useSiteDownloads(): SiteDownloadStats | null {
  const [stats, setStats] = useState<SiteDownloadStats | null>(null);
  useEffect(() => {
    let alive = true;
    loadDlStats().then((s) => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, []);
  return stats;
}
