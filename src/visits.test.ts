import assert from "node:assert/strict";
import test from "node:test";
import { formatCount, parseVisitStats } from "./visits.ts";

test("访问量数字:只接受非负整数", () => {
  assert.deepEqual(parseVisitStats({ total: 1234, today: 56, updated: "x" }), { total: 1234, today: 56 });
  assert.equal(parseVisitStats({ total: 0, today: 0 })?.total, 0);
  for (const bad of [null, "x", [], {}, { total: "12", today: 1 }, { total: -1, today: 0 }, { total: 1.5, today: 0 }, { total: 1 }]) {
    assert.equal(parseVisitStats(bad), null);
  }
});

test("访问量数字带千分位", () => {
  assert.equal(formatCount(1234567), "1,234,567");
  assert.equal(formatCount(0), "0");
});
