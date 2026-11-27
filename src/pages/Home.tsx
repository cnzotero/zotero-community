import { useEffect, useState, type FormEvent } from "react";
import boardsData from "virtual:home-boards";
import compatData from "virtual:compat-index";
import topicData from "virtual:topic-index";
import { Link } from "../link.tsx";
import { navigate } from "../router.ts";
import { categoryAnchor, homePicks } from "../guides/categories.ts";
import { ARTICLES, articlePath } from "../guides/content.ts";
import { serverCompatIndex, serverHomeBoards, serverTopicIndex } from "../plugins/data.ts";
import { PluginCard } from "../plugins/PluginsPage.tsx";
import { CATEGORIES, HOME_BOARD_VISIBLE, SITE_DL_RANK_NOTE, type HomeBoardKey } from "../plugins/lib.ts";
import { STAGE_PACKS } from "../plugins/packs.ts";
import { COMPAT_SCOPE, categoryPath, compatPath, packPath, pageMeta, topicPath } from "../seo/pages.ts";
import { HOME_FAQS } from "../seo/faqs.ts";
import { takeEarlyInput, useNow } from "../ssr.ts";
import { OfficialBox } from "../official/OfficialBox.tsx";

/** 首页榜单:全部复用插件广场的同一套排序,不另设算法,说明文字与规则页第 4 条一致。 */
const BOARDS: { key: HomeBoardKey; label: string; note: string }[] = [
  { key: "stars", label: "星标最多", note: "按 GitHub 星标排序,与插件广场的目录使用同一套规则,目录内的插件没有置顶或推荐位。" },
  { key: "updated", label: "最近更新", note: "按最近一次发布的日期排序,刚发布新版本的插件排在最前;与插件广场「最近更新」同一套规则。" },
  { key: "cadence", label: "更新最勤", note: "按近一年有发布的天数排序,同一天发布多次只算一天;与插件广场「更新频率」同一套规则。" },
  { key: "downloads", label: "下载最多(本站下载)", note: SITE_DL_RANK_NOTE },
];

const TOOLS = [
  { to: "/journals", title: "期刊查询", text: "按名称、缩写或 ISSN 查看收录、分区与影响因子。" },
  { to: "/plugins/charts", title: "插件数据看板", text: "星标、下载、更新节奏与适配版本的公开榜单。" },
  { to: "/rules", title: "收录规则", text: "插件怎么收录、怎么排序、怎么申请与下架。" },
];

