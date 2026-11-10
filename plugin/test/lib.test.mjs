import { test } from "node:test";
import assert from "node:assert/strict";
import L from "../addon/content/lib.js";

const rel = (o) => ({ t: 10, v: "1.0.0", u: "https://github.com/a/b/releases/download/v1/b.xpi", min: "7.0", max: "10.*", ...o });
const plugin = (o) => ({
  id: "a/b", name: "B", summary: "做某事", category: "reading", author: "a", homepage: "https://github.com/a/b", stars: 10,
  updated: "2026-10-01", zotero: { declared: true, majors: [7, 8, 9, 10] }, releases: [rel()], ...o,
});
const catalog = (plugins, o = {}) => JSON.stringify({ schema: 1, generatedAt: "2026-11-10", site: "https://zoterocn.org", count: plugins.length, categories: [{ key: "reading", label: "阅读" }, { key: "ai", label: "AI" }], plugins, ...o });

test("目录解析:schema 不是 1 提示更新插件市场;不是 JSON、不是对象、没有 plugins 都算格式不对", () => {
  const ok = L.parseCatalog(catalog([plugin()]));
  assert.equal(ok.ok, true);
  assert.equal(ok.catalog.plugins.length, 1);
  assert.equal(ok.catalog.generatedAt, "2026-11-10");
  assert.deepEqual(ok.catalog.categories.map((c) => c.key), ["reading", "ai"]);
  const s2 = L.parseCatalog(catalog([plugin()], { schema: 2 }));
  assert.equal(s2.ok, false);
  assert.equal(s2.reason, "schema");
  assert.match(s2.message, /请更新插件市场/);
  assert.equal(L.parseCatalog(JSON.stringify({ plugins: [] })).reason, "schema");
  for (const bad of ["", "{", "null", "[]", "123", JSON.stringify({ schema: 1 }), JSON.stringify({ schema: 1, plugins: {} })]) {
    const r = L.parseCatalog(bad);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, "invalid", bad);
  }
});

const EF = "https://github.com/e/f/releases/download/v1/f.xpi";

