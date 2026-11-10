import { useMemo, useState, type FormEvent } from "react";
import { Link } from "../link.tsx";
import { navigate } from "../router.ts";
import { ARTICLES, articlePath } from "../guides/content.ts";
import { PluginCard, usePluginData } from "../plugins/PluginsPage.tsx";
import { sortPlugins, type SortKey } from "../plugins/lib.ts";

/** 首页榜单:全部复用插件广场的同一套排序,不另设算法,说明文字与规则页第 4 条一致。 */
const BOARDS: { key: SortKey; label: string; note: string }[] = [
  { key: "stars", label: "星标最多", note: "按 GitHub 星标排序,与插件广场使用同一套规则,没有置顶或推荐位。" },
  { key: "cadence", label: "更新最勤", note: "按近一年有发布的天数排序,同一天发布多次只算一天;与插件广场「更新频率」同一套规则。" },
  { key: "downloads", label: "下载最多", note: "按发布页公开的安装包累计下载量排序;没有公开下载数据的插件不参与。" },
];

const TOOLS = [
  { to: "/journals", title: "期刊查询", text: "按名称、缩写或 ISSN 查看收录、分区与影响因子。" },
  { to: "/plugins/charts", title: "插件数据看板", text: "星标、下载、更新节奏与适配版本的公开榜单。" },
  { to: "/rules", title: "收录规则", text: "插件怎么收录、怎么排序、怎么申请与下架。" },
];

export function Home() {
  const [q, setQ] = useState("");
  const loaded = usePluginData();
  const now = useMemo(() => new Date(), []);
  const [board, setBoard] = useState<SortKey>("stars");
  const top = useMemo(() => {
    if (loaded.state !== "ready") return [];
    const pool = board === "downloads" ? loaded.data.plugins.filter((p) => p.dl?.total != null) : loaded.data.plugins;
    return sortPlugins(pool, board).slice(0, 6);
  }, [loaded, board]);
  const boardNote = BOARDS.find((b) => b.key === board)?.note ?? "";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/plugins?q=${encodeURIComponent(q.trim())}` : "/plugins");
  };
  return (
    <>
      <section className="hero">
        <h1>让 Zotero 更顺手,让研究更有条理</h1>
        <p>查找适合自己的插件,核对 Zotero 版本与更新记录;阅读中文教程,查询期刊与引用样式,按研究需要选择工具。</p>
        <form onSubmit={submit} role="search" className="hero-search">
          <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索插件,例如:翻译、Word、标签" aria-label="搜索插件" />
        </form>
        <p className="hero-cta">
          <Link to="/plugins" className="btn">查找插件</Link>
          <Link to="/guides" className="btn btn-ghost">阅读教程</Link>
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>热门插件</h2>
          <Link to="/plugins" className="more">查看全部插件</Link>
        </div>
        <div className="board-tabs" role="tablist" aria-label="插件榜单">
          {BOARDS.map((b) => (
            <button key={b.key} type="button" role="tab" aria-selected={board === b.key} className={`board-tab${board === b.key ? " is-active" : ""}`} onClick={() => setBoard(b.key)}>{b.label}</button>
          ))}
        </div>
        <p className="meta home-note">{boardNote}</p>
        {loaded.state === "loading" && <p className="empty" role="status">正在加载…</p>}
        {loaded.state === "error" && <div className="empty" role="alert">加载失败。<button className="linklike" onClick={loaded.retry}>重试</button></div>}
        {loaded.state === "ready" && <div className="grid plugin-grid">{top.map((p) => <PluginCard key={p.id} p={p} now={now} zv={null} />)}</div>}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>插件开发教程</h2>
          <Link to="/guides" className="more">全部教程</Link>
        </div>
        <ol className="series-list">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link to={articlePath(a.slug)} className="series-item">
                <span className="series-no">{a.order}</span>
                <span className="series-text"><b>{a.title}</b><span className="meta">{a.description}</span></span>
                <span />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <h2>更多工具</h2>
        <div className="grid">
          {TOOLS.map((t) => (
            <Link key={t.to} to={t.to} className="card tool-card"><h3>{t.title}</h3><p>{t.text}</p></Link>
          ))}
        </div>
      </section>
      <p className="data-note">插件信息整理自各项目公开资料,收录不代表对安全性或质量的背书。所有插件按同一套规则展示。</p>
    </>
  );
}
