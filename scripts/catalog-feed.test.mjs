import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { FEED_FILE, buildFeed, droppedSummary, feedReleases, releaseRejection, validateFeed, weeklyDownloads } from "./catalog-feed.mjs";
import { ADDON_IDS_FILE } from "./import-addon-ids.mjs";
import { loadCatalog } from "./catalog.ts";
import { robotsTxt, writeFeeds } from "./prerender.mjs";
import { CATEGORIES, isAllowedXpiUrl, matchesQuery, sortPlugins, supportsZotero } from "../src/plugins/lib.ts";
import market from "../plugin/addon/content/lib.js";

const root = new URL("..", import.meta.url).pathname;
const DAY = "2026-11-10";
const ADDON_IDS = JSON.parse(readFileSync(ADDON_IDS_FILE, "utf8"));
const HISTORY = JSON.parse(readFileSync(join(root, "src/data/history.json"), "utf8"));
const real = loadCatalog(DAY);
const realFeed = buildFeed({ listed: real.listed, day: DAY, addonIds: ADDON_IDS, history: HISTORY });

const P = {
  id: "a/b", name: "B", summary: "s", category: "reading", tags: ["notes"], author: "a", homepage: "https://github.com/a/b", stars: 7, forks: 3, watchers: 1, issues: 2,
  latest: { version: "2.0", date: "2026-10-01", releaseUrl: "https://github.com/a/b/releases/tag/v2" }, updated: "2026-10-01",
  zotero: { declared: true, majors: [7, 8, 9, 10] },
  cadence: { r12: 4, days12: 3, monthly: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], medianDays: 30, last: "2026-10-01" },
  dl: { total: 100, at: "2026-11-09", prevTotal: 90, prevAt: "2026-11-08" },
  downloads: [
    { t: 6, v: "0.9", u: "https://github.com/a/b/releases/download/v0.9/b.xpi", min: "5.0", max: "6.*" },
    { t: 7, v: "1.0", u: "https://github.com/a/b/releases/download/v1/b.xpi", min: "6.999", max: "7.*", d: "2025-01-01" },
    { t: 7, v: "1.5", u: "https://github.com/a/b/releases/download/v1.5/b.xpi", min: "6.999", max: "7.*" },
    { t: 10, v: "2.0", u: "https://github.com/a/b/releases/download/v2/b.xpi", min: "7.9.9", max: "10.*", d: "2026-10-01" },
    { t: 9, v: "2.0", u: "https://evil.example.com/b.xpi", min: "7.9.9", max: "10.*" },
    { t: 8, v: "2.0", u: "http://github.com/a/b/releases/download/v2/b.xpi" },
  ],
};

test("目录源条目:只带约定字段;缺的省略;安装包每个大版本取最新且只收 Zotero 7+ 的合法直链,带上插件标识", () => {
  const f = buildFeed({ listed: [P, { ...P, id: "c/d", name: "D", stars: 1, archived: true, updated: "", cadence: undefined, dl: undefined, downloads: undefined }], day: DAY, addonIds: { "a/b": { 7: "old@x", 10: "new@x" } } });
  assert.equal(f.schema, 1);
  assert.equal(f.generatedAt, DAY);
  assert.equal(f.site, "https://zoterocn.org");
  assert.equal(f.count, 2);
  assert.deepEqual(f.categories, CATEGORIES.map((c) => ({ key: c.key, label: c.label })));
  const [a, d] = f.plugins;
  assert.deepEqual(Object.keys(a), ["id", "name", "summary", "category", "author", "homepage", "stars", "updated", "cadence", "dl", "dlWeek", "zotero", "releases"]);
  assert.deepEqual(a.cadence, { days12: 3, r12: 4, last: "2026-10-01" });
  assert.deepEqual(a.dl, { total: 100, at: "2026-11-09" });
  assert.equal(a.dlWeek, null);
  assert.deepEqual(a.releases, [
    { t: 7, v: "1.5", u: "https://github.com/a/b/releases/download/v1.5/b.xpi", i: "old@x", min: "6.999", max: "7.*" },
    { t: 10, v: "2.0", u: "https://github.com/a/b/releases/download/v2/b.xpi", i: "new@x", min: "7.9.9", max: "10.*", d: "2026-10-01" },
  ]);
  assert.deepEqual(Object.keys(d), ["id", "name", "summary", "category", "author", "homepage", "stars", "dlWeek", "archived", "zotero", "releases"]);
  assert.equal(d.archived, true);
  assert.deepEqual(d.releases, []);
  assert.ok(!("archived" in a));
  // 没有标识的发布记录不带 i
  assert.ok(feedReleases(P, {}).every((r) => !("i" in r)));
  assert.deepEqual(validateFeed(f), []);
});