test("目录解析:格式不对的条目丢弃,重复 id 只留第一个;发布记录里不合法的安装包地址与标识被去掉", () => {
  const r = L.parseCatalog(catalog([
    plugin(),
    plugin({ name: "重复" }),
    plugin({ id: "../evil" }),
    plugin({ id: "x/y", stars: -1 }),
    plugin({ id: "x/z", zotero: null }),
    { id: "c/d" },
    null,
    plugin({
      id: "e/f",
      releases: [
        rel({ u: "https://evil.example.com/x.xpi" }),
        rel({ t: 9, u: "http://github.com/a/b/x.xpi" }),
        rel({ t: 8, i: "<bad id>", u: EF }),
        rel({ t: 7, i: "ok@x", d: "not-a-date", u: EF }),
      ],
    }),
  ]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.catalog.plugins.map((p) => p.id), ["a/b", "e/f"]);
  assert.equal(r.catalog.dropped, 6);
  const ef = r.catalog.plugins[1];
  assert.deepEqual(ef.releases.map((x) => x.t), [8, 7]);
  assert.ok(!("i" in ef.releases[0]));
  assert.equal(ef.releases[1].i, "ok@x");
  assert.ok(!("d" in ef.releases[1]));
});

test("安装包地址白名单:只认 https 的 github.com 上的 .xpi,各种绕过都拒绝", () => {
  const good = [
    "https://github.com/a/b/releases/download/v1/x.xpi",
    "https://github.com/a/b/releases/download/v1/X.XPI",
    "https://github.com/a/b/raw/master/x.xpi",
  ];
  for (const u of good) assert.equal(L.isAllowedXpiUrl(u), true, u);
  const bad = [
    "http://github.com/a/b/x.xpi", // 不是 https
    "https://gitee.com/a/b/releases/download/v1/x.xpi", // 只认 GitHub
    "HTTPS://github.com/a/b/x.xpi", // 协议大写
    "https://GitHub.com/a/b/x.xpi", // 主机大写
    "https://GITEE.COM/a/b/x.xpi",
    "https://github.com@evil.com/x.xpi", // 用户名伪装
    "https://user:pass@github.com/a/b/x.xpi", // 带凭据
    "https://github.com:443/a/b/x.xpi", // 带端口
    "https://github.com:8443/a/b/x.xpi",
    "https://evil.com/github.com/x.xpi", // 其它主机
    "https://github.com.evil.com/a/x.xpi",
    "https://evilgithub.com/a/x.xpi",
    "https://raw.githubusercontent.com/a/b/x.xpi",
    "https://objects.githubusercontent.com/x.xpi",
    "https://gíthub.com/a/x.xpi", // IDN 同形字
    "https://xn--gthub-zsa.com/a/x.xpi",
    "https://github.com/a/b/x.xpi?download=1", // 查询串
    "https://github.com/a/b/x.xpi#frag", // 锚点
    "https://github.com/a/b/x.xpi?.xpi",
    "https://github.com/a/b/x.xpi.exe", // 双后缀
    "https://github.com/a/b/x.xpi/", // 目录
    "https://github.com/a/b/xpi",
    "https://github.com/.xpi/", // 不是文件
    "https://github.com\\@evil.com/x.xpi", // 反斜杠
    "https://github.com/a/b/x .xpi", // 空白
    "https://github.com/a/b/x.xpi\n",
    " https://github.com/a/b/x.xpi",
    "https://github.com/a/b/../x.xpi", // 标准化后会变的地址
    "https://github.com/a/%2e%2e/x.xpi",
    "https://github.com/a/b/中文.xpi", // 未编码的字符(标准化后会变)
    // 百分号编码一律拒绝(WHATWG 会把 %2e%2e 当成 ..)
    "https://github.com/a/b/releases/download/v1.0/%E4%B8%AD%E6%96%87.xpi",
    "https://github.com/a/b/%2e%2e/%2e%2e/evil/mal/x.xpi",
    "https://github.com/a/b%2f..%2fevil/x.xpi",
    "https://github.com/a/b/x%5c..%5cy.xpi",
    "https://github.com/a/b/x.xpi%00.txt",
    "https://github.com/a/b/x%00.xpi",
    "https://github.com/a/b/x%0a.xpi",
    "https://github.com/a/b/releases/download/v1/metadatahunter%40x.xpi",
    // 空段、. 段
    "https://github.com/a//b/x.xpi",
    "https://github.com/a/b//x.xpi",
    "https://github.com//b/x.xpi",
    "https://github.com/x.xpi", // 路径太短,没有 owner/repo
    "javascript:alert(1)//github.com/x.xpi",
    "file:///github.com/x.xpi",
    "//github.com/a/x.xpi",
    "",
    null,
    undefined,
    42,
    { toString: () => "https://github.com/a/b/x.xpi" },
  ];
  for (const u of bad) assert.equal(L.isAllowedXpiUrl(u), false, String(u));
  assert.equal(L.hostOf("https://gitee.com/a/b/x.xpi"), "gitee.com");
  assert.equal(L.hostOf("not a url"), "");
});

test("版本比较:与 Zotero / Firefox 的版本比较规则一致", () => {
  const cases = [
    ["1.0", "1.0.0", 0],
    ["1", "1.0", 0],
    ["1.0.0", "1.0.1", -1],
    ["2.10", "2.9", 1],
    ["1.0b1", "1.0", -1], // 预发布在正式版之前
    ["1.0a", "1.0b", -1],
    ["1.0.0-beta.1", "1.0.0", -1],
    ["1.0pre1", "1.0pre2", -1],
    ["1.0+", "1.1pre", 0], // 1.0+ 等价于 1.1pre
    ["1.1pre", "1.1", -1],
    ["10.*", "10.0.8", 1], // * 最大
    ["7.0.*", "7.0.99", 1],
    ["6.999", "7.0", -1],
    ["7.9.9", "8.0.0", -1],
    ["", "0", 0],
    ["1..2", "1.0.2", 0],
  ];
  for (const [a, b, want] of cases) {
    assert.equal(L.compareVersions(a, b), want, `${a} vs ${b}`);
    assert.equal(L.compareVersions(b, a), want === 0 ? 0 : -want, `${b} vs ${a}`);
  }
  assert.equal(L.zoteroMajor("10.0.8"), 10);
  assert.equal(L.zoteroMajor("7.0.0-beta.1"), 7);
  assert.equal(L.zoteroMajor(""), null);
  assert.equal(L.zoteroMajor(undefined), null);
});

test("适配判断:列表按作者声明的大版本筛;安装包按声明的版本范围选(用完整的 Zotero 版本号)", () => {
  const p = plugin({ zotero: { declared: true, majors: [8, 9, 10] } });
  assert.equal(L.supportsMajor(p, 10), true);
  assert.equal(L.supportsMajor(p, 7), false);
  assert.equal(L.supportsMajor(plugin({ zotero: { declared: false, majors: [] } }), 10), false); // 未声明不算适配
  assert.equal(L.releaseCovers(rel({ min: "7.9.9", max: "10.9.9" }), "10.0.8"), true);
  assert.equal(L.releaseCovers(rel({ min: "7.9.9", max: "10.9.9" }), "7.0.5"), false);
  assert.equal(L.releaseCovers(rel({ min: "10.0", max: "10.0.*" }), "10.1.0"), false);
  assert.equal(L.releaseCovers(rel({ min: "6.999", max: "99.*" }), "9.0.1"), true);
  assert.equal(L.releaseCovers(rel({ min: undefined, max: undefined }), "10.0.8"), false); // 没声明范围不算覆盖
  // 多个可装:取版本最新的;同版本取大版本最接近的
  const multi = plugin({
    releases: [
      rel({ t: 7, v: "2.3.16", min: "6.999", max: "8.0.*", u: "https://github.com/a/b/releases/download/v2.3.16/b.xpi" }),
      rel({ t: 8, v: "2.4.8", min: "7.9.9", max: "10.9.9", u: "https://github.com/a/b/releases/download/v2.4.8/b8.xpi" }),
      rel({ t: 10, v: "2.4.8", min: "7.9.9", max: "10.9.9", u: "https://github.com/a/b/releases/download/v2.4.8/b10.xpi" }),
    ],
  });
  assert.equal(L.pickRelease(multi, "10.0.8").u, "https://github.com/a/b/releases/download/v2.4.8/b10.xpi");
  assert.equal(L.pickRelease(multi, "8.0.2").u, "https://github.com/a/b/releases/download/v2.4.8/b8.xpi");
  assert.equal(L.pickRelease(multi, "7.0.11").v, "2.3.16");
  assert.equal(L.pickRelease(multi, "11.0.0"), null);
  // 地址不合法的永远不会被选中
  assert.equal(L.pickRelease(plugin({ releases: [rel({ u: "https://evil.com/x.xpi" })] }), "10.0.8"), null);
  assert.equal(L.latestRelease(multi).v, "2.4.8");
  assert.equal(L.latestRelease(plugin({ releases: [] })), null);
  assert.equal(L.compatText(p), "适配 Zotero 8–10");
  assert.equal(L.compatText(plugin({ zotero: { declared: true, majors: [8, 10] } })), "适配 Zotero 8/10");
  assert.equal(L.compatText(plugin({ zotero: { declared: true, majors: [10] } })), "适配 Zotero 10");
  assert.equal(L.compatText(plugin({ zotero: { declared: false, majors: [] } })), "兼容范围未声明");
});

test("搜索与筛选:名称、简介、作者都能搜,多个词同时满足,大小写与全角不敏感;分类与「只显示适配」", () => {
  const list = [
    plugin({ id: "a/one", name: "Translate", summary: "划词翻译", author: "alice", category: "reading" }),
    plugin({ id: "b/two", name: "Notes", summary: "笔记工具", author: "bob", category: "notes", zotero: { declared: true, majors: [7] } }),
    plugin({ id: "c/three", name: "Ｇｐｔ Helper", summary: "AI 问答", author: "carol", category: "ai", zotero: { declared: false, majors: [] } }),
  ];
  const ids = (f) => L.filterPlugins(list, { query: "", category: "all", onlyCompatible: false, major: 10, ...f }).map((p) => p.id);
  assert.deepEqual(ids({ query: "translate" }), ["a/one"]);
  assert.deepEqual(ids({ query: "笔记" }), ["b/two"]);
  assert.deepEqual(ids({ query: "CAROL" }), ["c/three"]);
  assert.deepEqual(ids({ query: "gpt" }), ["c/three"]); // 全角字母
  assert.deepEqual(ids({ query: "alice 翻译" }), ["a/one"]);
  assert.deepEqual(ids({ query: "alice 笔记" }), []);
  assert.deepEqual(ids({ category: "notes" }), ["b/two"]);
  assert.deepEqual(ids({ onlyCompatible: true }), ["a/one"]);
  assert.deepEqual(ids({ onlyCompatible: true, major: 7 }), ["a/one", "b/two"]);
  assert.deepEqual(ids({}), ["a/one", "b/two", "c/three"]);
});

test("排序:与站点同一套口径,同分按名称;缺数据的排在后面", () => {
  const list = [
    plugin({ id: "a/a", name: "Beta", stars: 5, updated: "2026-01-01", cadence: { r12: 3, days12: 3 }, dl: { total: 10 } }),
    plugin({ id: "b/b", name: "Alpha", stars: 5, updated: "2026-03-01", cadence: { r12: 30, days12: 2 } }),
    plugin({ id: "c/c", name: "Gamma", stars: 50, updated: undefined, dl: { total: 5 } }),
    plugin({ id: "d/d", name: "Delta", stars: 1, updated: "2026-03-01", cadence: { r12: 9, days12: 3 }, dl: { total: 10 } }),
  ];
  const order = (k) => L.sortPlugins(list, k).map((p) => p.id);
  assert.deepEqual(order("stars"), ["c/c", "b/b", "a/a", "d/d"]); // 星标同分按名称:Alpha 在 Beta 前
  assert.deepEqual(order("updated"), ["b/b", "d/d", "a/a", "c/c"]);
  assert.deepEqual(order("cadence"), ["d/d", "a/a", "b/b", "c/c"]); // 先比有发布的天数,再比次数
  assert.deepEqual(order("downloads"), ["a/a", "d/d", "c/c", "b/b"]); // 同下载数比星标
  assert.deepEqual(list.map((p) => p.id), ["a/a", "b/b", "c/c", "d/d"]); // 不改原数组
  assert.deepEqual(L.SORTS.map((s) => s.key), ["stars", "updated", "cadence", "downloads"]);
});

test("安装状态:按插件标识判断已安装 / 可更新 / 未安装;没有标识时不显示「已安装」", () => {
  const r = rel({ v: "2.0.0", i: "b@x" });
  const p = plugin({ releases: [r] });
  const inst = (entries) => new Map(entries);
  assert.equal(L.installState(p, r, inst([])).kind, "not-installed");
  assert.deepEqual(L.installState(p, r, inst([["b@x", { version: "2.0.0", active: true }]])), { kind: "installed", version: "2.0.0", active: true });
  assert.deepEqual(L.installState(p, r, inst([["b@x", { version: "1.9.0", active: false }]])), { kind: "update", version: "1.9.0", active: false });
  assert.equal(L.installState(p, r, inst([["b@x", { version: "2.1.0" }]])).kind, "installed"); // 本机更新,不提示「可更新」
  assert.equal(L.installState(p, r, inst([["b@x", { version: "2.0.0b1" }]])).kind, "update"); // 预发布 < 正式版
  // 没有标识:无法判断,即使本机装了同名插件也不显示已安装
  const noId = rel({ v: "2.0.0" });
  assert.equal(L.installState(plugin({ releases: [noId] }), noId, inst([["b@x", { version: "2.0.0" }]])).kind, "unknown");
  // 没有适配当前版本的安装包:若本机装了目录里记录的任一标识,显示已安装;否则「没有安装包」
  assert.equal(L.installState(p, null, inst([["b@x", { version: "1.0" }]])).kind, "installed");
  assert.equal(L.installState(p, null, inst([])).kind, "no-package");
});

test("安装目标:只从目录里适配当前版本的发布记录取地址,并再次校验", () => {
  const p = plugin({ releases: [rel({ v: "2.0.0", i: "b@x" })] });
  const ok = L.installTarget(p, "10.0.8");
  assert.equal(ok.ok, true);
  assert.equal(ok.host, "github.com");
  assert.equal(ok.source, "github.com/a/b"); // 确认框显示完整来源
  assert.equal(ok.url, ok.release.u); // 显示值与下载地址来自同一字段
  assert.equal(ok.release.u, "https://github.com/a/b/releases/download/v1/b.xpi");
  assert.equal(L.installTarget(p, "11.0").ok, false);
  assert.equal(L.installTarget(null, "10.0").ok, false);
  // 即使有人绕过解析、把不合法的地址塞进发布记录,也取不到安装目标
  const tampered = plugin({ releases: [rel({ u: "https://github.com@evil.com/x.xpi" })] });
  assert.equal(L.installTarget(tampered, "10.0.8").ok, false);
  assert.match(L.installErrorText(-1), /下载失败/);
  assert.match(L.installErrorText(-11), /不兼容/);
  assert.match(L.installErrorText(-99), /错误码 -99/);
});

test("详情页地址与星标格式", () => {
  assert.equal(L.detailUrl("windingwind/zotero-pdf-translate"), "https://zoterocn.org/plugins/windingwind/zotero-pdf-translate");
  assert.equal(L.detailUrl("../x"), null);
  assert.equal(L.detailUrl("a/b/c"), null);
  assert.equal(L.detailUrl("a/b?x=1"), null);
  assert.equal(L.detailUrl("a/.."), null);
  assert.equal(L.detailUrl("a/."), null);
  assert.equal(L.detailUrl("a/.github"), "https://zoterocn.org/plugins/a/.github");
  assert.equal(L.CATALOG_URL, "https://zoterocn.org/data/catalog.json");
  assert.equal(L.formatStars(999), "999");
  assert.equal(L.formatStars(1234), "1.2k");
  assert.equal(L.formatStars(12263), "12.3k");
});

test("仓库绑定:安装包地址的 owner/repo 必须与插件 id 一致(大小写不敏感),否则发布记录丢弃;全部不合格时整条插件丢弃", () => {
  // 复现样例:别人的仓库冒充已装插件的新版本
  const evil = { id: "zotero/better-bibtex", name: "Better BibTeX", homepage: "https://github.com/zotero/better-bibtex", stars: 1, zotero: { declared: true, majors: [10] }, releases: [{ t: 10, u: "https://github.com/evil/mal/releases/download/v/a.xpi", i: "better-bibtex@iris-advies.com", v: "99.0", min: "7.0", max: "10.*" }] };
  assert.equal(L.isReleaseUrlForPlugin(evil.releases[0].u, evil.id), false);
  const r = L.parseCatalog(catalog([evil, plugin()]));
  assert.deepEqual(r.catalog.plugins.map((p) => p.id), ["a/b"]);
  assert.equal(r.catalog.dropped, 1);
  // 即使有人绕过解析直接构造对象,选版本与安装前校验也不放行,更不会显示「可更新」
  assert.equal(L.pickRelease(evil, "10.0.8"), null);
  assert.equal(L.installTarget(evil, "10.0.8").ok, false);
  assert.notEqual(L.installState(evil, L.pickRelease(evil, "10.0.8"), new Map([["better-bibtex@iris-advies.com", { version: "7.0" }]])).kind, "update");
  // 混合:冒充的那条丢弃,自己仓库的保留
  const mixed = L.parseCatalog(catalog([plugin({ releases: [rel({ t: 9, u: "https://github.com/evil/mal/releases/download/v/a.xpi" }), rel()] })]));
  assert.deepEqual(mixed.catalog.plugins[0].releases.map((x) => x.t), [10]);
  // 大小写不同但相等:通过;gitee 一律不认
  assert.equal(L.isReleaseUrlForPlugin("https://github.com/Zotero/Better-BibTeX/releases/download/v7/a.xpi", "zotero/better-bibtex"), true);
  assert.equal(L.isReleaseUrlForPlugin("https://github.com/zotero/better-bibtex/releases/download/v7/a.xpi", "Zotero/Better-BibTeX"), true);
  assert.equal(L.isReleaseUrlForPlugin("https://gitee.com/Owner/Repo/releases/download/v1/a.xpi", "owner/repo"), false);
  assert.equal(L.isReleaseUrlForPlugin("https://github.com/owner/other/releases/download/v1/a.xpi", "owner/repo"), false);
  // 前缀相同也不算:owner/repo 必须整段相等
  assert.equal(L.isReleaseUrlForPlugin("https://github.com/zotero/better-bibtex-evil/releases/download/v/a.xpi", "zotero/better-bibtex"), false);
  assert.equal(L.isReleaseUrlForPlugin("https://github.com/zotero/better/releases/download/v/a.xpi", "zotero/better-bibtex"), false);
  // 穿越到别的仓库也不行
  assert.equal(L.isReleaseUrlForPlugin("https://github.com/zotero/better-bibtex/%2e%2e/%2e%2e/evil/mal/a.xpi", "zotero/better-bibtex"), false);
  // 确认框来源显示 owner/repo(保留地址里的大小写)
  const t = L.installTarget(plugin({ id: "zotero/better-bibtex", homepage: "https://github.com/zotero/better-bibtex", releases: [rel({ u: "https://github.com/Zotero/Better-BibTeX/releases/download/v7/a.xpi" })] }), "10.0.8");
  assert.equal(t.ok, true);
  assert.equal(t.source, "github.com/Zotero/Better-BibTeX");
  assert.equal(L.sourceOf("https://evil.com/a/b/x.xpi"), "");
});

test("插件 id 校验:owner/repo 各 1–100 个安全字符,不能是 . 或 ..", () => {
  for (const id of ["a/b", "A-1/b.c_d", "x".repeat(100) + "/y", ".github/repo", "a/.github"]) assert.equal(L.isValidPluginId(id), true, id);
  for (const id of ["", "a", "a/b/c", "../b", "a/..", "./b", "a/.", "x".repeat(101) + "/y", "a/b c", "a/b?x", "a/%2e", null, 1]) assert.equal(L.isValidPluginId(id), false, String(id));
});

// ---------- 网络读取(假 fetch) ----------

function fakeResponse({ status = 200, type = "application/json; charset=utf-8", length, chunks = [], redirect = false } = {}) {
  const enc = new TextEncoder();
  let i = 0;
  let cancelled = false;
  const headers = new Map();
  if (type !== null) headers.set("content-type", type);
  if (length !== undefined) headers.set("content-length", String(length));
  return {
    status,
    ok: status >= 200 && status < 300,
    type: redirect ? "opaqueredirect" : "basic",
    headers: { get: (k) => (headers.has(k.toLowerCase()) ? headers.get(k.toLowerCase()) : null) },
    body: {
      getReader: () => ({
        read: async () => (cancelled || i >= chunks.length ? { done: true } : { done: false, value: typeof chunks[i] === "string" ? enc.encode(chunks[i++]) : chunks[i++] }),
        cancel: async () => {
          cancelled = true;
        },
      }),
    },
    get readCount() {
      return i;
    },
  };
}

test("读取目录:不跟随重定向、检查类型与大小、边读边限、超时", async () => {
  let seen;
  const ok = await L.fetchCatalogText(async (url, init) => ((seen = { url, init }), fakeResponse({ chunks: ['{"schema"', ":1}"] })));
  assert.equal(ok, '{"schema":1}');
  assert.equal(seen.url, "https://zoterocn.org/data/catalog.json");
  assert.equal(seen.init.redirect, "error"); // 不跟随重定向
  assert.equal(seen.init.credentials, "omit");
  // 中文按 UTF-8 正确拼接(多字节字符被切在两块之间)
  const bytes = new TextEncoder().encode("插件");
  assert.equal(await L.fetchCatalogText(async () => fakeResponse({ chunks: [bytes.slice(0, 2), bytes.slice(2)] })), "插件");
  await assert.rejects(L.fetchCatalogText(async () => fakeResponse({ status: 302, redirect: true })), /跳转/);
  await assert.rejects(L.fetchCatalogText(async () => fakeResponse({ status: 301 })), /跳转/);
  await assert.rejects(L.fetchCatalogText(async () => { throw new TypeError("NetworkError when attempting to fetch resource."); }), /网络连接失败/);
  await assert.rejects(L.fetchCatalogText(async () => fakeResponse({ status: 404, type: "text/html" })), /404/);
  await assert.rejects(L.fetchCatalogText(async () => fakeResponse({ type: "text/html", chunks: ["<html>"] })), /不是目录数据/);
  await assert.rejects(L.fetchCatalogText(async () => fakeResponse({ type: null, chunks: ["{}"] })), /不是目录数据/);
  // Content-Length 超上限:不读正文直接拒绝
  const big = fakeResponse({ length: 101, chunks: ["x".repeat(101)] });
  await assert.rejects(L.fetchCatalogText(async () => big, { maxBytes: 100 }), /上限/);
  assert.equal(big.readCount, 0);
  // 没有 Content-Length(或谎报):读到超限立即中止,后面的块不再读取
  const stream = fakeResponse({ chunks: ["x".repeat(60), "x".repeat(60), "x".repeat(60), "x".repeat(60)] });
  await assert.rejects(L.fetchCatalogText(async () => stream, { maxBytes: 100 }), /上限/);
  assert.equal(stream.readCount, 2);
  const liar = fakeResponse({ length: 10, chunks: ["x".repeat(60), "x".repeat(60), "x".repeat(60)] });
  await assert.rejects(L.fetchCatalogText(async () => liar, { maxBytes: 100 }), /上限/);
  // 超时:中止请求并给出中文说明
  let aborted = false;
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => ((aborted = true), reject(new Error("AbortError")))));
  await assert.rejects(L.fetchCatalogText(hang, { timeoutMs: 20 }), /超时/);
  assert.ok(aborted);
  // 交出中止句柄,窗口关闭时可以中止
  let ctrl;
  await L.fetchCatalogText(async () => fakeResponse({ chunks: ["{}"] }), { onController: (c) => (ctrl = c) });
  assert.equal(typeof ctrl.abort, "function");
});

