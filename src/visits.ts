// 访问量:页面每被打开一次(含站内切换页面),向本站发一个不带任何内容的请求;
// 服务器按请求条数汇总成「累计 / 今日」两个数字,显示在页脚。
// 不使用第三方统计,请求里不带页面地址、不带任何标识。
import { useEffect, useState } from "react";

const HIT_URL = "/api/visit";
const STATS_URL = "/stats.json";

export interface VisitStats {
  total: number;
  today: number;
}

/** 服务器给的数字不可信任其形状:不是非负整数就当作没有。 */
export function parseVisitStats(raw: unknown): VisitStats | null {
  if (!raw || typeof raw !== "object") return null;
  const { total, today } = raw as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
  return ok(total) && ok(today) ? { total, today } : null;
}

export function formatCount(n: number): string {
  return n.toLocaleString("zh-CN");
}

function hit(): void {
  try {
    // keepalive:即使马上离开页面,这个请求也能发完
    void fetch(HIT_URL, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    /* 发不出去就算了,不影响页面 */
  }
}

/** 首次打开记一次;站内切换到另一个页面再记一次(同一页面内改筛选参数不重复记)。 */
export function useVisitBeacon(): void {
  useEffect(() => {
    let last = location.pathname;
    hit();
    const on = () => {
      if (location.pathname === last) return;
      last = location.pathname;
      hit();
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
}

/** 页脚用的汇总数字;取不到(本地预览、服务器还没生成)就返回 null,页脚不显示这一行。 */
export function useVisitStats(): VisitStats | null {
  const [stats, setStats] = useState<VisitStats | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(STATS_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => { if (alive) setStats(parseVisitStats(raw)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return stats;
}
