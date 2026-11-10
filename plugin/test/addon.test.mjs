import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { UPDATE_URL, checkXpi, readZipFile, releaseXpiUrl, zipEntries, REQUIRED } from "../scripts/build.mjs";

const root = new URL("..", import.meta.url).pathname;
const addon = join(root, "addon");
const read = (p) => readFileSync(join(root, p), "utf8");
const manifest = JSON.parse(read("addon/manifest.json"));
const pkg = JSON.parse(read("package.json"));

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f !== "node_modules" && f !== "dist") walk(p, out);
    } else out.push(p);
  }
  return out;
}
const textFiles = () => walk(root).filter((f) => /\.(js|mjs|json|html|css|md)$/.test(f));

test("身份:显示名、标识、版本、主页、更新清单与适配范围", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.name, "Zotero中文社区");
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.homepage_url, "https://zoterocn.org");
  const z = manifest.applications.zotero;
  assert.equal(z.id, "zotero-community@zoterocn.org");
  // 自更新清单放在 GitHub 的固定 release 条目里,不放在站点上:站点被入侵也不能借自动更新推送代码
  assert.equal(z.update_url, UPDATE_URL);
  const u = new URL(z.update_url);
  assert.equal(u.protocol, "https:");
  assert.equal(u.hostname, "github.com");
  assert.ok(u.pathname.startsWith("/cnzotero/zotero-community/"), u.pathname);
  assert.ok(!/zoterocn\.org/.test(z.update_url));
  assert.equal(z.strict_min_version, "7.0");
  assert.equal(z.strict_max_version, "10.*");
  for (const icon of Object.values(manifest.icons)) assert.ok(existsSync(join(addon, icon)), icon);
});

test("引导脚本:导出 Zotero 需要的生命周期函数;启动时注册的东西在 shutdown 里全部撤销", () => {
  const src = read("addon/bootstrap.js");
  for (const fn of ["install", "startup", "shutdown", "uninstall", "onMainWindowLoad", "onMainWindowUnload"]) assert.match(src, new RegExp(`^(async )?function ${fn}\\(`, "m"), fn);
  const shutdown = /function shutdown\(\) \{([\s\S]*?)\n\}/.exec(src)[1];
  assert.match(shutdown, /clearTimeout\(selfTestTimer\)/); // 定时器
  assert.match(shutdown, /getEnumerator\(WINDOW_TYPE\)[\s\S]*\.close\(\)/); // 已打开的窗口
  assert.match(shutdown, /undecorate\(win\)/); // 工具栏按钮与菜单项
  assert.match(shutdown, /decorated\.clear\(\)/);
  assert.match(src, /function onMainWindowUnload\(\{ window \}\) \{\s*undecorate\(window\);/); // 关闭主窗口时清理
  // 「工具」菜单项默认不显示,由设置开启
  assert.match(src, /showMenuItem: boolPref\(SHOW_MENU_PREF\)/);
  assert.match(src, /const SHOW_MENU_PREF = "extensions\.zotero-community\.showToolsMenuItem";/);
  assert.match(shutdown, /chromeHandle\.destruct\(\)/); // chrome 注册
  assert.match(read("addon/content/market.html"), /windowtype="zotero-community:market"/);
  // 窗口关闭时撤销附加组件监听、中止请求、清掉定时器
  const market = read("addon/content/market.js");
  assert.match(market, /removeAddonListener/);
  // 缓存先查大小再读;后台检查完成前不安装,完成后恢复按钮
  assert.ok(market.indexOf("IOUtils.stat(cachePath())") < market.indexOf("IOUtils.readUTF8(cachePath())"));
  assert.match(market, /if \(!L\.cacheSizeOk\(info\.size\)\) return null;/);
  assert.match(market, /if \(!p \|\| state\.busy\.has\(id\) \|\| state\.checking\) return;/);
  assert.match(market, /renderStatus\(\);\s*refreshInstallButtons\(\);/);
  assert.match(market, /L\.installButtonState\(st\.kind, state\.busy\.has\(p\.id\), state\.checking\)/);
  assert.match(market, /fetchController\.abort\(\)/);
  assert.match(market, /for \(const t of state\.timers\) clearTimeout\(t\)/);
});

test("界面:文案为中文,菜单名与窗口标题正确;不用 innerHTML 拼接内容", () => {
  assert.match(read("addon/content/mainwindow.js"), /const LABEL = "Zotero 中文社区 · 插件市场";/);
  assert.match(read("addon/content/market.html"), /<title>Zotero中文社区 · 插件市场<\/title>/);
  for (const f of ["addon/content/market.js", "addon/content/lib.js", "addon/content/mainwindow.js", "addon/bootstrap.js"]) {
    const src = read(f);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(src), f);
  }
});