// ---------- 缓存 ----------

test("缓存:读回时重新校验;超过 30 天、时间在未来、格式不对都当作没有;目录回滚被识别", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  const text = catalog([plugin()]);
  const entry = L.makeCacheEntry(text, new Date("2026-11-01T00:00:00Z"));
  const got = L.readCacheEntry(entry, now);
  assert.equal(got.catalog.plugins.length, 1);
  assert.equal(got.savedAt, "2026-11-01T00:00:00.000Z");
  assert.equal(L.readCacheEntry(L.makeCacheEntry(text, new Date("2026-10-13T00:00:00Z")), now).catalog.generatedAt, "2026-11-10"); // 29 天前:仍可用
  assert.equal(L.readCacheEntry(L.makeCacheEntry(text, new Date("2026-10-11T00:00:00Z")), new Date("2026-11-10T00:00:00Z")).catalog.plugins.length, 1); // 正好 30 天:仍可用
  assert.equal(L.readCacheEntry(L.makeCacheEntry(text, new Date("2026-10-11T00:00:00Z")), new Date("2026-11-10T00:00:01Z")), null); // 超过 30 天
  assert.equal(L.readCacheEntry(L.makeCacheEntry(text, new Date("2026-12-01T00:00:00Z")), now), null); // 未来的时间
  assert.equal(L.readCacheEntry("{bad", now), null);
  assert.equal(L.readCacheEntry(JSON.stringify({ text }), now), null); // 缺保存时间
  assert.equal(L.readCacheEntry(L.makeCacheEntry(catalog([plugin()], { schema: 2 }), now), now), null);
  // 被篡改的缓存:冒充的安装包在读回时被丢弃
  const tampered = catalog([{ ...plugin({ id: "zotero/better-bibtex" }), releases: [rel({ u: "https://github.com/evil/mal/releases/download/v/a.xpi" })] }, plugin()]);
  assert.deepEqual(L.readCacheEntry(L.makeCacheEntry(tampered, now), now).catalog.plugins.map((p) => p.id), ["a/b"]);
  // 回滚:新目录比已保存的旧
  assert.equal(L.isRollback({ generatedAt: "2026-11-09" }, { generatedAt: "2026-11-10" }), true);
  assert.equal(L.isRollback({ generatedAt: "2026-11-10" }, { generatedAt: "2026-11-10" }), false);
  assert.equal(L.isRollback({ generatedAt: "2026-11-11" }, { generatedAt: "2026-11-10" }), false);
  assert.equal(L.isRollback({ generatedAt: null }, { generatedAt: "2026-11-10" }), false);
  assert.equal(L.isRollback({ generatedAt: "2026-11-10" }, null), false);
});

