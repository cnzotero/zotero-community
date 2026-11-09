import { test } from "node:test";
import assert from "node:assert/strict";
import { casLabel, chineseLabel, formatIssn, metric, queryOk, summaryBadges, versionLabel, type JournalRecord } from "./lib.ts";

const base: JournalRecord = {
  key: "x", name: "X", issn: "", eissn: "", categories: [], jcr: null, cas: null,
  lists: { ei: false, ccf: null, ajg: null, ft50: false, utd24: false, chinese: [] }, abbreviations: [],
};

test("缺失指标显示「暂无」,不推算", () => {
  assert.equal(metric(null), "暂无");
  assert.equal(metric(undefined), "暂无");
  assert.equal(metric(Number.NaN), "暂无");
  assert.equal(metric(56.1), "56.1");
  assert.equal(metric(0.44, 2), "0.44");
  assert.equal(metric(0), "0.0"); // 0 是有效值
  assert.equal(casLabel(null), "暂无");
  assert.equal(casLabel(2), "2 区");
});

test("ISSN 展示", () => {
  assert.equal(formatIssn({ issn: "0028-0836", eissn: "1476-4687" }), "ISSN 0028-0836 · eISSN 1476-4687");
  assert.equal(formatIssn({ issn: "", eissn: "1476-4687" }), "eISSN 1476-4687");
  assert.equal(formatIssn({ issn: "", eissn: "" }), "");
});

test("中文榜单标签", () => {
  assert.equal(chineseLabel({ type: "北核", detail: "北核" }), "北大核心");
  assert.equal(chineseLabel({ type: "CSSCI", detail: "南核" }), "CSSCI(南核)");
  assert.equal(chineseLabel({ type: "CSCD", detail: "CSCD核心" }), "CSCD");
});

test("摘要标签:有什么显示什么,没有就为空", () => {
  assert.deepEqual(summaryBadges(base), []);
  const r: JournalRecord = {
    ...base,
    jcr: { quartile: "Q1", rank: "1/134", impactFactor: 56.1, fiveYearImpactFactor: null, jci: null, scie: true, ssci: false },
    cas: { zone: 1, top: true, basicZone: 1, basicTop: false },
    lists: { ei: true, ccf: "A", ajg: { rating: "4*", ft50: true }, ft50: true, utd24: true, chinese: [{ type: "北核", detail: "北核" }] },
  };
  assert.deepEqual(summaryBadges(r).map((b) => b.text), ["SCIE", "JCR Q1", "中科院1区 Top", "EI", "CCF-A", "AJG 4*", "FT50", "UTD24", "北大核心"]);
});

test("查询长度与版本号显示", () => {
  assert.equal(queryOk("n"), false);
  assert.equal(queryOk(" n "), false);
  assert.equal(queryOk("nat"), true);
  assert.equal(queryOk("中国"), true);
  assert.equal(versionLabel("v2026.8"), "2026.8");
});
