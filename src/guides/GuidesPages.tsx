import { Fragment, useEffect, useMemo, useState } from "react";
import { GUIDES, type GuideEntry } from "../content.ts";
import { Link } from "../link.tsx";
import { filterGuides } from "../search.ts";
import { applyMeta } from "../seo/head.ts";
import { SITE_NAME, pageMeta } from "../seo/pages.ts";
import { currentPath } from "../ssr.ts";
import { ARTICLES, articleBySlug, articlePath, articleSlugFromPath } from "./content.ts";
import { wordCount, type Block, type Inline } from "./markdown.ts";

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

/** 教程目录:插件开发系列(站内文章)。 */
export function GuideSeries() {
  return (
    <section className="series" aria-labelledby="series-title">
      <h2 id="series-title">插件开发系列</h2>
      <p className="lead">从结构认识到第一个插件、调试、打包发布,再到申请被本站收录。每篇都附官方参考来源,没有验证过的步骤会明确标注「待核实」。</p>
      <ol className="series-list">
        {ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link to={articlePath(a.slug)} className="series-item">
              <span className="series-no">{a.order}</span>
              <span className="series-text">
                <b>{a.title}</b>
                <span className="meta">{a.description}</span>
              </span>
              <span className="meta series-time">约 {Math.max(1, Math.round(wordCount(a.blocks) / 400))} 分钟</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function GuideArticle() {
  const slug = articleSlugFromPath(currentPath());
  const a = slug ? articleBySlug(slug) : undefined;
  const i = a ? ARTICLES.findIndex((x) => x.slug === a.slug) : -1;
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
  const prev = ARTICLES[i - 1];
  const next = ARTICLES[i + 1];
  return (
    <article className="section prose article">
      <Link to="/guides" className="more">← 返回教程</Link>
      <h1 className="page-title">{a.title}</h1>
      <p className="meta">插件开发系列 第 {a.order} 篇 / 共 {ARTICLES.length} 篇 · 约 {Math.max(1, Math.round(wordCount(a.blocks) / 400))} 分钟读完</p>
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
        <p className="data-note">教程由社区整理,以官方文档为准;标注「待核实」的步骤尚未在目标版本上验证,请自行确认后再使用。发现错误欢迎在公开仓库提 Issue。</p>
      </section>
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

/** 教程栏目页:插件开发系列 + 更多使用教程(外链到官方文档)。 */
export function Guides() {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<GuideEntry["topic"] | "all">("all");
  const topics = useMemo(() => Array.from(new Set(GUIDES.map((g) => g.topic))), []);
  const list = filterGuides(GUIDES, { query: q, topic });
  return (
    <section className="section">
      <h1 className="page-title">{pageMeta("/guides").h1}</h1>
      <GuideSeries />
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