test("主机写死为 github.com:不读目录里的主页决定主机,gitee 一律拒;各种伪装主机仍拒", () => {
  const id = "zotero/better-bibtex";
  // 复现样例:目录被改时主页与安装包一起改到 gitee
  const giteeBoth = { id, name: "Better BibTeX", homepage: "https://gitee.com/zotero/better-bibtex", stars: 1, zotero: { declared: true, majors: [10] }, releases: [{ t: 10, v: "99.0", u: "https://gitee.com/zotero/better-bibtex/releases/download/v/a.xpi", min: "7.0", max: "10.*" }] };
  assert.equal(L.parseCatalog(catalog([giteeBoth])).catalog.plugins.length, 0);
  assert.equal(L.pickRelease(giteeBoth, "10.0.8"), null);
  assert.equal(L.installTarget(giteeBoth, "10.0.8").ok, false);
  // 主页写什么都不影响:github 上的本仓库通过,gitee 拒
  assert.equal(L.isReleaseUrlForPlugin("https://github.com/zotero/better-bibtex/releases/download/v7/a.xpi", id), true);
  assert.equal(L.isReleaseUrlForPlugin("https://gitee.com/zotero/better-bibtex/releases/download/v7/a.xpi", id), false);
  const ghWithGiteeHome = { ...giteeBoth, releases: [{ ...giteeBoth.releases[0], u: "https://github.com/zotero/better-bibtex/releases/download/v/a.xpi" }] };
  assert.equal(L.installTarget(ghWithGiteeHome, "10.0.8").ok, true);
  for (const u of [
    "https://github.com.evil.com/zotero/better-bibtex/a.xpi",
    "https://github.com@evil.com/zotero/better-bibtex/a.xpi",
    "https://evil@github.com/zotero/better-bibtex/a.xpi",
    "https://github.com:443/zotero/better-bibtex/a.xpi",
    "https://github.com:8443/zotero/better-bibtex/a.xpi",
    "http://github.com/zotero/better-bibtex/a.xpi",
    "https://www.github.com/zotero/better-bibtex/a.xpi",
    "https://objects.githubusercontent.com/zotero/better-bibtex/a.xpi",
  ]) assert.equal(L.isReleaseUrlForPlugin(u, id), false, u);
  assert.deepEqual(L.ALLOWED_HOSTS, ["github.com"]);
});

