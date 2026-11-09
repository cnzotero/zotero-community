import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import {
  CATEGORIES, DEFAULT_FILTERS, ZOTERO_VERSIONS as ZV, cardTags, downloadFilename, downloadHost, isAllowedXpiUrl, pickDownload, ZOTERO_VERSIONS, applyFilters, compatSummary, computeStats, formatStars, freshness,
  parseFilters, pluginIdFromPath, pluginPath, relatedPlugins, relativeTime, serializeFilters,
  type CategoryKey, type Filters, type Plugin, type SortKey, type UpdatedWithin,
} from "./lib.ts";

interface PluginData {
  generatedAt: string;
  plugins: Plugin[];
}

const PAGE = 24;
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<CategoryKey, string>;

type Loaded = { state: "loading" } | { state: "error" } | { state: "ready"; data: PluginData };

/** 插件数据较大,只在进入插件广场时才加载。 */
function usePluginData(): Loaded & { retry: () => void } {
  const [s, setS] = useState<Loaded>({ state: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setS({ state: "loading" });
    import("../data/plugins.json")
      .then((m) => alive && setS({ state: "ready", data: (m.default ?? m) as unknown as PluginData }))
      .catch(() => alive && setS({ state: "error" }));
    return () => {
      alive = false;
    };
  }, [tick]);
  return { ...s, retry: () => setTick((t) => t + 1) };
}

