import { useEffect, useRef, useState } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { pageMeta } from "../seo/pages.ts";
import { currentSearch } from "../ssr.ts";
import {
  casLabel, chineseLabel, formatIssn, hasAnyData, metric, queryOk, summaryBadges, versionLabel,
  type JournalRecord, type SearchResponse,
} from "./lib.ts";

const EXAMPLES = ["Nature", "中国社会科学", "0028-0836", "management science"];

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

  const results = state.s === "ok" ? state.data.results : [];
  const selected = results.find((r) => r.key === sel) ?? (results.length === 1 ? results[0] : null);

  return (
    <section className="section">
      <PageHero kind="hero-journals" title={pageMeta("/journals").h1} lead="输入期刊名称、缩写或 ISSN,一页看清它的收录、分区与影响力。">
        <Link to="/rules" className="inline-link hero-link">数据与使用规则</Link>
      </PageHero>
      <input
        className="search"
        type="search"
        value={q}
        placeholder="期刊名称、缩写或 ISSN,例如 Nature、中国社会科学、0028-0836"
        aria-label="搜索期刊"
        onChange={(e) => { setQ(e.target.value); setSel(null); }}
      />
      <div className="chips" role="group" aria-label="试试这些">
        {EXAMPLES.map((x) => <button key={x} className="chip chip-sm" onClick={() => { setQ(x); setSel(null); }}>{x}</button>)}
      </div>

      {state.s === "idle" && <p className="empty">输入至少 2 个字符开始查询。</p>}
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
                  <span className="meta">{formatIssn(r) || "ISSN 暂无"}</span>
                  <Badges r={r} />
                </button>
              </li>
            ))}
          </ul>
          <div className="jpane">
            {selected ? <Detail r={selected} version={state.data.dataVersion} /> : <p className="empty">点一本期刊查看详情。</p>}
          </div>
        </div>
      )}
      <p className="data-note">
        每次最多显示 20 条结果。指标均来自同一数据版本,没有数据的项显示「暂无」,不推算、不编造。详见<Link to="/rules" className="inline-link">使用规则</Link>。
      </p>
    </section>
  );
}
