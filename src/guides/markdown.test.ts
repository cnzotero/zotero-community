import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { blocksToHtml, parseArticle, parseBlocks, parseFrontmatter, parseInline, wordCount } from "./markdown.ts";
import { ORDER_RANGES, isGuideCategory } from "./categories.ts";
import { routeFromPath } from "../router.ts";

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

test("文件头:分类取固定值;不认识的字段忽略不报错;分类写错直接报错", () => {
  const fm = (extra: string) => `---\ntitle: "T"\nslug: "a"\norder: 300\n${extra}\n---\n正文`;
  assert.equal(parseFrontmatter(fm('category: "styles"')).meta.category, "styles");
  assert.equal(parseFrontmatter(fm("category: library")).meta.category, "library");
  assert.equal(parseFrontmatter(fm("")).meta.category, undefined);
  // 同事并行新增的文稿可能带新字段:忽略,不影响其他字段
  const { meta } = parseFrontmatter(fm('cover: "x.png"\nauthor: "某人"\ncategory: "writing"\ntags:\n  - "a"'));
  assert.equal(meta.category, "writing");
  assert.equal(meta.order, 300);
  assert.deepEqual(meta.sources, []);
  assert.throws(() => parseFrontmatter(fm('category: "Styles"')), /category/);
  assert.throws(() => parseFrontmatter(fm('category: "misc"')), /category/);
});

test("HTML 注释(截图拍摄清单)不进页面,单行与多行都跳过", () => {
  const b = parseBlocks("前一段\n<!-- 截图:演示 -->\n\n<!--\n多行\n注释 -->\n后一段");
  assert.deepEqual(b.map((x) => x.t), ["p", "p"]);
  assert.ok(!blocksToHtml(b).includes("截图") && !blocksToHtml(b).includes("&lt;!--"));
});

const GUIDE_DIR = new URL("../content/guides/", import.meta.url);
const guideFiles = () => readdirSync(GUIDE_DIR).filter((f) => f.endsWith(".md"));

test("真实教程文稿:全部能解析,slug 唯一、分类与 order 区间对应、来源是 https 链接、没有运营者信息", () => {
  const files = guideFiles();
  assert.ok(files.length >= 15);
  const arts = files.map((f) => parseArticle(readFileSync(new URL(f, GUIDE_DIR), "utf8")));
  assert.equal(new Set(arts.map((a) => a.slug)).size, arts.length);
  assert.equal(new Set(arts.map((a) => a.order)).size, arts.length, "order 不能重复");
  for (const a of arts) {
    assert.ok(a.category && isGuideCategory(a.category), `${a.slug} 缺少分类`);
    const [lo, hi] = ORDER_RANGES[a.category];
    assert.ok(a.order >= lo && a.order <= hi, `${a.slug} 的 order ${a.order} 不在 ${a.category} 区间 ${lo}–${hi}`);
    assert.ok(a.sources.length > 0 && a.sources.every((s) => /^https:\/\//.test(s)), a.slug);
    assert.ok(a.blocks.length > 5 && wordCount(a.blocks) > 500, `${a.slug} 内容过短`);
    const html = blocksToHtml(a.blocks);
    // 运营者相关字样与本机路径不应出现在公开内容里;词本身在运行时拼接,避免仓库里出现这些字样
    const banned = new RegExp([["ai4", "paper"].join(""), ["阅读", "宇宙"].join(""), "\\/Users\\/"].join("|"), "i");
    assert.ok(!banned.test(a.title + a.description + html), `${a.slug} 含有不应公开的信息`);
  }
});

test("真实教程文稿:站内链接都能打开(教程链接指向已有文章,其余是站内已有页面),没有残留的相对路径或截图注释", () => {
  const files = guideFiles();
  const srcs = files.map((f) => readFileSync(new URL(f, GUIDE_DIR), "utf8"));
  const slugs = new Set(srcs.map((s) => parseArticle(s).slug));
  for (const src of srcs) {
    const a = parseArticle(src);
    const links = a.blocks.flatMap((b) => (b.t === "ul" || b.t === "ol" ? b.items.flat() : b.t === "code" ? [] : b.inline)).filter((x) => x.t === "link");
    for (const l of links) {
      if (l.t !== "link" || l.external) continue;
      const g = /^\/guides\/([a-z0-9-]+)$/.exec(l.href);
      if (g) assert.ok(slugs.has(g[1]), `${a.slug} 链接到不存在的教程:${l.href}`);
      else assert.notEqual(routeFromPath(l.href), "notfound", `${a.slug} 链接到站内不存在的页面:${l.href}`);
    }
    // 原稿里的 ../xxx.md 之类相对链接会被当成普通文字,必须全部改成站内路径
    assert.ok(!/\]\((?!https:\/\/|\/)[^)]*\)/.test(src.replace(/^---[\s\S]*?---/, "")), `${a.slug} 还有相对链接`);
    assert.ok(!blocksToHtml(a.blocks).includes("&lt;!--"), `${a.slug} 注释漏进了页面`);
  }
});

test("教程单一来源:docs/ 下已发布的篇目只剩指向站内的说明,不再留一份正文", () => {
  const slugs = new Set(guideFiles().map((f) => parseArticle(readFileSync(new URL(f, GUIDE_DIR), "utf8")).slug));
  const docs = new URL("../../docs/", import.meta.url);
  for (const dir of ["getting-started", "plugins", "styles", "sync-backup"]) {
    for (const f of readdirSync(new URL(`${dir}/`, docs)).filter((x) => x.endsWith(".md"))) {
      const src = readFileSync(new URL(`${dir}/${f}`, docs), "utf8");
      const m = /https:\/\/zoterocn\.org\/guides\/([a-z0-9-]+)/.exec(src);
      assert.ok(m && slugs.has(m[1]), `docs/${dir}/${f} 没有指向站内已有教程`);
      assert.ok(src.length < 600 && !src.includes("## 操作步骤"), `docs/${dir}/${f} 仍留有正文`);
    }
  }
});
