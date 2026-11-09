import { test } from "node:test";
import assert from "node:assert/strict";
import { cadence, mergeDownloads, pushHistory, sumXpiDownloads } from "./refresh-plugins.mjs";

test("下载次数:只累加 .xpi 安装包,忽略其它资源与缺失字段", () => {
  const rel = [
    { releaseAssets: { nodes: [{ name: "a-1.0.xpi", downloadCount: 10 }, { name: "source.zip", downloadCount: 999 }] } },
    { releaseAssets: { nodes: [{ name: "A-0.9.XPI", downloadCount: 5 }, { name: "b.xpi" }] } },
    { releaseAssets: null },
    {},
  ];
  assert.equal(sumXpiDownloads(rel), 15);
  assert.equal(sumXpiDownloads([]), 0);
});

test("下载基线:首次只记当前值;隔天记上次值用来算今日新增;同一天重复运行不覆盖基线", () => {
  assert.deepEqual(mergeDownloads(undefined, 100, "2026-11-10"), { total: 100, at: "2026-11-10" });
  const d1 = mergeDownloads({ total: 100, at: "2026-11-10" }, 130, "2026-11-11");
  assert.deepEqual(d1, { total: 130, at: "2026-11-11", prevTotal: 100, prevAt: "2026-11-10" });
  assert.deepEqual(mergeDownloads(d1, 135, "2026-11-11"), { total: 135, at: "2026-11-11", prevTotal: 100, prevAt: "2026-11-10" });
});

test("更新节奏:近一年次数、每月次数、间隔中位数", () => {
  const now = Date.parse("2026-11-10");
  const c = cadence(["2026-11-05", "2026-10-20", "2026-09-01", "2025-12-01", "2025-01-01"], now);
  assert.equal(c.r12, 4);
  assert.equal(c.days12, 4);
  // 同一天发多次:次数照记,天数只算一天
  const same = cadence(["2026-11-05T01:00:00Z", "2026-11-05T09:00:00Z", "2026-11-05T20:00:00Z"], now);
  assert.deepEqual([same.r12, same.days12], [3, 1]);
  assert.deepEqual(c.monthly, [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2]);
  assert.equal(c.last, "2026-11-05");
  assert.equal(cadence([], now), null);
});

test("空值安全:列表里的空项不会让统计崩溃", () => {
  assert.equal(sumXpiDownloads([null, { releaseAssets: { nodes: [null, { name: "a.xpi", downloadCount: 7 }] } }, undefined]), 7);
});

test("历史快照:同一天覆盖、按日期排序、只留最近 N 天", () => {
  let h = pushHistory(undefined, "2026-11-10", 100, 500);
  h = pushHistory(h, "2026-11-11", 110, 520);
  h = pushHistory(h, "2026-11-11", 111, 530);
  assert.deepEqual(h, [["2026-11-10", 100, 500], ["2026-11-11", 111, 530]]);
  const many = Array.from({ length: 40 }, (_, i) => ["2026-10-" + String(i + 1).padStart(2, "0"), i, i]);
  assert.equal(pushHistory(many, "2026-12-01", 1, 1).length, 35);
});
