import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { downloadsPerDay } from "./charts-lib.ts";
import { cachedPluginData, loadPluginData, type PluginData } from "./data.ts";
import { applyMeta } from "../seo/head.ts";
import { categoryPath, compatPath, duplicateNames, pageMeta, pluginMeta } from "../seo/pages.ts";
import { currentPath, currentSearch, useImageOk, useNow } from "../ssr.ts";
import { DownloadIcon, ExternalIcon, GithubIcon, ShareIcon, StarIcon } from "../icons.tsx";
import {
  CATEGORIES, DEFAULT_FILTERS, ZOTERO_VERSIONS as ZV, ZOTERO_VERSIONS, applyFilters, authorOf, authorStats, barHeights, byNameStable, cadenceText,
  cardTags, compatIndex, compatSummary, computeStats, downloadFilename, downloadHost, formatCount, formatStars, isAllowedXpiUrl, parseFilters, pickDownload,
  pluginIdFromPath, pluginPath, relatedPlugins, relativeTime, serializeFilters, speedText, topAuthors,
  type CategoryKey, type Filters, type Plugin, type SortKey, type UpdatedWithin,
} from "./lib.ts";

const PAGE = 24;
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<CategoryKey, string>;

type Loaded = { state: "loading" } | { state: "error" } | { state: "ready"; data: PluginData };

/** 插件数据较大,只在用到的页面才加载;已加载(或预渲染时已注入)就直接可用。 */
export function usePluginData(): Loaded & { retry: () => void } {
  const [s, setS] = useState<Loaded>(() => {
    const d = cachedPluginData();
    return d ? { state: "ready", data: d } : { state: "loading" };
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (cachedPluginData()) return;
    let alive = true;
    setS({ state: "loading" });
    loadPluginData()
      .then((data) => alive && setS({ state: "ready", data }))
      .catch(() => alive && setS({ state: "error" }));
    return () => {
      alive = false;
    };
  }, [tick]);
  return { ...s, retry: () => setTick((t) => t + 1) };
}