test("近 7 天新增下载:要有最近一次与恰好 7 天前的快照;否则为 null", () => {
  assert.equal(weeklyDownloads(undefined), null);
  assert.equal(weeklyDownloads([["2026-11-09", 1, 100]]), null);
  assert.equal(weeklyDownloads([["2026-11-03", 1, 90], ["2026-11-09", 1, 100]]), null); // 只差 6 天
  assert.equal(weeklyDownloads([["2026-11-02", 1, 90], ["2026-11-05", 1, 95], ["2026-11-09", 1, 100]]), 10);
  assert.equal(weeklyDownloads([["2026-11-09", 1, 100], ["2026-11-02", 1, 90]]), 10); // 顺序无关
  assert.equal(weeklyDownloads([["2026-11-02", 1, null], ["2026-11-09", 1, 100]]), null);
  assert.equal(weeklyDownloads([["2026-11-02", 1, 120], ["2026-11-09", 1, 100]]), null); // 不出负数
});

test("校验能发现问题:条数不符、非白名单地址、多余字段、下架插件混入、schema 不对", () => {
  const base = buildFeed({ listed: [P], day: DAY });
  const clone = () => JSON.parse(JSON.stringify(base));
  let f = clone();
  f.count = 2;
  assert.ok(validateFeed(f).some((e) => e.includes("count")));
  f = clone();
  f.plugins[0].releases[0].u = "https://github.com@evil.com/x.xpi";
  assert.ok(validateFeed(f).some((e) => e.includes("白名单")));
  f = clone();
  f.plugins[0].tags = ["x"];
  assert.ok(validateFeed(f).some((e) => e.includes("多出字段 tags")));
  f = clone();
  assert.ok(validateFeed(f, { excludedIds: ["a/b"] }).some((e) => e.includes("已下架")));
  f = clone();
  f.schema = 2;
  assert.ok(validateFeed(f).some((e) => e.includes("schema")));
  f = clone();
  f.plugins[0].archived = false;
  assert.ok(validateFeed(f).some((e) => e.includes("archived")));
});

test("真实数据:目录源通过校验,只含在架插件,排序为星标降序,安装包全部通过白名单", () => {
  assert.deepEqual(validateFeed(realFeed, { excludedIds: real.delisted.map((d) => d.plugin.id) }), []);
  assert.equal(realFeed.count, real.listed.length);
  assert.equal(realFeed.plugins.length, real.listed.length);
  const delisted = new Set(real.delisted.map((d) => d.plugin.id));
  assert.ok(realFeed.plugins.every((p) => !delisted.has(p.id)));
  assert.deepEqual(realFeed.plugins.map((p) => p.id), sortPlugins(real.listed, "stars").map((p) => p.id));
  for (const p of realFeed.plugins) for (const r of p.releases) assert.ok(isAllowedXpiUrl(r.u) && market.isAllowedXpiUrl(r.u) && market.isReleaseUrlForPlugin(r.u, p.id) && new URL(r.u).hostname === "github.com" && !r.u.includes("%"), r.u);
});

