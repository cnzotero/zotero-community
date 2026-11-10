import { useEffect, useState } from "react";
import { currentPath } from "./ssr.ts";

const CATEGORY_SET = new Set(["ai", "reading", "metadata", "interface", "attachment", "integration", "notes", "utility", "writing", "visualization"]);

export type Route = "home" | "guides" | "plugins" | "plugin" | "official" | "journals" | "submission" | "styles" | "forum" | "rules" | "about" | "charts" | "guide" | "category" | "compat" | "delisted" | "notfound";

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
  // 站内没有的路径一律是 404;服务器对这些路径也返回真正的 404 状态码
  return [...ROUTES, ...UNLISTED_ROUTES].find((r) => r.path === clean)?.route ?? "notfound";
}

export function navigate(path: string): void {
  if (location.pathname + location.search === path) return;
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
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
