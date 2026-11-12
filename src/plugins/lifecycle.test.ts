import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Plugin } from "./lib.ts";
import {
  DELIST_REASONS, ZOTERO_CURRENT_MAJOR, currentZoteroMajor, declaredMaxMajor, evaluatePlugin, hasInstallableRelease, lastReleaseDate, splitCatalog,
} from "./lifecycle.ts";

const NOW = new Date("2026-11-11");
const DAY = 86_400_000;
/** 距 NOW 恰好 n 天的日期 */
const ago = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString().slice(0, 10);

function mk(id: string, days: number | null, majors: number[] | null, o: Partial<Plugin> = {}): Plugin {
  const date = days === null ? "" : ago(days);
  return {
    id, name: id, summary: "", category: "utility", author: id.split("/")[0], homepage: `https://github.com/${id}`, stars: 0, updated: date,
    zotero: majors === null ? { declared: false, majors: [] } : { declared: true, majors },
    ...(days === null ? {} : {
      latest: { version: "1.0.0", date, releaseUrl: `https://github.com/${id}/releases/tag/v1` },
      downloads: [{ t: 10, v: "1.0.0", u: `https://github.com/${id}/releases/download/v1/a.xpi`, min: "7", max: "10.*" }],
    }),
    ...o,
  };
}

const at = (p: Plugin, current = 10) => evaluatePlugin(p, NOW, current);

test("规则 2:最近一次发布 729、730 天在架,731 天下架(超过 2 年)", () => {
  assert.equal(at(mk("a/a", 729, [7, 8, 9, 10])).listed, true);
  assert.equal(at(mk("a/a", 730, [7, 8, 9, 10])).listed, true);
  const v = at(mk("a/a", 731, [7, 8, 9, 10]));
  assert.equal(v.listed, false);
  if (v.listed) return;
  assert.equal(v.reason, "stale-2y");
  assert.equal(v.reasonText, `最近一次发布于 ${ago(731)},距今超过 2 年`);
  assert.equal(v.facts.days, 731);
});

test("规则 3:超过 1 年未发布且未声明适配当前版本才下架;恰好 365 天在架,366 天下架", () => {
  assert.equal(at(mk("a/a", 365, [7, 8, 9])).listed, true);
  const v = at(mk("a/a", 366, [7, 8, 9]));
  assert.equal(v.listed, false);
  if (v.listed) return;
  assert.equal(v.reason, "stale-1y-unadapted");
  assert.equal(v.reasonText, `最近一次发布于 ${ago(366)},距今超过 1 年;声明适配的最高版本是 Zotero 9,不含当前的 Zotero 10`);
  assert.equal(v.facts.declaredMax, 9);
  assert.equal(v.facts.currentMajor, 10);
  // 声明适配了当前版本:1–2 年未发布也在架
  assert.equal(at(mk("a/a", 366, [10])).listed, true);
  assert.equal(at(mk("a/a", 730, [7, 8, 9, 10])).listed, true);
  // 1 年内发布的:适配声明没跟上也在架(维护状态标签只是提示)
  assert.equal(at(mk("a/a", 200, [7])).listed, true);
  assert.equal(at(mk("a/a", 200, null)).listed, true);
});

test("规则 3:未声明适配范围、或声明了但没有版本,都算「未声明适配当前版本」", () => {
  for (const p of [mk("a/a", 400, null), mk("b/b", 400, [])]) {
    const v = at(p);
    assert.equal(v.listed, false, p.id);
    if (v.listed) continue;
    assert.equal(v.reason, "stale-1y-unadapted");
    assert.equal(v.reasonText, `最近一次发布于 ${ago(400)},距今超过 1 年,且没有声明适配的 Zotero 版本`);
    assert.equal(v.facts.declaredMax, null);
  }
  assert.equal(declaredMaxMajor(mk("b/b", 1, [])), null);
  assert.equal(declaredMaxMajor(mk("b/b", 1, [8, 7])), 8);
});

