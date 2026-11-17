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

// ---------- 最新版本与安装包 ----------

import {
  applyRelease, formatCarryover, manifestInfo, mergeCadence, needsManifest, pickLatestRelease, refreshPlugin, shiftMonthly, trackDownloads, versionFromTag,
} from "./refresh-plugins.mjs";
import { findCollapses, mergeCandidates, persistentDrop } from "./carryover-scan.mjs";
import { feedReleases, validateFeed, buildFeed } from "./catalog-feed.mjs";

const GH = "https://github.com/acme/demo";
const rel = (tag, at, assets = [`demo-${tag}.xpi`], extra = {}) => ({
  tagName: tag, url: `${GH}/releases/tag/${tag}`, publishedAt: at, isDraft: false, isPrerelease: false,
  releaseAssets: { nodes: assets.map((a) => (typeof a === "string" ? { name: a, size: 1000, downloadUrl: `${GH}/releases/download/${tag}/${a}`, downloadCount: 0 } : a)) },
  ...extra,
});
const basePlugin = () => ({
  id: "acme/demo", name: "Demo", summary: "s", category: "utility", author: "acme", homepage: GH, stars: 1,
  latest: { version: "1.0.0", date: "2026-01-01", releaseUrl: `${GH}/releases/tag/v1.0.0` }, updated: "2026-01-01",
  zotero: { declared: true, majors: [7, 8] },
  downloads: [
    { t: 6, v: "0.9.0", u: `${GH}/releases/download/v0.9.0/demo-v0.9.0.xpi`, min: "5.0", max: "6.*" },
    { t: 7, v: "1.0.0", u: `${GH}/releases/download/v1.0.0/demo-v1.0.0.xpi`, min: "6.999", max: "8.*", d: "2026-01-01" },
    { t: 8, v: "1.0.0", u: `${GH}/releases/download/v1.0.0/demo-v1.0.0.xpi`, min: "6.999", max: "8.*", d: "2026-01-01" },
  ],
});

test("版本号:manifest 优先,标签里的数字兜底;不合规的字段当作没有", () => {
  assert.equal(versionFromTag("plugin-v10.0.14"), "10.0.14");
  assert.equal(versionFromTag("v2.4.8-beta.1"), "2.4.8-beta.1");
  assert.equal(versionFromTag("ethereal"), null);
  assert.deepEqual(manifestInfo({ version: "3.1.200", applications: { zotero: { strict_min_version: "6.999", strict_max_version: "11.*" } } }), { version: "3.1.200", min: "6.999", max: "11.*" });
  assert.deepEqual(manifestInfo({ version: "<script>", browser_specific_settings: { zotero: { strict_min_version: 7 } } }), { version: null, min: null, max: null });
});

test("最新发布:跳过草稿、预发布、没有安装包的发布;多个安装包时按现有文件名形状挑", () => {
  const nodes = [
    rel("v3.0.0", "2026-11-17T00:00:00Z", [], {}),
    rel("v2.9.0", "2026-11-16T00:00:00Z", undefined, { isPrerelease: true }),
    rel("v2.8.0", "2026-11-16T01:00:00Z", undefined, { isDraft: true }),
    rel("v2.0.0", "2026-11-15T00:00:00Z", ["demo-v2.0.0-zotero6.xpi", "demo-v2.0.0.xpi"]),
    null,
  ];
  const r = pickLatestRelease(nodes, "acme/demo", ["demo-v1.0.0.xpi"]);
  assert.equal(r.tag, "v2.0.0");
  assert.equal(r.date, "2026-11-15");
  assert.equal(r.asset.url, `${GH}/releases/download/v2.0.0/demo-v2.0.0.xpi`);
  // 认不出是哪一个:只更新版本信息,不选安装包
  assert.equal(pickLatestRelease(nodes, "acme/demo", ["other.xpi"]).asset, null);
});

test("安装包地址白名单不放宽:别的仓库、带百分号、非 github.com 的安装包一律不选", () => {
  const bad = [
    rel("v9", "2026-11-17T00:00:00Z", [{ name: "x.xpi", downloadUrl: "https://github.com/evil/demo/releases/download/v9/x.xpi" }]),
    rel("v8", "2026-11-16T00:00:00Z", [{ name: "x.xpi", downloadUrl: `${GH}/releases/download/v%2e%2e/x.xpi` }]),
    rel("v7", "2026-11-15T00:00:00Z", [{ name: "x.xpi", downloadUrl: "https://gitee.com/acme/demo/releases/download/v7/x.xpi" }]),
    rel("v6", "2026-11-14T00:00:00Z", [{ name: "x.xpi", downloadUrl: "http://github.com/acme/demo/releases/download/v6/x.xpi" }]),
  ];
  assert.equal(pickLatestRelease(bad, "acme/demo"), null);
  // 大小写不同的 owner/repo 仍属于同一个插件
  const ok = pickLatestRelease([rel("v1.1.0", "2026-11-17T00:00:00Z", [{ name: "d.xpi", downloadUrl: "https://github.com/Acme/Demo/releases/download/v1.1.0/d.xpi" }])], "acme/demo");
  assert.equal(ok.asset.url, "https://github.com/Acme/Demo/releases/download/v1.1.0/d.xpi");
});