test("网络:只访问 zoterocn.org 的目录;安装前必须确认;安装地址只取自目录并再次校验", () => {
  const market = read("addon/content/market.js");
  // 窗口里没有直接的网络请求,只经 lib.js 的 fetchCatalogText 读取目录地址(不传别的地址)
  assert.ok(!/\bfetch\(/.test(market));
  assert.deepEqual([...market.matchAll(/L\.fetchCatalogText\(([^)]*\))/g)].map((m) => /url\s*:/.test(m[1])), [false]);
  const lib = read("addon/content/lib.js");
  assert.deepEqual([...lib.matchAll(/fetchImpl\(([^,]+),/g)].map((m) => m[1].trim()), ["o.url || CATALOG_URL"]);
  // 安装接口只出现在 doInstall 里,且之前做过地址校验;doInstall 只在确认之后调用
  assert.equal((market.match(/getInstallForURL\(/g) ?? []).length, 1);
  const doInstall = /async function doInstall\(p, release\) \{([\s\S]*?)\n  \}\n/.exec(market)[1];
  assert.ok(doInstall.indexOf("isReleaseUrlForPlugin(release.u, p.id)") >= 0);
  assert.ok(doInstall.indexOf("isReleaseUrlForPlugin(release.u, p.id)") < doInstall.indexOf("getInstallForURL("));
  // 选哪份目录交给 lib.js 的 decideCatalog(未来日期、回滚检查在里面,有单测)
  assert.match(market, /L\.decideCatalog\(fetched, cache, new Date\(\)\)/);
  assert.match(doInstall, /install\.addListener\(L\.installListener\(release, resolve\)\)/); // 下载后核对包内标识
  assert.match(doInstall, /getInstallForURL\(release\.u,/);
  // 确认框的来源与地址都来自 target.url
  assert.match(market, /\$\("confirm-host"\)\.textContent = target\.source;/);
  assert.match(market, /\$\("confirm-url"\)\.textContent = target\.url;/);
  const onClick = /async function onInstallClick\(id\) \{([\s\S]*?)\n  \}\n/.exec(market)[1];
  assert.match(onClick, /installTarget\(p, state\.zoteroVersion\)/);
  assert.match(onClick, /if \(!\(await confirmInstall\([\s\S]*?\)\)\) return;\s*await doInstall\(p, target\.release\)/);
  assert.equal((market.match(/doInstall\(/g) ?? []).length, 2); // 定义一次,确认后调用一次
});

test("公开仓库红线:不含本机路径、令牌、IP 地址;规则对所有插件一视同仁(源码里没有按插件区分的分支)", () => {
  for (const f of textFiles().filter((x) => !x.endsWith("addon.test.mjs"))) { // 本文件里是检查用的规则本身
    const src = readFileSync(f, "utf8");
    assert.ok(!/\/Users\/|\/home\/[a-z]|C:\\\\Users/.test(src), `${f} 含本机路径`);
    assert.ok(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|x-access-token/.test(src), `${f} 含令牌`);
    assert.ok(!/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(src.replace(/\d+\.\d+\.\d+\.\d+(?=\s*\))|version|v\d/gi, "")), `${f} 含 IP 地址`);
  }
  for (const f of ["addon/content/lib.js", "addon/content/market.js", "addon/content/mainwindow.js", "addon/bootstrap.js"]) {
    const src = read(f);
    // 不得出现「某个插件 id / 作者」的字面量比较,也没有推荐、置顶字样
    assert.ok(!/(?<!typeof\s+)\b[\w$]+\.(id|author|name|homepage)\s*[!=]==?\s*["'`]/.test(src), `${f} 有按插件区分的分支`);
    assert.ok(!/推荐位(?!\s*[,。、)])|置顶|featured|pinned|promot/i.test(src.replace(/没有推荐位/g, "")), `${f} 含推荐或置顶`);
  }
});

test("窗口有内容安全策略:默认全部禁止,只放行 Zotero 与本插件的脚本样式,网络只到 zoterocn.org", () => {
  const html = read("addon/content/market.html");
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src chrome:;/);
  assert.match(csp, /connect-src https:\/\/zoterocn\.org$/);
  assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(csp));
  assert.ok(!/<script>|<script [^>]*>[^<]+<\/script>|\son[a-z]+="/.test(html)); // 没有内联脚本与内联事件
});

test("打包:一条命令产出 dist/zotero-community.xpi 与 dist/update.json,manifest 在根目录,结构校验通过,可复现", () => {
  execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { cwd: root, stdio: "pipe" });
  const buf = readFileSync(join(root, "dist/zotero-community.xpi"));
  const hash = createHash("sha256").update(buf).digest("hex");
  // 更新清单:只列当前版本,指向该版本 Release 的安装包,带哈希与适配范围
  const update = JSON.parse(readFileSync(join(root, "dist/update.json"), "utf8"));
  assert.deepEqual(update, { addons: { [manifest.applications.zotero.id]: { updates: [{ version: pkg.version, update_link: releaseXpiUrl(pkg.version), update_hash: `sha256:${hash}`, applications: { zotero: { strict_min_version: "7.0", strict_max_version: "10.*" } } }] } } });
  assert.equal(JSON.parse(readZipFile(buf, "manifest.json").toString()).version, pkg.version);
  assert.ok(readZipFile(buf, "LICENSE").toString().startsWith("MIT License"));
  // 再打一次:逐字节相同
  execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { cwd: root, stdio: "pipe" });
  assert.equal(createHash("sha256").update(readFileSync(join(root, "dist/zotero-community.xpi"))).digest("hex"), hash);
  const names = zipEntries(buf);
  assert.ok(names.includes("manifest.json") && names.includes("bootstrap.js"));
  for (const f of REQUIRED) assert.ok(names.includes(f), f);
  assert.deepEqual(checkXpi(names, { manifest, version: pkg.version }), []);
  assert.ok(!names.some((n) => n.startsWith("test/") || n.startsWith("scripts/") || n.includes(".DS_Store")));
  // 校验本身能发现问题
  assert.ok(checkXpi(["addon/manifest.json"], { manifest, version: pkg.version }).length > 0);
  assert.ok(checkXpi([...REQUIRED, "../x"], { manifest, version: pkg.version }).some((e) => e.includes("不安全")));
  assert.ok(checkXpi(REQUIRED, { manifest, version: "9.9.9" }).some((e) => e.includes("不一致")));
});
