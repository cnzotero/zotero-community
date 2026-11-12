import { useEffect, useState } from "react";
import { Link } from "../link.tsx";
import { cachedDelisted, loadDelisted } from "../plugins/data.ts";
import type { DelistedData, DelistedRecord } from "../plugins/delisted.ts";
import { DELIST_REASONS, type DelistReason } from "../plugins/lifecycle.ts";
import { pageMeta } from "../seo/pages.ts";

const REPO = "https://github.com/cnzotero/zotero-community";

/** 下架记录(很小,构建时算好);预渲染时已注入,浏览器接管前也已加载。 */
export function useDelisted(): DelistedData | null {
  const [d, setD] = useState<DelistedData | null>(() => cachedDelisted());
  useEffect(() => {
    if (d) return;
    let alive = true;
    loadDelisted().then((x) => alive && setD(x)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [d]);
  return d;
}

function Row({ r }: { r: DelistedRecord }) {
  return (
    <li className="delisted-item">
      <div className="delisted-head">
        <b>{r.name}</b>
        <span className="meta">作者 {r.author}</span>
        <a href={r.homepage} target="_blank" rel="noopener noreferrer" className="inline-link">{r.id}</a>
      </div>
      <p className="delisted-reason">{r.reasonText}</p>
      <p className="meta">
        最近一次发布:{r.lastRelease ?? "没有发布记录"} · 下架日期:{r.since}
        {r.archived && <> · 仓库已归档</>}
      </p>
    </li>
  );
}

export function DelistedPage() {
  const data = useDelisted();
  const groups = (Object.keys(DELIST_REASONS) as DelistReason[])
    .map((reason) => ({ reason, list: data?.records.filter((r) => r.reason === reason) ?? [] }))
    .filter((g) => g.list.length > 0);
  return (
    <article className="section prose">
      <h1 className="page-title">{pageMeta("/delisted").h1}</h1>
      <p className="lead">插件广场按<Link to="/rules" className="inline-link">收录规则</Link>判断插件是否展示,并记录社区管理作出的下架决定。这里公开列出目前已下架的插件和原因。</p>

      <h2>判断口径</h2>
      <p>满足下面任意一条,插件就会下架:</p>
      <ul>
        <li><b>{DELIST_REASONS["stale-1y-no-package"]}:</b>最近一次发布距今超过 1 年(365 天),或者没有任何发布记录,并且本站在作者的发布页上没有找到可以下载安装的 <code>.xpi</code> 安装包。近 1 年内有发布的插件不会因为这一条下架。</li>
        <li><b>{DELIST_REASONS["stale-2y"]}:</b>最近一次发布距今超过 2 年(730 天)。</li>
        <li><b>{DELIST_REASONS["stale-1y-unadapted"]}:</b>最近一次发布距今超过 1 年(365 天),并且作者没有声明适配版本,或声明适配的最高版本低于当前最新的 Zotero 大版本。</li>
      </ul>
      <p>「距今」按本站每次更新数据、重新生成页面的日期计算。仓库已归档本身不是下架理由,只在下面作为一条事实注明。</p>

      <h2>如何恢复</h2>
      <p>因上述发布与适配条件自动下架的插件,作者发布新版本、不再符合条件后,本站下一次更新数据时会自动恢复上架。社区管理下架的插件需解除相应决定后才会重新判断,不会因发布新版本自动恢复。如果你认为某条判断有误(例如数据没有及时反映最新发布),请在 <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer" className="inline-link">公开仓库的 Issue</a> 里提出,写明插件名称和依据。</p>

      <h2>已下架的插件</h2>
      {data && (
        <p className="result-count">
          {data.records.length > 0 ? <>目前共 {data.records.length} 款插件下架,在架 {data.listed} 款。下载与详情页已不再提供,仓库链接指向作者的项目主页。</> : <>目前没有下架的插件,在架 {data.listed} 款。</>}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.reason}>
          <h3>{DELIST_REASONS[g.reason]}({g.list.length} 款)</h3>
          <ul className="delisted-list">{g.list.map((r) => <Row key={r.id} r={r} />)}</ul>
        </section>
      ))}
      <p className="data-note">数据整理自各项目公开信息;下架日期是本站判断为下架的日期,不代表作者停止维护的日期。</p>
    </article>
  );
}
