import { useEffect, useMemo } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { PluginCard, PluginIndex, usePluginData } from "./PluginsPage.tsx";
import { CATEGORIES, compatIndex, compatList } from "./lib.ts";
import { applyMeta } from "../seo/head.ts";
import { COMPAT_SCOPE, categoryPath, compatMeta, compatPath } from "../seo/pages.ts";
import { currentPath, useNow } from "../ssr.ts";

const SHOWN = 24;

/** Zotero 大版本兼容页:列出声明支持该版本的全部插件,排序与分类页相同。 */
export function CompatPage() {
  const major = Number(/^\/compat\/zotero-(\d+)/.exec(currentPath())?.[1] ?? Number.NaN);
  const loaded = usePluginData();
  const now = useNow();
  const all = loaded.state === "ready" ? loaded.data.plugins : [];
  const list = useMemo(() => compatList(all, major), [all, major]);
  const meta = compatMeta(major, list.length);
  const others = useMemo(() => compatIndex(all).filter((x) => x.major !== major), [all, major]);
  const byCategory = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, n: list.filter((p) => p.category === c.key).length })).filter((c) => c.n > 0),
    [list],
  );

  useEffect(() => {
    if (loaded.state === "ready" && list.length > 0) applyMeta(compatMeta(major, list.length));
  }, [loaded.state, major, list.length]);

  return (
    <section className="section">
      <nav aria-label="面包屑" className="crumbs">
        <Link to="/">首页</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">{meta.h1}</span>
      </nav>
      <PageHero kind="hero" title={meta.h1} lead={COMPAT_SCOPE}>
        <Link to="/plugins" className="inline-link hero-link">← 返回插件广场</Link>
      </PageHero>
      {loaded.state === "loading" && <p className="empty" role="status">正在加载…</p>}
      {loaded.state === "error" && <div className="empty" role="alert">加载失败。<button className="linklike" onClick={loaded.retry}>重试</button></div>}
      {loaded.state === "ready" && list.length === 0 && (
        <div className="empty">目前没有插件声明适配这个版本。<Link to="/plugins" className="more">回到插件广场</Link></div>
      )}
      {loaded.state === "ready" && list.length > 0 && (
        <>
          <p className="result-count">共 {list.length} 款,按 GitHub 星标排序,与分类页使用同一规则。下载按钮指向适配 Zotero {major} 的安装包。</p>
          <div className="grid plugin-grid">{list.slice(0, SHOWN).map((p) => <PluginCard key={p.id} p={p} now={now} zv={major} />)}</div>
          {list.length > SHOWN && (
            <p className="more-wrap"><Link to={`/plugins?zv=${major}`} className="btn btn-ghost">查看全部 {list.length} 款并筛选</Link></p>
          )}
          <PluginIndex list={list.slice(SHOWN)} label={`按名称浏览其余 ${list.length - SHOWN} 款插件`} />
          <h2>按用途细分</h2>
          <p className="meta">括号里是该用途中声明适配 Zotero {major} 的插件数;点击进入分类页,查看这一用途的全部插件。</p>
          <nav className="chips" aria-label="按用途细分">
            {byCategory.map((c) => <Link key={c.key} to={categoryPath(c.key)} className="chip">{c.label}({c.n})</Link>)}
          </nav>
          {others.length > 0 && (
            <>
              <h2>其他 Zotero 版本</h2>
              <nav className="chips" aria-label="其他 Zotero 版本">
                {others.map((x) => <Link key={x.major} to={compatPath(x.major)} className="chip">Zotero {x.major}({x.count} 款)</Link>)}
              </nav>
            </>
          )}
          <p className="data-note">「适配」指作者声明的范围,未声明不等于不兼容,请到项目主页确认。数据整理自各项目公开信息,收录不代表安全性或质量背书,详见<Link to="/rules" className="inline-link">收录规则</Link>。</p>
        </>
      )}
    </section>
  );
}
