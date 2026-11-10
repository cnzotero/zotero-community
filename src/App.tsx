import { Suspense, useEffect, useState, type ComponentType } from "react";
import { FORUM_STATE } from "./content.ts";
import { Link } from "./link.tsx";
import { GithubIcon } from "./icons.tsx";
import { lazyRoute } from "./lazy.ts";
import { loadHistory, loadPluginData } from "./plugins/data.ts";
import { ROUTES, useRoute, type Route } from "./router.ts";
import { formatCount, useVisitBeacon, useVisitStats } from "./visits.ts";
import { applyMeta } from "./seo/head.ts";
import { pageMeta } from "./seo/pages.ts";

// 路由组件按需加载:每个页面只下载自己用到的代码。
const Home = lazyRoute(() => import("./pages/Home.tsx").then((m) => m.Home));
const PluginsList = lazyRoute(() => import("./plugins/PluginsPage.tsx").then((m) => m.PluginsList));
const PluginDetail = lazyRoute(() => import("./plugins/PluginsPage.tsx").then((m) => m.PluginDetail));
const CategoryPage = lazyRoute(() => import("./plugins/CategoryPage.tsx").then((m) => m.CategoryPage));
const CompatPage = lazyRoute(() => import("./plugins/CompatPage.tsx").then((m) => m.CompatPage));
const ChartsPage = lazyRoute(() => import("./plugins/ChartsPage.tsx").then((m) => m.ChartsPage));
const JournalsPage = lazyRoute(() => import("./journals/JournalsPage.tsx").then((m) => m.JournalsPage));
const Guides = lazyRoute(() => import("./guides/GuidesPages.tsx").then((m) => m.Guides));
const GuideArticle = lazyRoute(() => import("./guides/GuidesPages.tsx").then((m) => m.GuideArticle));
const Rules = lazyRoute(() => import("./pages/StaticPages.tsx").then((m) => m.Rules));
const About = lazyRoute(() => import("./pages/StaticPages.tsx").then((m) => m.About));
const StylesPage = lazyRoute(() => import("./pages/StylesPage.tsx").then((m) => m.StylesPage));
const Submission = lazyRoute(() => import("./pages/StaticPages.tsx").then((m) => m.Submission));

const SKINS = [
  { key: "indigo", label: "靛蓝", color: "#3451b2" },
  { key: "red", label: "洁净红", color: "#c9252f" },
] as const;

function SkinSwitch() {
  // 先按默认配色渲染(与静态页面一致),挂载后再读取已保存的选择
  const [skin, setSkin] = useState<string>("indigo");
  useEffect(() => {
    if (document.documentElement.dataset.skin === "red") setSkin("red");
  }, []);
  const pick = (k: string) => {
    setSkin(k);
    if (k === "indigo") delete document.documentElement.dataset.skin;
    else document.documentElement.dataset.skin = k;
    try { localStorage.setItem("skin", k); } catch { /* 隐私模式下忽略 */ }
  };
  return (
    <span className="skin-switch" role="group" aria-label="配色">
      <span>配色</span>
      {SKINS.map((s) => (
        <button key={s.key} className={skin === s.key ? "skin-dot on" : "skin-dot"} style={{ background: s.color }} title={s.label} aria-label={`切换为${s.label}`} aria-pressed={skin === s.key} onClick={() => pick(s.key)} />
      ))}
    </span>
  );
}

function Header({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <picture className="brand-logo" aria-hidden>
            <source media="(prefers-color-scheme: dark)" srcSet="/brand/logo-mark-dark.png" />
            <img src="/brand/logo-mark-light.png" alt="" width="32" height="32" decoding="async" />
          </picture>
          <span>Zotero 中文社区</span>
        </Link>
        <nav aria-label="主导航" className="nav">
          {ROUTES.filter((r) => !r.footer).map((r) => (
            <Link key={r.route} to={r.path} className={r.route === route || (route === "plugin" && r.route === "plugins") || (route === "guide" && r.route === "guides") ? "nav-link active" : "nav-link"}>
              {r.label}
            </Link>
          ))}
        </nav>
        <a className="icon-btn header-gh" href="https://github.com/cnzotero/zotero-community" target="_blank" rel="noopener noreferrer" title="GitHub 仓库" aria-label="GitHub 仓库(新标签打开)">
          <GithubIcon size={17} />
        </a>
      </div>
    </header>
  );
}

