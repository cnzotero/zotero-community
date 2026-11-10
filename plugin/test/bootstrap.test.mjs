import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;

/** 在假的 Zotero 环境里载入 bootstrap.js;getBoolPref 的行为由 prefs 决定(值为 Error 时抛出,模拟类型不对)。 */
function load(prefs) {
  const logs = [];
  const decorated = [];
  const doc = {
    getElementById: () => null,
    createXULElement: () => ({}),
  };
  const win = { document: doc };
  const ctx = {
    Zotero: { debug: (m) => logs.push(m), logError: () => {}, getMainWindows: () => [win], uiReadyPromise: Promise.resolve() },
    Services: {
      io: { newURI: (u) => ({ spec: u }) },
      prefs: {
        getBoolPref: (name, def) => {
          if (!(name in prefs)) return def;
          if (prefs[name] instanceof Error) throw prefs[name];
          return prefs[name];
        },
      },
      scriptloader: {
        loadSubScript: (url, target) => {
          const MW = require(root + "addon/content/mainwindow.js");
          target.ZoteroCommunityMainWindow = { ...MW, decorate: (d, opts) => (decorated.push(opts), { button: null, menuItem: null }) };
        },
      },
      wm: { getEnumerator: () => ({ hasMoreElements: () => false }) },
    },
    Components: {
      classes: { "@mozilla.org/addons/addon-manager-startup;1": { getService: () => ({ registerChrome: () => ({ destruct() {} }) }) } },
      interfaces: { amIAddonManagerStartup: {} },
    },
    setTimeout,
    clearTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(root + "addon/bootstrap.js", "utf8"), ctx);
  return { ctx, logs, decorated };
}

test("偏好类型不对(读取时抛错)时启动不失败,菜单项按默认不显示", async () => {
  const typeError = Object.assign(new Error("NS_ERROR_UNEXPECTED"), { name: "NS_ERROR_UNEXPECTED" });
  const { ctx, logs, decorated } = load({ "extensions.zotero-community.showToolsMenuItem": typeError, "extensions.zotero-community.selfTest": typeError });
  await ctx.startup({ rootURI: "chrome://fake/" });
  assert.ok(logs.some((m) => m.includes("startup ok")));
  assert.equal(decorated.length, 1);
  assert.equal(decorated[0].showMenuItem, false);
  ctx.shutdown();
  assert.ok(logs.some((m) => m.includes("shutdown ok")));
});

test("偏好为 true 时显示菜单项;没有设置时默认不显示", async () => {
  const on = load({ "extensions.zotero-community.showToolsMenuItem": true });
  await on.ctx.startup({ rootURI: "chrome://fake/" });
  assert.equal(on.decorated[0].showMenuItem, true);
  const none = load({});
  await none.ctx.startup({ rootURI: "chrome://fake/" });
  assert.equal(none.decorated[0].showMenuItem, false);
});

test("插件里读布尔设置的地方都经过兜底函数", () => {
  for (const f of ["addon/bootstrap.js", "addon/content/market.js"]) {
    const src = readFileSync(root + f, "utf8");
    const raw = [...src.matchAll(/getBoolPref\(/g)].length;
    assert.equal(raw, 1, `${f} 只在 boolPref 里直接调用 getBoolPref`);
    assert.match(src, /function boolPref\(name\) \{\s*try \{\s*return Services\.prefs\.getBoolPref\(name, false\);\s*\} catch \(e\) \{\s*return false;/);
  }
});
