import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { classify, cleanText, evaluateRequest, listOpenIssues, markerOf, parseIssueForm, parseRepoUrl, replyText, summaryOf } from "./intake.mjs";

const FORM = (over = {}) => `### 插件名称

${over.name ?? "Demo"}

### 公开仓库地址

${over.repo ?? "https://github.com/Alice/zotero-demo"}

### 适配的 Zotero 版本

Zotero 7–10

### 一两句用途说明

${over.purpose ?? "在阅读器里做双语对照。第二句不要。"}

### 作者发布页（可选）

_No response_
`;

test("解析申请表:取出各栏,空栏当作空串;不是这张表返回 null", () => {
  const f = parseIssueForm(FORM());
  assert.deepEqual(f, { name: "Demo", repo: "https://github.com/Alice/zotero-demo", zotero: "Zotero 7–10", purpose: "在阅读器里做双语对照。第二句不要。", release: "" });
  assert.equal(parseIssueForm("### 哪个插件\n\n非插件\n\n### 依据\n\n你好"), null);
  assert.equal(parseIssueForm(null), null);
  assert.equal(parseIssueForm(FORM().replace("\n", "\r\n")).name, "Demo");
});

test("认仓库地址:GitHub / Gitee、带 .git、带路径、不认其它站点", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/Alice/zotero-demo"), { host: "github.com", owner: "Alice", repo: "zotero-demo" });
  assert.deepEqual(parseRepoUrl("https://github.com/Alice/zotero-demo.git"), { host: "github.com", owner: "Alice", repo: "zotero-demo" });
  assert.deepEqual(parseRepoUrl("请看 https://github.com/Alice/zotero-demo/releases ,谢谢"), { host: "github.com", owner: "Alice", repo: "zotero-demo" });
  assert.deepEqual(parseRepoUrl("https://gitee.com/ckern/zotero-wps-bridge"), { host: "gitee.com", owner: "ckern", repo: "zotero-wps-bridge" });
  assert.equal(parseRepoUrl("https://evil.example/Alice/zotero-demo"), null);
  assert.equal(parseRepoUrl("https://github.com/Alice"), null);
  assert.equal(parseRepoUrl(""), null);
});

test("文字清理:去链接、HTML、Markdown 符号与控制字符,超长截断;简介取第一句", () => {
  assert.equal(cleanText("**加粗** <b>标签</b> [链接](https://x.y/z) https://a.b/c 正文‮", 100), "加粗 标签 链接 正文");
  assert.equal(cleanText("a".repeat(70), 60).length, 60);
  assert.equal(summaryOf("先做这件事。再做那件事。", ""), "先做这件事");
  assert.equal(summaryOf("Does a thing. And more.", ""), "Does a thing");
  assert.equal(summaryOf("", "仓库简介"), "仓库简介");
  assert.ok(summaryOf("长".repeat(300), "").length <= 100);
});

test("分类:按关键词归入,没有命中归「工具」", () => {
  assert.equal(classify("Zotero PDF 阅读器里划词翻译"), "reading");
  assert.equal(classify("用 ChatGPT 总结论文"), "ai");
  assert.equal(classify("在 WPS 中插入引文"), "integration");
  assert.equal(classify("管理笔记 Markdown 导出"), "notes");
  assert.equal(classify("一个小玩意"), "utility");
  assert.equal(classify("main tab"), "interface"); // 英文关键词按词首匹配,不会把 maintain 当成 ai
  assert.equal(classify("maintain"), "utility");
});

