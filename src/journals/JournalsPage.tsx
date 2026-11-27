import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { pageMeta } from "../seo/pages.ts";
import { JOURNALS_FAQS } from "../seo/faqs.ts";
import { currentSearch } from "../ssr.ts";
import featuredData from "./featured-journals.json" with { type: "json" };
import {
  casLabel, chineseLabel, formatIssn, hasAnyData, metric, queryOk, summaryBadges, versionLabel,
  type JournalRecord, type SearchResponse,
} from "./lib.ts";

interface FeaturedEntry {
  group: string;
  record: JournalRecord;
}

const FEATURED_VERSION = (featuredData as { dataVersion: string }).dataVersion;
const FEATURED_ITEMS = (featuredData as unknown as { items: FeaturedEntry[] }).items;
const FEATURED_GROUPS = ["全部", ...Array.from(new Set(FEATURED_ITEMS.map((x) => x.group)))];

const EXAMPLES = ["Nature", "中国社会科学", "0028-0836", "Management Science"];

type State =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "error" }
  | { s: "ok"; data: SearchResponse };

function Badges({ r }: { r: JournalRecord }) {
  const list = summaryBadges(r);
  if (list.length === 0) return <span className="meta">暂无榜单数据</span>;
  return (
    <div className="plugin-badges">
      {list.map((b, i) => <span key={i} className={`jbadge jbadge-${b.kind}`}>{b.text}</span>)}
    </div>
  );
}

function Detail({ r, version }: { r: JournalRecord; version: string }) {
  const j = r.jcr;
  return (
    <section className="jdetail" aria-label={`${r.name} 详情`}>
      <h2 className="jname">{r.name}</h2>
      <p className="meta">{formatIssn(r) || "ISSN 暂无"}</p>
      <dl className="facts">
        <div><dt>影响因子</dt><dd>{metric(j?.impactFactor)}</dd></div>
        <div><dt>五年影响因子</dt><dd>{metric(j?.fiveYearImpactFactor)}</dd></div>
        <div><dt>JCI</dt><dd>{metric(j?.jci, 2)}</dd></div>
        <div><dt>JCR 分区</dt><dd>{j?.quartile ?? "暂无"}{j?.rank ? `(学科排名 ${j.rank})` : ""}</dd></div>
        <div><dt>中科院分区(升级版)</dt><dd>{casLabel(r.cas?.zone)}{r.cas?.top ? " · Top 期刊" : ""}</dd></div>
        <div><dt>中科院分区(基础版)</dt><dd>{casLabel(r.cas?.basicZone)}{r.cas?.basicTop ? " · Top 期刊" : ""}</dd></div>
      </dl>
      <h3>收录与榜单</h3>
      <Badges r={r} />
      {r.lists.chinese.length > 0 && (
        <p className="meta">中文期刊榜单:{r.lists.chinese.map(chineseLabel).join("、")}</p>
      )}
      {r.categories.length > 0 && (
        <>
          <h3>学科类别</h3>
          <p className="meta">{r.categories.join(" · ")}</p>
        </>
      )}
      {r.abbreviations.length > 0 && <p className="meta">常见缩写:{r.abbreviations.join("、")}</p>}
      {!hasAnyData(r) && <p className="empty">这本期刊在当前数据里没有可展示的指标。</p>}
      <p className="data-note">数据版本 {versionLabel(version)}。数据仅供参考,以发布机构和期刊官网为准;投稿前请自行核对。</p>
    </section>
  );
}

