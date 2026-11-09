import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { blocksToHtml, parseArticle, parseBlocks, parseFrontmatter, parseInline, wordCount } from "./markdown.ts";

test("文件头:标题、slug、顺序、来源列表;非法 slug 被拒绝", () => {
  const { meta, body } = parseFrontmatter('---\ntitle: "T：x"\ndescription: "D"\nslug: "a-1"\norder: 3\nsources:\n  - "https://a.com/x"\n  - "https://b.com"\n---\n\n# H\n正文');
  assert.deepEqual(meta, { title: "T：x", description: "D", slug: "a-1", order: 3, sources: ["https://a.com/x", "https://b.com"] });
  assert.equal(body.trim().startsWith("# H"), true);
  assert.throws(() => parseFrontmatter('---\ntitle: "t"\nslug: "../x"\n---\n'), /slug/);
  assert.throws(() => parseFrontmatter("没有文件头"), /文件头/);
});

test("行内:代码、加粗、链接;危险链接只留文字", () => {
  assert.deepEqual(parseInline("用 `npm start` 运行"), [{ t: "text", v: "用 " }, { t: "code", v: "npm start" }, { t: "text", v: " 运行" }]);
  assert.deepEqual(parseInline("**重要**"), [{ t: "strong", v: "重要" }]);
  assert.deepEqual(parseInline("[官方](https://www.zotero.org/x)"), [{ t: "link", v: "官方", href: "https://www.zotero.org/x", external: true }]);
  assert.deepEqual(parseInline("[规则](/rules)"), [{ t: "link", v: "规则", href: "/rules", external: false }]);
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "ftp://x.com"]) {
    const r = parseInline(`[点我](${bad})`);
    assert.ok(r.every((x) => x.t === "text"), `${bad} 不能变成链接`);
    assert.equal(r[0].v, "点我");
  }
});

test("块:标题(跳过首个一级标题)、段落合并、列表、代码块保持原样", () => {
  const b = parseBlocks("# 总标题\n\n## 小节\n第一行\n第二行\n\n- 甲\n- 乙\n  续行\n\n1. 步骤一\n2. 步骤二\n\n```sh\n# 注释\nnpm start\n```\n\n### 细节\n结尾");
  assert.deepEqual(b.map((x) => x.t), ["h2", "p", "ul", "ol", "code", "h3", "p"]);
  assert.equal((b[1] as any).inline[0].v, "第一行第二行"); // 中文换行不插入空格
  assert.equal((b[2] as any).items.length, 2);
  assert.equal((b[2] as any).items[1].map((x: any) => x.v).join(""), "乙 续行");
  assert.equal((b[4] as any).v, "# 注释\nnpm start");
});

test("HTML 输出全部转义,没有可执行内容", () => {
  const html = blocksToHtml(parseBlocks("## <img src=x onerror=1>\n\n正文 <script>alert(1)</script> [x](javascript:1)\n\n```\n<b>&</b>\n```"));
  assert.ok(!html.includes("<img") && !html.includes("<script>") && !html.includes("javascript:"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<pre><code>&lt;b&gt;&amp;&lt;\/b&gt;<\/code><\/pre>/);
});

test("真实教程文稿:全部能解析,slug 唯一、顺序连续、来源是 https 链接、没有运营者信息", () => {
  const dir = new URL("../content/guides/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  assert.ok(files.length >= 5);
  const arts = files.map((f) => parseArticle(readFileSync(new URL(f, dir), "utf8")));
  assert.equal(new Set(arts.map((a) => a.slug)).size, arts.length);
  assert.deepEqual(arts.map((a) => a.order).sort((a, b) => a - b), arts.map((_, i) => i + 1));
  for (const a of arts) {
    assert.ok(a.sources.length > 0 && a.sources.every((s) => /^https:\/\//.test(s)), a.slug);
    assert.ok(a.blocks.length > 5 && wordCount(a.blocks) > 500, `${a.slug} 内容过短`);
    const html = blocksToHtml(a.blocks);
    // 运营者相关字样与本机路径不应出现在公开内容里;词本身在运行时拼接,避免仓库里出现这些字样
    const banned = new RegExp([["ai4", "paper"].join(""), ["阅读", "宇宙"].join(""), "\\/Users\\/"].join("|"), "i");
    assert.ok(!banned.test(a.title + a.description + html), `${a.slug} 含有不应公开的信息`);
  }
});
