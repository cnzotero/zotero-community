#!/usr/bin/env node
// 发布后核对:GitHub 上的安装包与更新清单都与本地构建一致。
// 用法(在 plugin/ 目录下):
//   node scripts/verify-release.mjs <版本号> --xpi-only   只核对该版本 Release 里的安装包(上传更新清单之前先跑这一步)
//   node scripts/verify-release.mjs <版本号>              再核对固定地址的更新清单,及其 update_link 指向的安装包
// 本地文件默认 dist/zotero-community.xpi;核对项:下载返回 200、文件大小与 SHA-256 与本地一致、
// 包里 manifest 的版本号与插件标识正确;更新清单里有这个版本、update_link 是该版本的 Release 地址、update_hash 与本地一致。
import { readFileSync } from "node:fs";
import { ADDON_ID, OUT, UPDATE_URL, readZipFile, releaseXpiUrl, sha256 } from "./build.mjs";

const MAX_BYTES = 30 * 1024 * 1024;

async function download(fetchImpl, url, maxBytes, what) {
  const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (res.status !== 200) throw new Error(`${what}返回 ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error(`${what}超过大小上限`);
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`${what}超过大小上限`);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** 核对某个地址上的安装包与本地文件一致,且版本号、插件标识正确。 */
async function checkXpiAt(fetchImpl, url, local, version, maxBytes) {
  const remote = await download(fetchImpl, url, maxBytes, "安装包地址");
  if (remote.length !== local.length) throw new Error(`文件大小不一致:线上 ${remote.length},本地 ${local.length}`);
  if (sha256(remote) !== sha256(local)) throw new Error("文件哈希与本地构建不一致");
  const manifestBuf = readZipFile(remote, "manifest.json");
  if (!manifestBuf) throw new Error("安装包里没有 manifest.json");
  const manifest = JSON.parse(manifestBuf.toString("utf8"));
  if (manifest.version !== version) throw new Error(`安装包里的版本号是 ${manifest.version},不是 ${version}`);
  if (manifest.applications?.zotero?.id !== ADDON_ID) throw new Error("安装包里的插件标识不对");
  return remote;
}

/**
 * 核对发布。xpiOnly 为 true 时只核对该版本的安装包;否则先读更新清单,再核对它指向的安装包。
 * 返回 { ok: true, link, size, sha256 };不通过时抛出写明原因的错误。
 * updateUrl / xpiUrl / expectedLink / fetchImpl 便于测试时指向本地假服务器。
 */
export async function verifyRelease({ version, xpiOnly = false, localXpi = OUT, updateUrl = UPDATE_URL, xpiUrl = null, expectedLink = undefined, fetchImpl = fetch, maxBytes = MAX_BYTES }) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) throw new Error(`版本号格式不对:${version}`);
  const local = readFileSync(localXpi);
  const hash = sha256(local);
  if (xpiOnly) {
    const link = xpiUrl ?? releaseXpiUrl(version);
    await checkXpiAt(fetchImpl, link, local, version, maxBytes);
    return { ok: true, link, size: local.length, sha256: hash };
  }
  const update = JSON.parse((await download(fetchImpl, updateUrl, 1024 * 1024, "更新清单")).toString("utf8"));
  const entries = update?.addons?.[ADDON_ID]?.updates ?? [];
  const entry = entries.find((u) => u?.version === version);
  if (!entry) throw new Error(`更新清单里没有版本 ${version}`);
  const link = entry.update_link;
  const want = expectedLink === undefined ? releaseXpiUrl(version) : expectedLink;
  if (want && link !== want) throw new Error(`更新清单里的地址不是预期的 Release 地址:${link}`);
  if (entry.update_hash !== `sha256:${hash}`) throw new Error("更新清单里的 update_hash 与本地构建不一致");
  await checkXpiAt(fetchImpl, link, local, version, maxBytes);
  return { ok: true, link, size: local.length, sha256: hash };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const version = args.find((a) => !a.startsWith("--"));
  try {
    const r = await verifyRelease({ version, xpiOnly: args.includes("--xpi-only") });
    console.log(`核对通过:${r.link}\n  大小 ${r.size} 字节,SHA-256 ${r.sha256}`);
  } catch (e) {
    console.error(`核对失败:${e.message}`);
    process.exit(1);
  }
}
