import { useEffect, useState } from "react";

export type Route = "home" | "guides" | "plugins" | "plugin" | "styles" | "forum";

export const ROUTES: { route: Route; path: string; label: string }[] = [
  { route: "home", path: "/", label: "首页" },
  { route: "guides", path: "/guides", label: "教程" },
  { route: "plugins", path: "/plugins", label: "插件广场" },
  { route: "styles", path: "/styles", label: "引用样式" },
  { route: "forum", path: "/forum", label: "问答讨论" },
];

export function routeFromPath(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (/^\/plugins\/[^/]+\/[^/]+$/.test(clean)) return "plugin";
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