test("仓库绑定与路径规则(构建时):别人仓库的安装包、含 % 的路径不进目录;大小写不同但相等的通过;丢弃有报告", () => {
  const mk = (id, downloads) => ({ ...P, id, downloads });
  const evil = mk("zotero/better-bibtex", [{ t: 10, v: "99.0", u: "https://github.com/evil/mal/releases/download/v/a.xpi", min: "7.0", max: "10.*" }]);
  const cased = mk("zotero/better-bibtex", [{ t: 10, v: "7.0", u: "https://github.com/Zotero/Better-BibTeX/releases/download/v7/a.xpi", min: "7.0", max: "10.*" }]);
  const pct = mk("x/y", [{ t: 10, v: "1", u: "https://github.com/x/y/releases/download/v1/a%40b.xpi", min: "7.0", max: "10.*" }, { t: 9, v: "1", u: "https://github.com/x/y/%2e%2e/%2e%2e/evil/mal/a.xpi", min: "7.0", max: "10.*" }]);
  assert.equal(releaseRejection(evil.downloads[0].u, evil.id), "repo");
  assert.equal(releaseRejection(cased.downloads[0].u, cased.id), null);
  assert.equal(releaseRejection(pct.downloads[0].u, pct.id), "path");
  assert.equal(releaseRejection("https://evil.com/x/y/a.xpi", "x/y"), "host");
  // 主机写死为 github.com:gitee 上的同名仓库一律拒,与目录里的主页写什么无关
  assert.equal(releaseRejection("https://gitee.com/zotero/better-bibtex/releases/a.xpi", "zotero/better-bibtex"), "non-github");
  const giteeHome = { ...mk("zotero/better-bibtex", [{ t: 10, v: "1", u: "https://gitee.com/zotero/better-bibtex/releases/download/v1/a.xpi", min: "7.0", max: "10.*" }]), homepage: "https://gitee.com/zotero/better-bibtex" };
  assert.deepEqual(feedReleases(giteeHome, {}), []);
  const dropped = [];
  const f = buildFeed({ listed: [evil, pct, { ...cased, id: "z/z", name: "Z" }], day: DAY, dropped });
  assert.deepEqual(f.plugins.find((p) => p.id === "zotero/better-bibtex").releases, []); // 插件仍在目录(在架),只是没有安装包
  assert.deepEqual(f.plugins.find((p) => p.id === "x/y").releases, []);
  assert.equal(dropped.length, 4); // 冒充 1 + % 2 + z/z 指向别的仓库 1
  const sum = droppedSummary(dropped, f);
  assert.deepEqual(sum.byReason, { repo: 2, path: 2 });
  assert.equal(sum.plugins, 3);
  assert.deepEqual(sum.lostAll.sort(), ["x/y", "z/z", "zotero/better-bibtex"]);
  assert.deepEqual(feedReleases(cased, {}).map((r) => r.u), ["https://github.com/Zotero/Better-BibTeX/releases/download/v7/a.xpi"]);
  // 校验也拦得住:有人把冒充的发布记录塞回目录
  const g = buildFeed({ listed: [cased], day: DAY });
  g.plugins[0].releases[0].u = "https://github.com/evil/mal/releases/download/v/a.xpi";
  assert.ok(validateFeed(g).some((e) => e.includes("不属于该插件的仓库")));
});

test("真实数据:目录源里没有本机路径、令牌、内部地址;体积在预算内", () => {
  const text = JSON.stringify(realFeed);
  assert.ok(!/\/Users\/|\/home\/[a-z]|C:\\\\Users/.test(text));
  assert.ok(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|x-access-token|Bearer /.test(text));
  assert.ok(!/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(text));
  assert.ok(!/localhost|127\.0\.0\.1/.test(text));
  assert.ok(text.length < 600_000, `未压缩 ${text.length} 字节`);
  assert.ok(gzipSync(text).length < 150_000);
});