function usePopstateKey(): string {
  const [k, setK] = useState(() => currentPath() + currentSearch());
  useEffect(() => {
    const on = () => setK(location.pathname + location.search);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return k;
}

const IMG = "/images/plugins/";
const EMPTY_ART = { w: 960, h: 640 };

/** 图片还没上线或加载失败时整体隐藏,不留破图。 */
function SafeImg({ src, className, alt = "" }: { src: string; className?: string; alt?: string }) {
  const [ok, ref, fail] = useImageOk();
  if (!ok) return null;
  return <img ref={ref} src={src} className={className} alt={alt} width={18} height={18} loading="lazy" decoding="async" onError={fail} />;
}

function EmptyArt() {
  const [ok, ref, fail] = useImageOk();
  if (!ok) return null;
  return (
    <picture className="empty-art" aria-hidden>
      <source media="(prefers-color-scheme: dark)" srcSet={`${IMG}empty-dark.webp`} />
      <img ref={ref} src={`${IMG}empty-light.webp`} alt="" width={EMPTY_ART.w} height={EMPTY_ART.h} decoding="async" onError={fail} />
    </picture>
  );
}

/** 作者头像:来自 GitHub 公开头像地址;加载失败(例如网络无法访问)时退回首字母方块。 */
function Avatar({ p, big = false }: { p: Plugin; big?: boolean }) {
  const ch = (p.name.match(/[A-Za-z0-9\u4e00-\u9fa5]/)?.[0] ?? "插").toUpperCase();
  const [ok, ref, fail] = useImageOk();
  const owner = authorOf(p.id);
  return (
    <span className={big ? "avatar avatar-lg" : "avatar"} aria-hidden>
      {ch}
      {ok && owner && (
        <img
          ref={ref}
          src={`https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?s=${big ? 160 : 96}&v=4`}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={fail}
        />
      )}
    </span>
  );
}

function ShareButton({ p, label = false }: { p: Plugin; label?: boolean }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = `${location.origin}${pluginPath(p.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      window.prompt("复制这个链接分享:", url);
    }
  };
  return (
    <button className={label ? "btn btn-ghost btn-sm" : "icon-btn"} onClick={share} title="复制链接" aria-label={`复制 ${p.name} 的链接`}>
      <ShareIcon size={15} />
      {label && <span>{done ? "已复制" : "分享"}</span>}
      {!label && done && <span className="toast" role="status">已复制</span>}
    </button>
  );
}

function CompatBadge({ p }: { p: Plugin }) {
  const c = compatSummary(p);
  return <span className={`compat compat-${c.kind}`}>{c.text}</span>;
}

/** 详情页「适配 Zotero」一行:作者声明支持的每个大版本链到对应的版本兼容页;没声明的不链。 */
function CompatLinks({ p }: { p: Plugin }) {
  const majors = p.zotero.declared ? [...p.zotero.majors].sort((a, b) => b - a) : [];
  if (majors.length === 0) return null;
  return (
    <span className="compat-links">
      <span className="meta">同版本插件:</span>
      {majors.map((m) => <Link key={m} to={compatPath(m)} className="inline-link">Zotero {m}</Link>)}
    </span>
  );
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

export function PluginCard({ p, now, zv, onAuthor }: { p: Plugin; now: Date; zv: number | null; onAuthor?: (a: string) => void }) {
  const dl = pickDownload(p, zv ?? 10) ?? (zv === null ? ZV.map((v) => pickDownload(p, v)).find(Boolean) ?? null : null);
  return (
    <article className="card plugin-card">
      <Link to={pluginPath(p.id)} className="card-main">
        <div className="plugin-head">
          <Avatar p={p} />
          <div className="plugin-title">
            <h3>{p.name}</h3>
            <span className="meta">{authorOf(p.id)}</span>
          </div>
        </div>
        <p className="clamp2">{p.summary}</p>
        <div className="plugin-stats">
          <span title="GitHub 星标"><StarIcon size={13} /> {formatStars(p.stars)}</span>
          {p.dl && p.dl.total > 0 && <span title="GitHub 累计下载次数"><DownloadIcon size={13} /> {formatCount(p.dl.total)}</span>}
          {p.latest && <span>v{p.latest.version}</span>}
          <span title={speedText(p) ?? undefined}>{cadenceText(p)}</span>
        </div>
        <CardTags p={p} now={now} />
      </Link>
      <div className="card-actions">
        {dl ? (
          <a className="btn btn-sm" href={dl.u} target="_blank" rel="noopener noreferrer" title={`下载 v${dl.v}`}>
            <DownloadIcon size={14} /> 下载
          </a>
        ) : (
          <Link to={pluginPath(p.id)} className="btn btn-sm btn-ghost">查看详情</Link>
        )}
        {dl && <Link to={pluginPath(p.id)} className="btn btn-sm btn-ghost">详情</Link>}
        <span className="spacer" />
        {onAuthor && (
          <button className="icon-btn" title={`只看 ${authorOf(p.id)} 的插件`} aria-label={`只看 ${authorOf(p.id)} 的插件`} onClick={() => onAuthor(authorOf(p.id))}>
            <span className="icon-text">作者</span>
          </button>
        )}
        <a className="icon-btn" href={p.homepage} target="_blank" rel="noopener noreferrer" title="GitHub 仓库" aria-label={`${p.name} 的 GitHub 仓库`}>
          <GithubIcon size={16} />
        </a>
        <ShareButton p={p} />
      </div>
    </article>
  );
}

function Filters_({ f, set, openMobile, authors }: { f: Filters; set: (n: Partial<Filters>) => void; openMobile: boolean; authors: { author: string; count: number }[] }) {
  return (
    <div className={openMobile ? "filters open" : "filters"}>
      <div className="filter-bar">
        <label className="field">
          <span className="filter-label">Zotero 版本</span>
          <select className="select" value={f.zotero ?? ""} onChange={(e) => set({ zotero: e.target.value ? Number(e.target.value) : null })}>
            <option value="">不限</option>
            {ZOTERO_VERSIONS.map((v) => <option key={v} value={v}>Zotero {v}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="filter-label">更新时间</span>
          <select className="select" value={f.within} onChange={(e) => set({ within: e.target.value as UpdatedWithin })}>
            <option value="any">不限</option>
            <option value="30">30 天内</option>
            <option value="365">1 年内</option>
          </select>
        </label>
        <label className="field">
          <span className="filter-label">排序</span>
          <select className="select" value={f.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
            <option value="stars">热度(星标)</option>
            <option value="updated">最近更新</option>
            <option value="cadence">更新频率</option>
            <option value="downloads">下载量</option>
            <option value="name">名称</option>
          </select>
        </label>
        <label className="field">
          <span className="filter-label">作者</span>
          <select className="select" value={f.author} onChange={(e) => set({ author: e.target.value })}>
            <option value="">全部作者</option>
            {f.author && !authors.some((a) => a.author === f.author) && <option value={f.author}>{f.author}</option>}
            {authors.map((a) => <option key={a.author} value={a.author}>{a.author}({a.count})</option>)}
          </select>
        </label>
      </div>
      <div className="chips cat-chips" role="group" aria-label="分类">
        <button className={f.category === "all" ? "chip on" : "chip"} onClick={() => set({ category: "all" })}>全部</button>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={f.category === c.key ? "chip on" : "chip"} onClick={() => set({ category: c.key })}>
            <SafeImg src={`${IMG}cat-${c.key}.png`} className="chip-icon" />
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AuthorStrip({ author, all, onClear }: { author: string; all: Plugin[]; onClear: () => void }) {
  const st = authorStats(all, author);
  const [ok, setOk] = useState(true);
  return (
    <section className="author-strip" aria-label={`作者 ${author}`}>
      <span className="avatar avatar-lg" aria-hidden>
        {author.slice(0, 1).toUpperCase()}
        {ok && <img src={`https://avatars.githubusercontent.com/${encodeURIComponent(author)}?s=160&v=4`} alt="" referrerPolicy="no-referrer" onError={() => setOk(false)} />}
      </span>
      <div className="author-name">
        <b>{author}</b>
        <a href={`https://github.com/${encodeURIComponent(author)}`} target="_blank" rel="noopener noreferrer" className="inline-link"><GithubIcon size={13} /> 作者主页</a>
      </div>
      <dl className="author-nums">
        <div><dt>已收录插件</dt><dd>{st.count}</dd></div>
        <div><dt>收到星标</dt><dd>{st.stars.toLocaleString("zh-CN")}</dd></div>
      </dl>
      <button className="icon-btn" onClick={onClear} aria-label="取消作者筛选" title="取消作者筛选">✕</button>
    </section>
  );
}

/** 按名称列出全部插件的链接(收起显示),方便按名字查找,也让每个详情页都能从列表页直接到达。 */
export function PluginIndex({ list, label }: { list: Plugin[]; label: string }) {
  if (list.length === 0) return null;
  return (
    <details className="plugin-index">
      <summary>{label}</summary>
      <ul>{byNameStable(list).map((p) => <li key={p.id}><Link to={pluginPath(p.id)}>{p.name}</Link></li>)}</ul>
    </details>
  );
}

function DataNote() {
  return <p className="data-note">数据整理自各项目公开信息,收录不代表对其安全性或质量的背书。</p>;
}

export function PluginsList() {
  const loaded = usePluginData();
  const key = usePopstateKey();
  const [f, setF] = useState<Filters>(() => parseFilters(currentSearch()));
  const [shown, setShown] = useState(PAGE);
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = useNow();

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
  const authors = useMemo(() => topAuthors(all), [all]);
  const compat = useMemo(() => compatIndex(all), [all]);
  const active = f.category !== "all" || f.zotero !== null || f.within !== "any" || f.query.trim() !== "" || f.author !== "";

  return (
    <section className="section">
      <PageHero kind="hero" title={pageMeta("/plugins").h1} lead="收录常用的 Zotero 插件,按公开数据整理,点击查看详情。">
        <Link to="/plugins/charts" className="inline-link hero-link">数据看板</Link>
        <span className="hero-sep"> · </span>
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
      <Filters_ f={f} set={set} openMobile={mobileOpen} authors={authors} />
      {compat.length > 0 && (
        <nav className="cat-link compat-nav" aria-label="按 Zotero 版本">
          <span className="meta">按 Zotero 版本:</span>
          {compat.map((c) => <Link key={c.major} to={compatPath(c.major)} className="inline-link">Zotero {c.major} 兼容的插件({c.count})</Link>)}
        </nav>
      )}
      {f.category !== "all" && (
        <p className="cat-link"><Link to={categoryPath(f.category)} className="inline-link">了解{CATEGORY_LABEL[f.category]}类插件 →</Link></p>
      )}
      {f.author && loaded.state === "ready" && <AuthorStrip author={f.author} all={all} onClear={() => set({ author: "" })} />}

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
            {list.slice(0, shown).map((p) => <PluginCard key={p.id} p={p} now={now} zv={f.zotero} onAuthor={(a) => set({ author: a })} />)}
          </div>
          {shown < list.length && (
            <div className="more-wrap">
              <button className="chip" onClick={() => setShown((s) => s + PAGE)}>加载更多(还有 {list.length - shown} 款)</button>
            </div>
          )}
        </>
      )}
      {loaded.state === "ready" && <PluginIndex list={all} label={`按名称浏览全部 ${all.length} 款插件`} />}
      <DataNote />
    </section>
  );
}