export function Home() {
  const [q, setQ] = useState("");
  const now = useNow();
  const [board, setBoard] = useState<HomeBoardKey>("stars");
  const [expanded, setExpanded] = useState(false);
  // 榜单数据构建时已按同一套排序算好(预渲染时用注入的数据),首页不加载整份插件数据
  const top = (serverHomeBoards() ?? boardsData)[board];
  const compat = serverCompatIndex() ?? compatData;
  const topics = serverTopicIndex() ?? topicData;
  const boardNote = BOARDS.find((b) => b.key === board)?.note ?? "";
  // 接管前已经在搜索框里输入的文字:挂载后补上,不丢
  useEffect(() => {
    const early = takeEarlyInput("home-q");
    if (early) setQ(early);
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/plugins?q=${encodeURIComponent(q.trim())}` : "/plugins");
  };
  return (
    <>
      <section className="hero hero-stage">
        <p className="hero-eyebrow">Zotero 中文开源社区 · zoterocn.org</p>
        <h1>{pageMeta("/").h1}</h1>
        <p className="hero-lead">查找适配 Zotero 7–10 的开源插件与更新记录，阅读系统中文教程，查询期刊分区与引用样式。</p>
        <form onSubmit={submit} role="search" className="hero-search">
          <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索插件名称、作者或用途，例如：翻译、AI、期刊分区、Obsidian" aria-label="搜索插件" data-early="home-q" />
        </form>
        <p className="hero-cta">
          <Link to="/plugins" className="btn">浏览插件广场</Link>
          <Link to="/guides" className="btn btn-ghost">阅读中文教程</Link>
          <Link to="/journals" className="btn btn-ghost">查询期刊分区</Link>
        </p>
        <ul className="trust-pills" aria-label="站点特性">
          <li>适配 Zotero 7–10</li>
          <li>公开收录规则</li>
          <li>安装包直链作者仓库</li>
          <li>代码与目录完全开源</li>
        </ul>
      </section>

      <OfficialBox compact />

      <section className="section home-boards">
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
        <div className={expanded ? "grid plugin-grid home-grid is-expanded" : "grid plugin-grid home-grid"}>{(expanded ? top : top.slice(0, HOME_BOARD_VISIBLE)).map((p) => <PluginCard key={p.id} p={p} now={now} zv={null} compact siteFirst={board === "downloads"} />)}</div>
        {top.length > HOME_BOARD_VISIBLE && (
          <p className="board-more"><button type="button" className="more board-more-btn" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>{expanded ? "收起" : `展开更多(还有 ${top.length - HOME_BOARD_VISIBLE} 个)`}</button></p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>按用途找插件</h2>
          <Link to="/plugins" className="more">插件广场</Link>
        </div>
        <nav className="chips" aria-label="插件分类">
          {CATEGORIES.map((c) => <Link key={c.key} to={categoryPath(c.key)} className="chip">{c.label}</Link>)}
        </nav>
      </section>

      {topics.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>按功能找插件</h2>
          </div>
          <nav className="chips" aria-label="按功能找插件">
            {topics.map((t) => <Link key={t.key} to={topicPath(t.key)} className="chip">{t.label}<span className="chip-count">{t.count}</span></Link>)}
          </nav>
          <p className="meta home-note">按插件名称或简介里写明的用途归入专题，一个插件可以出现在多个专题。</p>
        </section>
      )}

      {compat.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>按 Zotero 版本找插件</h2>
          </div>
          <nav className="chips" aria-label="按 Zotero 版本">
            {compat.map((c) => <Link key={c.major} to={compatPath(c.major)} className="chip">Zotero {c.major}<span className="chip-count">{c.count} 款</span></Link>)}
          </nav>
          <p className="meta home-note">{COMPAT_SCOPE}</p>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>按科研阶段配插件</h2>
          <Link to="/packs" className="more">查看全部搭配方案</Link>
        </div>
        <div className="pack-cards-grid home-pack-grid">
          {STAGE_PACKS.map((pack) => (
            <Link key={pack.key} to={packPath(pack.key)} className="card pack-card pack-card-sm">
              <span className="pack-audience">{pack.audience}</span>
              <h3>{pack.label}</h3>
              <p>{pack.subtitle}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>教程</h2>
          <Link to="/guides" className="more">全部教程</Link>
        </div>
        <div className="grid guide-home">
          {homePicks(ARTICLES).map((g) => (
            <div key={g.key} className="card guide-home-group">
              <h3><Link to={`/guides#${categoryAnchor(g.key)}`}>{g.label}</Link></h3>
              <ul>{g.articles.map((a) => <li key={a.slug}><Link to={articlePath(a.slug)} className="inline-link">{a.title}</Link></li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>更多工具</h2>
        <div className="grid">
          {TOOLS.map((t) => (
            <Link key={t.to} to={t.to} className="card tool-card"><h3>{t.title}</h3><p>{t.text}</p></Link>
          ))}
        </div>
      </section>

      <section className="section faq-section" aria-labelledby="home-faq-title">
        <div className="section-head">
          <h2 id="home-faq-title">常见问题</h2>
          <Link to="/rules" className="more">查看完整规则</Link>
        </div>
        <div className="faq-list">
          {HOME_FAQS.map((item, idx) => (
            <details key={item.q} className="faq-item" open={idx === 0}>
              <summary className="faq-q">{item.q}</summary>
              <p className="faq-a">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <p className="data-note">插件信息整理自各项目公开资料,收录不代表对安全性或质量的背书。所有插件按同一套规则展示。</p>
    </>
  );
}