function usePopstateKey(): string {
  const [k, setK] = useState(() => location.pathname + location.search);
  useEffect(() => {
    const on = () => setK(location.pathname + location.search);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return k;
}

const IMG = "/images/plugins/";

/** 图片还没上线或加载失败时整体隐藏,不留破图。 */
function SafeImg({ src, className, alt = "" }: { src: string; className?: string; alt?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img src={src} className={className} alt={alt} loading="lazy" decoding="async" onError={() => setOk(false)} />;
}

function EmptyArt() {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <picture className="empty-art" aria-hidden>
      <source media="(prefers-color-scheme: dark)" srcSet={`${IMG}empty-dark.png`} />
      <img src={`${IMG}empty-light.png`} alt="" decoding="async" onError={() => setOk(false)} />
    </picture>
  );
}

function Avatar({ name, art = false }: { name: string; art?: boolean }) {
  const ch = (name.match(/[A-Za-z0-9\u4e00-\u9fa5]/)?.[0] ?? "插").toUpperCase();
  const [ok, setOk] = useState(true);
  // 详情页大头像:用默认图标底 + 首字母角标;图缺失时退回纯字母方块
  if (art && ok) {
    return (
      <span className="avatar avatar-art" aria-hidden>
        <img src={`${IMG}plugin-default.png`} alt="" onError={() => setOk(false)} />
        <b>{ch}</b>
      </span>
    );
  }
  return <span className="avatar" aria-hidden>{ch}</span>;
}

function CompatBadge({ p }: { p: Plugin }) {
  const c = compatSummary(p);
  return <span className={`compat compat-${c.kind}`}>{c.text}</span>;
}

function CardTags({ p, now }: { p: Plugin; now: Date }) {
  return (
    <div className="plugin-badges" aria-label="标签">
      {cardTags(p, now).map((t) => (
        <span key={t.slot} className={`ptag ptag-${t.slot} ptag-${t.slot}-${t.kind}`}>{t.text}</span>
      ))}
    </div>
  );
}

function PluginCard({ p, now }: { p: Plugin; now: Date }) {
  return (
    <Link to={pluginPath(p.id)} className="card plugin-card">
      <div className="plugin-head">
        <Avatar name={p.name} />
        <div className="plugin-title">
          <h3>{p.name}</h3>
          <span className="meta">{p.author} · {CATEGORY_LABEL[p.category]}</span>
        </div>
      </div>
      <p className="clamp2">{p.summary}</p>
      <div className="plugin-foot">
        <span title="GitHub 星标">★ {formatStars(p.stars)}</span>
        <span title={p.updated || undefined}>
          {p.latest ? `v${p.latest.version} · ` : ""}{relativeTime(p.updated, now)}
        </span>
      </div>
      <CardTags p={p} now={now} />
    </Link>
  );
}

function Filters_({ f, set, openMobile }: { f: Filters; set: (n: Partial<Filters>) => void; openMobile: boolean }) {
  return (
    <div className={openMobile ? "filters open" : "filters"}>
      <div className="chips" role="group" aria-label="分类">
        <button className={f.category === "all" ? "chip on" : "chip"} onClick={() => set({ category: "all" })}>全部</button>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={f.category === c.key ? "chip on" : "chip"} onClick={() => set({ category: c.key })}>
            <SafeImg src={`${IMG}cat-${c.key}.png`} className="chip-icon" />
            {c.label}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <div className="filter-group" role="group" aria-label="Zotero 版本">
          <span className="filter-label">Zotero 版本</span>
          {ZOTERO_VERSIONS.map((v) => (
            <button
              key={v}
              className={f.zotero === v ? "chip chip-sm on" : "chip chip-sm"}
              aria-pressed={f.zotero === v}
              onClick={() => set({ zotero: f.zotero === v ? null : v })}
            >
              {v}
            </button>
          ))}
        </div>
        <label className="filter-group">
          <span className="filter-label">更新时间</span>
          <select className="select" value={f.within} onChange={(e) => set({ within: e.target.value as UpdatedWithin })}>
            <option value="any">不限</option>
            <option value="30">30 天内</option>
            <option value="365">1 年内</option>
          </select>
        </label>
        <label className="filter-group">
          <span className="filter-label">排序</span>
          <select className="select" value={f.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
            <option value="stars">热度</option>
            <option value="updated">最近更新</option>
            <option value="name">名称</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function DataNote() {
  return <p className="data-note">数据整理自各项目公开信息,收录不代表对其安全性或质量的背书。</p>;
}

export function PluginsList() {
  const loaded = usePluginData();
  const key = usePopstateKey();
  const [f, setF] = useState<Filters>(() => parseFilters(location.search));
  const [shown, setShown] = useState(PAGE);
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = useMemo(() => new Date(), []);

  // 浏览器前进/后退时,按网址重新读取筛选条件
  useEffect(() => {
    if (location.pathname === "/plugins") setF(parseFilters(location.search));
  }, [key]);

  const set = useCallback((n: Partial<Filters>) => {
    setF((prev) => {
      const next = { ...prev, ...n };
      history.replaceState(null, "", "/plugins" + serializeFilters(next));
      return next;
    });
    setShown(PAGE);
  }, []);

  const all = loaded.state === "ready" ? loaded.data.plugins : [];
  const stats = useMemo(() => computeStats(all, now), [all, now]);
  const list = useMemo(() => applyFilters(all, f, now), [all, f, now]);
  const active = f.category !== "all" || f.zotero !== null || f.within !== "any" || f.query.trim() !== "";

  return (
    <section className="section">
      <PageHero kind="hero" title="插件广场" lead="收录常用的 Zotero 插件,按公开数据整理,点击查看详情。">
        <Link to="/rules" className="inline-link hero-link">收录规则</Link>
      </PageHero>
      <input
        className="search"
        type="search"
        value={f.query}
        placeholder="搜索插件名称、作者或用途"
        aria-label="搜索插件名称、作者或用途"
        onChange={(e) => set({ query: e.target.value })}
      />
      {loaded.state === "ready" && (
        <p className="stats" aria-live="polite">
          收录 <b>{stats.total}</b> 款 · 近 30 天有更新 <b>{stats.updated30}</b> 款 · 适配 Zotero 10 的 <b>{stats.zotero10}</b> 款
          <span className="stats-date">数据更新于 {loaded.data.generatedAt}</span>
        </p>
      )}
      <button className="chip filter-toggle" aria-expanded={mobileOpen} onClick={() => setMobileOpen((o) => !o)}>
        {mobileOpen ? "收起筛选" : "筛选与排序"}
      </button>
      <Filters_ f={f} set={set} openMobile={mobileOpen} />

      {loaded.state === "loading" && <p className="empty" role="status">正在加载插件列表…</p>}
      {loaded.state === "error" && (
        <div className="empty" role="alert">
          插件列表加载失败。<button className="linklike" onClick={loaded.retry}>重试</button>
        </div>
      )}
      {loaded.state === "ready" && list.length === 0 && (
        <div className="empty empty-state">
          <EmptyArt />
          没有符合条件的插件。
          {active && <button className="linklike" onClick={() => set({ ...DEFAULT_FILTERS, sort: f.sort })}>清除筛选</button>}
        </div>
      )}
      {loaded.state === "ready" && list.length > 0 && (
        <>
          <p className="result-count">共 {list.length} 款</p>
          <div className="grid plugin-grid">
            {list.slice(0, shown).map((p) => <PluginCard key={p.id} p={p} now={now} />)}
          </div>
          {shown < list.length && (
            <div className="more-wrap">
              <button className="chip" onClick={() => setShown((s) => s + PAGE)}>加载更多(还有 {list.length - shown} 款)</button>
            </div>
          )}
        </>
      )}
      <DataNote />
    </section>
  );
}

function DownloadBox({ p }: { p: Plugin }) {
  const majors = ZV.filter((v) => pickDownload(p, v));
  const [major, setMajor] = useState<number>(() => (majors.length ? Math.max(...majors) : 10));
  const d = pickDownload(p, major);
  const fallback = (p.downloads ?? []).filter((r) => isAllowedXpiUrl(r.u));
  return (
    <section className="download" aria-labelledby="dl-title">
      <h2 id="dl-title">下载安装包</h2>
      <div className="dl-row">
        <span className="filter-label">我的 Zotero 版本</span>
        <div role="group" aria-label="选择 Zotero 版本" className="dl-versions">
          {ZV.map((v) => (
            <button
              key={v}
              className={major === v ? "chip chip-sm on" : "chip chip-sm"}
              aria-pressed={major === v}
              onClick={() => setMajor(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {d ? (
        <p className="dl-main">
          <a className="btn" href={d.u} target="_blank" rel="noopener noreferrer">下载 v{d.v}(.xpi)</a>
          <span className="meta">{downloadFilename(d.u)} · 来自 {downloadHost(d.u)}</span>
        </p>
      ) : (
        <p className="empty">
          {fallback.length === 0
            ? "作者没有提供可直接下载的安装包,请到项目主页查看安装方法。"
            : `没有找到明确适配 Zotero ${major} 的安装包,请换一个版本,或到项目主页确认。`}
        </p>
      )}
      <details className="how">
        <summary>怎么安装?</summary>
        <ol>
          <li>保存下载的 <code>.xpi</code> 文件,不要解压。</li>
          <li>打开 Zotero,菜单选择「工具 → 插件」。</li>
          <li>点右上角齿轮,选「Install Plugin From File…」,选中刚下载的文件。</li>
          <li>按提示重启 Zotero。</li>
        </ol>
        <p className="data-note">本站不托管安装包,链接指向作者的发布页。安装第三方插件前建议先备份文献库,详见<Link to="/rules" className="inline-link">收录规则</Link>。</p>
      </details>
    </section>
  );
}

export function PluginDetail() {
  const loaded = usePluginData();
  const key = usePopstateKey();
  const id = useMemo(() => pluginIdFromPath(location.pathname), [key]);
  const now = useMemo(() => new Date(), []);
  const all = loaded.state === "ready" ? loaded.data.plugins : [];
  const p = useMemo(() => (id ? all.find((x) => x.id === id) ?? null : null), [all, id]);
  const related = useMemo(() => (p ? relatedPlugins(all, p) : []), [all, p]);

  useEffect(() => {
    document.title = p ? `${p.name} · 插件广场 · Zotero 中文社区` : "插件广场 · Zotero 中文社区";
  }, [p]);

  return (
    <section className="section">
      <Link to="/plugins" className="more">← 返回插件广场</Link>
      {loaded.state === "loading" && <p className="empty" role="status">正在加载…</p>}
      {loaded.state === "error" && (
        <div className="empty" role="alert">加载失败。<button className="linklike" onClick={loaded.retry}>重试</button></div>
      )}
      {loaded.state === "ready" && !p && (
        <div className="empty">没有找到这个插件。<Link to="/plugins" className="more">回到插件广场</Link></div>
      )}
      {p && (
        <>
          <header className="detail-head">
            <Avatar name={p.name} art />
            <div>
              <h1 className="page-title">{p.name}</h1>
              <p className="meta">作者 {p.author} · {CATEGORY_LABEL[p.category]}</p>
              <div className="detail-actions">
                <a className="btn" href={p.homepage} target="_blank" rel="noopener noreferrer">前往项目主页</a>
                {p.latest && (
                  <a className="btn btn-ghost" href={p.latest.releaseUrl} target="_blank" rel="noopener noreferrer">查看发布页</a>
                )}
              </div>
            </div>
          </header>
          <dl className="facts">
            <div><dt>最新版本</dt><dd>{p.latest ? `v${p.latest.version}` : "未获取到"}</dd></div>
            <div><dt>发布日期</dt><dd title={p.updated}>{p.updated ? `${p.updated}(${relativeTime(p.updated, now)})` : "未知"}</dd></div>
            <div><dt>适配 Zotero</dt><dd><CompatBadge p={p} /></dd></div>
            <div><dt>GitHub 星标</dt><dd>★ {p.stars.toLocaleString("zh-CN")}</dd></div>
          </dl>
          <DownloadBox p={p} />
          <h2>简介</h2>
          <p className="detail-summary">{p.summary}</p>
          {p.tags && p.tags.length > 0 && (
            <p className="card-tags">{p.tags.map((t) => <span key={t} className="tag">{CATEGORY_LABEL[t]}</span>)}</p>
          )}
          {related.length > 0 && (
            <>
              <h2>相关插件</h2>
              <div className="grid plugin-grid">{related.map((r) => <PluginCard key={r.id} p={r} now={now} />)}</div>
            </>
          )}
          <DataNote />
        </>
      )}
    </section>
  );
}
