#!/usr/bin/env node
// 自动收录:把公开仓库里「申请收录」的 Issue 按收录规则统一核对,合格的直接收录,不合格的公开回复原因。
// 规则只有一套、对所有申请一视同仁:不看申请人是谁、插件叫什么、功能是否与别的插件相近。
//
// 用法(令牌只从环境变量读取;在 GitHub Actions 里就是内置的 GITHUB_TOKEN):
//   GITHUB_TOKEN=… node --experimental-strip-types scripts/intake.mjs apply [--dry-run]   核对申请,收录合格的(写 src/data,并留下 intake-results.json)
//   GITHUB_TOKEN=… node --experimental-strip-types scripts/intake.mjs notify [--dry-run]  构建发布成功后,按 intake-results.json 在 Issue 里公开回复、关闭已收录的
// 两步分开:收录写进数据后还要测试、构建、发布,回复「已收录」要等网站真的发布之后。
//
// 核对内容(都来自公开数据,不执行任何内容):
//   1. 仓库地址是 GitHub 公开仓库(安装包下载直链要求在 github.com 的发布页;Gitee 仓库留给维护者人工评估);
//   2. 不在目录里(已在目录里的直接回复并关闭,是否展示由收录规则第 3 章自动判断);
//   3. 作者没有被社区管理决定排除(src/data/moderation.json);
//   4. 最新的正式发布里有通过目录源同一份校验的 .xpi 安装包,且安装包里能读到版本号;
//   5. 安装包声明了适配范围时,至少覆盖 Zotero 7 及以上的一个大版本;
//   6. 按收录规则第 3 章的自动下架条件算一遍,不会一收录就被下架。
// 分类与简介取自申请表和仓库公开信息;分类按关键词归入,不合适可以由维护者在数据里更正。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS, FAILED, fetchMorePages, gql, pushHistory, q, refreshPlugin, pickLatestRelease, xpiInfo } from "./refresh-plugins.mjs";
import { ADDON_IDS_FILE, MAX_XPI_BYTES, addonIdFromXpi, addonIdsJson, downloadXpi } from "./import-addon-ids.mjs";
import { PLUGINS_FILE } from "./catalog.ts";
import { ZOTERO_VERSIONS, compareVersions } from "../src/plugins/lib.ts";
import { currentZoteroMajor, evaluatePlugin } from "../src/plugins/lifecycle.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HISTORY_FILE = resolve(root, "src/data/history.json");
const MODERATION_FILE = resolve(root, "src/data/moderation.json");
export const RESULTS_FILE = resolve(root, "intake-results.json");
export const REPO = "cnzotero/zotero-community";
const SITE = "https://zoterocn.org";
const MAX_PER_RUN = 20; // 一次最多收录几个:申请一下子来很多时分几次处理,单次出错的影响也小

// ---------- 解析申请表 ----------

