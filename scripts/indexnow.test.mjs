import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { INDEXNOW_KEY, parseSitemap, selectUrls, SITE } from "./indexnow.mjs";

const xml = `<urlset>
<url><loc>${SITE}/</loc><lastmod>2026-11-10</lastmod></url>
<url><loc>${SITE}/plugins?a=1&amp;b=2</loc><lastmod>2026-11-09</lastmod></url>
<url><loc>${SITE}/rules</loc><lastmod>2026-11-10</lastmod></url>
<url><loc>https://example.org/x</loc><lastmod>2026-11-10</lastmod></url>
</urlset>`;

test("只通知更新日期是今天的本站地址", () => {
  assert.deepEqual(selectUrls(parseSitemap(xml), { today: "2026-11-10" }), [`${SITE}/`, `${SITE}/rules`]);
});

test("--all 通知全部本站地址,外站地址永不提交", () => {
  const urls = selectUrls(parseSitemap(xml), { all: true });
  assert.deepEqual(urls, [`${SITE}/`, `${SITE}/plugins?a=1&b=2`, `${SITE}/rules`]);
});

test("密钥文件随站点发布,内容与脚本里的一致", () => {
  const file = new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url);
  assert.ok(existsSync(file));
  assert.equal(readFileSync(file, "utf8").trim(), INDEXNOW_KEY);
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
});
