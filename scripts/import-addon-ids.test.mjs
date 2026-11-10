import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import {
  ADDON_IDS_FILE, addonIdFor, addonIdFromManifest, addonIdFromXpi, addonIdsJson, compactIds, downloadXpi, importAddonIds, isAllowedDownloadHop,
  isPlausibleAddonId, readZipManifest, resolveFromUpstream, upstreamIndex,
} from "./import-addon-ids.mjs";

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

const MANIFEST = JSON.stringify({ manifest_version: 2, name: "X", version: "1.0", applications: { zotero: { id: "x@example.org", strict_min_version: "6.999" } } });

test("从 xpi 里读 manifest.json:存储与压缩两种方式都能读;只认根目录的 manifest.json", () => {
  assert.equal(addonIdFromXpi(makeZip([{ name: "bootstrap.js", data: "evil()" }, { name: "manifest.json", data: MANIFEST }])), "x@example.org");
  assert.equal(addonIdFromXpi(makeZip([{ name: "manifest.json", data: MANIFEST, deflate: true }])), "x@example.org");
  assert.equal(addonIdFromXpi(makeZip([{ name: "sub/manifest.json", data: MANIFEST }])), null);
  assert.equal(addonIdFromXpi(makeZip([{ name: "manifest.json", data: MANIFEST }], { encrypted: true })), null);
  assert.equal(addonIdFromXpi(makeZip([{ name: "manifest.json", data: "{not json" }])), null);
  assert.equal(addonIdFromXpi(Buffer.from("not a zip at all, just some bytes padding padding")), null);
  assert.equal(readZipManifest(Buffer.alloc(10)), null);
  // 带 BOM 的 manifest 也能读
  assert.equal(addonIdFromXpi(makeZip([{ name: "manifest.json", data: "﻿" + MANIFEST }])), "x@example.org");
});

test("manifest 里的标识:只认 Zotero 的标识字段,且只接受安全字符", () => {
  assert.equal(addonIdFromManifest({ applications: { zotero: { id: "a@b.c" } } }), "a@b.c");
  assert.equal(addonIdFromManifest({ browser_specific_settings: { zotero: { id: "{12345678-aaaa-bbbb-cccc-1234567890ab}" } } }), "{12345678-aaaa-bbbb-cccc-1234567890ab}");
  assert.equal(addonIdFromManifest({ applications: { gecko: { id: "a@b.c" } } }), null);
  assert.equal(addonIdFromManifest({ applications: { zotero: { id: "a b@c" } } }), null);
  assert.equal(addonIdFromManifest({ applications: { zotero: { id: "<script>@x" } } }), null);
  assert.equal(addonIdFromManifest(null), null);
  assert.ok(!isPlausibleAddonId("x".repeat(201)));
});

const UPSTREAM = [
  {
    repo: "Owner/Repo",
    releases: [
      { targetZoteroVersion: "10", id: "new@x", xpiDownloadUrl: { github: "https://github.com/Owner/Repo/releases/download/v2/a.xpi" } },
      { targetZoteroVersion: "7", id: "old@x", xpiDownloadUrl: { github: "https://github.com/Owner/Repo/releases/download/v1/a.xpi" } },
      { targetZoteroVersion: "6", id: "z6@x", xpiDownloadUrl: { github: "https://github.com/Owner/Repo/releases/download/v0/a.xpi" } },
    ],
  },
  { repo: "same/one", releases: [{ targetZoteroVersion: "8", id: "s@x", xpiDownloadUrl: { github: "https://github.com/same/one/releases/download/v1/s.xpi" } }, { targetZoteroVersion: "9", id: "s@x", xpiDownloadUrl: { github: "https://github.com/same/one/releases/download/v1/s.xpi" } }] },
];
const PLUGINS = [
  { id: "owner/repo", downloads: [{ t: 10, u: "https://github.com/Owner/Repo/releases/download/v2/a.xpi" }, { t: 7, u: "https://github.com/Owner/Repo/releases/download/v1/a.xpi" }, { t: 6, u: "https://github.com/Owner/Repo/releases/download/v0/a.xpi" }] },
  { id: "same/one", downloads: [{ t: 8, u: "https://github.com/same/one/releases/download/v1/s.xpi" }, { t: 9, u: "https://github.com/same/one/releases/download/v1/s.xpi" }] },
  // 上游有同一大版本,但安装包不是同一个文件:要下载本站记录的那个
  { id: "drift/ver", downloads: [{ t: 10, u: "https://github.com/drift/ver/releases/download/v3/d.xpi" }] },
  // 上游没有;地址不合法的不下载
  { id: "nope/bad", downloads: [{ t: 10, u: "https://evil.example.com/x.xpi" }] },
];

