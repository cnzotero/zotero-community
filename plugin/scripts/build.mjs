#!/usr/bin/env node
// 打包:把 addon/ 目录(加上 LICENSE)打成 dist/zotero-community.xpi(zip 格式,manifest.json 在根目录),校验包的结构,
// 并生成发布时上传到 GitHub「release」条目的更新清单 dist/update.json。
// 打包可复现:文件按名称排序、修改时间统一固定、不带系统扩展属性,同一份源码与同一版 zip 工具得到逐字节相同的包。
// 用法:node scripts/build.mjs        (在 plugin/ 目录下运行,或 npm run build)
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADDON = join(root, "addon");
export const OUT = join(root, "dist", "zotero-community.xpi");
export const UPDATE_OUT = join(root, "dist", "update.json");
export const ADDON_ID = "zotero-community@zoterocn.org";
/** 更新清单的固定地址:GitHub 上 tag 为 release 的条目里的附件(与 manifest 的 update_url 一致,有测试核对)。 */
export const UPDATE_URL = "https://github.com/cnzotero/zotero-community/releases/download/release/update.json";
/** 某个版本的安装包地址:该版本 Release 的附件。 */
export const releaseXpiUrl = (version) => `https://github.com/cnzotero/zotero-community/releases/download/plugin-v${version}/zotero-community.xpi`;
/** 包内文件统一使用的修改时间(UTC)。 */
const FIXED_TIME = new Date("2026-01-01T00:00:00Z");

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** 更新清单:只列当前版本;update_hash 是安装包的 SHA-256,Zotero 下载更新后会核对。 */
export function updateManifest({ version, manifest, hash }) {
  const z = manifest.applications.zotero;
  return {
    addons: {
      [ADDON_ID]: {
        updates: [
          {
            version,
            update_link: releaseXpiUrl(version),
            update_hash: `sha256:${hash}`,
            applications: { zotero: { strict_min_version: z.strict_min_version, strict_max_version: z.strict_max_version } },
          },
        ],
      },
    },
  };
}

/** addon/ 下要打包的文件(相对路径,按名称排序;跳过隐藏文件)。 */
export function addonFiles(dir = ADDON) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      if (f.startsWith(".")) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split("\\").join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** 可复现地打包到 out:先复制到临时目录并统一修改时间,再按排序后的文件清单压缩。 */
export function buildXpi(out = OUT) {
  const stage = mkdtempSync(join(tmpdir(), "zc-xpi-"));
  try {
    const files = [...addonFiles(), "LICENSE"].sort();
    for (const f of files) {
      const src = f === "LICENSE" ? join(root, "LICENSE") : join(ADDON, f);
      const dst = join(stage, f);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      chmodSync(dst, 0o644); // 文件权限也统一,不受本机 umask 影响
      utimesSync(dst, FIXED_TIME, FIXED_TIME);
    }
    mkdirSync(dirname(out), { recursive: true });
    if (existsSync(out)) rmSync(out);
    // -X 不带系统扩展属性与额外时间戳;-D 不写目录条目;TZ=UTC 让 zip 里记录的时间与本机时区无关
    execFileSync("zip", ["-q", "-X", "-D", "-6", out, ...files], { cwd: stage, stdio: "inherit", env: { ...process.env, TZ: "UTC" } });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  return readFileSync(out);
}

/** 包里必须有的文件。 */
export const REQUIRED = ["manifest.json", "bootstrap.js", "LICENSE", "content/market.html", "content/market.js", "content/market.css", "content/lib.js", "content/mainwindow.js", "content/icons/icon-32.png", "content/icons/icon-64.png", "content/icons/market.svg"];

/** 读 zip 的中央目录,列出全部条目名。 */
export function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("不是有效的 zip 文件");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip 中央目录损坏");
    const nameLen = buf.readUInt16LE(p + 28);
    names.push(buf.toString("utf8", p + 46, p + 46 + nameLen));
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return names;
}

/** 读出 zip 里某个文件的内容(只支持存储与 deflate 两种方式);没有返回 null。 */
export function readZipFile(buf, wanted, maxBytes = 1024 * 1024) {
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
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    if (name !== wanted) continue;
    if (usize > maxBytes || local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) return null;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data, { maxOutputLength: maxBytes });
    return null;
  }
  return null;
}

/** 校验包结构;返回问题清单。 */
export function checkXpi(names, { manifest, version }) {
  const errs = [];
  for (const f of REQUIRED) if (!names.includes(f)) errs.push(`缺少 ${f}`);
  for (const n of names) {
    if (n.startsWith("/") || n.split("/").includes("..")) errs.push(`不安全的路径 ${n}`);
    if (n.split("/").some((s) => s.startsWith("."))) errs.push(`不应打包隐藏文件 ${n}`);
  }
  if (manifest.version !== version) errs.push(`manifest 版本 ${manifest.version} 与 package.json 版本 ${version} 不一致`);
  if (manifest.applications?.zotero?.id !== "zotero-community@zoterocn.org") errs.push("插件标识不对");
  return errs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(ADDON, "manifest.json"), "utf8"));
  const buf = buildXpi();
  const names = zipEntries(buf);
  const errs = checkXpi(names, { manifest, version: pkg.version });
  if (errs.length) {
    console.error(`安装包结构不对:\n${errs.join("\n")}`);
    process.exit(1);
  }
  const hash = sha256(buf);
  writeFileSync(UPDATE_OUT, `${JSON.stringify(updateManifest({ version: pkg.version, manifest, hash }), null, 2)}\n`);
  console.log(`已生成 dist/zotero-community.xpi(${pkg.version},${names.length} 个文件,${buf.length} 字节,SHA-256 ${hash})与 dist/update.json`);
}