/** 解析「申请收录插件」表单生成的 Issue 正文;不是这个表单(缺少插件名称或仓库地址)返回 null。 */
export function parseIssueForm(body) {
  const fields = {};
  for (const part of String(body ?? "").replace(/\r/g, "").split(/^### +/m).slice(1)) {
    const nl = part.indexOf("\n");
    const label = (nl < 0 ? part : part.slice(0, nl)).trim();
    const value = nl < 0 ? "" : part.slice(nl + 1).trim();
    fields[label] = value === "_No response_" ? "" : value;
  }
  const keyOf = (prefix) => Object.keys(fields).find((k) => k.startsWith(prefix));
  if (!keyOf("插件名称") || !keyOf("公开仓库地址")) return null;
  const pick = (prefix) => fields[keyOf(prefix)] ?? "";
  return { name: pick("插件名称"), repo: pick("公开仓库地址"), zotero: pick("适配的 Zotero 版本"), purpose: pick("一两句用途说明"), release: pick("作者发布页") };
}

/** 从文字里认出仓库地址:{ host: "github.com" | "gitee.com", owner, repo };认不出来返回 null。 */
export function parseRepoUrl(text) {
  const m = /https?:\/\/(?:www\.)?(github\.com|gitee\.com)\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?=[/?#\s)>\]"']|$)/i.exec(String(text ?? ""));
  return m ? { host: m[1].toLowerCase(), owner: m[2], repo: m[3] } : null;
}

const CONTROL = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g;

/** 去掉控制字符、双向文字控制符、链接与 Markdown 符号,合并空白,超长截断。 */
export function cleanText(s, max) {
  const t = String(s ?? "")
    .replace(CONTROL, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[`*_#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** 简介:取用途说明的第一句(没有就用仓库简介),不超过 100 字。 */
export function summaryOf(purpose, fallback) {
  const text = cleanText(purpose, 600) || cleanText(fallback, 600);
  const first = /^(.+?[。！？!?]|.+?\.(?=\s))/.exec(text)?.[1] ?? text;
  return cleanText(first.replace(/[。.]$/, ""), 100);
}

// 分类:按名称、简介与仓库简介里的关键词计数;并列时按下面的先后取。只是起点,维护者可以更正。
const CATEGORY_WORDS = [
  ["ai", ["ai", "gpt", "llm", "大模型", "chatgpt", "claude", "openai", "gemini", "deepseek", "agent", "mcp", "智能", "总结", "摘要"]],
  ["integration", ["wps", "word", "obsidian", "notion", "logseq", "latex", "bibtex", "anki", "overleaf", "bridge", "集成", "联动", "同步到"]],
  ["reading", ["阅读", "翻译", "translat", "reader", "pdf", "批注", "annotation", "双语", "bilingual", "对照", "highlight", "高亮"]],
  ["notes", ["笔记", "note", "markdown"]],
  ["metadata", ["metadata", "元数据", "doi", "期刊", "journal", "citation", "题录", "查重", "去重", "duplicate", "影响因子", "isbn"]],
  ["attachment", ["附件", "attachment", "重命名", "rename", "webdav", "文件管理", "file"]],
  ["interface", ["界面", "theme", "主题", "column", "标签页", "tab", "ui", "style"]],
  ["writing", ["写作", "writing", "参考文献", "bibliography", "引文", "引用"]],
  ["visualization", ["可视化", "graph", "图谱", "chart", "visual"]],
];

export function classify(text) {
  const t = String(text ?? "").toLowerCase();
  let best = "utility", score = 0;
  for (const [key, words] of CATEGORY_WORDS) {
    const n = words.reduce((c, w) => c + (/^[a-z0-9 ]+$/.test(w) ? (new RegExp(`(^|[^a-z0-9])${w}`).test(t) ? 1 : 0) : t.includes(w) ? 1 : 0), 0);
    if (n > score) { best = key; score = n; }
  }
  return best;
}

// ---------- 核对 ----------

const covers = (min, max, major) => {
  const v = String(major);
  return !(min && compareVersions(v, min) < 0) && !(max && compareVersions(v, max) > 0);
};

const reject = (code, text) => ({ status: "rejected", code, text });
const RECHECK = "改好后会自动重新检查(编辑本 Issue、作者发布新版本,或每天的定时检查都会触发),不用另开新的申请。";

/** 读安装包:版本与适配范围、插件标识(只读 manifest.json 一个文件)。 */
const parseXpi = (buf) => ({ info: xpiInfo(buf), addonId: addonIdFromXpi(buf) });

/**
 * 核对一条申请。ctx:{ plugins(全部,含下架), moderation, today, fetchRepo(id) → { repo, nodes, truncated } | null,
 * fetchXpi(url) → Buffer, log? }。
 * 返回 { status: "accepted", plugin, addonId } | { status: "exists", id } | { status: "rejected", code, text }。
 */
export async function evaluateRequest(form, ctx) {
  const { plugins, moderation, today, fetchRepo, fetchXpi, log = () => {} } = ctx;
  const ref = parseRepoUrl(form.repo);
  if (!ref) return reject("bad-repo", `没有从「公开仓库地址」里认出仓库地址,请填写形如 https://github.com/作者/仓库 的地址。${RECHECK}`);
  if (ref.host === "gitee.com") {
    return { status: "manual", code: "gitee", text: "目前自动收录只处理 GitHub 仓库(安装包下载直链要求在 github.com 的发布页)。这条申请留给维护者人工评估,请耐心等待。" };
  }
  const id = `${ref.owner}/${ref.repo}`.toLowerCase();
  const known = plugins.find((p) => p.id.toLowerCase() === id);
  if (known) return { status: "exists", id: known.id };
  const banned = Object.entries(moderation?.authors ?? {}).find(([a]) => a.toLowerCase() === ref.owner.toLowerCase());
  if (banned) return reject("moderation", `按社区管理决定,该作者的插件暂不收录(${String(banned[1]).replace(/。$/, "")})。如有异议,请在这里说明。`);

  const got = await fetchRepo(id);
  if (!got) return reject("not-found", `没有找到公开仓库 ${ref.owner}/${ref.repo},请确认地址拼写、且仓库是公开的。${RECHECK}`);
  const { repo, nodes, truncated } = got;
  const rel = pickLatestRelease(nodes, id, []);
  if (!rel?.asset) {
    return reject("no-release", `仓库的发布页(GitHub Releases)里没有找到可下载的 .xpi 安装包。收录要求在发布页提供 .xpi 安装包,且安装包地址来自这个仓库(见[收录规则](${SITE}/rules)第 2 条)。${RECHECK}`);
  }
  if (rel.asset.size > MAX_XPI_BYTES) return reject("xpi-too-big", "最新安装包超过 30 MB 的读取上限,暂时无法自动核对,已留给维护者人工评估。");
  let buf, parsed;
  try {
    buf = await fetchXpi(rel.asset.url);
    parsed = parseXpi(buf);
  } catch (e) {
    log(`${id} 安装包读取失败:${String(e).slice(0, 100)}`);
    return reject("xpi-unreadable", `读取最新发布(${rel.tag})的安装包时出错,稍后会自动重试。`);
  }
  const { info, addonId } = parsed;
  if (!info?.version) return reject("no-manifest", `最新发布(${rel.tag})的安装包里没有读到插件清单(manifest.json)或版本号。${RECHECK}`);
  const declared = !!(info.min || info.max);
  const majors = declared ? ZOTERO_VERSIONS.filter((t) => covers(info.min, info.max, t)) : [];
  if (declared && majors.length === 0) {
    return reject("no-zotero7", `最新安装包声明的适配范围是 Zotero ${info.min ?? "?"} 至 ${info.max ?? "?"},不含 Zotero 7 及以上版本(见[收录规则](${SITE}/rules)第 1 条)。${RECHECK}`);
  }

  const author = repo.nameWithOwner?.split("/")[0] ?? ref.owner;
  const p = {
    id,
    name: cleanText(form.name, 60) || ref.repo,
    summary: summaryOf(form.purpose, repo.description) || "(暂无简介)",
    category: classify([form.name, form.purpose, repo.description].join(" ")),
    author,
    homepage: `https://github.com/${repo.nameWithOwner ?? `${ref.owner}/${ref.repo}`}`,
    stars: 0,
    updated: "",
    zotero: { declared, majors },
    downloads: [],
  };
  const dl = await refreshPlugin(p, repo, nodes, truncated, { today, fetchXpi: async () => buf, log });
  p.zotero = { declared, majors };
  p.__dl = dl; // 写历史快照用,写入数据前去掉
  const verdict = evaluatePlugin(p, new Date(today), currentZoteroMajor([...plugins, p]));
  if (!verdict.listed) {
    delete p.__dl;
    return reject("delisted", `按[收录规则](${SITE}/rules)第 3 章的自动下架条件,这个插件目前不能展示:${verdict.reasonText}。${RECHECK}`);
  }
  return { status: "accepted", plugin: p, addonId };
}

// ---------- GitHub 接口 ----------

async function rest(token, method, path, body) {
  const r = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "zotero-community-intake", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}

/** 全部打开的 Issue(不含 PR),按编号从小到大。 */
export async function listOpenIssues(token, fetchRest = rest) {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await fetchRest(token, "GET", `/repos/${REPO}/issues?state=open&per_page=100&page=${page}`);
    out.push(...batch.filter((i) => !i.pull_request));
    if (batch.length < 100) break;
  }
  return out.sort((a, b) => a.number - b.number);
}

function makeFetchRepo(token) {
  return async (id) => {
    const [owner, name] = id.split("/");
    const query = `query { r: repository(owner: ${q(owner)}, name: ${q(name)}) { nameWithOwner description ${FIELDS.replace("%AFTER%", "")} } }`;
    let data = null;
    for (let i = 0; i < 3 && !data; i++) {
      const d = await gql(token, query);
      if (!d[FAILED].has("r")) data = d;
    }
    if (!data) throw new Error("GitHub 查询出错");
    const repo = data.r;
    if (!repo) return null;
    let nodes = (repo.releases?.nodes ?? []).filter(Boolean), truncated = false;
    if (repo.releases?.pageInfo?.hasNextPage) ({ nodes, truncated } = await fetchMorePages(token, id, repo));
    return { repo, nodes, truncated };
  };
}

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);
const hashOf = (s) => createHash("sha256").update(String(s ?? "")).digest("hex").slice(0, 8);
export const markerOf = (status, code, hash) => `<!-- cz-intake:${status}:${code ?? "-"}:${hash} -->`;

// ---------- apply ----------

async function apply(token, dryRun) {
  const today = new Date().toISOString().slice(0, 10);
  const data = readJson(PLUGINS_FILE, null);
  if (!data) throw new Error("读不到插件数据文件");
  const moderation = readJson(MODERATION_FILE, { authors: {} });
  const history = readJson(HISTORY_FILE, {});
  const addonIds = readJson(ADDON_IDS_FILE, {});
  const fetchRepo = makeFetchRepo(token);
  const results = [];
  let accepted = 0;
  for (const issue of await listOpenIssues(token)) {
    const form = parseIssueForm(issue.body);
    if (!form) continue;
    const hash = hashOf(issue.body);
    let r;
    try {
      if (accepted >= MAX_PER_RUN) { console.log(`#${issue.number} 本次收录已满 ${MAX_PER_RUN} 个,留到下次`); continue; }
      r = await evaluateRequest(form, { plugins: data.plugins, moderation, today, fetchRepo, fetchXpi: (u) => downloadXpi(u), log: (m) => console.warn(m) });
    } catch (e) {
      console.error(`#${issue.number} 核对出错,留到下次:${String(e).slice(0, 160)}`);
      continue;
    }
    const base = { number: issue.number, hash };
    if (r.status === "accepted") {
      const { plugin, addonId } = r;
      const dl = plugin.__dl;
      delete plugin.__dl;
      data.plugins.push(plugin);
      if (addonId) addonIds[plugin.id] = addonId;
      history[plugin.id] = pushHistory(history[plugin.id], today, plugin.stars, dl ?? null);
      accepted++;
      results.push({ ...base, status: "accepted", id: plugin.id, name: plugin.name, category: plugin.category });
      console.log(`#${issue.number} 收录 ${plugin.id}(${plugin.category},${plugin.stars} 星)`);
    } else if (r.status === "exists") {
      results.push({ ...base, status: "exists", id: r.id });
      console.log(`#${issue.number} 已在目录里:${r.id}`);
    } else {
      results.push({ ...base, status: r.status, code: r.code, text: r.text });
      console.log(`#${issue.number} ${r.status}:${r.code}`);
    }
  }
  if (dryRun) { console.log(`(试运行,未写入)将收录 ${accepted} 个`); return; }
  if (accepted > 0) {
    data.plugins.sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id));
    data.generatedAt = today;
    writeFileSync(PLUGINS_FILE, JSON.stringify(data));
    writeFileSync(HISTORY_FILE, JSON.stringify(history));
    writeFileSync(ADDON_IDS_FILE, addonIdsJson(addonIds));
  }
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`完成:处理 ${results.length} 条,收录 ${accepted} 个`);
}

