import { Fragment, useEffect } from "react";
import { Link } from "../link.tsx";
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
  const slug = articleSlugFromPath(location.pathname);
  const a = slug ? articleBySlug(slug) : undefined;
  const i = a ? ARTICLES.findIndex((x) => x.slug === a.slug) : -1;
  useEffect(() => {
    if (!a) return;
    document.title = `${a.title}｜Zotero 中文社区`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", a.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", `https://zoterocn.org${articlePath(a.slug)}`);
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
