import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plugin } from "./lib.ts";
import { splitCatalog } from "./lifecycle.ts";
import { delistedLedgerJson, delistedRecords, updateDelistedLedger } from "./delisted.ts";

const xpi = (id: string) => [{ t: 10, v: "1.0", u: `https://github.com/${id}/releases/download/v1/a.xpi`, min: "7", max: "10.*" }];
function mk(id: string, date: string | null, majors: number[] | null, o: Partial<Plugin> = {}): Plugin {
  return {
    id, name: id.split("/")[1], summary: "", category: "utility", author: id.split("/")[0], homepage: `https://github.com/${id}`, stars: 0, updated: date ?? "",
    zotero: majors ? { declared: true, majors } : { declared: false, majors: [] },
    ...(date ? { latest: { version: "1.0", date, releaseUrl: `https://github.com/${id}/releases/tag/v1` }, downloads: xpi(id) } : {}),
    ...o,
  };
}
const split = (list: Plugin[], day: string) => splitCatalog(list, new Date(day)).delisted;

test("下架台账:新下架的记当天;仍在下架的沿用旧日期(原因按本次更新);恢复上架的删除", () => {
  const day1 = "2026-11-11";
  const l1 = updateDelistedLedger({}, split([mk("a/old", "2023-01-01", [10]), mk("b/none", null, [10]), mk("c/ok", "2026-11-01", [10])], day1), day1);
  assert.deepEqual(l1, { "a/old": { since: day1, reason: "stale-2y" }, "b/none": { since: day1, reason: "stale-1y-no-package" } });

  // 第二天:a 仍下架(沿用旧日期);b 发了带安装包的新版本(恢复,删除);d 新下架(超过 1 年未发布且没有安装包,记当天)
  const day2 = "2026-11-12";
  const l2 = updateDelistedLedger(l1, split([mk("a/old", "2023-01-01", [10]), mk("b/none", "2026-11-12", [10]), mk("c/ok", "2026-11-01", [10]), mk("d/gone", "2025-06-01", [10], { downloads: [] })], day2), day2);
  assert.deepEqual(l2, { "a/old": { since: day1, reason: "stale-2y" }, "d/gone": { since: day2, reason: "stale-1y-no-package" } });

  // 仍在下架但原因变了:日期沿用,原因更新
  const l3 = updateDelistedLedger(l2, split([mk("a/old", "2023-01-01", [10], { downloads: [] })], "2026-11-13"), "2026-11-13");
  assert.deepEqual(l3, { "a/old": { since: day1, reason: "stale-1y-no-package" } });

  // 台账缺失或日期损坏:按新下架处理
  assert.deepEqual(updateDelistedLedger(null, split([mk("a/old", "2023-01-01", [10])], day1), day1), { "a/old": { since: day1, reason: "stale-2y" } });
  assert.deepEqual(updateDelistedLedger({ "a/old": { since: "坏", reason: "stale-2y" } }, split([mk("a/old", "2023-01-01", [10])], day1), day1), { "a/old": { since: day1, reason: "stale-2y" } });
});

test("台账文件格式:按 id 排序、每行一条;空台账是 {}", () => {
  assert.equal(delistedLedgerJson({}), "{}\n");
  assert.equal(delistedLedgerJson({ "z/z": { since: "2026-11-11", reason: "stale-2y" }, "a/a": { since: "2026-11-10", reason: "stale-1y-no-package" } }), '{\n  "a/a": {"since":"2026-11-10","reason":"stale-1y-no-package"},\n  "z/z": {"since":"2026-11-11","reason":"stale-2y"}\n}\n');
  assert.deepEqual(JSON.parse(delistedLedgerJson({ "a/a": { since: "2026-11-10", reason: "stale-1y-no-package" } })), { "a/a": { since: "2026-11-10", reason: "stale-1y-no-package" } });
});

test("下架记录:只含公开事实、没有下载地址;按原因分组顺序、组内按名称排列;归档作为附注", () => {
  const day = "2026-11-11";
  const d = split([mk("z/zeta", "2023-01-01", [10], { archived: true }), mk("y/beta", null, null), mk("x/alpha", "2023-02-01", [10]), mk("w/gamma", "2025-01-01", [7])], day);
  const recs = delistedRecords(d, { "x/alpha": { since: "2026-10-01", reason: "stale-2y" } }, day);
  assert.deepEqual(recs.map((r) => [r.id, r.reason]), [["y/beta", "stale-1y-no-package"], ["x/alpha", "stale-2y"], ["z/zeta", "stale-2y"], ["w/gamma", "stale-1y-unadapted"]]);
  const alpha = recs.find((r) => r.id === "x/alpha")!;
  assert.equal(alpha.since, "2026-10-01"); // 台账里的日期
  assert.equal(recs.find((r) => r.id === "z/zeta")!.since, day); // 台账没有的用当天
  assert.equal(recs.find((r) => r.id === "z/zeta")!.archived, true);
  assert.equal(alpha.archived, false);
  assert.equal(recs.find((r) => r.id === "y/beta")!.lastRelease, null);
  for (const r of recs) {
    assert.deepEqual(Object.keys(r).sort(), ["archived", "author", "homepage", "id", "lastRelease", "name", "reason", "reasonText", "since"]);
    assert.ok(!JSON.stringify(r).includes(".xpi\""), "记录里不含安装包地址");
  }
});