test("选目录:网络上取到的新目录日期在未来、比缓存旧、格式不对时不采用,回退到缓存", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  const cache = L.readCacheEntry(L.makeCacheEntry(catalog([plugin()], { generatedAt: "2026-11-09" }), now), now);
  // 正常:采用新目录并写缓存
  const ok = L.decideCatalog({ text: catalog([plugin(), plugin({ id: "c/d", releases: [rel({ u: "https://github.com/c/d/releases/download/v1/d.xpi" })] })], { generatedAt: "2026-11-10" }) }, cache, now);
  assert.equal(ok.source, "network");
  assert.equal(ok.save, true);
  assert.equal(ok.catalog.plugins.length, 2);
  // 未来日期:不采用,回退缓存,不写缓存
  const future = L.decideCatalog({ text: catalog([plugin()], { generatedAt: "2099-01-01" }) }, cache, now);
  assert.equal(future.source, "cache");
  assert.equal(future.save, false);
  assert.equal(future.catalog.generatedAt, "2026-11-09");
  assert.match(future.notice, /2099-01-01.*不合理/);
  // 没有缓存时:未来日期的新目录同样不采用
  const futureNoCache = L.decideCatalog({ text: catalog([plugin()], { generatedAt: "2099-01-01" }) }, null, now);
  assert.equal(futureNoCache.catalog, null);
  assert.equal(futureNoCache.save, false);
  // 回滚
  const old = L.decideCatalog({ text: catalog([plugin()], { generatedAt: "2026-11-01" }) }, cache, now);
  assert.equal(old.source, "cache");
  assert.match(old.notice, /更旧/);
  // 网络失败、格式不对
  assert.equal(L.decideCatalog({ error: "服务器返回 404" }, cache, now).source, "cache");
  const none = L.decideCatalog({ error: "服务器返回 404" }, null, now);
  assert.equal(none.catalog, null);
  assert.equal(none.retry, true);
  assert.match(none.notice, /404/);
  assert.equal(L.decideCatalog({ text: "{bad" }, cache, now).source, "cache");
  // schema 不对:提示更新插件市场,不给重试
  const schema = L.decideCatalog({ text: catalog([plugin()], { schema: 2 }) }, cache, now);
  assert.equal(schema.catalog, null);
  assert.equal(schema.retry, false);
  assert.match(schema.notice, /请更新插件市场/);
});

