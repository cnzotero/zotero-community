import { useEffect, useMemo } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { PluginCard, PluginIndex, usePluginData } from "./PluginsPage.tsx";
import { MIN_TOPIC_PLUGINS, topicIndex, topicList, topicOf, topicRule } from "./topics.ts";
import { applyMeta } from "../seo/head.ts";
import { topicIntro, topicMeta, topicPath } from "../seo/pages.ts";
import { currentPath, useNow } from "../ssr.ts";

const SHOWN = 24;

/** 功能专题页(翻译、引用、笔记……):列出名称或简介里写明该用途的在架插件,排序与分类页相同。 */
export function TopicPage() {
  const key = /^\/topics\/([a-z0-9-]+)/.exec(currentPath())?.[1] ?? "";
  const topic = topicOf(key);
  const loaded = usePluginData();
  const now = useNow();
  const all = loaded.state === "ready" ? loaded.data.plugins : [];
  const meta = useMemo(() => topicMeta(key, all), [key, all]);
  const list = useMemo(() => topicList(all, key), [all, key]);
  const others = useMemo(() => topicIndex(all).filter((x) => x.key !== key), [all, key]);

  // 标题里的数量要等数据到了才算得准
  useEffect(() => {
    if (meta && loaded.state === "ready" && list.length >= MIN_TOPIC_PLUGINS) applyMeta(meta);
  }, [meta, loaded.state, list.length]);

  if (!meta || !topic) return null;
  return (
    <section className="section">
      <nav aria-label="面包屑" className="crumbs">
        <Link to="/">首页</Link>
        <span aria-hidden> › </span>
        <Link to="/plugins">插件广场</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">{meta.h1}</span>
      </nav>
      <PageHero kind="hero" title={meta.h1} lead={topicIntro(key)}>
        <Link to="/plugins" className="inline-link hero-link">← 返回插件广场</Link>
      </PageHero>
      {loaded.state === "loading" && <p className="empty" role="status">正在加载…</p>}
      {loaded.state === "error" && <div className="empty" role="alert">加载失败。<button className="linklike" onClick={loaded.retry}>重试</button></div>}
      {loaded.state === "ready" && list.length < MIN_TOPIC_PLUGINS && (
        <div className="empty">目前收录的相关插件还不多。<Link to="/plugins" className="more">回到插件广场</Link></div>
      )}
      {loaded.state === "ready" && list.length >= MIN_TOPIC_PLUGINS && (
        <>
          <p className="result-count">共 {list.length} 款,按 GitHub 星标排序,与分类页使用同一规则。{topicRule(topic)}</p>
          <div className="grid plugin-grid">{list.slice(0, SHOWN).map((p) => <PluginCard key={p.id} p={p} now={now} zv={null} />)}</div>
          {list.length > SHOWN && <PluginIndex list={list.slice(SHOWN)} label={`按名称浏览其余 ${list.length - SHOWN} 款插件`} />}
          {others.length > 0 && (
            <>
              <h2>其他功能专题</h2>
              <nav className="chips" aria-label="其他功能专题">
                {others.map((x) => <Link key={x.key} to={topicPath(x.key)} className="chip">{x.label}({x.count} 款)</Link>)}
              </nav>
            </>
          )}
          <p className="data-note">专题按插件名称或简介里的用途词收录，一个插件可以同时出现在多个专题。数据整理自各项目公开信息，收录不代表安全性或质量背书，详见<Link to="/rules" className="inline-link">收录规则</Link>。</p>
        </>
      )}
    </section>
  );
}
