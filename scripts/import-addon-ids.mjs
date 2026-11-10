#!/usr/bin/env node
// 一次性、可重跑:为每个插件的安装包补上 Zotero 插件标识(xpi 里 manifest.json 的 applications.zotero.id),
// 写入 src/data/addon-ids.json。插件市场靠这个标识判断「是否已安装」。
// 来源按顺序:
//   1. zotero-chinese/zotero-plugins 项目公开的插件目录(MIT 协议;每个发布记录带 id 字段)——只采用安装包地址与本站完全一致的那一条;
//   2. 上游没有、或上游记录的安装包与本站不是同一个文件的,下载本站记录的 .xpi,只读取 zip 里根目录的 manifest.json
//      (仅限 github.com / gitee.com 的 https 直链,单个不超过 30MB;不解压其它文件、不执行任何内容)。
// 都取不到的就不写,构建目录源时那条发布记录不带标识(不推断)。
// 用法:node --experimental-strip-types scripts/import-addon-ids.mjs [--no-xpi]   --no-xpi:只用上游目录,不下载安装包
// 本站数据经 scripts/catalog.ts 的 PLUGINS_FILE 读取;这里需要全部插件(含下架的),作者发布新版本重新上架时标识已经备好。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { PLUGINS_FILE } from "./catalog.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ADDON_IDS_FILE = resolve(root, "src/data/addon-ids.json");

/** 上游公开目录(GitHub 上 gh-pages 分支的构建产物,公开可读)。 */
export const UPSTREAM_URL = "https://raw.githubusercontent.com/zotero-chinese/zotero-plugins/gh-pages/plugins.json";
export const MAX_XPI_BYTES = 30 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MIN_MAJOR = 7;

/** 本站接受的安装包地址:https、主机 github.com 或 gitee.com、以 .xpi 结尾(与站点 lib.ts 的规则一致)。 */
export function isAllowedXpiUrl(url) {
  return typeof url === "string" && /^https:\/\/(github\.com|gitee\.com)\/[^\s?#]+\.xpi$/i.test(url);
}

/** 下载安装包时允许跳转到的主机:代码托管站本身与它们的文件分发域名。 */
export function isAllowedDownloadHop(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname;
  return h === "github.com" || h === "gitee.com" || h.endsWith(".githubusercontent.com") || h.endsWith(".gitee.com");
}

/** 插件标识只接受常见的安全字符(邮箱式或 {GUID} 式),其它一律视为取不到。 */
export function isPlausibleAddonId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 200 && /^[A-Za-z0-9._+\-@{}]+$/.test(id);
}

/** 从 manifest.json 的内容里取 Zotero 插件标识;取不到返回 null。 */
export function addonIdFromManifest(manifest) {
  const id = manifest?.applications?.zotero?.id ?? manifest?.browser_specific_settings?.zotero?.id ?? null;
  return isPlausibleAddonId(id) ? id : null;
}

/**
 * 从 zip(xpi)里读出根目录 manifest.json 的文本;没有、加密、或格式不对返回 null。
 * 只解析中央目录与这一个条目,不解压其它文件。
 */
export function readZipManifest(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return null;
  // 中央目录结束记录:从文件尾往前找(注释最长 65535 字节)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name !== "manifest.json") continue;
    if (flags & 1) return null; // 加密
    if (csize === 0xffffffff || usize > MAX_MANIFEST_BYTES) return null;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) return null;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (start + csize > buf.length) return null;
    const data = buf.subarray(start, start + csize);
    try {
      if (method === 0) return data.toString("utf8");
      if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_MANIFEST_BYTES }).toString("utf8");
    } catch {
      return null;
    }
    return null;
  }
  return null;
}

/** 从 xpi 文件内容里取插件标识。 */
export function addonIdFromXpi(buf) {
  const text = readZipManifest(buf);
  if (text === null) return null;
  try {
    return addonIdFromManifest(JSON.parse(text.replace(/^﻿/, "")));
  } catch {
    return null;
  }
}

/** 上游目录 → Map<owner/repo(小写), [{ t, id, urls }]>。只收 Zotero 7 及以上、标识合法的发布记录。 */
export function upstreamIndex(upstream) {
  const out = new Map();
  for (const p of Array.isArray(upstream) ? upstream : []) {
    if (typeof p?.repo !== "string") continue;
    const rows = [];
    for (const r of p.releases ?? []) {
      const t = Number(r?.targetZoteroVersion);
      if (!Number.isInteger(t) || t < MIN_MAJOR || !isPlausibleAddonId(r?.id)) continue;
      const urls = Object.values(r.xpiDownloadUrl ?? {}).filter((u) => typeof u === "string");
      rows.push({ t, id: r.id, urls });
    }
    out.set(p.repo.toLowerCase(), rows);
  }
  return out;
}

