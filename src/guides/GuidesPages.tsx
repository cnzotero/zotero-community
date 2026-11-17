import { Fragment, useEffect, useMemo, useState } from "react";
import { GUIDES, type GuideEntry } from "../content.ts";
import { Link } from "../link.tsx";
import { filterGuides } from "../search.ts";
import { applyMeta } from "../seo/head.ts";
import { SITE_NAME, pageMeta } from "../seo/pages.ts";
import { currentPath } from "../ssr.ts";
import { categoryAnchor, groupArticles, guideCategoryLabel, sameCategory } from "./categories.ts";
import { ARTICLES, articleBySlug, articlePath, articleSlugFromPath } from "./content.ts";
import { wordCount, type Article, type Block, type Inline } from "./markdown.ts";

function InlineView({ inline }: { inline: Inline[] }) {
  return (
    <>
      {inline.map((x, i) => {
        if (x.t === "code") return <code key={i}>{x.v}</code>;
        if (x.t === "strong") return <strong key={i}>{x.v}</strong>;
        if (x.t === "link") {
          return x.external
            ? <a key={i} href={x.href} target="_blank" rel="noopener noreferrer" className="inline-link">{x.v}</a>
            : <Link key={i} to={x.href} className="inline-link">{x.v}</Link>;
        }
        return <Fragment key={i}>{x.v}</Fragment>;
      })}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.t === "h2") return <h2><InlineView inline={b.inline} /></h2>;
  if (b.t === "h3") return <h3><InlineView inline={b.inline} /></h3>;
  if (b.t === "p") return <p><InlineView inline={b.inline} /></p>;
  if (b.t === "quote") return <blockquote><InlineView inline={b.inline} /></blockquote>;
  if (b.t === "code") return <pre className="codeblock"><code>{b.v}</code></pre>;
  const items = b.items.map((it, i) => <li key={i}><InlineView inline={it} /></li>);
  return b.t === "ol" ? <ol>{items}</ol> : <ul>{items}</ul>;
}

const minutes = (a: Article) => Math.max(1, Math.round(wordCount(a.blocks) / 400));

/** 教程总览:顶部是分类锚点导航,下面按分类分组(分类顺序固定,没有文章的分类不显示,组内按 order)。 */
export function GuideIndex() {
  const groups = groupArticles(ARTICLES);
  return (
    <>
      <nav className="chips guide-cats" aria-label="教程分类">
        {groups.map((g) => (
          <a key={g.key} href={`#${categoryAnchor(g.key)}`} className="chip">{g.label}<span className="guide-cat-n">{g.articles.length}</span></a>
        ))}
      </nav>
      {groups.map((g) => (
        <section key={g.key} id={categoryAnchor(g.key)} className="series guide-group" aria-labelledby={`${categoryAnchor(g.key)}-title`}>
          <h2 id={`${categoryAnchor(g.key)}-title`}>{g.label}</h2>
          <ol className="series-list">
            {g.articles.map((a, k) => (
              <li key={a.slug}>
                <Link to={articlePath(a.slug)} className="series-item">
                  <span className="series-no">{k + 1}</span>
                  <span className="series-text">
                    <b>{a.title}</b>
                    <span className="meta">{a.description}</span>
                  </span>
                  <span className="meta series-time">约 {minutes(a)} 分钟</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}

export function GuideArticle() {
  const slug = articleSlugFromPath(currentPath());
  const a = slug ? articleBySlug(slug) : undefined;
  useEffect(() => {
    if (!a) return;
    applyMeta({ path: articlePath(a.slug), title: `${a.title}｜${SITE_NAME}`, description: a.description, h1: a.title, kind: "guide" });
  }, [a]);
  if (!a) {
    return (
      <section className="section">
        <Link to="/guides" className="more">← 返回教程</Link>
        <div className="empty">没有找到这篇教程。<Link to="/guides" className="more">回到教程</Link></div>
      </section>
    );
  }
  // 上一篇、下一篇与「同分类的其他教程」都只在同一分类里找
  const group = sameCategory(ARTICLES, a);
  const i = group.findIndex((x) => x.slug === a.slug);
  const prev = group[i - 1];
  const next = group[i + 1];
  const others = group.filter((x) => x.slug !== a.slug);
  const label = guideCategoryLabel(a.category);
  return (
    <article className="section prose article">
      <Link to="/guides" className="more">← 返回教程</Link>
      <h1 className="page-title">{a.title}</h1>
      <p className="meta">
        <Link to={`/guides#${categoryAnchor(a.category ?? "other")}`} className="inline-link">{label}</Link> · 第 {i + 1} 篇 / 共 {group.length} 篇 · 约 {minutes(a)} 分钟读完
      </p>
      {(a.published || a.updated) && (
        <p className="meta">
          {a.published && <>发布于 <time dateTime={a.published}>{a.published}</time></>}
          {a.published && a.updated && " · "}
          {a.updated && <>更新于 <time dateTime={a.updated}>{a.updated}</time></>}
        </p>
      )}
      {a.blocks.map((b, k) => <BlockView key={k} b={b} />)}
      <section className="sources" aria-labelledby="src-title">
        <h2 id="src-title">参考来源</h2>
        <ul>{a.sources.map((s) => <li key={s}><a href={s} target="_blank" rel="noopener noreferrer" className="inline-link">{s}</a></li>)}</ul>
        <p className="data-note">教程由社区整理,以官方文档为准;标注「待核实」「未实测」的步骤尚未在目标版本上验证,请自行确认后再使用。发现错误欢迎在公开仓库提 Issue。</p>
      </section>
      {others.length > 0 && (
        <section className="related-guides" aria-labelledby="related-title">
          <h2 id="related-title">同分类的其他教程</h2>
          <ul>{others.map((o) => <li key={o.slug}><Link to={articlePath(o.slug)} className="inline-link">{o.title}</Link></li>)}</ul>
        </section>
      )}
      <nav className="article-nav" aria-label="上一篇下一篇">
        {prev ? <Link to={articlePath(prev.slug)} className="btn btn-ghost btn-sm">← {prev.title}</Link> : <span />}
        {next ? <Link to={articlePath(next.slug)} className="btn btn-ghost btn-sm">{next.title} →</Link> : <span />}
      </nav>
    </article>
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

/** 从别的页面带着分类锚点(/guides#cat-xxx)跳进来时,页面渲染后滚到对应分类。 */
function useScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
}

/** 教程栏目页:按分类整理的站内教程 + 更多使用教程(外链到官方文档)。 */
export function Guides() {
  useScrollToHash();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<GuideEntry["topic"] | "all">("all");
  const topics = useMemo(() => Array.from(new Set(GUIDES.map((g) => g.topic))), []);
  const list = filterGuides(GUIDES, { query: q, topic });
  return (
    <section className="section">
      <h1 className="page-title">{pageMeta("/guides").h1}</h1>
      <p className="lead">按分类整理的 Zotero 使用教程与插件开发教程。每篇写明适用版本、核对日期与参考来源,未亲自验证的步骤会标注「未实测」或「待核实」。</p>
      <GuideIndex />
      <h2 className="more-guides">更多使用教程</h2>
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