test("并入新发布:更新最新版本与范围覆盖的各大版本安装包;旧大版本的安装包保留;新数据通过目录源校验", () => {
  const p = basePlugin();
  const r = pickLatestRelease([rel("v2.0.0", "2026-11-15T03:00:00Z", ["demo-v2.0.0.xpi"])], "acme/demo", ["demo-v1.0.0.xpi"]);
  assert.equal(needsManifest(p, r), true);
  const changed = applyRelease(p, r, { version: "2.0.0", min: "7.9", max: "10.*" });
  assert.deepEqual(changed, { latest: true, downloads: true });
  assert.deepEqual(p.latest, { version: "2.0.0", date: "2026-11-15", releaseUrl: `${GH}/releases/tag/v2.0.0` });
  assert.equal(p.updated, "2026-11-15");
  assert.deepEqual(p.downloads.map((d) => [d.t, d.v]), [[6, "0.9.0"], [7, "1.0.0"], [8, "2.0.0"], [9, "2.0.0"], [10, "2.0.0"]]);
  assert.deepEqual(p.downloads.find((d) => d.t === 10), { t: 10, v: "2.0.0", u: `${GH}/releases/download/v2.0.0/demo-v2.0.0.xpi`, min: "7.9", max: "10.*", d: "2026-11-15" });
  assert.equal(needsManifest(p, r), false); // 已经并入,明天不再下载
  const dropped = [];
  const feed = feedReleases(p, {}, dropped);
  assert.deepEqual(dropped, []);
  assert.deepEqual(feed.map((x) => [x.t, x.v]), [[7, "1.0.0"], [8, "2.0.0"], [9, "2.0.0"], [10, "2.0.0"]]);
  const f = buildFeed({ listed: [p], day: "2026-11-17" });
  assert.deepEqual(validateFeed(f), []);
});

test("并入新发布:版本更低的补丁发布不把最新版本拉回去;读不到 manifest 时只按标签更新版本,不动安装包", () => {
  const p = basePlugin();
  applyRelease(p, pickLatestRelease([rel("v0.9.5", "2026-11-16T00:00:00Z", ["demo-v0.9.5.xpi"])], "acme/demo"), { version: "0.9.5", min: "5.0", max: "6.*" });
  assert.equal(p.latest.version, "1.0.0");
  assert.equal(p.downloads.length, 3); // 6 不在 7 及以上,不并入;7/8 不在范围里
  const q = basePlugin();
  const before = JSON.stringify(q.downloads);
  applyRelease(q, pickLatestRelease([rel("v1.2.0", "2026-11-16T00:00:00Z", ["demo-v1.2.0.xpi"])], "acme/demo"), null);
  assert.equal(q.latest.version, "1.2.0");
  assert.equal(JSON.stringify(q.downloads), before);
});

test("单个插件读安装包失败:保留旧安装包,星标与节奏照常更新,不抛错", async () => {
  const p = basePlugin();
  const repo = { stargazerCount: 42, forkCount: 1, watchers: { totalCount: 2 }, issues: { totalCount: 3 } };
  const nodes = [rel("v2.0.0", "2026-11-15T00:00:00Z", [{ name: "demo-v2.0.0.xpi", size: 10, downloadUrl: `${GH}/releases/download/v2.0.0/demo-v2.0.0.xpi`, downloadCount: 5 }])];
  const logs = [];
  const dl = await refreshPlugin(p, repo, nodes, false, {
    today: "2026-11-17", nowMs: Date.parse("2026-11-17T12:00:00Z"), log: (m) => logs.push(m),
    fetchXpi: async () => { throw new Error("网络断了"); },
  });
  assert.equal(p.stars, 42);
  assert.equal(dl, 5);
  assert.equal(p.cadence.r12, 1);
  assert.equal(p.latest.version, "2.0.0"); // 标签兜底
  assert.equal(p.downloads.length, 3);
  assert.ok(logs.some((m) => m.includes("读取安装包失败")));
  // 发布数据残缺也不抛错
  const q = basePlugin();
  await refreshPlugin(q, repo, [{ tagName: null, publishedAt: "bad", releaseAssets: null }], false, { today: "2026-11-17", fetchXpi: async () => Buffer.alloc(0) });
  assert.equal(q.latest.version, "1.0.0");
});