/**
 * 逐个安装包(Zotero 7 及以上、地址合法)决定标识来源:上游有同一个大版本、且安装包地址完全一致的,直接用上游的标识;
 * 否则列入待下载清单(按地址去重)。返回 { found: Map<repo, Map<t, id>>, pending: Map<url, [{repo, t}]> }。
 */
export function resolveFromUpstream(plugins, index) {
  const found = new Map();
  const pending = new Map();
  for (const p of plugins) {
    for (const d of p.downloads ?? []) {
      if (!Number.isInteger(d?.t) || d.t < MIN_MAJOR || !isAllowedXpiUrl(d.u)) continue;
      const hit = (index.get(p.id) ?? []).find((r) => r.t === d.t && r.urls.includes(d.u));
      if (hit) {
        if (!found.has(p.id)) found.set(p.id, new Map());
        found.get(p.id).set(d.t, hit.id);
      } else {
        if (!pending.has(d.u)) pending.set(d.u, []);
        pending.get(d.u).push({ repo: p.id, t: d.t });
      }
    }
  }
  return { found, pending };
}

/** 写文件用的紧凑形式:同一插件各大版本标识相同时写成字符串,不同时写成 { "大版本": 标识 }。键按字母排序。 */
export function compactIds(found) {
  const out = {};
  for (const repo of [...found.keys()].sort()) {
    const byT = found.get(repo);
    if (byT.size === 0) continue;
    const ids = new Set(byT.values());
    if (ids.size === 1) out[repo] = [...ids][0];
    else out[repo] = Object.fromEntries([...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, id]) => [String(t), id]));
  }
  return out;
}

/** 构建时查标识:addon-ids.json 里某插件某大版本的标识;没有返回 null。 */
export function addonIdFor(map, repo, t) {
  const v = map?.[repo];
  if (typeof v === "string") return isPlausibleAddonId(v) ? v : null;
  if (v && typeof v === "object") {
    const id = v[String(t)];
    return isPlausibleAddonId(id) ? id : null;
  }
  return null;
}

export function addonIdsJson(map) {
  const keys = Object.keys(map).sort();
  return `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])}`).join(",\n")}\n}\n`;
}

/** 下载安装包:逐跳检查跳转目标,限制大小;任何一步不符合就放弃。fetchImpl 便于测试注入。 */
export async function downloadXpi(url, fetchImpl = fetch, maxBytes = MAX_XPI_BYTES) {
  if (!isAllowedXpiUrl(url)) throw new Error("安装包地址不在允许范围");
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    if (!isAllowedDownloadHop(current)) throw new Error(`跳转到了不允许的地址:${new URL(current).hostname}`);
    const res = await fetchImpl(current, { redirect: "manual", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "zotero-community-addon-ids" } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("跳转缺少目标地址");
      current = new URL(loc, current).href;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) throw new Error("安装包超过大小上限");
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error("安装包超过大小上限");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }
  throw new Error("跳转次数过多");
}

/** 主流程(可注入网络与读写,便于测试)。返回统计。 */
export async function importAddonIds({ plugins, upstream, useXpi = true, fetchXpi = downloadXpi, log = () => {} }) {
  const index = upstreamIndex(upstream);
  const { found, pending } = resolveFromUpstream(plugins, index);
  const failed = [];
  let fromXpi = 0;
  if (useXpi) {
    for (const [url, uses] of pending) {
      let id = null;
      try {
        id = addonIdFromXpi(await fetchXpi(url));
      } catch (e) {
        log(`读取失败 ${url}:${e.message}`);
      }
      if (!id) {
        failed.push(url);
        continue;
      }
      fromXpi++;
      for (const { repo, t } of uses) {
        if (!found.has(repo)) found.set(repo, new Map());
        found.get(repo).set(t, id);
      }
    }
  } else {
    failed.push(...pending.keys());
  }
  const map = compactIds(found);
  return { map, stats: { plugins: plugins.length, withId: Object.keys(map).length, xpiRead: fromXpi, pending: pending.size, failed } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const useXpi = !process.argv.includes("--no-xpi");
  const { plugins } = JSON.parse(readFileSync(PLUGINS_FILE, "utf8"));
  const res = await fetch(UPSTREAM_URL, { signal: AbortSignal.timeout(60_000), headers: { "user-agent": "zotero-community-addon-ids" } });
  if (!res.ok) throw new Error(`上游目录读取失败:HTTP ${res.status}`);
  const upstream = await res.json();
  const { map, stats } = await importAddonIds({ plugins, upstream, useXpi, log: (m) => console.warn(m) });
  writeFileSync(ADDON_IDS_FILE, addonIdsJson(map));
  console.log(`插件标识已写入 src/data/addon-ids.json:${stats.withId}/${stats.plugins} 个插件有标识;读取安装包 ${stats.xpiRead}/${stats.pending} 个;未取到 ${stats.failed.length} 个安装包`);
  for (const u of stats.failed) console.log(`  未取到:${u}`);
}
