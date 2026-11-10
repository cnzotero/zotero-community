/*
 * Zotero中文社区 · 插件市场 —— Zotero 7+ 引导脚本。
 * 启动时注册 chrome 内容目录,并在每个 Zotero 主窗口的「工具」菜单里加一项「Zotero中文社区 · 插件市场」;
 * 关闭、停用或卸载时撤销全部注册:菜单项、已打开的插件市场窗口、定时器、chrome 注册。
 * 运行环境由 Zotero 提供:Zotero、Services、Components、ChromeUtils、setTimeout 等,以及 APP_SHUTDOWN 等原因常量。
 */
/* global Zotero, Services, Components, ChromeUtils */
"use strict";

var chromeHandle = null;
var selfTestTimer = null;

const MENU_ITEM_ID = "zotero-community-market-menuitem";
const MENU_LABEL = "Zotero中文社区 · 插件市场";
const WINDOW_TYPE = "zotero-community:market";
const WINDOW_URL = "chrome://zotero-community/content/market.html";
const WINDOW_FEATURES = "chrome,dialog=no,resizable,centerscreen,width=980,height=760";
/** 仅供开发自检:为 true 时启动后自动打开插件市场并在调试输出里记录自检结果。平时不存在这个设置。 */
const SELF_TEST_PREF = "extensions.zotero-community.selfTest";

function log(msg) {
  Zotero.debug("[zotero-community] " + msg);
}

function install() {}

async function startup({ rootURI }) {
  const aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"].getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [["content", "zotero-community", rootURI + "content/"]]);
  // 插件在 Zotero 运行中被启用时,主窗口已经打开:直接加菜单;之后新开的主窗口由 onMainWindowLoad 处理
  for (const win of Zotero.getMainWindows()) addMenu(win);
  log("startup ok");
  if (Services.prefs.getBoolPref(SELF_TEST_PREF, false)) {
    await Zotero.uiReadyPromise;
    selfTestTimer = setTimeout(() => {
      selfTestTimer = null;
      selfTest().catch((e) => log("selftest: FAIL exception " + ((e && e.stack) || e)));
    }, 3000);
  }
}

function onMainWindowLoad({ window }) {
  addMenu(window);
}

function onMainWindowUnload({ window }) {
  removeMenu(window);
}

function shutdown() {
  if (selfTestTimer) {
    clearTimeout(selfTestTimer);
    selfTestTimer = null;
  }
  // 关掉已打开的插件市场窗口(窗口自己在 unload 时撤销监听与定时器)
  const wins = Services.wm.getEnumerator(WINDOW_TYPE);
  while (wins.hasMoreElements()) {
    const w = wins.getNext();
    try {
      w.close();
    } catch (e) {
      Zotero.logError(e);
    }
  }
  for (const win of Zotero.getMainWindows()) removeMenu(win);
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
  log("shutdown ok");
}

function uninstall() {}

function addMenu(win) {
  const doc = win && win.document;
  if (!doc || doc.getElementById(MENU_ITEM_ID)) return;
  const popup = doc.getElementById("menu_ToolsPopup");
  if (!popup) {
    log("tools menu not found");
    return;
  }
  const item = doc.createXULElement("menuitem");
  item.id = MENU_ITEM_ID;
  item.setAttribute("label", MENU_LABEL);
  item.addEventListener("command", () => openMarket());
  popup.appendChild(item);
  log("menu added");
}

function removeMenu(win) {
  const el = win && win.document && win.document.getElementById(MENU_ITEM_ID);
  if (el) el.remove();
}

function openMarket() {
  const existing = Services.wm.getMostRecentWindow(WINDOW_TYPE);
  if (existing) {
    existing.focus();
    return existing;
  }
  return Services.ww.openWindow(null, WINDOW_URL, "_blank", WINDOW_FEATURES, null);
}

// ---------- 开发自检(仅在 extensions.zotero-community.selfTest 为 true 时运行;不安装任何插件) ----------
// 1 通过「工具」菜单项的命令打开插件市场(窗口里的自检随后运行并自行关闭);
// 2 窗口关闭后停用本插件,确认菜单项与窗口都已撤销;再启用,确认菜单项重新出现。
async function selfTest() {
  const id = "zotero-community@zoterocn.org";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const check = (cond, m) => log("selftest: " + (cond ? "PASS " : "FAIL ") + m);
  const win = Zotero.getMainWindow();
  const item = win && win.document.getElementById(MENU_ITEM_ID);
  check(!!item && item.parentNode === win.document.getElementById("menu_ToolsPopup"), "menu item is in Tools menu, label=" + (item && item.getAttribute("label")));
  if (!item) return;
  item.doCommand();
  let opened = false;
  for (let i = 0; i < 60 && !opened; i++) {
    await sleep(500);
    opened = !!Services.wm.getMostRecentWindow(WINDOW_TYPE);
  }
  check(opened, "menu command opened the market window");
  for (let i = 0; i < 120 && Services.wm.getMostRecentWindow(WINDOW_TYPE); i++) await sleep(500);
  check(!Services.wm.getMostRecentWindow(WINDOW_TYPE), "market window closed after its self-test");
  // 停用 / 启用一次,检查清理与重新注册;先关掉自检开关,免得重新启用时再跑一遍
  Services.prefs.setBoolPref(SELF_TEST_PREF, false);
  let AddonManager;
  try {
    AddonManager = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager;
  } catch (e) {
    AddonManager = ChromeUtils.import("resource://gre/modules/AddonManager.jsm").AddonManager;
  }
  const addon = await AddonManager.getAddonByID(id);
  openMarket();
  await sleep(1500);
  check(!!Services.wm.getMostRecentWindow(WINDOW_TYPE), "market window open before disable");
  await addon.disable();
  await sleep(1500);
  check(!win.document.getElementById(MENU_ITEM_ID), "disable removed the menu item");
  check(!Services.wm.getMostRecentWindow(WINDOW_TYPE), "disable closed the market window");
  await addon.enable();
  await sleep(2000);
  check(!!win.document.getElementById(MENU_ITEM_ID), "enable re-added the menu item");
  log("selftest: lifecycle done");
}
