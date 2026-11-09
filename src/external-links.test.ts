import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

// 站内跳转用 <Link>;凡是直接写 <a href=...> 的都是外链,必须新标签打开并带 noopener,
// 避免 GitHub 等外链把用户从站点里带走,或让对方页面拿到 window.opener。
test("所有直接写的 <a href> 外链都带 target=_blank 与 rel=noopener", () => {
  const bad: string[] = [];
  for (const file of walk("src")) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/<a\b[^>]*?>/gs)) {
      const tag = m[0];
      if (!/href=/.test(tag)) continue;
      if (/href=\{to\}/.test(tag)) continue; // Link 组件内部的站内链接
      if (!/target="_blank"/.test(tag) || !/rel="noopener noreferrer"/.test(tag)) bad.push(`${file}: ${tag.slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, []);
});