/** 近 12 个月发布节奏:迷你柱图,每根柱是该月的发布次数。 */
function CadenceChart({ p, now }: { p: Plugin; now: Date }) {
  const c = p.cadence;
  if (!c) return null;
  const hs = barHeights(c.monthly);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return `${d.getMonth() + 1}月`;
  });
  return (
    <section className="cadence" aria-labelledby="cad-title">
      <h2 id="cad-title">更新节奏</h2>
      <div className="bars" role="img" aria-label={`近 12 个月每月发布次数:${c.monthly.join("、")}`}>
        {hs.map((h, i) => (
          <div key={i} className="bar-col" title={`${months[i]}:${c.monthly[i]} 次`}>
            <span className="bar" style={{ height: `${Math.max(h * 100, c.monthly[i] > 0 ? 6 : 0)}%` }} />
            <span className="bar-label">{months[i]}</span>
          </div>
        ))}
      </div>
      <p className="meta">{cadenceText(p)}{speedText(p) ? ` · ${speedText(p)}` : ""} · 最近发布 {c.last}。数据来自 GitHub 发布记录。</p>
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
          <a className="btn" href={d.u} target="_blank" rel="noopener noreferrer"><DownloadIcon size={15} /> 下载 v{d.v}(.xpi)</a>
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
  const id = useMemo(() => pluginIdFromPath(currentPath()), [key]);
  const now = useNow();
  const all = loaded.state === "ready" ? loaded.data.plugins : [];
  const p = useMemo(() => (id ? all.find((x) => x.id === id) ?? null : null), [all, id]);
  const related = useMemo(() => (p ? relatedPlugins(all, p) : []), [all, p]);
  const headerDl = useMemo(() => (p ? ([10, 9, 8, 7].map((v) => pickDownload(p, v)).find(Boolean) ?? null) : null), [p]);

  useEffect(() => {
    if (!p) { document.title = "插件广场 · Zotero 中文社区"; return; }
    applyMeta(pluginMeta(p, duplicateNames(all).has(p.name)));
  }, [p, all]);

  return (
    <section className="section">
      {p ? (
        <nav aria-label="面包屑" className="crumbs">
          <Link to="/">首页</Link>
          <span aria-hidden> › </span>
          <Link to={categoryPath(p.category)}>{CATEGORY_LABEL[p.category]}类插件</Link>
          <span aria-hidden> › </span>
          <span aria-current="page">{p.name}</span>
        </nav>
      ) : (
        <Link to="/plugins" className="more">← 返回插件广场</Link>
      )}
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
            <Avatar p={p} big />
            <div>
              <h1 className="page-title">{p.name}</h1>
              <p className="meta">作者 {authorOf(p.id)} · <Link to={categoryPath(p.category)} className="inline-link">{CATEGORY_LABEL[p.category]}类插件</Link></p>
              <div className="detail-actions">
                {headerDl ? (
                  <a className="btn" href={headerDl.u} target="_blank" rel="noopener noreferrer"><DownloadIcon size={15} /> 下载 v{headerDl.v}</a>
                ) : null}
                <a className={headerDl ? "btn btn-ghost" : "btn"} href={p.homepage} target="_blank" rel="noopener noreferrer"><GithubIcon size={15} /> GitHub 仓库</a>
                {p.latest && (
                  <a className="btn btn-ghost" href={p.latest.releaseUrl} target="_blank" rel="noopener noreferrer">发布页 <ExternalIcon size={13} /></a>
                )}
                <ShareButton p={p} label />
              </div>
            </div>
          </header>
          <dl className="facts">
            <div><dt>最新版本</dt><dd>{p.latest ? `v${p.latest.version}` : "未获取到"}</dd></div>
            <div><dt>发布日期</dt><dd title={p.updated}>{p.updated ? `${p.updated}(${relativeTime(p.updated, now)})` : "未知"}</dd></div>
            <div><dt>适配 Zotero</dt><dd><CompatBadge p={p} /><CompatLinks p={p} /></dd></div>
            <div><dt>GitHub 星标</dt><dd><StarIcon size={14} /> {p.stars.toLocaleString("zh-CN")}</dd></div>
            <div><dt>累计下载(GitHub)</dt><dd>{p.dl ? formatCount(p.dl.total) : "暂无"}{downloadsPerDay(p) ? <small className="dd-sub"> +{Math.round(downloadsPerDay(p) as number).toLocaleString("zh-CN")}/天</small> : null}</dd></div>
            <div><dt>更新速度</dt><dd>{speedText(p) ?? "暂无"}</dd></div>
            <div><dt>近一年发布</dt><dd>{p.cadence ? `${p.cadence.r12}${p.cadence.capped ? "+" : ""} 次` : "暂无"}</dd></div>
          </dl>
          <DownloadBox p={p} />
          <CadenceChart p={p} now={now} />
          <h2>简介</h2>
          <p className="detail-summary">{p.summary}</p>
          {p.tags && p.tags.length > 0 && (
            <p className="card-tags">{p.tags.map((t) => <span key={t} className="tag">{CATEGORY_LABEL[t]}</span>)}</p>
          )}
          {related.length > 0 && (
            <>
              <h2>相关插件</h2>
              <div className="grid plugin-grid">{related.map((r) => <PluginCard key={r.id} p={r} now={now} zv={null} />)}</div>
            </>
          )}
          <DataNote />
        </>
      )}
    </section>
  );
}