// ---------- notify ----------

/** 公开回复的正文(不含隐藏标记)。 */
export function replyText(r) {
  if (r.status === "accepted") {
    return `已按[收录规则](${SITE}/rules)收录「${r.name}」。网站发布后(通常 15 分钟内)可以在插件广场看到:${SITE}/plugins/${r.id}\n\n- 简介、版本和安装包都取自仓库的公开信息;分类(${r.category})是按关键词归入的,不合适请在这里留言,维护者会更正。\n- 收录不代表对插件的安全性、稳定性或质量的背书。\n\n这是按统一规则自动处理的结果,如有不同意见请留言,维护者会复核。`;
  }
  if (r.status === "exists") {
    return `这个插件已经在目录里了:${SITE}/plugins/${r.id}\n\n是否展示由[收录规则](${SITE}/rules)第 3 章的自动判断决定;被下架的插件及原因见 ${SITE}/delisted ,作者发布新版本后会重新判断。本申请先关闭,如信息有误请另开「更正信息」。`;
  }
  return r.text;
}

async function notify(token, dryRun) {
  const results = readJson(RESULTS_FILE, []);
  for (const r of results) {
    const marker = markerOf(r.status, r.code, r.hash);
    try {
      const comments = await rest(token, "GET", `/repos/${REPO}/issues/${r.number}/comments?per_page=100`);
      const done = comments.some((c) => typeof c.body === "string" && c.body.includes(marker));
      const close = r.status === "accepted" || r.status === "exists";
      if (dryRun) { console.log(`#${r.number} ${r.status}${done ? "(已回复过)" : ""}${close ? " → 关闭" : ""}`); continue; }
      if (!done) await rest(token, "POST", `/repos/${REPO}/issues/${r.number}/comments`, { body: `${replyText(r)}\n\n${marker}` });
      if (close) await rest(token, "PATCH", `/repos/${REPO}/issues/${r.number}`, { state: "closed", state_reason: "completed" });
      console.log(`#${r.number} ${r.status}:已回复${close ? "并关闭" : ""}`);
    } catch (e) {
      console.error(`#${r.number} 回复出错:${String(e).slice(0, 160)}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { console.error("缺少环境变量 GITHUB_TOKEN"); process.exit(1); }
  const cmd = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (cmd === "apply") await apply(token, dryRun);
  else if (cmd === "notify") await notify(token, dryRun);
  else { console.error("用法:intake.mjs apply|notify [--dry-run]"); process.exit(1); }
}