test("规则 1:超过 1 年未发布(或没有任何发布记录)且没有可下载的 .xpi 安装包,下架;规则 1 先于其它规则", () => {
  const none = at(mk("a/a", null, [10]));
  assert.equal(none.listed, false);
  if (!none.listed) {
    assert.equal(none.reason, "stale-1y-no-package");
    assert.equal(none.reasonText, "没有发布记录,本站也没有找到可下载的 .xpi 安装包");
    assert.equal(none.facts.lastRelease, null);
  }
  // 365 天在架,366 天下架(声明了适配当前版本,所以只可能是规则 1)
  assert.equal(at(mk("b/b", 365, [10], { downloads: [] })).listed, true);
  const empty = at(mk("b/b", 366, [10], { downloads: [] }));
  assert.equal(empty.listed, false);
  if (!empty.listed) {
    assert.equal(empty.reason, "stale-1y-no-package");
    assert.equal(empty.reasonText, `最近一次发布于 ${ago(366)},距今超过 1 年,且本站没有找到可下载的 .xpi 安装包`);
  }
  // 下载地址不是 github.com / gitee.com 上的 .xpi:不算可安装
  assert.equal(hasInstallableRelease(mk("c/c", 10, [10], { downloads: [{ t: 10, v: "1", u: "https://example.com/a.xpi" }] })), false);
  assert.equal(hasInstallableRelease(mk("c/c", 10, [10], { downloads: [{ t: 10, v: "1", u: "https://github.com/c/c/releases/download/v1/a.zip" }] })), false);
  // 同时超过 2 年:原因仍是规则 1
  const both = at(mk("d/d", 900, [7], { downloads: [] }));
  assert.equal(!both.listed && both.reason, "stale-1y-no-package");
});

test("规则 1 不误伤:最近 365 天内有发布,但数据里缺最新版本与安装包地址(未声明适配范围),仍在架", () => {
  // 只有发布记录(数据管线还没填 latest / downloads / 适配范围)
  const recent = mk("e/e", null, null, { updated: ago(15), cadence: { r12: 1, days12: 1, monthly: [], medianDays: null, last: ago(15) } });
  assert.equal(hasInstallableRelease(recent), false);
  assert.equal(lastReleaseDate(recent), ago(15));
  assert.equal(at(recent).listed, true);
  assert.equal(at({ ...recent, cadence: { ...recent.cadence!, last: ago(365) } }).listed, true);
  // 同一个插件超过 1 年没有新发布:下架
  const later = at({ ...recent, cadence: { ...recent.cadence!, last: ago(366) } });
  assert.equal(!later.listed && later.reason, "stale-1y-no-package");
  // 有最新版本但安装包地址为空、近期发布:在架
  assert.equal(at(mk("f/f", 30, [10], { downloads: [] })).listed, true);
});

test("最近一次发布日期:取最新版本日期与发布记录里最近一次正式发布中较晚的一个", () => {
  const p = mk("a/a", 800, [7], { cadence: { r12: 1, monthly: [], medianDays: null, last: ago(100) } });
  assert.equal(lastReleaseDate(p), ago(100));
  assert.equal(at(p).listed, true); // 发布记录里有更近的正式发布,就按它算
  assert.equal(lastReleaseDate(mk("a/a", null, null)), null);
  assert.equal(lastReleaseDate(mk("a/a", 5, null, { cadence: { r12: 1, monthly: [], medianDays: null, last: "" } })), ago(5));
});

test("已归档只作事实附注,本身不是下架理由", () => {
  assert.equal(at(mk("a/a", 10, [10], { archived: true })).listed, true);
  const v = at(mk("a/a", 800, [10], { archived: true }));
  assert.equal(!v.listed && v.facts.archived, true);
  assert.ok(!v.listed && !v.reasonText.includes("归档"), "原因里不写归档");
  const w = at(mk("a/a", 800, [10]));
  assert.equal(!w.listed && w.facts.archived, false);
});

test("恢复是自动的:同一个插件在新数据下(作者发布了新版本)重新在架", () => {
  const before = mk("a/a", 900, [7, 8]);
  const s1 = splitCatalog([before, mk("z/z", 1, [10])], NOW);
  assert.deepEqual(s1.delisted.map((d) => d.plugin.id), ["a/a"]);
  const after = mk("a/a", 3, [7, 8, 9, 10]);
  const s2 = splitCatalog([after, mk("z/z", 1, [10])], NOW);
  assert.deepEqual(s2.listed.map((p) => p.id), ["a/a", "z/z"]);
  assert.deepEqual(s2.delisted, []);
  // 判断随构建日期变化:同一份数据,在发布后第 300 天构建时在架
  assert.equal(evaluatePlugin(before, new Date(new Date(before.latest!.date).getTime() + 300 * DAY), 10).listed, true);
});

