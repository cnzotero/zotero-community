import { useEffect, useMemo } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { PluginCard, PluginIndex, usePluginData } from "./PluginsPage.tsx";
import { CATEGORIES, sortPlugins } from "./lib.ts";
import { applyMeta } from "../seo/head.ts";
import { categoryIntro, categoryMeta } from "../seo/pages.ts";
import { currentPath, useNow } from "../ssr.ts";

const SHOWN = 24;

export function CategoryPage() {
  const key = /^\/categories\/([a-z]+)/.exec(currentPath())?.[1] ?? "";
  const meta = categoryMeta(key);
  const cat = CATEGORIES.find((c) => c.key === key);
  const loaded = usePluginData();
  const now = useNow();
  const all = loaded.state === "ready" ? loaded.data.plugins : [];
  const list = useMemo(() => sortPlugins(all.filter((p) => p.category === key), "stars"), [all, key]);

  useEffect(() => {
    if (meta) applyMeta(meta);
  }, [meta, key]);

  if (!meta || !cat) return null;
  return (
    <section className="section">
      <PageHero kind="hero" title={meta.h1} lead={categoryIntro(key)}>
        <Link to="/plugins" className="inline-link hero-link">← 返回插件广场</Link>
      </PageHero>
      {loaded.state === "loading" && <p className="empty" role="status">正在加载…</p>}
      {loaded.state === "error" && <div className="empty" role="alert">加载失败。<button className="linklike" onClick={loaded.retry}>重试</button></div>}
      {loaded.state === "ready" && (
        <>
          <p className="result-count">共 {list.length} 款,按 GitHub 星标排序,与其他分类使用同一规则。</p>
          <div className="grid plugin-grid">{list.slice(0, SHOWN).map((p) => <PluginCard key={p.id} p={p} now={now} zv={null} />)}</div>
          {list.length > SHOWN && (
            <p className="more-wrap"><Link to={`/plugins?cat=${key}`} className="btn btn-ghost">查看全部 {list.length} 款并筛选</Link></p>
          )}
          <PluginIndex list={list.slice(SHOWN)} label={`按名称浏览本分类其余 ${list.length - SHOWN} 款插件`} />
          <p className="data-note">分类仅按主要用途归类,一个插件只归一个主分类。数据整理自各项目公开信息,收录不代表安全性或质量背书,详见<Link to="/rules" className="inline-link">收录规则</Link>。</p>
        </>
      )}
    </section>
  );
}