export function JournalsPage() {
  const initial = new URLSearchParams(currentSearch());
  const [q, setQ] = useState(initial.get("q") ?? "");
  const [sel, setSel] = useState<string | null>(initial.get("k"));
  const [group, setGroup] = useState<string>("全部");
  const [state, setState] = useState<State>({ s: "idle" });
  const seq = useRef(0);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (sel) sp.set("k", sel);
    history.replaceState(null, "", "/journals" + (sp.toString() ? `?${sp}` : ""));
  }, [q, sel]);

  useEffect(() => {
    if (!queryOk(q)) {
      setState({ s: "idle" });
      return;
    }
    const id = ++seq.current;
    const ctl = new AbortController();
    setState({ s: "loading" });
    const t = setTimeout(() => {
      fetch(`/api/journals/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<SearchResponse>) : Promise.reject(new Error(String(r.status)))))
        .then((data) => id === seq.current && setState({ s: "ok", data }))
        .catch((e) => {
          if (e?.name !== "AbortError" && id === seq.current) setState({ s: "error" });
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const featuredList = useMemo(
    () => (group === "全部" ? FEATURED_ITEMS : FEATURED_ITEMS.filter((x) => x.group === group)).map((x) => x.record),
    [group],
  );
  const results = state.s === "ok" ? state.data.results : [];
  const activeList = state.s === "idle" ? featuredList : results;
  const activeVersion = state.s === "ok" ? state.data.dataVersion : FEATURED_VERSION;
  const selected = activeList.find((r) => r.key === sel) ?? activeList[0] ?? null;

  return (
    <section className="section">
      <PageHero kind="hero-journals" title={pageMeta("/journals").h1} lead="直接浏览各学科高频代表期刊，或输入期刊名称、缩写与 ISSN 实时查询全库收录、分区与影响因子。">
        <Link to="/rules" className="inline-link hero-link">数据与使用规则</Link>
        <span className="hero-sep"> · </span>
        <Link to="/submission" className="inline-link hero-link">投稿选刊建议</Link>
      </PageHero>
      <input
        className="search"
        type="search"
        value={q}
        placeholder="搜索全库期刊：输入期刊全称、缩写或 ISSN，例如 Nature、中国社会科学、0028-0836"
        aria-label="搜索期刊"
        onChange={(e) => { setQ(e.target.value); setSel(null); }}
      />
      <div className="chips" role="group" aria-label="快捷搜索示例">
        {EXAMPLES.map((x) => <button key={x} className="chip chip-sm" onClick={() => { setQ(x); setSel(null); }}>{x}</button>)}
      </div>

      {state.s === "idle" && (
        <>
          <div className="featured-head">
            <div>
              <h2>高频代表期刊速览</h2>
              <p className="meta">输入至少 2 个字符开始查询全库期刊；下方默认列出各学科代表期刊（数据版本 {versionLabel(FEATURED_VERSION)}），点击左侧期刊直接查看完整指标。</p>
            </div>
            <div className="chips featured-groups" role="group" aria-label="按学科筛选代表期刊">
              {FEATURED_GROUPS.map((g) => (
                <button key={g} className={group === g ? "chip chip-sm on" : "chip chip-sm"} onClick={() => { setGroup(g); setSel(null); }}>{g}</button>
              ))}
            </div>
          </div>
          {featuredList.length > 0 && (
            <div className="jlayout">
              <ul className="jlist" aria-label="代表期刊列表">
                {featuredList.map((r) => (
                  <li key={r.key}>
                    <button className={selected?.key === r.key ? "jitem on" : "jitem"} aria-pressed={selected?.key === r.key} onClick={() => setSel(r.key)}>
                      <span className="jitem-name">{r.name}</span>
                      <span className="meta">
                        {r.jcr?.impactFactor != null ? `IF ${metric(r.jcr.impactFactor)} · ` : ""}
                        {formatIssn(r) || "ISSN 暂无"}
                      </span>
                      <Badges r={r} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="jpane">
                {selected ? <Detail r={selected} version={activeVersion} /> : <p className="empty">点一本期刊查看详情。</p>}
              </div>
            </div>
          )}
        </>
      )}
      {state.s === "loading" && <p className="empty" role="status">查询中…</p>}
      {state.s === "error" && <p className="empty" role="alert">查询失败,请稍后重试。</p>}
      {state.s === "ok" && results.length === 0 && (
        <div className="empty empty-state">没有找到「{q.trim()}」。可以试试期刊全称、常见缩写或 ISSN。</div>
      )}
      {state.s === "ok" && results.length > 0 && (
        <div className="jlayout">
          <ul className="jlist" aria-label="查询结果">
            {results.map((r) => (
              <li key={r.key}>
                <button className={selected?.key === r.key ? "jitem on" : "jitem"} aria-pressed={selected?.key === r.key} onClick={() => setSel(r.key)}>
                  <span className="jitem-name">{r.name}</span>
                  <span className="meta">
                    {r.jcr?.impactFactor != null ? `IF ${metric(r.jcr.impactFactor)} · ` : ""}
                    {formatIssn(r) || "ISSN 暂无"}
                  </span>
                  <Badges r={r} />
                </button>
              </li>
            ))}
          </ul>
          <div className="jpane">
            {selected ? <Detail r={selected} version={activeVersion} /> : <p className="empty">点一本期刊查看详情。</p>}
          </div>
        </div>
      )}
      <section className="section journals-extra" aria-labelledby="journals-guide-title">
        <h2 id="journals-guide-title">支持查询的指标与榜单</h2>
        <div className="info-grid">
          <div className="card info-card">
            <h3>国际引文与分区指标</h3>
            <p>影响因子（IF）、五年影响因子、JCI、JCR 分区与学科排名、中科院分区（升级版与基础版及 Top 标识）、SCIE / SSCI / EI 收录情况。</p>
          </div>
          <div className="card info-card">
            <h3>学科与中文核心榜单</h3>
            <p>覆盖 CCF 推荐目录、AJG、FT50、UTD24，以及北大核心、CSSCI、CSCD 等常见中文核心收录标识，缺失项直接标为「暂无」。</p>
          </div>
          <div className="card info-card">
            <h3>在 Zotero 列表里直接看分区</h3>
            <p>
              想在 Zotero 文献列表直接显示期刊分区列？可查阅{" "}
              <Link to="/guides/zotero-journal-ranking-column" className="inline-link">Zotero 文献列表显示期刊分区指南</Link>
              ，或前往{" "}
              <Link to="/topics/journal" className="inline-link">期刊分区与影响因子插件专题</Link>。
            </p>
          </div>
        </div>
        <h2 className="faq-heading">常见问题</h2>
        <div className="faq-list">
          {JOURNALS_FAQS.map((item, idx) => (
            <details key={item.q} className="faq-item" open={idx === 0}>
              <summary className="faq-q">{item.q}</summary>
              <p className="faq-a">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <p className="data-note">
        每次最多显示 20 条结果。指标均来自同一数据版本,没有数据的项显示「暂无」,不推算、不编造。详见<Link to="/rules" className="inline-link">使用规则</Link>。
      </p>
    </section>
  );
}
