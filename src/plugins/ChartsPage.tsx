import { useEffect, useMemo, useState } from "react";
import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { cachedHistory, loadHistory } from "./data.ts";
import { usePluginData } from "./PluginsPage.tsx";
import { pageMeta } from "../seo/pages.ts";
import { useNow } from "../ssr.ts";
import { authorTotals, categoryCounts, compatCounts, downloadsPerDay, historyDays, kpis, monthlyTotals, topBy, trending, type History, type RankItem } from "./charts-lib.ts";
import { formatStars, pluginPath, type Plugin } from "./lib.ts";

function Panel({ title, note, children, wide = false }: { title: string; note?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? "cpanel cpanel-wide" : "cpanel"}>
      <h2>{title}</h2>
      {note && <p className="cnote">{note}</p>}
      {children}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{value}</b>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

/** 横向条形榜:条的长度按最大值归一;前三名用满色,其余渐淡。 */
function RankBars({ items, fmt, link = true, empty, neutral = false }: { items: RankItem[]; fmt: (n: number) => string; link?: boolean; empty?: string; neutral?: boolean }) {
  if (items.length === 0) return <p className="empty">{empty ?? "暂无数据"}</p>;
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ol className="rank">
      {items.map((it, i) => (
        <li key={it.id}>
          <span className="rank-no">{i + 1}</span>
          <span className="rank-name">{link ? <Link to={pluginPath(it.id)}>{it.name}</Link> : it.name}</span>
          <span className="rank-track" aria-hidden>
            <span className={neutral ? "rank-fill neutral" : i < 3 ? "rank-fill top" : "rank-fill"} style={{ width: `${Math.max((it.value / max) * 100, 2)}%` }} />
          </span>
          <span className="rank-val">{fmt(it.value)}{it.sub && <small>{it.sub}</small>}</span>
        </li>
      ))}
    </ol>
  );
}

