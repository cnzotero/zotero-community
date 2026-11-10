// 把内容有变化的页面地址通知支持 IndexNow 的搜索引擎(必应等),不用等它们自己来发现。
// 不需要任何账号或密钥保管:密钥就是站点根目录下那个公开的同名文本文件,用来证明「这些地址是本站自己提交的」。
//
//   node scripts/indexnow.mjs            # 只通知站点地图里更新日期是今天的地址(每日流水线用)
//   node scripts/indexnow.mjs --all      # 通知全部地址(首次接入或大改版后手动跑一次)
//   node scripts/indexnow.mjs --dry-run  # 只列出数量,不发送
//
// 数据源是刚构建出的 dist/sitemap.xml。密钥文件在线上还访问不到时(刚合并、服务器尚未同步)直接跳过,不报错。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SITE = "https://zoterocn.org";
export const INDEXNOW_KEY = "b9779a479426da7e092e5978824d8d15";
const BATCH = 10000; // 单次提交上限

export function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((m) => ({
      loc: /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1]?.replace(/&amp;/g, "&") ?? "",
      lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1] ?? "",
    }))
    .filter((e) => e.loc);
}

/** 只选本站地址;all 为假时只要更新日期等于 today 的。 */
export function selectUrls(entries, { all = false, today = "" } = {}) {
  return [...new Set(
    entries
      .filter((e) => e.loc === SITE + "/" || e.loc.startsWith(SITE + "/"))
      .filter((e) => all || e.lastmod === today)
      .map((e) => e.loc),
  )];
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const dryRun = args.includes("--dry-run");
  const today = new Date().toISOString().slice(0, 10);
  const xml = readFileSync(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
  const urls = selectUrls(parseSitemap(xml), { all, today });
  console.log(`待通知 ${urls.length} 个地址${dryRun ? "(dry-run,不发送)" : ""}`);
  if (dryRun || urls.length === 0) return;

  const keyUrl = `${SITE}/${INDEXNOW_KEY}.txt`;
  const live = await fetch(keyUrl).then(async (r) => r.ok && (await r.text()).trim() === INDEXNOW_KEY).catch(() => false);
  if (!live) {
    console.log("密钥文件线上还访问不到,本次跳过(下次运行再通知)");
    return;
  }
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key: INDEXNOW_KEY, keyLocation: keyUrl, urlList: batch }),
    });
    console.log(`  ${batch.length} 个地址 → HTTP ${res.status}`);
    if (res.status !== 200 && res.status !== 202) console.log("   ", (await res.text()).slice(0, 200));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 通知失败不应让发布流水线变红:网站本身已经发布成功
  main().catch((e) => { console.error("通知搜索引擎失败:", e?.message ?? e); });
}
