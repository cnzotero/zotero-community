// 期刊查询的纯逻辑:接口数据类型、指标格式化、标签生成。不碰 DOM 与网络。

export interface JournalRecord {
  key: string;
  name: string;
  issn: string;
  eissn: string;
  categories: string[];
  jcr: {
    quartile: string | null;
    rank: string | null;
    impactFactor: number | null;
    fiveYearImpactFactor: number | null;
    jci: number | null;
    scie: boolean;
    ssci: boolean;
  } | null;
  cas: { zone: number | null; top: boolean; basicZone: number | null; basicTop: boolean } | null;
  lists: {
    ei: boolean;
    ccf: string | null;
    ajg: { rating: string; ft50: boolean } | null;
    ft50: boolean;
    utd24: boolean;
    chinese: { type: string; detail: string }[];
  };
  abbreviations: string[];
}

export interface SearchResponse {
  dataVersion: string;
  query: string;
  results: JournalRecord[];
}

export const MIN_QUERY = 2;

export function queryOk(q: string): boolean {
  return q.trim().length >= MIN_QUERY;
}

/** 缺失值显示「暂无」,不推算、不编造。 */
export function metric(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "暂无";
  return n.toFixed(digits);
}

export function casLabel(zone: number | null | undefined): string {
  return zone === null || zone === undefined ? "暂无" : `${zone} 区`;
}

export function formatIssn(r: Pick<JournalRecord, "issn" | "eissn">): string {
  const parts: string[] = [];
  if (r.issn) parts.push(`ISSN ${r.issn}`);
  if (r.eissn) parts.push(`eISSN ${r.eissn}`);
  return parts.join(" · ");
}

const CHINESE_LABEL: Record<string, string> = { 北核: "北大核心", CSSCI: "CSSCI", CSCD: "CSCD" };

export function chineseLabel(i: { type: string; detail: string }): string {
  const base = CHINESE_LABEL[i.type] ?? i.type;
  return i.type === "CSSCI" && i.detail ? `CSSCI(${i.detail})` : base;
}

export interface Badge {
  kind: "index" | "zone" | "list";
  text: string;
}

/** 列表里每本期刊的摘要标签:收录 / 分区 / 榜单。 */
export function summaryBadges(r: JournalRecord): Badge[] {
  const out: Badge[] = [];
  if (r.jcr?.scie) out.push({ kind: "index", text: "SCIE" });
  if (r.jcr?.ssci) out.push({ kind: "index", text: "SSCI" });
  if (r.jcr?.quartile) out.push({ kind: "zone", text: `JCR ${r.jcr.quartile}` });
  if (r.cas?.zone != null) out.push({ kind: "zone", text: `中科院${r.cas.zone}区${r.cas.top ? " Top" : ""}` });
  if (r.lists.ei) out.push({ kind: "index", text: "EI" });
  if (r.lists.ccf) out.push({ kind: "list", text: `CCF-${r.lists.ccf}` });
  if (r.lists.ajg) out.push({ kind: "list", text: `AJG ${r.lists.ajg.rating}` });
  if (r.lists.ft50) out.push({ kind: "list", text: "FT50" });
  if (r.lists.utd24) out.push({ kind: "list", text: "UTD24" });
  for (const c of r.lists.chinese) out.push({ kind: "list", text: chineseLabel(c) });
  return out;
}

/** 「v2026.8」→「2026.8」 */
export function versionLabel(v: string): string {
  return v.replace(/^v/i, "");
}

export function hasAnyData(r: JournalRecord): boolean {
  return summaryBadges(r).length > 0 || r.jcr !== null || r.cas !== null;
}
