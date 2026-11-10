/*
 * Zotero中文社区 · 插件市场:主窗口里的入口(文库工具栏按钮与可选的「工具」菜单项)。
 * 只做 DOM 的添加与清理,不依赖其它插件;与 lib.js 一样不联网、不读写文件,便于在 Node 里用假 DOM 测试。
 * 在 Zotero 里由 bootstrap.js 用 loadSubScript 载入(挂到传入对象的 ZoteroCommunityMainWindow 上),
 * 在 Node 测试里以 CommonJS 加载。
 */
var ZoteroCommunityMainWindow = (function () {
  "use strict";

  const BUTTON_ID = "zotero-community-tb-market";
  const MENU_ITEM_ID = "zotero-community-market-menuitem";
  const LABEL = "Zotero 中文社区 · 插件市场";
  const ICON_URL = "chrome://zotero-community/content/icons/market.svg";
  const TOOLBAR_ID = "zotero-items-toolbar";
  const SEARCH_ID = "zotero-tb-search";
  const SPINNER_ID = "zotero-tb-search-spinner";
  const TOOLS_POPUP_ID = "menu_ToolsPopup";

  /**
   * 按钮插在哪个元素之前:从搜索框往左,越过紧挨着它的其它元素(例如别的插件放在这里的按钮),
   * 停在 Zotero 自己的弹性空白或搜索转圈图标处。这样本按钮总在搜索框左侧,
   * 并且紧邻已有按钮的左侧,不覆盖、不挤开别人。找不到搜索框返回 null。
   */
  function toolbarAnchor(doc) {
    const search = doc.getElementById(SEARCH_ID);
    if (!search || !search.parentNode) return null;
    let anchor = search;
    for (;;) {
      const prev = anchor.previousElementSibling;
      if (!prev || prev.localName === "spacer" || prev.id === SPINNER_ID || prev.id === BUTTON_ID) break;
      anchor = prev;
    }
    return anchor;
  }

  /** 在文库工具栏搜索框左侧加按钮;已存在就不重复添加。返回按钮,找不到工具栏返回 null。 */
  function addToolbarButton(doc, onCommand) {
    const existing = doc.getElementById(BUTTON_ID);
    if (existing) return existing;
    const anchor = toolbarAnchor(doc);
    if (!anchor) return null;
    const b = doc.createXULElement("toolbarbutton");
    b.id = BUTTON_ID;
    b.setAttribute("class", "zotero-tb-button");
    b.setAttribute("tooltiptext", LABEL);
    b.setAttribute("aria-label", LABEL);
    b.setAttribute("tabindex", "-1");
    // 与 Zotero 自带的工具栏按钮同一种写法:单色图标随主题文字颜色变化,深浅色都清晰
    b.style.listStyleImage = 'url("' + ICON_URL + '")';
    b.style.fill = "currentColor";
    b.style.setProperty("-moz-context-properties", "fill, fill-opacity");
    b.addEventListener("command", onCommand);
    anchor.parentNode.insertBefore(b, anchor);
    return b;
  }

  /** 「工具」菜单项(默认不显示,由设置开启)。已存在就不重复添加。 */
  function addMenuItem(doc, onCommand) {
    const existing = doc.getElementById(MENU_ITEM_ID);
    if (existing) return existing;
    const popup = doc.getElementById(TOOLS_POPUP_ID);
    if (!popup) return null;
    const item = doc.createXULElement("menuitem");
    item.id = MENU_ITEM_ID;
    item.setAttribute("label", LABEL);
    item.addEventListener("command", onCommand);
    popup.appendChild(item);
    return item;
  }

  /** 撤销本插件在这个窗口里加的全部元素;返回移除的个数。 */
  function removeAll(doc) {
    let n = 0;
    for (const id of [BUTTON_ID, MENU_ITEM_ID]) {
      const el = doc.getElementById(id);
      if (el) {
        el.remove();
        n++;
      }
    }
    return n;
  }

  /** 给一个主窗口加入口:工具栏按钮总是加;菜单项只在 showMenuItem 为 true 时加。 */
  function decorate(doc, opts) {
    const button = addToolbarButton(doc, opts.onCommand);
    const menuItem = opts.showMenuItem ? addMenuItem(doc, opts.onCommand) : null;
    return { button, menuItem };
  }

  return { BUTTON_ID, MENU_ITEM_ID, LABEL, ICON_URL, TOOLBAR_ID, SEARCH_ID, toolbarAnchor, addToolbarButton, addMenuItem, removeAll, decorate };
})();

if (typeof module === "object" && module && module.exports) module.exports = ZoteroCommunityMainWindow;