// ---------- 历史保留 ----------

const SNAP = { cutoff: "2026-11-10T21:14:32Z", r12: 20, days12: 10, monthly: [0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5], medianDays: 0.5, last: "2026-11-10" };

test("快照平移:总数守恒,移出近一年的部分丢弃", () => {
  assert.deepEqual(shiftMonthly([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10], 0), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10]);
  assert.deepEqual(shiftMonthly([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10], 15), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5]);
  assert.deepEqual(shiftMonthly([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10], 30), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0]);
  assert.deepEqual(shiftMonthly([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 60), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
});

test("节奏合并:快照 ∪ 快照之后的现存发布;快照时已有的现存发布不重复计,同一天不重复算天数", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  const dates = [
    "2026-11-01T00:00:00Z", // 快照前就有、现在还在:已含在快照里
    "2026-11-10T22:00:00Z", // 快照之后、与快照最后发布同一天:次数 +1,天数不加
    "2026-11-13T09:00:00Z", "2026-11-13T10:00:00Z", "2026-11-16T08:00:00Z",
  ];
  const c = mergeCadence(SNAP, dates, now);
  assert.equal(c.r12, 24);
  assert.equal(c.days12, 12);
  assert.equal(c.last, "2026-11-16");
  assert.equal(c.carried, true);
  assert.equal(c.monthly.reduce((s, x) => s + x, 0), c.r12);
  // 只有快照、没有新发布
  const only = mergeCadence(SNAP, ["2026-11-01T00:00:00Z"], now);
  assert.deepEqual([only.r12, only.days12, only.last, only.medianDays], [20, 10, "2026-11-10", 0.5]);
});

test("下载记账:快照 + 之后的新增;发布被移除不变负、重新出现不重复计、快照前就有的只算增长", () => {
  const snapDl = { cutoff: "2026-11-10T21:14:32Z", total: 1000 };
  const r = (tag, at, n) => ({ tagName: tag, publishedAt: at, releaseAssets: { nodes: [{ name: `${tag}.xpi`, downloadCount: n }, { name: "src.zip", downloadCount: 999 }] } });
  // 第一天:旧发布 old(快照前)现存 300 次,快照后的 a、b 各 10、20 次
  let t = trackDownloads(undefined, snapDl, [r("old", "2026-11-01T00:00:00Z", 300), r("a", "2026-11-12T00:00:00Z", 10), r("b", "2026-11-13T00:00:00Z", 20)], "2026-11-17");
  assert.equal(t.init, true);
  assert.equal(t.total, 1030);
  // 第二天:old +5,a +5;b 被移除(或接口没返回)
  t = trackDownloads(t.track, snapDl, [r("old", "2026-11-01T00:00:00Z", 305), r("a", "2026-11-12T00:00:00Z", 15)], "2026-11-18");
  assert.equal(t.init, false);
  assert.equal(t.total, 1040);
  // 第三天:b 又出现(数值没变)、新发布 c 有 7 次:不重复计 b
  t = trackDownloads(t.track, snapDl, [r("old", "2026-11-01T00:00:00Z", 305), r("a", "2026-11-12T00:00:00Z", 15), r("b", "2026-11-13T00:00:00Z", 20), r("c", "2026-11-18T00:00:00Z", 7)], "2026-11-19");
  assert.equal(t.total, 1047);
  // 第四天:全部移除,只剩一个 0 次的新发布:总数不下降
  t = trackDownloads(t.track, snapDl, [r("d", "2026-11-19T00:00:00Z", 0)], "2026-11-20");
  assert.equal(t.total, 1047);
  assert.equal(t.track.since, "2026-11-17");
  assert.deepEqual(Object.keys(t.track.rel), ["old", "a", "b", "c", "d"]);
});