test("上游索引与匹配:只认同一大版本且安装包地址完全一致的记录;Zotero 6 不收", () => {
  const idx = upstreamIndex([...UPSTREAM, { repo: "drift/ver", releases: [{ targetZoteroVersion: "10", id: "d@x", xpiDownloadUrl: { github: "https://github.com/drift/ver/releases/download/v2/d.xpi" } }] }]);
  assert.deepEqual(idx.get("owner/repo").map((r) => r.t), [10, 7]);
  const { found, pending } = resolveFromUpstream(PLUGINS, idx);
  assert.deepEqual([...found.get("owner/repo").entries()], [[10, "new@x"], [7, "old@x"]]);
  assert.deepEqual([...pending.keys()], ["https://github.com/drift/ver/releases/download/v3/d.xpi"]);
});

test("紧凑形式:各版本相同写字符串,不同写按大版本的对象;查找两种形式都能用", () => {
  const found = new Map([["b/b", new Map([[8, "s@x"], [9, "s@x"]])], ["a/a", new Map([[10, "new@x"], [7, "old@x"]])]]);
  const map = compactIds(found);
  assert.deepEqual(Object.keys(map), ["a/a", "b/b"]);
  assert.deepEqual(map["a/a"], { 7: "old@x", 10: "new@x" });
  assert.equal(map["b/b"], "s@x");
  assert.equal(addonIdFor(map, "a/a", 7), "old@x");
  assert.equal(addonIdFor(map, "a/a", 8), null);
  assert.equal(addonIdFor(map, "b/b", 13), "s@x");
  assert.equal(addonIdFor(map, "c/c", 10), null);
  assert.deepEqual(JSON.parse(addonIdsJson(map)), map);
});

test("主流程:上游 + 读安装包;读不到的不写(不推断)", async () => {
  const fetched = [];
  const fetchXpi = async (u) => {
    fetched.push(u);
    if (u.includes("drift")) return makeZip([{ name: "manifest.json", data: JSON.stringify({ applications: { zotero: { id: "drift@x" } } }) }]);
    throw new Error("404");
  };
  const { map, stats } = await importAddonIds({ plugins: PLUGINS, upstream: UPSTREAM, fetchXpi });
  assert.deepEqual(fetched, ["https://github.com/drift/ver/releases/download/v3/d.xpi"]);
  assert.equal(map["drift/ver"], "drift@x");
  assert.ok(!("nope/bad" in map));
  assert.equal(stats.withId, 3);
  const off = await importAddonIds({ plugins: PLUGINS, upstream: UPSTREAM, useXpi: false, fetchXpi });
  assert.ok(!("drift/ver" in off.map));
  assert.equal(off.stats.failed.length, 1);
});

test("下载安装包:只从 github.com / gitee.com 出发,跳转只允许到它们的文件分发域名,超过大小上限放弃", async () => {
  assert.ok(isAllowedDownloadHop("https://objects.githubusercontent.com/x"));
  assert.ok(isAllowedDownloadHop("https://release-assets.githubusercontent.com/x"));
  assert.ok(!isAllowedDownloadHop("http://github.com/x"));
  assert.ok(!isAllowedDownloadHop("https://githubusercontent.com.evil.com/x"));
  assert.ok(!isAllowedDownloadHop("https://user:pw@github.com/x"));
  const resp = (status, headers = {}, body = []) => ({ status, ok: status >= 200 && status < 300, headers: new Headers(headers), body: (async function* () { yield* body; })() });
  // 跳转到别的主机:拒绝
  await assert.rejects(downloadXpi("https://github.com/a/b/releases/download/v1/a.xpi", async () => resp(302, { location: "https://evil.example.com/a.xpi" })), /不允许/);
  // 起点不合法:拒绝且不发请求
  let called = false;
  await assert.rejects(downloadXpi("https://evil.example.com/a.xpi", async () => ((called = true), resp(200))), /允许范围/);
  assert.equal(called, false);
  // 超过大小上限
  await assert.rejects(downloadXpi("https://github.com/a/b/releases/download/v1/a.xpi", async () => resp(200, { "content-length": "999" }), 100), /上限/);
  await assert.rejects(downloadXpi("https://github.com/a/b/releases/download/v1/a.xpi", async () => resp(200, {}, [Buffer.alloc(80), Buffer.alloc(80)]), 100), /上限/);
  // 正常:一次允许的跳转后拿到内容
  let n = 0;
  const buf = await downloadXpi("https://github.com/a/b/releases/download/v1/a.xpi", async () => (n++ === 0 ? resp(302, { location: "https://release-assets.githubusercontent.com/f" }) : resp(200, {}, [Buffer.from("ok")])));
  assert.equal(buf.toString(), "ok");
});

test("仓库里的 addon-ids.json:格式合法,键都是小写 owner/repo,标识都是安全字符", () => {
  const map = JSON.parse(readFileSync(ADDON_IDS_FILE, "utf8"));
  assert.ok(Object.keys(map).length > 0);
  for (const [repo, v] of Object.entries(map)) {
    assert.match(repo, /^[a-z0-9._-]+\/[a-z0-9._-]+$/, repo);
    const ids = typeof v === "string" ? [v] : Object.entries(v).map(([t, id]) => (assert.match(t, /^\d+$/), id));
    for (const id of ids) assert.ok(isPlausibleAddonId(id), `${repo} ${id}`);
  }
});