test("文字清理:去掉控制字符与双向文字控制符,超长截断", () => {
  assert.equal(L.cleanText("Safe\u202Egnp.exe", 100), "Safe gnp.exe");
  assert.equal(L.cleanText("a\u2066b\u2069c\u200Fd\u061Ce", 100), "a b c d e");
  assert.equal(L.cleanText("line1\nline2\t\u0000x", 100), "line1 line2 x");
  assert.equal(L.cleanText("  多  空格  ", 100), "多 空格");
  assert.equal(L.cleanText("x".repeat(400), 300).length, 300);
  assert.ok(L.cleanText("x".repeat(400), 300).endsWith("…"));
  assert.equal(L.cleanText("😀".repeat(5), 3), "😀😀…"); // 按字符截断,不切坏代理对
  assert.equal(L.cleanText(null, 10), "");
  const r = L.parseCatalog(catalog([plugin({ name: "\u202E名称", summary: "s".repeat(500) })]));
  assert.equal(r.catalog.plugins[0].name, "名称");
  assert.equal(Array.from(r.catalog.plugins[0].summary).length, L.SUMMARY_MAX);
  assert.equal(L.parseCatalog(catalog([plugin({ name: "\u202E\u202C" })])).catalog.plugins.length, 0); // 清理后为空:丢弃
});