const TINTS = [100, 82, 66, 52, 40, 30, 22, 16, 11, 7];
function Donut({ slices }: { slices: { label: string; count: number }[] }) {
  const total = slices.reduce((s, x) => s + x.count, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={`分类分布:${slices.map((s) => `${s.label} ${s.count}`).join("、")}`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--mist)" strokeWidth="20" />
        {slices.map((s, i) => {
          const len = (s.count / total) * C;
          const el = (
            <circle key={s.label} cx="70" cy="70" r={R} fill="none" strokeWidth="20"
              stroke={`color-mix(in srgb, var(--accent) ${TINTS[Math.min(i, TINTS.length - 1)]}%, var(--paper))`}
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`} strokeDashoffset={-acc}
              transform="rotate(-90 70 70)" />
          );
          acc += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-n">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-l">款插件</text>
      </svg>
      <ul className="legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <i style={{ background: `color-mix(in srgb, var(--accent) ${TINTS[Math.min(i, TINTS.length - 1)]}%, var(--paper))` }} />
            <span>{s.label}</span>
            <b>{s.count}</b>
            <small>{Math.round((s.count / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 近 12 个月面积图:细网格 + 渐变填充 + 末点高亮,直接标注数值。 */
function AreaChart({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 600, H = 190, L = 34, B = 24, T = 14, R = 10;
  const max = Math.max(1, ...values);
  const x = (i: number) => L + (i * (W - L - R)) / (values.length - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="area" role="img" aria-label={`近 12 个月每月发布总次数:${values.join("、")}`}>
      <defs>
        <linearGradient id="areafill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      <path d={area} fill="url(#areafill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (i % 2 === 0 || i === last) && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="axis">{labels[i]}</text>)}
      <circle cx={x(last)} cy={y(values[last])} r="4.5" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2" />
      <text x={x(last)} y={y(values[last]) - 10} textAnchor="end" className="annot">{values[last]}</text>
    </svg>
  );
}

function useHistory(): History {
  const [h, setH] = useState<History>(() => cachedHistory() ?? {});
  useEffect(() => {
    if (cachedHistory()) return;
    let alive = true;
    loadHistory().then((d) => alive && setH(d)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return h;
}

const nf = (n: number) => n.toLocaleString("zh-CN");
const compact = (n: number) => (n >= 100_000_000 ? `${(n / 100_000_000).toFixed(1)} 亿` : n >= 10_000 ? `${(n / 10_000).toFixed(1)} 万` : nf(n));

export function ChartsPage() {
  const loaded = usePluginData();
  const history = useHistory();
  const now = useNow();
  const list: Plugin[] = loaded.state === "ready" ? loaded.data.plugins : [];
  const k = useMemo(() => kpis(list, now), [list, now]);
  const hDays = useMemo(() => historyDays(history), [history]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${new Date(now.getFullYear(), now.getMonth() - (11 - i), 1).getMonth() + 1}月`), [now]);

  const stars = useMemo(() => topBy(list, (p) => p.stars, 15), [list]);
  const dls = useMemo(() => topBy(list, (p) => p.dl?.total, 15).map((it) => {
    const p = list.find((x) => x.id === it.id)!;
    const d = downloadsPerDay(p);
    return d !== null && d > 0 ? { ...it, sub: `+${nf(Math.round(d))}/天` } : it;
  }), [list]);
  const active = useMemo(() => topBy(list, (p) => p.cadence?.days12, 15), [list]);
  const week = useMemo(() => trending(list, history, 7, now), [list, history, now]);
  const issues = useMemo(() => topBy(list, (p) => p.issues, 10), [list]);
  const authors = useMemo(() => authorTotals(list, 10), [list]);


  return (
    <section className="section charts">
      <PageHero kind="hero" title={pageMeta("/plugins/charts").h1} lead="星标、下载、更新节奏、适配版本的公开数据榜单,每天自动更新。">
        <Link to="/plugins" className="inline-link hero-link">← 返回插件广场</Link>
      </PageHero>
      {loaded.state === "loading" && <p className="empty" role="status">正在加载数据…</p>}
      {loaded.state === "error" && <div className="empty" role="alert">数据加载失败。<button className="linklike" onClick={loaded.retry}>重试</button></div>}
      {loaded.state === "ready" && (
        <>
          <div className="kpis">
            <Kpi label="收录插件" value={nf(k.plugins)} hint={`近 30 天有更新 ${k.updated30} 款`} />
            <Kpi label="累计星标" value={compact(k.stars)} hint="GitHub" />
            <Kpi label="累计下载" value={compact(k.downloads)} hint="GitHub 发布页安装包" />
            <Kpi label="近一年发布" value={compact(k.releases12m)} hint="次(按各项目发布记录)" />
          </div>
          <div className="cgrid">
            <Panel title="星标榜" note="按 GitHub 星标数排名。">
              <RankBars items={stars} fmt={formatStars} />
            </Panel>
            <Panel title="下载榜" note="累计下载只统计 GitHub 发布页里的安装包,不含其他下载渠道;每天新增来自相邻两天的差值。">
              <RankBars items={dls} fmt={compact} />
            </Panel>
            <Panel title="本周新增星标" note="最近 7 天新增星标最多的插件,由每天保存的快照算出。">
              {hDays >= 7 ? (
                <RankBars items={week} fmt={(n) => `+${nf(n)}`} empty="这 7 天没有明显增长的插件。" />
              ) : (
                <p className="empty">数据每天自动更新、历史正在积累:已记录 {hDays} 天,满 7 天后显示。</p>
              )}
            </Panel>
            <Panel title="更新最勤" note="按近一年「有发布的天数」排名,同一天发多次只算一天,避免个别项目因频繁小版本占据榜首。">
              <RankBars items={active} fmt={(n) => `${n} 天`} />
            </Panel>
            <Panel title="分类分布" note="按各分类下的插件数量排序。分类之间没有高低之分。">
              <RankBars items={categoryCounts(list).map((c) => ({ id: c.key, name: c.label, value: c.count }))} fmt={nf} link={false} neutral />
            </Panel>
            <Panel title="Zotero 版本适配" note="按作者声明的兼容范围统计;未声明不等于不兼容。">
              <RankBars items={compatCounts(list).map((c) => ({ id: c.label, name: c.label, value: c.count }))} fmt={nf} link={false} />
            </Panel>
            <Panel title="每月发布总量" note="全部插件每月发布次数之和(同一插件每月最多计 31 次)。" wide>
              <AreaChart values={monthlyTotals(list)} labels={months} />
            </Panel>
            <Panel title="作者榜" note="按作者名下收录插件的星标总数。">
              <RankBars items={authors} fmt={formatStars} link={false} />
            </Panel>
            <Panel title="未关闭的 Issues" note="Issues 多通常与使用的人多有关,不代表质量差。">
              <RankBars items={issues} fmt={nf} />
            </Panel>
          </div>
          <p className="data-note">数据更新于 {loaded.data.generatedAt}。数据整理自各项目 GitHub 公开信息,收录不代表对其安全性或质量的背书;榜单对所有插件使用同一规则,详见<Link to="/rules" className="inline-link">收录规则</Link>。</p>
        </>
      )}
    </section>
  );
}
