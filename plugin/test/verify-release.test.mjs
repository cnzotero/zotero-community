import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ADDON_ID, releaseXpiUrl, sha256 } from "../scripts/build.mjs";
import { verifyRelease } from "../scripts/verify-release.mjs";

/** 用 zip 命令打一个只含 manifest.json 的小安装包。 */
function makeXpi(dir, name, manifest) {
  const src = join(dir, `src-${name}`);
  mkdirSync(src);
  writeFileSync(join(src, "manifest.json"), JSON.stringify(manifest));
  const out = join(dir, `${name}.xpi`);
  execFileSync("zip", ["-q", "-X", out, "manifest.json"], { cwd: src });
  return out;
}

/** 本地假服务器:routes 是 { 路径: (req, res) => void }。 */
async function serve(routes) {
  const server = createServer((req, res) => {
    const h = routes[req.url];
    if (h) h(req, res);
    else {
      res.statusCode = 404;
      res.end("not found");
    }
  });
  await new Promise((r) => server.listen(0, "localhost", r));
  const base = `http://localhost:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

const send = (body, type = "application/octet-stream") => (req, res) => {
  res.setHeader("content-type", type);
  res.end(body);
};

test("发布核对:安装包与更新清单都能下载,大小、哈希、版本号与本地一致才通过", async () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-"));
  const good = makeXpi(dir, "good", { manifest_version: 2, version: "0.2.0", applications: { zotero: { id: ADDON_ID } } });
  const other = makeXpi(dir, "other", { manifest_version: 2, version: "0.2.0", applications: { zotero: { id: ADDON_ID } }, description: "不同的文件" });
  const wrongVer = makeXpi(dir, "wrongver", { manifest_version: 2, version: "0.1.9", applications: { zotero: { id: ADDON_ID } } });
  const goodHash = sha256(readFileSync(good));
  let srv;
  const update = (version, path, hash = goodHash) => JSON.stringify({ addons: { [ADDON_ID]: { updates: [{ version, update_link: `${srv.base}${path}`, update_hash: `sha256:${hash}` }] } } });
  srv = await serve({
    "/update.json": (req, res) => send(update("0.2.0", "/dl/zotero-community.xpi"), "application/json")(req, res),
    "/update-missing.json": (req, res) => send(update("0.1.0", "/dl/zotero-community.xpi"))(req, res),
    "/update-404.json": (req, res) => send(update("0.2.0", "/gone.xpi"))(req, res),
    "/update-other.json": (req, res) => send(update("0.2.0", "/other.xpi"))(req, res),
    "/update-badhash.json": (req, res) => send(update("0.2.0", "/dl/zotero-community.xpi", "0".repeat(64)))(req, res),
    "/update-wrongver.json": (req, res) => send(update("0.2.0", "/wrongver.xpi", sha256(readFileSync(wrongVer))))(req, res),
    // Release 的固定下载地址会跳转到文件分发地址
    "/dl/zotero-community.xpi": (req, res) => {
      res.statusCode = 302;
      res.setHeader("location", "/assets/good");
      res.end();
    },
    "/assets/good": send(readFileSync(good)),
    "/other.xpi": send(readFileSync(other)),
    "/wrongver.xpi": send(readFileSync(wrongVer)),
  });
  try {
    const full = (path, o = {}) => verifyRelease({ version: "0.2.0", localXpi: good, updateUrl: `${srv.base}${path}`, expectedLink: null, ...o });
    const xpi = (path, o = {}) => verifyRelease({ version: "0.2.0", localXpi: good, xpiOnly: true, xpiUrl: `${srv.base}${path}`, ...o });
    // 第一步:只核对安装包(此时更新清单还没上传)
    const a = await xpi("/dl/zotero-community.xpi");
    assert.equal(a.ok, true);
    assert.equal(a.sha256, goodHash);
    await assert.rejects(xpi("/gone.xpi"), /返回 404/);
    await assert.rejects(xpi("/other.xpi"), /大小不一致|哈希/);
    // 第二步:更新清单 + 它指向的安装包
    const b = await full("/update.json", { expectedLink: `${srv.base}/dl/zotero-community.xpi` });
    assert.equal(b.ok, true);
    assert.equal(b.size, readFileSync(good).length);
    await assert.rejects(full("/update.json", { expectedLink: "https://github.com/x/y/releases/download/v/z.xpi" }), /不是预期的 Release 地址/);
    await assert.rejects(full("/update.json", { expectedLink: undefined }), /不是预期的 Release 地址/); // 默认要求 GitHub 上该版本的地址
    await assert.rejects(full("/update-missing.json"), /没有版本 0\.2\.0/);
    await assert.rejects(full("/update-404.json"), /返回 404/);
    await assert.rejects(full("/update-other.json"), /大小不一致|哈希/);
    await assert.rejects(full("/update-badhash.json"), /update_hash/);
    await assert.rejects(full("/update-wrongver.json", { localXpi: wrongVer }), /版本号是 0\.1\.9/);
    await assert.rejects(full("/nope.json"), /更新清单返回 404/);
    await assert.rejects(full("/update.json", { version: "1.0" }), /格式不对/);
    await assert.rejects(full("/update.json", { maxBytes: 10 }), /上限/);
  } finally {
    await srv.close();
  }
  assert.equal(releaseXpiUrl("0.1.0"), "https://github.com/cnzotero/zotero-community/releases/download/plugin-v0.1.0/zotero-community.xpi");
});