/** 页脚的访问量。数字来自服务器的汇总,取不到就不显示这一行(静态页面里也没有,接管后才出现)。 */
function VisitCount() {
  const stats = useVisitStats();
  if (!stats) return null;
  return (
    <div className="footer-visits">
      累计访问 {formatCount(stats.total)} 次 · 今日 {formatCount(stats.today)} 次
    </div>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = "页面不存在｜Zotero 中文社区";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "你访问的页面不存在,可以回到首页、插件广场或教程继续浏览。");
  }, []);
  return (
    <section className="section">
      <h1 className="page-title">页面不存在</h1>
      <p className="lead">你访问的地址没有对应的页面,可能是链接写错了,或者内容已经移动。</p>
      <p><Link to="/" className="btn">回到首页</Link> <Link to="/plugins" className="btn btn-ghost">插件广场</Link> <Link to="/guides" className="btn btn-ghost">教程</Link></p>
    </section>
  );
}

function Forum() {
  return (
    <section className="section">
      <h1 className="page-title">{pageMeta("/forum").h1}</h1>
      <div className="notice">{FORUM_STATE.note}</div>
    </section>
  );
}

const VIEWS: Record<Route, ComponentType & { preload?: () => Promise<void> }> = {
  home: Home,
  guides: Guides,
  plugins: PluginsList,
  plugin: PluginDetail,
  styles: StylesPage,
  forum: Forum,
  journals: JournalsPage,
  charts: ChartsPage,
  guide: GuideArticle,
  category: CategoryPage,
  compat: CompatPage,
  notfound: NotFound,
  submission: Submission,
  rules: Rules,
  about: About,
};

const NEEDS_PLUGIN_DATA = new Set<Route>(["plugins", "plugin", "category", "compat", "charts"]);

/** 预先加载某个页面需要的代码与数据(浏览器接管静态页面前调用,避免出现「加载中」)。 */
export function preloadRoute(route: Route): Promise<unknown> {
  return Promise.all([
    VIEWS[route].preload?.(),
    NEEDS_PLUGIN_DATA.has(route) ? loadPluginData() : null,
    route === "charts" ? loadHistory() : null,
  ]);
}

/** 预渲染用:一次加载全部页面组件。 */
export const preloadAllRoutes = (): Promise<unknown> => Promise.all(Object.values(VIEWS).map((v) => v.preload?.()));

export function App() {
  const route = useRoute();
  useVisitBeacon();
  useEffect(() => {
    if (route === "plugin" || route === "guide" || route === "category" || route === "compat" || route === "notfound") return; // 详情类页面自己设置标题
    applyMeta(pageMeta(ROUTES.find((r) => r.route === route)?.path ?? "/"));
  }, [route]);
  const View = VIEWS[route];
  return (
    <>
      <Header route={route} />
      <main className="container">
        <Suspense fallback={<p className="empty" role="status">正在加载…</p>}>
          <View />
        </Suspense>
      </main>
      <footer className="footer">
        <div className="container">
          <nav aria-label="页脚导航" className="footer-nav">
            {ROUTES.filter((r) => r.footer).map((r) => <Link key={r.route} to={r.path}>{r.label}</Link>)}
            <a href="https://github.com/cnzotero/zotero-community" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
          Zotero 中文社区 · 社区自发运营 · 本站与 Zotero 官方无隶属关系
          <VisitCount />
          <SkinSwitch />
        </div>
      </footer>
    </>
  );
}
