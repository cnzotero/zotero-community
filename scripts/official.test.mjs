import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "./prerender.mjs";
import { OFFICIAL } from "../src/official/official.ts";
import { sortPlugins } from "../src/plugins/lib.ts";

const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, "plugin/addon/manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "plugin/package.json"), "utf8"));
const TEMPLATE = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><title>t</title></head><body><div id="root"></div><script type="module" src="/x.js"></script></body></html>`;
const mk = (id, stars, o = {}) => ({
  id, name: id.toUpperCase(), summary: "s", category: "reading", author: id.split("/")[0], homepage: `https://github.com/${id}`, stars, updated: "2026-11-01",
  zotero: { declared: true, majors: [7, 8, 9, 10] }, latest: { version: "1.0", date: "2026-11-01", releaseUrl: `https://github.com/${id}/releases/tag/v1` },
  downloads: [{ t: 10, v: "1.0", u: `https://github.com/${id}/releases/download/v1/a.xpi`, min: "7", max: "10.*" }], ...o,
});
const PLUGINS = [mk("a/low", 5), mk("b/top", 900), mk("c/mid", 50)];

let built;
async function site() {
  if (built) return built;
  const dir = mkdtempSync(join(tmpdir(), "official-"));
  writeFileSync(join(dir, "index.html"), TEMPLATE);
  const entries = await build(dir, PLUGINS, "2026-11-10", [], { dateOf: () => null });
  const read = (p) => readFileSync(p === "/" ? join(dir, "index.html") : join(dir, p, "index.html"), "utf8");
  built = { dir, entries, read };
  return built;
}

test("版本号与适配范围从插件 manifest 读取,与 package.json 一致;下载按钮指向该版本的发布页", () => {
  assert.equal(OFFICIAL.version, manifest.version);
  assert.equal(OFFICIAL.version, pkg.version);
  assert.equal(OFFICIAL.releaseUrl, `https://github.com/cnzotero/zotero-community/releases/tag/plugin-v${manifest.version}`);
  assert.equal(OFFICIAL.compatText, "适配 Zotero 7–10");
  assert.equal(OFFICIAL.name, manifest.name);
});

test("插件广场:社区官方插件单独展示在目录之外,不进排序结果、不参与计数,不伪造星标与下载数", async () => {
  const { read } = await site();
  const html = read("/plugins");
  const box = /<aside class="official-box" aria-label="社区官方插件">([\s\S]*?)<\/aside>/.exec(html);
  assert.ok(box, "有官方展示位");
  assert.match(box[1], /社区官方插件 · 由本社区维护/);
  assert.match(box[1], new RegExp(`当前版本 v<!-- -->${OFFICIAL.version.replace(/\./g, "\\.")}|当前版本 v${OFFICIAL.version.replace(/\./g, "\\.")}`));
  assert.match(box[1], /适配 Zotero 7–10/);
  assert.ok(box[1].includes(`href="${OFFICIAL.releaseUrl}" target="_blank" rel="noopener noreferrer"`));
  assert.match(box[1], /href="\/plugin"/);
  assert.ok(!/星标|下载次数|plugin-stats/.test(box[1]), "展示位里没有星标、下载等目录指标");
  // 展示位在搜索框与目录之前,不在目录卡片网格里
  assert.ok(html.indexOf('class="official-box"') < html.indexOf('class="grid plugin-grid"'));
  const grid = html.slice(html.indexOf('class="grid plugin-grid"'));
  assert.ok(!grid.includes(OFFICIAL.name) && !grid.includes("official-box"));
  // 计数与名次不变:收录数 = 目录插件数;第一张卡片仍是星标最多的
  assert.match(html, new RegExp(`收录 <b>${PLUGINS.length}</b> 款`));
  assert.match(html, new RegExp(`共 <!-- -->${PLUGINS.length}<!-- --> 款`));
  const ids = [...grid.matchAll(/<article class="card plugin-card"><a href="\/plugins\/([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, sortPlugins(PLUGINS, "stars").map((p) => p.id));
});

test("首页有社区官方插件入口;规则页写明单独展示、不参与排序", async () => {
  const { read } = await site();
  assert.match(read("/"), /<aside class="official-box official-compact" aria-label="社区官方插件">/);
  const rules = read("/rules");
  const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");
  const EXC = "唯一例外是本社区自己维护的「Zotero中文社区」插件,它在插件广场顶部单独展示,不参与排序和计数,不接受其他插件申请这一位置。";
  // 规则页:口径是「目录内的插件」没有推荐位与付费置顶,并写明唯一例外
  assert.ok(text(rules).includes("目录内的插件没有推荐位、没有付费置顶,也没有广告位。" + EXC));
  assert.ok(text(rules).includes("社区官方插件单独展示(唯一例外):本社区自己维护的「Zotero中文社区」插件在插件广场顶部单独展示,不在插件目录里,不参与排序和计数,也不影响其他插件的收录与排序规则;这一位置不接受其他插件申请。"));
  assert.ok(text(read("/about")).includes("一视同仁:目录内的插件没有推荐位、没有付费置顶。" + EXC));
  // 各页面与描述里不再有不加限定的「没有推荐位 / 没有置顶」说法
  for (const p of ["/", "/rules", "/about", "/plugins", "/plugin"]) {
    const t = text(read(p));
    for (const m of t.matchAll(/(?:没有|不设|无)[^。;,]{0,6}(?:推荐位|置顶)/g)) {
      const before = t.slice(Math.max(0, m.index - 12), m.index);
      assert.ok(/目录内|目录使用同一套规则,目录内的插件/.test(before) || before.includes("目录内的插件"), `${p} 有不加限定的说法:…${before}${m[0]}`);
    }
  }
});

test("介绍页 /plugin:进 sitemap,带 SoftwareApplication 结构化数据,版本与下载地址来自 manifest", async () => {
  const { dir, entries, read } = await site();
  assert.ok(entries.some((e) => e.path === "/plugin"));
  assert.match(readFileSync(join(dir, "sitemap.xml"), "utf8"), /<loc>https:\/\/zoterocn\.org\/plugin<\/loc>/);
  const html = read("/plugin");
  assert.match(html, /<link rel="canonical" href="https:\/\/zoterocn\.org\/plugin" \/>/);
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const app = lds.find((j) => j["@type"] === "SoftwareApplication");
  assert.equal(app.softwareVersion, manifest.version);
  assert.equal(app.downloadUrl, `https://github.com/cnzotero/zotero-community/releases/download/plugin-v${manifest.version}/zotero-community.xpi`);
  assert.equal(app.installUrl, OFFICIAL.releaseUrl);
  for (const h of ["它能做什么", "安装四步", "适配版本", "隐私", "常见问题"]) assert.match(html, new RegExp(`<h2>${h}</h2>`), h);
  assert.match(html, /src="\/images\/plugin\/install-flow\.webp"/);
  assert.ok(readFileSync(join(root, "public/images/plugin/install-flow.webp")).length > 0);
});