/** 拼一个最小的 zip(不校验 CRC,读取逻辑也不依赖它)。entries: [{ name, data, deflate? }] */
function makeZip(entries, { encrypted = false } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const raw = Buffer.from(e.data);
    const body = e.deflate ? deflateRawSync(raw) : raw;
    const name = Buffer.from(e.name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(encrypted ? 1 : 0, 6);
    lh.writeUInt16LE(e.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(encrypted ? 1 : 0, 8);
    ch.writeUInt16LE(e.deflate ? 8 : 0, 10);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const xpi = (zotero = { strict_min_version: "6.999", strict_max_version: "8.*" }, version = "1.0.0") =>
  makeZip([{ name: "manifest.json", data: JSON.stringify({ version, applications: { zotero: { id: "demo@example.org", ...zotero } } }) }]);

// ---------- 核对流程(网络注入,安装包用真实 zip) ----------

const today = "2026-11-26";
const node = (tag, date, name = "demo.xpi") => ({
  tagName: tag, url: `https://github.com/alice/zotero-demo/releases/tag/${tag}`, publishedAt: `${date}T00:00:00Z`, isDraft: false, isPrerelease: false,
  releaseAssets: { nodes: [{ name, size: 1000, downloadUrl: `https://github.com/Alice/zotero-demo/releases/download/${tag}/${name}`, downloadCount: 12 }] },
});
const repoOf = (nodes) => ({ nameWithOwner: "Alice/zotero-demo", description: "demo", stargazerCount: 42, forkCount: 1, isArchived: false, watchers: { totalCount: 2 }, issues: { totalCount: 3 }, releases: { nodes, pageInfo: { hasNextPage: false } } });
const ctx = (over = {}) => ({
  plugins: [{ id: "other/plugin", zotero: { declared: true, majors: [10] } }],
  moderation: { authors: { Banned: "经社区管理决定下架。" } },
  today,
  fetchRepo: async () => ({ repo: repoOf([node("v1.0.0", "2026-11-20")]), nodes: [node("v1.0.0", "2026-11-20")], truncated: false }),
  fetchXpi: async () => xpi(),
  ...over,
});
const form = (over) => parseIssueForm(FORM(over));

test("合格的申请:收录,并带上适配范围、安装包、星标与插件标识", async () => {
  const r = await evaluateRequest(form(), ctx());
  assert.equal(r.status, "accepted");
  assert.equal(r.plugin.id, "alice/zotero-demo");
  assert.equal(r.plugin.author, "Alice");
  assert.equal(r.plugin.homepage, "https://github.com/Alice/zotero-demo");
  assert.equal(r.plugin.stars, 42);
  assert.equal(r.plugin.summary, "在阅读器里做双语对照");
  assert.deepEqual(r.plugin.zotero, { declared: true, majors: [7, 8] });
  assert.deepEqual(r.plugin.downloads.map((d) => d.t), [7, 8]);
  assert.equal(r.addonId, "demo@example.org");
  assert.equal(r.plugin.latest.version, "1.0.0");
});

test("适配范围只收 7–10:声明到 11 也不写 11(避免抬高「当前 Zotero 版本」影响其它插件的判断)", async () => {
  const r = await evaluateRequest(form(), ctx({ fetchXpi: async () => xpi({ strict_min_version: "10.0", strict_max_version: "11.*" }) }));
  assert.equal(r.status, "accepted");
  assert.deepEqual(r.plugin.zotero.majors, [10]);
});

test("不收的情形:认不出地址 / Gitee 转人工 / 已在目录 / 作者被排除 / 找不到仓库", async () => {
  assert.equal((await evaluateRequest(form({ repo: "没有地址" }), ctx())).code, "bad-repo");
  const g = await evaluateRequest(form({ repo: "https://gitee.com/a/b" }), ctx());
  assert.deepEqual([g.status, g.code], ["manual", "gitee"]);
  const e = await evaluateRequest(form({ repo: "https://github.com/Other/Plugin" }), ctx());
  assert.deepEqual([e.status, e.id], ["exists", "other/plugin"]);
  const m = await evaluateRequest(form({ repo: "https://github.com/banned/x" }), ctx());
  assert.equal(m.code, "moderation");
  assert.match(m.text, /经社区管理决定下架/);
  assert.equal((await evaluateRequest(form(), ctx({ fetchRepo: async () => null }))).code, "not-found");
  // 按作者隐藏:即使仓库已在目录里,也只回「暂不收录」,不说「已收录」,也不写原因
  const h = await evaluateRequest(form({ repo: "https://github.com/Hid/plugin" }), ctx({ plugins: [{ id: "hid/plugin", zotero: { declared: true, majors: [10] } }], moderation: { authors: {}, hiddenAuthors: ["hid"] } }));
  assert.equal(h.code, "moderation");
  assert.match(h.text, /暂不收录/);
});

test("发布页没有 .xpi / 安装包读不出清单 / 只适配 Zotero 6:各自写明原因,不收录", async () => {
  const none = { repo: repoOf([]), nodes: [], truncated: false };
  assert.equal((await evaluateRequest(form(), ctx({ fetchRepo: async () => none }))).code, "no-release");
  const wrongHost = { repo: repoOf([]), nodes: [{ ...node("v1", "2026-11-20"), releaseAssets: { nodes: [{ name: "a.xpi", size: 1, downloadUrl: "https://github.com/Evil/other/releases/download/v1/a.xpi", downloadCount: 0 }] } }], truncated: false };
  assert.equal((await evaluateRequest(form(), ctx({ fetchRepo: async () => wrongHost }))).code, "no-release"); // 安装包必须来自这个仓库
  assert.equal((await evaluateRequest(form(), ctx({ fetchXpi: async () => makeZip([{ name: "bootstrap.js", data: "x" }]) }))).code, "no-manifest");
  assert.equal((await evaluateRequest(form(), ctx({ fetchXpi: async () => { throw new Error("HTTP 500"); } }))).code, "xpi-unreadable");
  const z6 = await evaluateRequest(form(), ctx({ fetchXpi: async () => xpi({ strict_min_version: "5.0", strict_max_version: "6.*" }) }));
  assert.equal(z6.code, "no-zotero7");
});

test("发布太久远:按收录规则第 3 章的自动下架条件,不会一收录就下架", async () => {
  const old = { repo: repoOf([node("v0.1.0", "2023-01-01")]), nodes: [node("v0.1.0", "2023-01-01")], truncated: false };
  const r = await evaluateRequest(form(), ctx({ fetchRepo: async () => old }));
  assert.equal(r.code, "delisted");
  assert.match(r.text, /超过 2 年/);
});

test("公开回复:已收录与已存在带站内链接;每种结果的隐藏标记不同,改过申请内容(哈希变了)会重新回复", () => {
  assert.match(replyText({ status: "accepted", id: "a/b", name: "N", category: "reading" }), /https:\/\/zoterocn\.org\/plugins\/a\/b/);
  assert.match(replyText({ status: "exists", id: "a/b" }), /已经在目录里/);
  assert.equal(replyText({ status: "rejected", text: "原因" }), "原因");
  assert.notEqual(markerOf("rejected", "no-release", "aaaa1111"), markerOf("rejected", "no-release", "bbbb2222"));
  assert.notEqual(markerOf("rejected", "no-release", "aaaa1111"), markerOf("accepted", "-", "aaaa1111"));
});

test("回复文案不出现技术细节与本站运营方以外的口径", () => {
  const all = [
    replyText({ status: "accepted", id: "a/b", name: "N", category: "reading" }),
    replyText({ status: "exists", id: "a/b" }),
  ].join("\n");
  // 禁用词运行时拼接,免得这个测试文件自己把它们写进仓库
  const banned = new RegExp(["ai4", "paper"].join("") + "|" + ["阅读", "宇宙"].join("") + "|token|令牌|密钥", "i");
  assert.doesNotMatch(all, banned);
});

test("列出打开的 Issue:去掉 PR、按编号排序、满一页继续翻页", async () => {
  const pages = [
    Array.from({ length: 100 }, (_, i) => ({ number: 300 - i })),
    [{ number: 5, pull_request: {} }, { number: 4 }],
  ];
  let n = 0;
  const out = await listOpenIssues("t", async () => pages[n++]);
  assert.equal(n, 2);
  assert.equal(out.length, 101);
  assert.equal(out[0].number, 4);
  assert.ok(!out.some((i) => i.number === 5));
});
