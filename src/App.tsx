import { useEffect, useMemo, useState } from "react";
import {
  FORUM_STATE,
  GUIDES,
  PLUGINS,
  PLUGIN_CATEGORIES,
  type GuideEntry,
  type PluginCategory,
} from "./content.ts";
import { Link } from "./link.tsx";
import { GithubIcon } from "./icons.tsx";
import { PluginDetail, PluginsList } from "./plugins/PluginsPage.tsx";
import { ChartsPage } from "./plugins/ChartsPage.tsx";
import { JournalsPage } from "./journals/JournalsPage.tsx";
import { About, Rules, Submission } from "./pages/StaticPages.tsx";
import { ROUTES, useRoute, type Route } from "./router.ts";
import { STATIC_PAGES } from "./seo/pages.ts";
import { filterGuides, filterPlugins, searchAll } from "./search.ts";

const SKINS = [
  { key: "red", label: "洁净红", color: "#c9252f" },
  { key: "indigo", label: "靛蓝", color: "#3451b2" },
] as const;

function SkinSwitch() {
  const [skin, setSkin] = useState<string>(() => document.documentElement.dataset.skin || "red");
  const pick = (k: string) => {
    setSkin(k);
    if (k === "red") delete document.documentElement.dataset.skin;
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
          <span className="brand-mark" aria-hidden>中</span>
          <span>Zotero 中文社区</span>
        </Link>
        <nav aria-label="主导航" className="nav">
          {ROUTES.filter((r) => !r.footer).map((r) => (
            <Link key={r.route} to={r.path} className={r.route === route || (route === "plugin" && r.route === "plugins") ? "nav-link active" : "nav-link"}>
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

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      className="search"
      type="search"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function GuideCard({ g }: { g: GuideEntry }) {
  return (
    <a className="card" href={g.href} target="_blank" rel="noopener noreferrer">
      <div className="card-tags">
        <span className="tag">{g.topic}</span>
        <span className="tag tag-soft">{g.level}</span>
      </div>
      <h3>{g.title}</h3>
      <p>{g.summary}</p>
    </a>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

function Home() {
  const [q, setQ] = useState("");
  const result = useMemo(() => searchAll(PLUGINS, GUIDES, q), [q]);
  const searching = q.trim().length > 0;
  return (
    <>
      <section className="hero">
        <h1>把 Zotero 用顺手</h1>
        <p>教程、插件、引用样式和经验交流,给每一位用 Zotero 做研究的人。</p>
        <SearchBox value={q} onChange={setQ} placeholder="搜索教程或插件,例如:翻译、Word、标签" />
      </section>
      {searching ? (
        <section className="section">
          <h2>搜索结果</h2>
          {result.guides.length + result.plugins.length === 0 && <Empty text="没有找到相关内容,换个词试试。" />}
          {result.guides.length > 0 && (
            <div className="grid">{result.guides.map((g) => <GuideCard key={g.id} g={g} />)}</div>
          )}
          {result.plugins.length > 0 && (
            <div className="grid">
              {result.plugins.map((p) => (
                <a key={p.id} className="card" href={p.homepage} target="_blank" rel="noopener noreferrer">
                  <div className="card-tags"><span className="tag">{PLUGIN_CATEGORIES[p.category]}</span></div>
                  <h3>{p.name}</h3>
                  <p>{p.summary}</p>
                </a>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <h2>新手入门</h2>
              <Link to="/guides" className="more">全部教程</Link>
            </div>
            <div className="grid">{GUIDES.slice(0, 3).map((g) => <GuideCard key={g.id} g={g} />)}</div>
          </section>
          <section className="section">
            <div className="section-head">
              <h2>插件广场</h2>
              <Link to="/plugins" className="more">查看全部</Link>
            </div>
            <div className="grid">
              {PLUGINS.slice(0, 3).map((p) => (
                <a key={p.id} className="card" href={p.homepage} target="_blank" rel="noopener noreferrer">
                  <div className="card-tags"><span className="tag">{PLUGIN_CATEGORIES[p.category]}</span></div>
                  <h3>{p.name}</h3>
                  <p>{p.summary}</p>
                </a>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Guides() {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<GuideEntry["topic"] | "all">("all");
  const topics = useMemo(() => Array.from(new Set(GUIDES.map((g) => g.topic))), []);
  const list = filterGuides(GUIDES, { query: q, topic });
  return (
    <section className="section">
      <h1 className="page-title">教程</h1>
      <SearchBox value={q} onChange={setQ} placeholder="搜索教程" />
      <div className="chips" role="group" aria-label="主题">
        <button className={topic === "all" ? "chip on" : "chip"} onClick={() => setTopic("all")}>全部</button>
        {topics.map((t) => (
          <button key={t} className={topic === t ? "chip on" : "chip"} onClick={() => setTopic(t)}>{t}</button>
        ))}
      </div>
      {list.length === 0 ? <Empty text="没有符合条件的教程。" /> : <div className="grid">{list.map((g) => <GuideCard key={g.id} g={g} />)}</div>}
    </section>
  );
}

function Styles() {
  return (
    <section className="section">
      <h1 className="page-title">引用样式</h1>
      <p className="lead">常用期刊与学位论文的引用格式整理。</p>
      <div className="notice">样式库正在整理中,会按学科与期刊分类上线,届时可直接下载使用。</div>
    </section>
  );
}

function Forum() {
  return (
    <section className="section">
      <h1 className="page-title">问答讨论</h1>
      <div className="notice">{FORUM_STATE.note}</div>
    </section>
  );
}

export function App() {
  const route = useRoute();
  useEffect(() => {
    if (route === "plugin") return; // 插件详情页自己设置标题
    const path = ROUTES.find((r) => r.route === route)?.path ?? "/";
    const meta = STATIC_PAGES.find((m) => m.path === path);
    document.title = meta?.title ?? "Zotero 中文社区";
    const desc = document.querySelector('meta[name="description"]');
    if (desc && meta) desc.setAttribute("content", meta.description);
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute("href", `https://zoterocn.org${path === "/" ? "/" : path}`);
  }, [route]);
  return (
    <>
      <Header route={route} />
      <main className="container">
        {route === "home" && <Home />}
        {route === "guides" && <Guides />}
        {route === "plugins" && <PluginsList />}
        {route === "plugin" && <PluginDetail />}
        {route === "styles" && <Styles />}
        {route === "forum" && <Forum />}
        {route === "journals" && <JournalsPage />}
        {route === "charts" && <ChartsPage />}
        {route === "submission" && <Submission />}
        {route === "rules" && <Rules />}
        {route === "about" && <About />}
      </main>
      <footer className="footer">
        <div className="container">
          <nav aria-label="页脚导航" className="footer-nav">
            {ROUTES.filter((r) => r.footer).map((r) => <Link key={r.route} to={r.path}>{r.label}</Link>)}
            <a href="https://github.com/cnzotero/zotero-community" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
          Zotero 中文社区 · 社区自发运营 · 本站与 Zotero 官方无隶属关系
          <SkinSwitch />
        </div>
      </footer>
    </>
  );
}
