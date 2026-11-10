import { test } from "node:test";
import assert from "node:assert/strict";
import MW from "../addon/content/mainwindow.js";

// ---------- 极简的假 DOM:只实现主窗口入口用到的那几个接口 ----------
class El {
  constructor(doc, localName, id = "") {
    this.ownerDocument = doc;
    this.localName = localName;
    this.id = id;
    this.attrs = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    const props = {};
    this.style = { setProperty: (k, v) => (props[k] = v), getPropertyValue: (k) => props[k] };
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return k in this.attrs ? this.attrs[k] : null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  dispatch(type) {
    for (const fn of this.listeners[type] || []) fn({ type, target: this });
  }
  appendChild(c) {
    return this.insertBefore(c, null);
  }
  insertBefore(c, ref) {
    if (c.parentNode) c.remove();
    const i = ref ? this.children.indexOf(ref) : this.children.length;
    if (ref && i < 0) throw new Error("ref 不是子节点");
    this.children.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  remove() {
    if (!this.parentNode) return;
    const sib = this.parentNode.children;
    sib.splice(sib.indexOf(this), 1);
    this.parentNode = null;
  }
  get previousElementSibling() {
    if (!this.parentNode) return null;
    const sib = this.parentNode.children;
    return sib[sib.indexOf(this) - 1] || null;
  }
}

class Doc {
  constructor() {
    this.root = new El(this, "window");
  }
  createXULElement(name) {
    return new El(this, name);
  }
  el(name, id, parent = this.root) {
    return parent.appendChild(new El(this, name, id));
  }
  getElementById(id) {
    const walk = (e) => {
      if (e.id === id) return e;
      for (const c of e.children) {
        const r = walk(c);
        if (r) return r;
      }
      return null;
    };
    return walk(this.root);
  }
  all(id) {
    const out = [];
    const walk = (e) => {
      if (e.id === id) out.push(e);
      e.children.forEach(walk);
    };
    walk(this.root);
    return out;
  }
}

/** 照 Zotero 10 的文库工具栏搭一个:几个按钮、弹性空白、搜索转圈图标、搜索框、窄屏时的切换按钮;另有「工具」菜单。 */
function mainWindow({ foreign = 0 } = {}) {
  const d = new Doc();
  const bar = d.el("hbox", "zotero-items-toolbar");
  d.el("toolbarbutton", "zotero-tb-add", bar);
  d.el("toolbarbutton", "zotero-tb-note-add", bar);
  d.el("spacer", "", bar);
  d.el("image", "zotero-tb-search-spinner", bar);
  for (let i = 0; i < foreign; i++) d.el("toolbarbutton", `other-plugin-${i}`, bar);
  d.el("quick-search-textbox", "zotero-tb-search", bar);
  d.el("toolbarbutton", "zotero-tb-toggle-item-pane-stacked", bar);
  const menubar = d.el("menu", "tools-menu");
  d.el("menupopup", "menu_ToolsPopup", menubar);
  return { d, bar, ids: () => bar.children.map((c) => c.id || c.localName) };
}

test("工具栏按钮:插在搜索框左侧,样式与 Zotero 按钮一致,点击打开插件市场", () => {
  const { d, ids } = mainWindow();
  let opened = 0;
  const b = MW.addToolbarButton(d, () => opened++);
  assert.deepEqual(ids(), ["zotero-tb-add", "zotero-tb-note-add", "spacer", "zotero-tb-search-spinner", MW.BUTTON_ID, "zotero-tb-search", "zotero-tb-toggle-item-pane-stacked"]);
  assert.equal(b.localName, "toolbarbutton");
  assert.equal(b.getAttribute("class"), "zotero-tb-button");
  assert.equal(b.getAttribute("tooltiptext"), "Zotero 中文社区 · 插件市场");
  assert.equal(b.style.listStyleImage, 'url("chrome://zotero-community/content/icons/market.svg")');
  assert.equal(b.style.fill, "currentColor"); // 图标随主题文字颜色变化
  assert.equal(b.style.getPropertyValue("-moz-context-properties"), "fill, fill-opacity");
  b.dispatch("command");
  assert.equal(opened, 1);
});

test("工具栏按钮:搜索框左侧已有别的插件的按钮时,紧邻它们的左侧,不覆盖、不挤开", () => {
  const { d, ids } = mainWindow({ foreign: 2 });
  MW.addToolbarButton(d, () => {});
  assert.deepEqual(ids().slice(3), ["zotero-tb-search-spinner", MW.BUTTON_ID, "other-plugin-0", "other-plugin-1", "zotero-tb-search", "zotero-tb-toggle-item-pane-stacked"]);
  assert.ok(d.getElementById("other-plugin-0") && d.getElementById("other-plugin-1"));
});

test("不重复添加;找不到搜索框时不加;清理后不留任何元素,可再次添加", () => {
  const { d } = mainWindow();
  MW.decorate(d, { onCommand: () => {}, showMenuItem: false });
  MW.decorate(d, { onCommand: () => {}, showMenuItem: false });
  assert.equal(d.all(MW.BUTTON_ID).length, 1);
  assert.equal(MW.removeAll(d), 1);
  assert.equal(d.all(MW.BUTTON_ID).length, 0);
  assert.equal(MW.removeAll(d), 0);
  MW.decorate(d, { onCommand: () => {}, showMenuItem: false });
  assert.equal(d.all(MW.BUTTON_ID).length, 1);
  // 没有文库工具栏的窗口
  const bare = new Doc();
  assert.equal(MW.addToolbarButton(bare, () => {}), null);
  assert.equal(MW.toolbarAnchor(bare), null);
});

test("「工具」菜单项:默认不加;设置开启时加在工具菜单里;清理时一并移除", () => {
  const { d } = mainWindow();
  const off = MW.decorate(d, { onCommand: () => {}, showMenuItem: false });
  assert.equal(off.menuItem, null);
  assert.equal(d.getElementById(MW.MENU_ITEM_ID), null);
  let opened = 0;
  const on = MW.decorate(d, { onCommand: () => opened++, showMenuItem: true });
  assert.equal(on.menuItem.parentNode.id, "menu_ToolsPopup");
  assert.equal(on.menuItem.getAttribute("label"), "Zotero 中文社区 · 插件市场");
  on.menuItem.dispatch("command");
  assert.equal(opened, 1);
  assert.equal(d.all(MW.BUTTON_ID).length, 1); // 按钮没有重复
  assert.equal(MW.removeAll(d), 2);
  assert.equal(d.getElementById(MW.MENU_ITEM_ID), null);
  assert.equal(d.getElementById(MW.BUTTON_ID), null);
});

test("多个主窗口:各自一个按钮,互不影响;关掉一个只清理它自己的", () => {
  const a = mainWindow();
  const b = mainWindow();
  MW.decorate(a.d, { onCommand: () => {}, showMenuItem: false });
  MW.decorate(b.d, { onCommand: () => {}, showMenuItem: false });
  assert.equal(a.d.all(MW.BUTTON_ID).length, 1);
  assert.equal(b.d.all(MW.BUTTON_ID).length, 1);
  MW.removeAll(b.d);
  assert.equal(a.d.all(MW.BUTTON_ID).length, 1);
  assert.equal(b.d.all(MW.BUTTON_ID).length, 0);
});
