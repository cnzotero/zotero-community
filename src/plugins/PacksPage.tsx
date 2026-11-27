import { useEffect, useMemo } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { PluginCard, usePluginData } from "./PluginsPage.tsx";
import { PACK_RULE_NOTE, STAGE_PACKS, packOf, packTopicLabel, selectSlotPlugins } from "./packs.ts";
import { articleBySlug, articlePath } from "../guides/content.ts";
import { applyMeta } from "../seo/head.ts";
import { packMeta, packPath, pageMeta, topicPath } from "../seo/pages.ts";
import { currentPath, useNow } from "../ssr.ts";

/** 按科研阶段配插件总览页(/packs)。 */
export function PacksIndex() {
  return (
    <section className="section">
      <nav aria-label="面包屑" className="crumbs">
        <Link to="/">首页</Link>
        <span aria-hidden> › </span>
        <Link to="/plugins">插件广场</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">{pageMeta("/packs").h1}</span>
      </nav>
      <PageHero
        kind="hero"
        title={pageMeta("/packs").h1}
        lead="不必一口气装十几个互相重叠的插件。按当前所处科研阶段，只挑解决当下核心环节的活跃适配插件。"
      >
        <Link to="/guides/zotero-plugins-by-stage" className="inline-link hero-link">阅读分阶段搭配思路</Link>
        <span className="hero-sep"> · </span>
        <Link to="/guides/zotero-plugins-safety-guide" className="inline-link hero-link">安装前安全自查</Link>
      </PageHero>
      <div className="pack-cards-grid">
        {STAGE_PACKS.map((pack) => (
          <Link key={pack.key} to={packPath(pack.key)} className="card pack-card">
            <span className="pack-audience">{pack.audience}</span>
            <h2>{pack.label}</h2>
            <p>{pack.subtitle}</p>
            <div className="pack-slot-tags">
              {pack.slots.map((s) => <span key={s.topicKey} className="tag">{packTopicLabel(s.topicKey)}</span>)}
            </div>
            <span className="more">查看 {pack.slots.length} 个核心环节组合 →</span>
          </Link>
        ))}
      </div>
      <p className="data-note">{PACK_RULE_NOTE} 详见<Link to="/rules" className="inline-link">收录规则</Link>。</p>
    </section>
  );
}

/** 单个科研阶段的插件组合详情页(/packs/:key)。 */
export function PackDetail() {
  const key = /^\/packs\/([a-z0-9-]+)/.exec(currentPath())?.[1] ?? "";
  const pack = packOf(key);
  const loaded = usePluginData();
  const now = useNow();
  const all = loaded.state === "ready" ? loaded.data.plugins : [];
  const meta = useMemo(() => packMeta(key), [key]);
  const guides = useMemo(
    () => (pack ? pack.guideSlugs.map((s) => articleBySlug(s)).filter((a): a is NonNullable<typeof a> => Boolean(a)) : []),
    [pack],
  );
  const others = useMemo(() => STAGE_PACKS.filter((p) => p.key !== key), [key]);

  useEffect(() => {
    if (meta) applyMeta(meta);
  }, [meta]);

  if (!pack || !meta) return null;
  return (
    <section className="section">
      <nav aria-label="面包屑" className="crumbs">
        <Link to="/">首页</Link>
        <span aria-hidden> › </span>
        <Link to="/packs">按科研阶段配插件</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">{pack.label}</span>
      </nav>
      <PageHero kind="hero" title={meta.h1} lead={pack.subtitle}>
        <Link to="/packs" className="inline-link hero-link">← 查看全部阶段</Link>
        <span className="hero-sep"> · </span>
        <Link to="/guides/zotero-plugins-safety-guide" className="inline-link hero-link">安装前安全核查</Link>
      </PageHero>

      <div className="pack-tips card">
        <h2>本阶段少踩坑建议</h2>
        <ul className="compact-list">
          {pack.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>

      {loaded.state === "loading" && <p className="empty" role="status">正在加载插件目录…</p>}
      {loaded.state === "error" && <div className="empty" role="alert">加载失败。<button className="linklike" onClick={loaded.retry}>重试</button></div>}
      {loaded.state === "ready" && (
        <>
          <p className="result-count">{PACK_RULE_NOTE}</p>
          {pack.slots.map((slot, idx) => {
            const picked = selectSlotPlugins(all, slot.topicKey, slot.limit, now);
            return (
              <section key={slot.topicKey} className="pack-slot">
                <div className="section-head">
                  <h2>{idx + 1}. {slot.task}</h2>
                  <Link to={topicPath(slot.topicKey)} className="more">查看全部{packTopicLabel(slot.topicKey)}插件 →</Link>
                </div>
                <p className="meta pack-slot-why">{slot.why}</p>
                {picked.length > 0 ? (
                  <div className="grid plugin-grid">
                    {picked.map((p) => <PluginCard key={p.id} p={p} now={now} zv={10} />)}
                  </div>
                ) : (
                  <p className="empty">该环节当前暂无满足条件的候选插件，可前往专题页查看全部条目。</p>
                )}
              </section>
            );
          })}
        </>
      )}

      {guides.length > 0 && (
        <>
          <h2>本阶段推荐阅读教程</h2>
          <ul>
            {guides.map((g) => <li key={g.slug}><Link to={articlePath(g.slug)} className="inline-link">{g.title}</Link></li>)}
          </ul>
        </>
      )}

      <h2>切换其他科研阶段</h2>
      <nav className="chips" aria-label="其他科研阶段">
        {others.map((o) => <Link key={o.key} to={packPath(o.key)} className="chip">{o.label}</Link>)}
      </nav>
      <p className="data-note">本页清单由公开目录数据按同一套客观规则自动生成，不代表对安全性或质量的背书，详见<Link to="/rules" className="inline-link">收录规则</Link>。</p>
    </section>
  );
}
