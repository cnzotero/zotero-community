import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App, preloadRoute } from "./App.tsx";
import { prefetch, shouldIdlePrefetch } from "./prefetch.ts";
import { routeFromPath } from "./router.ts";
import { captureEarlyInputs } from "./ssr.ts";
import "./styles.css";

const el = document.getElementById("root")!;
const path = location.pathname.replace(/\/+$/, "") || "/";
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// 先加载当前页面的代码与数据,再接管预渲染好的静态页面,接管前后内容完全一致、不闪「加载中」。
// 只有地址正是预渲染的那一页(且没有查询参数)时才接管;其余情况(如 404 页、带筛选参数)整页重新渲染。
preloadRoute(routeFromPath(path))
  .catch(() => {})
  .finally(() => {
    captureEarlyInputs(el);
    if (el.dataset.ssr === path && !location.search) hydrateRoot(el, app);
    else createRoot(el).render(app);
  });

// 接管后浏览器空闲时,把最常点的几个页面的代码与数据先下载好(数据节省模式与 2G 网络不做)
const warmUp = async () => {
  for (const key of ["plugins", "guides", "journals", "rules"]) await prefetch(key);
};
const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
if (shouldIdlePrefetch(conn)) {
  const idle: (cb: () => void) => void = "requestIdleCallback" in window ? (cb) => window.requestIdleCallback(cb, { timeout: 4000 }) : (cb) => setTimeout(cb, 2500);
  window.addEventListener("load", () => idle(() => { void warmUp(); }), { once: true });
}