test("有历史保留的插件:第一次补回时不留「上次基线」,第二天起照常算每天新增;历史快照记合并后的数", async () => {
  const p = basePlugin();
  p.dl = { total: 0, at: "2026-11-16" };
  const carry = { cadence: SNAP, dl: { cutoff: SNAP.cutoff, date: "2026-11-10", total: 1000 } };
  const repo = { stargazerCount: 1 };
  const node = (n) => rel("v2.0.0", "2026-11-15T00:00:00Z", [{ name: "demo-v2.0.0.xpi", size: 1, downloadUrl: `${GH}/releases/download/v2.0.0/demo-v2.0.0.xpi`, downloadCount: n }]);
  const ctx = { today: "2026-11-17", nowMs: Date.parse("2026-11-17T12:00:00Z"), carry, fetchXpi: async () => Buffer.alloc(0) };
  assert.equal(await refreshPlugin(p, repo, [node(30)], false, ctx), 1030);
  assert.deepEqual(p.dl, { total: 1030, at: "2026-11-17", carried: true });
  assert.equal(p.cadence.r12, 21);
  assert.equal(await refreshPlugin(p, repo, [node(45)], false, { ...ctx, today: "2026-11-18", nowMs: Date.parse("2026-11-18T12:00:00Z") }), 1045);
  assert.deepEqual(p.dl, { total: 1045, at: "2026-11-18", prevTotal: 1030, prevAt: "2026-11-17", carried: true });
});

test("塌缩识别:只认降到一半以下并持续至少 3 次的;一两天又恢复的不算;已按历史保留计算之后的数据不参与", () => {
  assert.equal(persistentDrop([100, 100, 0, 0, 0]), 2);
  assert.equal(persistentDrop([100, 100, 0, 0]), -1); // 只持续 2 次
  assert.equal(persistentDrop([100, 2, 100, 100, 100]), -1); // 恢复了
  assert.equal(persistentDrop([100, 60, 20, 20, 20]), 2); // 相对前一次降到一半或以下
  assert.equal(persistentDrop([9, 1, 1, 1], 10), -1); // 近一年发布次数原本不到 10 次
  const day = (d, commit, plugins) => ({ commit, time: `${d}T21:00:00Z`, day: d, plugins: new Map(Object.entries(plugins)) });
  const cad = (r12) => ({ r12, days12: 1, monthly: Array(12).fill(0), medianDays: null, last: "2026-11-01" });
  const series = [
    day("2026-11-09", "c1", { "a/x": { raw: 500, cadence: cad(40) }, "b/y": { raw: 900, cadence: cad(5) } }),
    day("2026-11-10", "c2", { "a/x": { raw: 510, cadence: cad(41) }, "b/y": { raw: 10, cadence: cad(5) } }),
    day("2026-11-12", "c3", { "a/x": { raw: 0, cadence: cad(1) }, "b/y": { raw: 950, cadence: cad(5) } }),
    day("2026-11-13", "c4", { "a/x": { raw: undefined, cadence: cad(2) }, "b/y": { raw: 960, cadence: cad(5) } }),
    day("2026-11-14", "c5", { "a/x": { raw: 3, cadence: cad(3) }, "b/y": { raw: 970, cadence: cad(5) } }),
    day("2026-11-15", "c6", { "a/x": { raw: 4, cadence: cad(4) }, "b/y": { raw: 980, cadence: cad(5) } }),
    day("2026-11-16", "c7", { "a/x": { raw: 9999, cadence: { ...cad(60), carried: true }, carried: true } }),
  ];
  const found = findCollapses(series);
  assert.deepEqual(Object.keys(found), ["a/x"]);
  assert.deepEqual(found["a/x"].dl, { commit: "c2", date: "2026-11-10", cutoff: "2026-11-10T21:00:00Z", dropCommit: "c3", dropDate: "2026-11-12", total: 510 });
  assert.equal(found["a/x"].cadence.commit, "c2");
  assert.equal(found["a/x"].cadence.r12, 41);
  // 补入时不覆盖已有分项
  const existing = { "a/x": { dl: { total: 1 } } };
  assert.deepEqual(mergeCandidates(existing, found), ["a/x cadence"]);
  assert.equal(existing["a/x"].dl.total, 1);
});

test("carryover.json:数据文件格式与出处字段齐全;只含数字与字符串的数组写在一行", async () => {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(new URL("../src/data/carryover.json", import.meta.url), "utf8");
  const d = JSON.parse(text);
  assert.equal(formatCarryover(d), text);
  for (const [id, e] of Object.entries(d.plugins)) {
    assert.match(id, /^[a-z0-9._-]+\/[a-z0-9._-]+$/);
    for (const k of ["cadence", "dl"]) {
      if (!e[k]) continue;
      assert.match(e[k].commit, /^[0-9a-f]{40}$/, `${id} ${k} 缺出处提交`);
      assert.match(e[k].date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!Number.isNaN(Date.parse(e[k].cutoff)));
    }
    if (e.cadence) assert.equal(e.cadence.monthly.reduce((s, x) => s + x, 0), e.cadence.r12);
  }
});
