import { useEffect, useState } from "react";
import { TOPIC_KEYS } from "./plugins/topics.ts";
import { currentPath } from "./ssr.ts";
import { prefetch, waitUpTo } from "./prefetch.ts";

const CATEGORY_SET = new Set(["ai", "reading", "metadata", "interface", "attachment", "integration", "notes", "utility", "writing", "visualization"]);

export type Route = "home" | "guides" | "plugins" | "plugin" | "official" | "journals" | "submission" | "styles" | "forum" | "rules" | "openData" | "about" | "charts" | "guide" | "category" | "compat" | "topic" | "delisted" | "notfound";

export const ROUTES: { route: Route; path: string; label: string; footer?: boolean }[] = [
  { route: "home", path: "/", label: "首页" },
  { route: "guides", path: "/guides", label: "教程" },
  { route: "plugins", path: "/plugins", label: "插件广场" },
  { route: "journals", path: "/journals", label: "期刊查询" },
  { route: "submission", path: "/submission", label: "投稿建议" },
  { route: "styles", path: "/styles", label: "引用样式" },
  { route: "forum", path: "/forum", label: "问答讨论" },
  { route: "charts", path: "/plugins/charts", label: "数据看板", footer: true },
  { route: "rules", path: "/rules", label: "收录规则", footer: true },
  { route: "openData", path: "/open-data", label: "开放数据", footer: true },
  { route: "about", path: "/about", label: "关于本站", footer: true },
];

/** 不出现在页头与页脚导航里的页面(由其它页面链接进入)。 */
export const UNLISTED_ROUTES: { route: Route; path: string }[] = [
  { route: "delisted", path: "/delisted" },
  { route: "official", path: "/plugin" },
];

/** 栏目页的路径(用来取页面标题等元信息);详情类页面返回 null。 */
export const routePath = (route: Route): string | null => [...ROUTES, ...UNLISTED_ROUTES].find((r) => r.route === route)?.path ?? null;

export function routeFromPath(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (/^\/plugins\/[^/]+\/[^/]+$/.test(clean)) return "plugin";
  if (/^\/guides\/[^/]+$/.test(clean)) return "guide";
  const cat = /^\/categories\/([a-z]+)$/.exec(clean);
  if (cat) return CATEGORY_SET.has(cat[1]) ? "category" : "notfound";
  if (/^\/compat\/zotero-\d+$/.test(clean)) return "compat";
  const topic = /^\/topics\/([a-z0-9-]+)$/.exec(clean);
  if (topic) return TOPIC_KEYS.includes(topic[1]) ? "topic" : "notfound";
  // 站内没有的路径一律是 404;服务器对这些路径也返回真正的 404 状态码
  return [...ROUTES, ...UNLISTED_ROUTES].find((r) => r.path === clean)?.route ?? "notfound";
}

/** 预取目标路径对应页面的代码与数据;已就绪返回 null。 */
export function prefetchPath(path: string): Promise<void> | null {
  return prefetch(routeFromPath(path.split(/[?#]/)[0]));
}

const NAVIGATING = "is-navigating";
const NAV_WAIT_MS = 5000;
let navSeq = 0;

/**
 * 站内跳转。目标页面还没下载好时,先留在当前页面(页面顶部出现进度条),下载完成或最多等 5 秒再切换,
 * 避免整页换成「正在加载」的空白;已经就绪(悬停预取、空闲预取、之前访问过)就立刻切换。
 */
export function navigate(path: string): void {
  if (location.pathname + location.search === path) return;
  const seq = ++navSeq;
  const root = document.documentElement;
  root.classList.remove(NAVIGATING);
  const go = () => {
    if (location.pathname + location.search === path) return;
    history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  };
  const wait = prefetchPath(path);
  if (!wait) return go();
  root.classList.add(NAVIGATING);
  void waitUpTo(wait, NAV_WAIT_MS).then(() => {
    if (seq !== navSeq) return; // 期间又点了别的链接,以最后一次为准
    root.classList.remove(NAVIGATING);
    go();
  });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromPath(currentPath()));
  useEffect(() => {
    const on = () => setRoute(routeFromPath(location.pathname));
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return route;
}
