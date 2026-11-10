// 下架记录:提交在仓库里的下架台账(从哪天起下架)与 /delisted 页面展示的数据。纯函数,不读写文件。
// 是否下架由 lifecycle.ts 判断;这里只负责记录与展示,不做任何判断。
import { DELIST_REASONS, type DelistReason, type DelistedPlugin } from "./lifecycle.ts";

/** 下架台账(提交在仓库里的 src/data/delisted.json):每个下架插件从哪天起下架、当前原因。 */
export type DelistedLedger = Record<string, { since: string; reason: DelistReason }>;

/**
 * 按本次判断结果更新下架台账。纯函数,不读写文件。
 * 仍在下架的沿用旧的下架日期(原因按本次判断更新);新下架的用 today;已恢复上架的从台账删除。
 */
export function updateDelistedLedger(old: DelistedLedger | null | undefined, delisted: DelistedPlugin[], today: string): DelistedLedger {
  const next: DelistedLedger = {};
  for (const d of delisted) {
    const prev = old?.[d.plugin.id];
    next[d.plugin.id] = { since: prev && /^\d{4}-\d{2}-\d{2}$/.test(prev.since) ? prev.since : today, reason: d.reason };
  }
  return next;
}

/** 下架记录页展示的一条:只含公开事实,不含下载地址。 */
export interface DelistedRecord {
  id: string;
  name: string;
  author: string;
  homepage: string;
  lastRelease: string | null;
  reason: DelistReason;
  reasonText: string;
  archived: boolean;
  since: string;
}

/** 下架记录页与收录规则页用的数据:在架数、判断时采用的当前 Zotero 大版本、下架记录(按原因分组的顺序,组内按名称)。 */
export interface DelistedData {
  listed: number;
  current: number | null;
  records: DelistedRecord[];
}

const REASON_ORDER = Object.keys(DELIST_REASONS) as DelistReason[];

export function delistedRecords(delisted: DelistedPlugin[], ledger: DelistedLedger, today: string): DelistedRecord[] {
  const key = (r: DelistedRecord) => r.name.toLowerCase();
  return delisted
    .map((d): DelistedRecord => ({
      id: d.plugin.id,
      name: d.plugin.name,
      author: d.plugin.author || d.plugin.id.split("/")[0],
      homepage: d.plugin.homepage,
      lastRelease: d.facts.lastRelease,
      reason: d.reason,
      reasonText: d.reasonText,
      archived: d.facts.archived,
      since: ledger[d.plugin.id]?.since ?? today,
    }))
    // 只比较字符编码,保证构建时与浏览器里顺序完全一致
    .sort((a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 下架台账写成文件时的格式:按 id 排序、每行一条,便于在提交记录里看清变化。 */
export function delistedLedgerJson(ledger: DelistedLedger): string {
  const keys = Object.keys(ledger).sort();
  if (keys.length === 0) return "{}\n";
  return `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(ledger[k])}`).join(",\n")}\n}\n`;
}
