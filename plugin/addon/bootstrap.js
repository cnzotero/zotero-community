/*
 * Zotero中文社区 · 插件市场 —— Zotero 7+ 引导脚本。
 * 启动时注册 chrome 内容目录,并在每个 Zotero 主窗口的文库工具栏(搜索框左侧)加一个「插件市场」按钮;
 * 「工具」菜单项默认不显示,设置 extensions.zotero-community.showToolsMenuItem 为 true 时才加。
 * 关闭、停用或卸载时撤销全部注册:按钮、菜单项、已打开的插件市场窗口、定时器、chrome 注册。
 * 运行环境由 Zotero 提供:Zotero、Services、Components、ChromeUtils、setTimeout 等,以及 APP_SHUTDOWN 等原因常量。
 */
/* global Zotero, Services, Components, ChromeUtils, PathUtils, IOUtils */
"use strict";

var chromeHandle = null;
var selfTestTimer = null;
/** 主窗口入口的添加与清理(content/mainwindow.js)。 */
var MW = null;
/** 已经加过入口的主窗口;窗口关闭或插件停用时移出。 */
var decorated = new Set();

const WINDOW_TYPE = "zotero-community:market";
const WINDOW_URL = "chrome://zotero-community/content/market.html";
const WINDOW_FEATURES = "chrome,dialog=no,resizable,centerscreen,width=980,height=760";
/** 设为 true 时在「工具」菜单里也显示入口(默认不显示;重新打开主窗口或重新启用插件后生效)。 */
const SHOW_MENU_PREF = "extensions.zotero-community.showToolsMenuItem";
/** 仅供开发自检:为 true 时启动后自动跑一遍自检并在调试输出里记录结果。平时不存在这个设置。 */
const SELF_TEST_PREF = "extensions.zotero-community.selfTest";

/** 读布尔设置;设置不存在或类型不对(例如被手动改成文字)时当作 false,不让启动失败。 */
function boolPref(name) {
  try {
    return Services.prefs.getBoolPref(name, false);
  } catch (e) {
    return false;
  }
}

function log(msg) {
  Zotero.debug("[zotero-community] " + msg);
}

function install() {}

async function startup({ rootURI }) {
  const aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"].getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [["content", "zotero-community", rootURI + "content/"]]);
  const holder = {};
  Services.scriptloader.loadSubScript(rootURI + "content/mainwindow.js", holder);
  MW = holder.ZoteroCommunityMainWindow;
  // 插件在 Zotero 运行中被启用时,主窗口已经打开:直接加入口;之后新开的主窗口由 onMainWindowLoad 处理
  for (const win of Zotero.getMainWindows()) decorate(win);
  log("startup ok");
  if (boolPref(SELF_TEST_PREF)) {
    await Zotero.uiReadyPromise;
    selfTestTimer = setTimeout(() => {
      selfTestTimer = null;
      selfTest().catch((e) => log("selftest: FAIL exception " + ((e && e.stack) || e)));
    }, 3000);
  }
}

function onMainWindowLoad({ window }) {
  decorate(window);
}

function onMainWindowUnload({ window }) {
  undecorate(window);
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
  for (const win of Zotero.getMainWindows()) undecorate(win);
  for (const win of decorated) undecorate(win);
  decorated.clear();
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
  log("shutdown ok");
}

function uninstall() {}

function decorate(win) {
  const doc = win && win.document;
  if (!doc || !MW) return;
  const { button, menuItem } = MW.decorate(doc, { onCommand: () => openMarket(), showMenuItem: boolPref(SHOW_MENU_PREF) });
  decorated.add(win);
  log("entry added: button=" + !!button + " menu=" + !!menuItem);
}

