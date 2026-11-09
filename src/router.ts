import { useEffect, useState } from "react";

export type Route = "home" | "guides" | "plugins" | "plugin" | "journals" | "submission" | "styles" | "forum" | "rules" | "about" | "charts" | "guide";

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

export function routeFromPath(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (/^\/plugins\/[^/]+\/[^/]+$/.test(clean)) return "plugin";
  if (/^\/guides\/[^/]+$/.test(clean)) return "guide";
  return ROUTES.find((r) => r.path === clean)?.route ?? "home";
}

export function navigate(path: string): void {
  if (location.pathname + location.search === path) return;
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromPath(location.pathname));
  useEffect(() => {
    const on = () => setRoute(routeFromPath(location.pathname));
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return route;
}