test("未来日期:目录日期晚于现在 + 2 天视为无效;缓存丢弃,新目录不采用", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  assert.equal(L.isFutureDated({ generatedAt: "2026-11-13" }, now), false);
  assert.equal(L.isFutureDated({ generatedAt: "2026-11-14" }, now), true);
  assert.equal(L.isFutureDated({ generatedAt: "2099-01-01" }, now), true);
  assert.equal(L.isFutureDated({ generatedAt: null }, now), false);
  // 被篡改成未来日期的缓存:读回时丢弃,不会挡住合法的新目录
  const poisoned = L.makeCacheEntry(catalog([plugin()], { generatedAt: "2099-01-01" }), now);
  assert.equal(L.readCacheEntry(poisoned, now), null);
  assert.ok(L.readCacheEntry(L.makeCacheEntry(catalog([plugin()], { generatedAt: "2026-11-12" }), now), now));
});

test("安装监听器:下载完成后核对包内插件标识,不符就取消安装;只报告一次结果", () => {
  const run = (release, addonId) => {
    const results = [];
    const l = L.installListener(release, (r) => results.push(r));
    let cancelled = 0;
    const install = { addon: addonId === undefined ? null : { id: addonId }, error: -3, cancel() { cancelled++; l.onDownloadCancelled(install); } };
    const ret = l.onDownloadEnded(install);
    return { ret, results, cancelled, l, install };
  };
  // 一致:继续安装
  const ok = run({ i: "b@x" }, "b@x");
  assert.equal(ok.ret, true);
  assert.equal(ok.cancelled, 0);
  assert.deepEqual(ok.results, []);
  ok.l.onInstallEnded(ok.install, { id: "b@x", version: "2.0" });
  assert.deepEqual(ok.results, [{ ok: true, addon: { id: "b@x", version: "2.0" } }]);
  // 不一致:返回 false 并取消;结果写明两个标识;随后的「已取消」不再覆盖
  const bad = run({ i: "b@x" }, "better-bibtex@iris-advies.com");
  assert.equal(bad.ret, false);
  assert.equal(bad.cancelled, 1);
  assert.equal(bad.results.length, 1);
  assert.equal(bad.results[0].ok, false);
  assert.match(bad.results[0].message, /better-bibtex@iris-advies\.com.*b@x.*已取消安装/);
  // 读不出包内标识时同样取消
  assert.equal(run({ i: "b@x" }, undefined).ret, false);
  // 目录没有记录标识:无从核对,继续(界面上本来就不显示「已安装」)
  assert.equal(run({}, "anything@x").ret, true);
  // 其它结果
  const f = run({ i: "b@x" }, "b@x");
  f.l.onDownloadFailed({ error: -1 });
  f.l.onInstallEnded(f.install, {});
  assert.deepEqual(f.results, [{ ok: false, code: -1 }]);
});