function undecorate(win) {
  try {
    if (win && win.document && MW) MW.removeAll(win.document);
  } catch (e) {
    // 窗口已经关闭
  }
  decorated.delete(win);
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
// 1 工具栏按钮在搜索框左侧、与 Zotero 按钮同尺寸,「工具」菜单项默认没有;保存一张工具栏截图;
// 2 点按钮打开插件市场(窗口里的自检随后运行并自行关闭);
// 3 新开一个主窗口:也有且只有一个按钮;关掉后不留记录;
// 4 停用本插件:按钮、菜单项、窗口都撤销;再启用:按钮恢复且不重复;打开菜单设置后再启用:菜单项出现。
async function selfTest() {
  const id = "zotero-community@zoterocn.org";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const check = (cond, m) => log("selftest: " + (cond ? "PASS " : "FAIL ") + m);
  const waitFor = async (fn, ms = 30000) => {
    for (let t = 0; t < ms; t += 250) {
      if (fn()) return true;
      await sleep(250);
    }
    return false;
  };
  const win = Zotero.getMainWindow();
  const doc = win.document;
  const count = (d) => d.querySelectorAll("#" + MW.BUTTON_ID).length;
  const button = doc.getElementById(MW.BUTTON_ID);
  const search = doc.getElementById(MW.SEARCH_ID);
  check(!!button && button.parentNode && button.parentNode.id === MW.TOOLBAR_ID, "toolbar button is in the items toolbar");
  check(!!button && !!search && button.parentNode === search.parentNode && (button.compareDocumentPosition(search) & win.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, "button is before the search box in the same toolbar");
  if (button && search) {
    const b = button.getBoundingClientRect();
    const s = search.getBoundingClientRect();
    const note = doc.getElementById("zotero-tb-note-add");
    const n = note ? note.getBoundingClientRect() : null;
    check(b.right <= s.left + 1 && b.width > 0, "button is drawn left of the search box (button " + Math.round(b.left) + "-" + Math.round(b.right) + ", search starts " + Math.round(s.left) + ")");
    check(!n || Math.abs(b.height - n.height) < 1, "button height " + Math.round(b.height) + " matches Zotero buttons " + (n ? Math.round(n.height) : "?"));
    log("selftest: button tooltip=" + button.getAttribute("tooltiptext") + " color=" + win.getComputedStyle(button).color + " dark=" + win.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  check(!doc.getElementById(MW.MENU_ITEM_ID), "tools menu item hidden by default");
  check(count(doc) === 1, "exactly one button");
  await snapshot(win, "toolbar");
  // 点按钮打开插件市场
  button.doCommand();
  check(await waitFor(() => !!Services.wm.getMostRecentWindow(WINDOW_TYPE)), "button opened the market window");
  await waitFor(() => !Services.wm.getMostRecentWindow(WINDOW_TYPE), 90000);
  check(!Services.wm.getMostRecentWindow(WINDOW_TYPE), "market window closed after its self-test");
  // 新开一个主窗口
  const before = Zotero.getMainWindows().length;
  Zotero.openMainWindow();
  await waitFor(() => Zotero.getMainWindows().length > before);
  const win2 = Zotero.getMainWindows().find((w) => w !== win);
  const got2 = await waitFor(() => !!(win2 && win2.document.getElementById(MW.BUTTON_ID)));
  check(got2 && count(win2.document) === 1 && count(doc) === 1, "second main window has its own single button");
  check(decorated.size === 2, "two decorated windows tracked");
  win2.close();
  await waitFor(() => Zotero.getMainWindows().length === before);
  await sleep(500);
  check(decorated.size === 1 && decorated.has(win), "closing the second window leaves no record");
  // 停用 / 启用;先关掉自检开关,免得重新启用时再跑一遍
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
  check(count(doc) === 0 && !doc.getElementById(MW.MENU_ITEM_ID), "disable removed the button");
  check(!Services.wm.getMostRecentWindow(WINDOW_TYPE), "disable closed the market window");
  await addon.enable();
  await sleep(2000);
  check(count(doc) === 1, "enable re-added exactly one button");
  check(!doc.getElementById(MW.MENU_ITEM_ID), "menu item still hidden after enable");
  // 打开「工具」菜单设置后再停用 / 启用一次
  Services.prefs.clearUserPref(SHOW_MENU_PREF); // 测试配置里可能被故意设成了错误的类型
  Services.prefs.setBoolPref(SHOW_MENU_PREF, true);
  await addon.disable();
  await sleep(1000);
  await addon.enable();
  await sleep(2000);
  const item = doc.getElementById(MW.MENU_ITEM_ID);
  check(!!item && item.parentNode === doc.getElementById("menu_ToolsPopup") && count(doc) === 1, "menu item shown when the setting is on");
  Services.prefs.clearUserPref(SHOW_MENU_PREF);
  log("selftest: lifecycle done");
}

/** 把主窗口画面存成图片(只写在当前配置目录里),便于开发时人工查看。 */
async function snapshot(win, name) {
  try {
    const canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    canvas.width = win.innerWidth;
    canvas.height = win.innerHeight;
    canvas.getContext("2d").drawWindow(win, 0, 0, canvas.width, canvas.height, "rgb(128,128,128)");
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    const dir = PathUtils.join(PathUtils.profileDir, "zotero-community");
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    await IOUtils.write(PathUtils.join(dir, "selftest-" + name + ".png"), new Uint8Array(await blob.arrayBuffer()));
    log("selftest: snapshot saved: " + name);
  } catch (e) {
    log("selftest: snapshot skipped: " + e);
  }
}