test("社区插件按同一套口径读取目录源:解析无丢弃,四种排序、搜索、适配筛选与站点结果一致", () => {
  const parsed = market.parseCatalog(JSON.stringify(realFeed));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.catalog.dropped, 0);
  assert.equal(parsed.catalog.plugins.length, real.listed.length);
  for (const key of ["stars", "updated", "cadence", "downloads"]) {
    assert.deepEqual(market.sortPlugins(parsed.catalog.plugins, key).map((p) => p.id), sortPlugins(real.listed, key).map((p) => p.id), key);
  }
  for (const q of ["翻译", "pdf", "windingwind", "AI 笔记", "ｚｏｔｅｒｏ"]) {
    assert.deepEqual(parsed.catalog.plugins.filter((p) => market.matchesQuery(p, q)).map((p) => p.id), realFeed.plugins.filter((_, i) => matchesQuery(sortPlugins(real.listed, "stars")[i], q)).map((p) => p.id), q);
  }
  const byId = new Map(real.listed.map((p) => [p.id, p]));
  for (const major of [7, 8, 9, 10, 11]) {
    for (const p of parsed.catalog.plugins) assert.equal(market.supportsMajor(p, major), supportsZotero(byId.get(p.id), major), `${p.id} ${major}`);
  }
});

test("写出目录源:条数与 sitemap 插件页一致,不一致时构建失败;站点不再输出插件的更新清单", () => {
  const dir = mkdtempSync(join(tmpdir(), "feed-"));
  const entries = [{ path: "/" }, { path: "/plugins" }, { path: "/plugins/charts" }, ...real.listed.map((p) => ({ path: `/plugins/${p.id}` }))];
  const { feed } = writeFeeds(dir, { listed: real.listed, delistedIds: real.delisted.map((d) => d.plugin.id), today: DAY, addonIds: ADDON_IDS, history: HISTORY, entries });
  const written = JSON.parse(readFileSync(join(dir, FEED_FILE), "utf8"));
  assert.equal(written.count, feed.count);
  assert.equal(written.count, real.listed.length);
  assert.ok(!existsSync(join(dir, "plugin"))); // 更新清单放在 GitHub,站点上没有
  assert.throws(() => writeFeeds(mkdtempSync(join(tmpdir(), "feed-")), { listed: real.listed, today: DAY, entries: entries.slice(0, -1) }), /不一致/);
  assert.ok(!existsSync(join(dir, "data", "index.html")));
});

test("插件身份:目录地址一致;插件的自更新清单不在站点上", () => {
  const manifest = JSON.parse(readFileSync(join(root, "plugin/addon/manifest.json"), "utf8"));
  const u = new URL(manifest.applications.zotero.update_url);
  assert.equal(u.hostname, "github.com");
  assert.ok(u.pathname.startsWith("/cnzotero/zotero-community/"));
  assert.equal(market.CATALOG_URL, `https://zoterocn.org/${FEED_FILE}`);
});

test("robots.txt 不屏蔽 /data/ 与 /plugin/", () => {
  const r = robotsTxt();
  assert.ok(!/Disallow:\s*\/data/.test(r));
  assert.ok(!/Disallow:\s*\/plugin\b/.test(r));
});

test("一视同仁:目录源脚本与社区插件的源码里不出现任何具体插件的 id 或插件标识", () => {
  const { plugins } = JSON.parse(readFileSync(join(root, "src/data/plugins.json"), "utf8"));
  const needles = new Set();
  for (const p of plugins) needles.add(p.id);
  for (const v of Object.values(ADDON_IDS)) for (const id of typeof v === "string" ? [v] : Object.values(v)) needles.add(id.toLowerCase());
  const files = ["scripts/catalog-feed.mjs", "scripts/import-addon-ids.mjs", "plugin/addon/bootstrap.js", "plugin/addon/content/lib.js", "plugin/addon/content/market.js", "plugin/addon/content/market.html"];
  for (const f of files) {
    const src = readFileSync(join(root, f), "utf8").toLowerCase();
    for (const n of needles) assert.ok(!src.includes(n), `${f} 出现了 ${n}`);
  }
});