test("安装按钮:后台检查未完成时不可点并提示「正在检查更新…」,完成后恢复;安装中不可点", () => {
  assert.deepEqual(L.installButtonState("not-installed", false, true), { label: "安装", disabled: true, title: "正在检查更新…" });
  assert.deepEqual(L.installButtonState("update", false, true), { label: "更新", disabled: true, title: "正在检查更新…" });
  assert.deepEqual(L.installButtonState("not-installed", false, false), { label: "安装", disabled: false, title: "" });
  assert.deepEqual(L.installButtonState("update", false, false), { label: "更新", disabled: false, title: "" });
  assert.deepEqual(L.installButtonState("unknown", true, false), { label: "正在安装…", disabled: true, title: "" });
  assert.deepEqual(L.installButtonState("unknown", true, true), { label: "正在安装…", disabled: true, title: "" });
});

test("缓存大小上限:超过上限或大小未知时不读,读回的文本超长也当作没有", () => {
  assert.equal(L.CACHE_MAX_BYTES, 8 * 1024 * 1024);
  assert.ok(L.CACHE_MAX_BYTES >= 2 * L.MAX_CATALOG_BYTES); // 能放下任何被接受的目录(转义后)
  assert.equal(L.cacheSizeOk(1024), true);
  assert.equal(L.cacheSizeOk(L.CACHE_MAX_BYTES), true);
  assert.equal(L.cacheSizeOk(L.CACHE_MAX_BYTES + 1), false);
  for (const v of [undefined, null, -1, NaN, Infinity, "10"]) assert.equal(L.cacheSizeOk(v), false, String(v));
  const now = new Date("2026-11-11T00:00:00Z");
  const huge = L.makeCacheEntry(catalog([plugin()], { pad: "x".repeat(L.CACHE_MAX_BYTES) }), now);
  assert.equal(L.readCacheEntry(huge, now), null);
  assert.ok(L.readCacheEntry(L.makeCacheEntry(catalog([plugin()]), now), now));
});