test("当前 Zotero 大版本:默认取数据集中声明过的最大大版本,不写死", () => {
  assert.equal(ZOTERO_CURRENT_MAJOR, null);
  assert.equal(currentZoteroMajor([mk("a/a", 1, [7, 8]), mk("b/b", 1, [9]), mk("c/c", 1, null)]), 9);
  assert.equal(currentZoteroMajor([mk("c/c", 1, null)]), null);
  // 数据集只声明到 9 时,声明到 9 的插件 1–2 年未发布也在架;声明到 8 的下架
  const s = splitCatalog([mk("a/a", 400, [8]), mk("b/b", 400, [7, 8, 9])], NOW);
  assert.equal(s.currentMajor, 9);
  assert.deepEqual(s.listed.map((p) => p.id), ["b/b"]);
  assert.deepEqual(s.delisted.map((d) => d.plugin.id), ["a/a"]);
  // 下架插件声明过的版本也参与计算:当前版本按全部插件算,而不是只看在架的
  assert.equal(splitCatalog([mk("a/a", 900, [7, 8, 9, 10]), mk("b/b", 1, [9])], NOW).currentMajor, 10);
});

test("一视同仁:同样的条件,不同的插件(id、作者、名称、星标都不同)得到同样的结果", () => {
  const variants = (days: number | null, majors: number[] | null, o: Partial<Plugin> = {}) => [
    mk("alpha/one", days, majors, { name: "One", stars: 0, ...o }),
    mk("beta/two", days, majors, { name: "Two", stars: 50_000, ...o }),
    mk("gamma/three", days, majors, { name: "三", stars: 7, author: "gamma", ...o }),
  ];
  const cases: [number | null, number[] | null, Partial<Plugin>?][] = [[1, [10]], [366, [9]], [366, null], [731, [7, 8, 9, 10]], [null, [10]], [10, [10], { downloads: [] }], [800, [10], { archived: true }]];
  for (const [days, majors, o] of cases) {
    const results = variants(days, majors, o).map((p) => {
      const v = at(p);
      return v.listed ? { listed: true } : { listed: false, reason: v.reason, reasonText: v.reasonText, facts: v.facts };
    });
    for (const r of results) assert.deepEqual(r, results[0], `${days} 天 / ${JSON.stringify(majors)}`);
  }
});

test("一视同仁:判断模块的源码里没有按插件 id、作者或名称区分的分支,也没有放行或豁免名单", () => {
  const src = readFileSync(new URL("./lifecycle.ts", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/^import .*$/gm, ""); // 去掉注释与 import 再查
  for (const field of ["id", "author", "name", "homepage", "stars", "summary"]) {
    assert.ok(!new RegExp(`\\.${field}\\b`).test(code), `判断代码读取了插件的 ${field} 字段`);
  }
  assert.ok(!/["'`][\w.-]+\/[\w.-]+["'`]/.test(code), "源码里出现了形如 owner/repo 的字符串");
  assert.ok(!/\b(allow|white|black|exempt|skip|whitelist|blacklist|allowlist|denylist)\w*\s*[:=]/i.test(code), "源码里出现了放行或豁免名单");
  assert.ok(!/new Date\(\s*\)|Date\.now\(/.test(code), "判断函数不得自己取当前时间");
});

test("原因名称与规则一致", () => {
  assert.deepEqual(DELIST_REASONS, {
    "manual": "社区管理下架",
    "stale-1y-no-package": "超过 1 年未发布,且没有可下载的安装包",
    "stale-2y": "最近一次发布超过 2 年",
    "stale-1y-unadapted": "超过 1 年未发布,且未声明适配当前 Zotero 版本",
  });
});

test("真实数据:在架 + 下架 = 全部;结果不退化;每条下架都有原因与事实", async () => {
  const data = (await import("../data/plugins.json", { with: { type: "json" } })).default as unknown as { generatedAt: string; plugins: Plugin[] };
  const now = new Date(data.generatedAt); // 以数据日期为准,避免测试结果随运行日期漂移
  const { listed, delisted, currentMajor } = splitCatalog(data.plugins, now);
  assert.equal(listed.length + delisted.length, data.plugins.length);
  // 只做健全性检查,不绑定具体数字(数据每天变化):下架的不到一半,且不是全部在架或全部下架
  assert.ok(listed.length > 0, "全部下架");
  assert.ok(delisted.length >= 0 && delisted.length < data.plugins.length / 2, `下架 ${delisted.length} 个,超过总数的一半`);
  assert.equal(currentMajor, Math.max(...data.plugins.flatMap((p) => (p.zotero.declared ? p.zotero.majors : []))));
  const ids = new Set(listed.map((p) => p.id));
  for (const d of delisted) {
    assert.ok(!ids.has(d.plugin.id));
    assert.ok(d.reason in DELIST_REASONS);
    assert.ok(d.reasonText.length > 0 && !/[!!]|遗憾|可惜|糟糕/.test(d.reasonText), d.reasonText);
  }
  for (const p of listed) assert.equal(evaluatePlugin(p, now, currentMajor).listed, true);
});
