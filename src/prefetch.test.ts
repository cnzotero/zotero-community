import { test } from "node:test";
import assert from "node:assert/strict";
import { prefetch, setPrefetchLoader, shouldIdlePrefetch, waitUpTo } from "./prefetch.ts";

test("没有注册加载函数时不预取,点击直接切换", () => {
  setPrefetchLoader(null);
  assert.equal(prefetch("plugins"), null);
});

test("同一页面重复预取只加载一次;加载完成后返回 null", async () => {
  let calls = 0;
  setPrefetchLoader(async () => { calls++; });
  const a = prefetch("plugins");
  const b = prefetch("plugins");
  assert.ok(a && b);
  assert.equal(a, b);
  await a;
  assert.equal(calls, 1);
  assert.equal(prefetch("plugins"), null);
  assert.ok(prefetch("guides"));
});

test("加载失败不抛错、不记为已加载,下次会重试", async () => {
  let calls = 0;
  setPrefetchLoader(async () => { calls++; if (calls === 1) throw new Error("网络错误"); });
  await prefetch("plugins");
  const again = prefetch("plugins");
  assert.ok(again);
  await again;
  assert.equal(calls, 2);
  assert.equal(prefetch("plugins"), null);
});

test("waitUpTo:没超时按完成时间返回,超时也会返回", async () => {
  const t0 = Date.now();
  await waitUpTo(new Promise((r) => setTimeout(r, 10)), 1000);
  assert.ok(Date.now() - t0 < 500);
  const t1 = Date.now();
  await waitUpTo(new Promise(() => {}), 30);
  assert.ok(Date.now() - t1 >= 25);
});

test("数据节省与 2G 网络不做空闲预取", () => {
  assert.equal(shouldIdlePrefetch(undefined), true);
  assert.equal(shouldIdlePrefetch({ saveData: true }), false);
  assert.equal(shouldIdlePrefetch({ effectiveType: "2g" }), false);
  assert.equal(shouldIdlePrefetch({ effectiveType: "slow-2g" }), false);
  assert.equal(shouldIdlePrefetch({ effectiveType: "4g" }), true);
});
