/*
 * Zotero中文社区 · 插件市场窗口。只做界面与 Zotero 接口的衔接;判断逻辑都在 lib.js。
 * 网络只访问两处:zoterocn.org 的插件目录,以及用户在确认框里点了「安装」之后的那个安装包地址。
 * 不收集、不上传任何用户信息。
 */
/* global Zotero, Services, ChromeUtils, IOUtils, PathUtils, ZoteroCommunityMarket */
"use strict";

(function () {
  const L = ZoteroCommunityMarket;
  const SELF_TEST_PREF = "extensions.zotero-community.selfTest";
  const CACHE_DIR = "zotero-community";
  const CACHE_FILE = "catalog-cache.json";

  const AddonManager = loadAddonManager();
  const $ = (id) => document.getElementById(id);

  const state = {
    catalog: null,
    source: null, // "network" | "cache"
    savedAt: null,
    installed: new Map(),
    busy: new Set(),
    results: new Map(), // 插件 id → { text, error, restart }
    zoteroVersion: String(Zotero.version || ""),
    major: L.zoteroMajor(Zotero.version),
    fetchController: null,
    timers: new Set(),
    addonListener: null,
    closing: false,
  };

  function loadAddonManager() {
    try {
      return ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager;
    } catch (e) {
      // 较早的 Zotero 7 里还是旧式模块
      return ChromeUtils.import("resource://gre/modules/AddonManager.jsm").AddonManager;
    }
  }

  function later(fn, ms) {
    const t = setTimeout(() => {
      state.timers.delete(t);
      fn();
    }, ms);
    state.timers.add(t);
    return t;
  }

  function cancelTimer(t) {
    if (t) {
      clearTimeout(t);
      state.timers.delete(t);
    }
  }

  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v;
      else e.setAttribute(k, v);
    }
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  // ---------- 目录读取与缓存 ----------

  function cachePath() {
    return PathUtils.join(PathUtils.profileDir, CACHE_DIR, CACHE_FILE);
  }

  /** 读回缓存并重新校验(格式、30 天保存期、目录解析);不合格当作没有。 */
  async function readCache() {
    try {
      return L.readCacheEntry(await IOUtils.readUTF8(cachePath()), new Date());
    } catch (e) {
      return null; // 没有缓存
    }
  }

  async function writeCache(text) {
    try {
      await IOUtils.makeDirectory(PathUtils.join(PathUtils.profileDir, CACHE_DIR), { ignoreExisting: true });
      await IOUtils.writeUTF8(cachePath(), L.makeCacheEntry(text, new Date()));
    } catch (e) {
      Zotero.logError(e);
    }
  }

  /** 用 Zotero 窗口自带的 fetch 读取目录;不跟随重定向、限制大小与类型、10 秒超时(见 lib.js)。 */
  async function fetchCatalogText() {
    try {
      return await L.fetchCatalogText(window.fetch.bind(window), { onController: (c) => (state.fetchController = c) });
    } finally {
      state.fetchController = null;
    }
  }

  async function load() {
    $("reload").disabled = true;
    setStatus("正在读取插件目录…");
    hideNotice();
    const cache = await readCache();
    let fetched;
    try {
      fetched = { text: await fetchCatalogText() };
    } catch (e) {
      fetched = { error: (e && e.message) || String(e) };
    }
    if (state.closing) return;
    // 用哪份目录由 lib.js 决定:格式不对、日期在未来、比已保存的旧都不采用,回退到缓存
    const d = L.decideCatalog(fetched, cache, new Date());
    state.catalog = d.catalog;
    state.source = d.source;
    state.savedAt = d.source === "cache" ? cache.savedAt : null;
    if (d.save) await writeCache(fetched.text);
    if (d.notice) showNotice(d.notice, d.retry);
    await refreshInstalled();
    fillCategories();
    render();
    $("reload").disabled = false;
  }

  async function refreshInstalled() {
    try {
      const addons = await AddonManager.getAllAddons();
      state.installed = new Map(addons.map((a) => [a.id, { version: a.version, active: a.isActive }]));
    } catch (e) {
      Zotero.logError(e);
    }
  }

  // ---------- 界面 ----------

  function setStatus(text) {
    $("status").textContent = text;
  }

  function showNotice(text, withRetry) {
    const box = $("notice");
    box.textContent = text;
    box.className = "notice error";
    if (withRetry) {
      const b = el("button", { type: "button" }, "重试");
      b.addEventListener("click", () => load());
      box.appendChild(b);
    }
    box.hidden = false;
  }

  function hideNotice() {
    const box = $("notice");
    box.hidden = true;
    box.textContent = "";
  }

  function fillCategories() {
    const sel = $("cat");
    const current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    for (const c of (state.catalog && state.catalog.categories) || []) sel.appendChild(el("option", { value: c.key }, c.label));
    sel.value = [...sel.options].some((o) => o.value === current) ? current : "all";
  }

  function filters() {
    return { query: $("q").value, category: $("cat").value, onlyCompatible: $("compat").checked, major: state.major };
  }

  function visiblePlugins() {
    if (!state.catalog) return [];
    return L.sortPlugins(L.filterPlugins(state.catalog.plugins, filters()), $("sort").value);
  }

  function render() {
    const list = $("list");
    list.textContent = "";
    if (!state.catalog) {
      setStatus("");
      return;
    }
    const shown = visiblePlugins();
    const parts = [];
    if (state.catalog.generatedAt) parts.push("数据更新于 " + state.catalog.generatedAt + (state.source === "cache" ? "(离线缓存)" : ""));
    parts.push("显示 " + shown.length + " / " + state.catalog.plugins.length + " 款");
    if (state.zoteroVersion) parts.push("当前 Zotero " + state.zoteroVersion);
    setStatus(parts.join(" · "));
    if (shown.length === 0) {
      const tip = $("compat").checked ? "没有符合条件的插件。可以取消勾选「只显示适配当前 Zotero 的插件」查看全部。" : "没有符合条件的插件。";
      list.appendChild(el("p", { class: "empty" }, tip));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const p of shown) frag.appendChild(card(p));
    list.appendChild(frag);
  }

  function stateText(st) {
    if (st.kind === "update") return "已安装 " + st.version + (st.active ? "" : "(未启用)") + ",可更新";
    if (st.kind === "installed") return "已安装 " + st.version + (st.active ? "" : "(未启用)");
    if (st.kind === "not-installed") return "未安装";
    if (st.kind === "unknown") return "安装后可在附加组件里查看";
    return state.major ? "没有适配 Zotero " + state.major + " 的安装包" : "没有适配当前 Zotero 的安装包";
  }

  function card(p) {
    const release = L.pickRelease(p, state.zoteroVersion);
    const st = L.installState(p, release, state.installed);
    const latest = L.latestRelease(p);
    const c = el("article", { class: "card", "data-id": p.id });
    c.appendChild(el("h2", null, p.name));
    if (p.author) c.appendChild(el("div", { class: "author" }, p.author));
    if (p.summary) c.appendChild(el("p", { class: "summary" }, p.summary));
    const meta = el("div", { class: "meta" });
    meta.appendChild(el("span", null, "★ " + L.formatStars(p.stars)));
    if (latest) meta.appendChild(el("span", null, "最新 " + latest.v + (latest.d ? "(" + latest.d + ")" : "")));
    meta.appendChild(el("span", null, L.compatText(p)));
    if (p.archived) meta.appendChild(el("span", null, "仓库已归档"));
    c.appendChild(meta);

    const actions = el("div", { class: "actions" });
    actions.appendChild(el("span", { class: "state " + st.kind }, stateText(st)));
    const busy = state.busy.has(p.id);
    if (release && (st.kind === "not-installed" || st.kind === "unknown" || st.kind === "update")) {
      const b = el("button", { type: "button", class: "install" }, busy ? "正在安装…" : st.kind === "update" ? "更新" : "安装");
      b.disabled = busy;
      b.addEventListener("click", () => onInstallClick(p.id));
      actions.appendChild(b);
    }
    const d = el("button", { type: "button", class: "detail" }, "查看详情");
    d.addEventListener("click", () => openDetail(p.id));
    actions.appendChild(d);
    c.appendChild(actions);

    const r = state.results.get(p.id);
    if (r) {
      const line = el("div", { class: "result" + (r.error ? " error" : "") }, r.text);
      if (r.restart) {
        const rb = el("button", { type: "button" }, "立即重启 Zotero");
        rb.addEventListener("click", restartZotero);
        line.appendChild(document.createTextNode(" "));
        line.appendChild(rb);
      }
      c.appendChild(line);
    }
    return c;
  }

  function findPlugin(id) {
    return (state.catalog && state.catalog.plugins.find((p) => p.id === id)) || null;
  }

  function openDetail(id) {
    const url = L.detailUrl(id);
    if (url) Zotero.launchURL(url);
  }

  function restartZotero() {
    const U = Zotero.Utilities && Zotero.Utilities.Internal;
    if (U && typeof U.quit === "function") U.quit(true);
    else if (U && typeof U.quitZotero === "function") U.quitZotero(true);
  }

  // ---------- 安装 ----------

  let pendingConfirm = null;

  /** 确认框:显示插件名、版本、来源域名与安装包地址。默认焦点在「取消」上。返回是否确认。 */
  function confirmInstall(p, target, isUpdate) {
    const dlg = $("confirm");
    $("confirm-title").textContent = isUpdate ? "确认更新" : "确认安装";
    $("confirm-name").textContent = p.name;
    $("confirm-version").textContent = target.release.v;
    // 来源与地址都由同一个字段 target.url(即 target.release.u)得出,后面安装用的也是它
    $("confirm-host").textContent = target.source;
    $("confirm-url").textContent = target.url;
    $("confirm-ok").textContent = isUpdate ? "更新" : "安装";
    return new Promise((resolve) => {
      const ok = $("confirm-ok");
      const cancel = $("confirm-cancel");
      const finish = (value) => {
        ok.removeEventListener("click", onOk);
        cancel.removeEventListener("click", onCancel);
        dlg.removeEventListener("cancel", onCancel);
        pendingConfirm = null;
        if (dlg.open) dlg.close();
        resolve(value);
      };
      const onOk = () => finish(true);
      const onCancel = (e) => {
        if (e && e.type === "cancel") e.preventDefault();
        finish(false);
      };
      ok.addEventListener("click", onOk);
      cancel.addEventListener("click", onCancel);
      dlg.addEventListener("cancel", onCancel);
      pendingConfirm = finish;
      dlg.showModal();
      cancel.focus();
    });
  }

  async function onInstallClick(id) {
    const p = findPlugin(id);
    if (!p || state.busy.has(id)) return;
    // 安装地址只取自目录里这个插件适配当前版本的那条发布记录,并再次校验主机与 .xpi 后缀
    const target = L.installTarget(p, state.zoteroVersion);
    if (!target.ok) {
      state.results.set(id, { text: target.message, error: true });
      render();
      return;
    }
    const st = L.installState(p, target.release, state.installed);
    if (!(await confirmInstall(p, target, st.kind === "update"))) return;
    await doInstall(p, target.release);
  }

  async function doInstall(p, release) {
    if (!L.isReleaseUrlForPlugin(release.u, p.id)) {
      state.results.set(p.id, { text: "安装包地址没有通过安全校验,已拒绝安装", error: true });
      render();
      return;
    }
    state.busy.add(p.id);
    state.results.set(p.id, { text: "正在从 " + L.sourceOf(release.u) + " 下载并安装…" });
    render();
    let outcome;
    try {
      const install = await AddonManager.getInstallForURL(release.u, { name: p.name, version: release.v, telemetryInfo: { source: "zotero-community" } });
      outcome = await new Promise((resolve) => {
        // 监听器在 lib.js:下载完成后核对包内的插件标识,与目录记录不符就取消安装
        install.addListener(L.installListener(release, resolve));
        try {
          const r = install.install();
          if (r && typeof r.catch === "function") r.catch(() => {});
        } catch (e) {
          resolve({ ok: false, message: (e && e.message) || String(e) });
        }
      });
    } catch (e) {
      outcome = { ok: false, message: (e && e.message) || String(e) };
    }
    state.busy.delete(p.id);
    if (state.closing) return;
    if (!outcome.ok) {
      const why = outcome.code !== undefined ? L.installErrorText(outcome.code) : outcome.message;
      state.results.set(p.id, { text: "安装失败:" + why, error: true });
    } else {
      const addon = outcome.addon;
      const pending = addon && AddonManager.PENDING_INSTALL !== undefined && (addon.pendingOperations & (AddonManager.PENDING_INSTALL | AddonManager.PENDING_UPGRADE)) !== 0;
      const restart = outcome.postponed || pending;
      let text = "已安装 " + p.name + (addon && addon.version ? " " + addon.version : "");
      if (restart) text += ",需要重启 Zotero 后生效";
      state.results.set(p.id, { text, restart });
    }
    await refreshInstalled();
    render();
  }

  // ---------- 事件与清理 ----------

  let searchTimer = null;
  let addonTimer = null;

  function init() {
    const sort = $("sort");
    for (const s of L.SORTS) sort.appendChild(el("option", { value: s.key }, s.label));
    sort.value = "stars";
    $("compat-label").textContent = state.major ? "只显示适配 Zotero " + state.major + " 的插件" : "只显示适配当前 Zotero 的插件";
    $("q").addEventListener("input", () => {
      cancelTimer(searchTimer);
      searchTimer = later(render, 150);
    });
    for (const id of ["cat", "sort", "compat"]) $(id).addEventListener("change", render);
    $("reload").addEventListener("click", () => load());
    // 在附加组件管理器里安装、卸载、启用或停用插件后,刷新卡片上的安装状态
    const refresh = () => {
      cancelTimer(addonTimer);
      addonTimer = later(async () => {
        await refreshInstalled();
        if (!state.closing) render();
      }, 300);
    };
    state.addonListener = { onInstalled: refresh, onUninstalled: refresh, onEnabled: refresh, onDisabled: refresh };
    AddonManager.addAddonListener(state.addonListener);
    window.addEventListener("unload", cleanup, { once: true });
    load().then(() => {
      if (Services.prefs.getBoolPref(SELF_TEST_PREF, false)) selfTest();
    });
  }

  function cleanup() {
    state.closing = true;
    if (pendingConfirm) pendingConfirm(false);
    if (state.addonListener) AddonManager.removeAddonListener(state.addonListener);
    state.addonListener = null;
    if (state.fetchController) state.fetchController.abort();
    for (const t of state.timers) clearTimeout(t);
    state.timers.clear();
  }

  // ---------- 开发自检(仅在 extensions.zotero-community.selfTest 为 true 时运行;不安装任何插件) ----------

  async function selfTest() {
    const log = (m) => Zotero.debug("[zotero-community] selftest: " + m);
    const wait = (ms) => new Promise((r) => later(r, ms));
    let failures = 0;
    // 把窗口画面存成图片,便于开发时人工查看排版(只写在当前配置目录里)
    const snap = async (name) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.getContext("2d").drawWindow(window, 0, 0, canvas.width, canvas.height, "rgb(128,128,128)");
        const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
        await IOUtils.write(PathUtils.join(PathUtils.profileDir, CACHE_DIR, "selftest-" + name + ".png"), new Uint8Array(await blob.arrayBuffer()));
        log("snapshot saved: " + name);
      } catch (e) {
        log("snapshot skipped: " + e);
      }
    };
    const check = (cond, m) => {
      if (!cond) failures++;
      log((cond ? "PASS " : "FAIL ") + m);
    };
    try {
      log("zotero=" + state.zoteroVersion + " major=" + state.major + " source=" + state.source + " generatedAt=" + (state.catalog && state.catalog.generatedAt));
      log("status=" + $("status").textContent + " | notice=" + ($("notice").hidden ? "(none)" : $("notice").textContent));
      check(!!state.catalog && state.catalog.plugins.length > 0, "catalog loaded, plugins=" + (state.catalog ? state.catalog.plugins.length : 0));
      if (!state.catalog) return;
      const cards = () => $("list").querySelectorAll(".card");
      const compatCount = state.catalog.plugins.filter((p) => L.supportsMajor(p, state.major)).length;
      check(cards().length === compatCount, "only-compatible cards=" + cards().length + " expected=" + compatCount);
      $("compat").checked = false;
      $("compat").dispatchEvent(new Event("change"));
      check(cards().length === state.catalog.plugins.length, "all cards=" + cards().length);
      for (const s of L.SORTS) {
        $("sort").value = s.key;
        $("sort").dispatchEvent(new Event("change"));
        const expected = L.sortPlugins(state.catalog.plugins, s.key)[0];
        check(cards()[0].getAttribute("data-id") === expected.id, "sort " + s.key + " first=" + expected.id);
      }
      $("sort").value = "stars";
      $("q").value = state.catalog.plugins[0].name;
      $("q").dispatchEvent(new Event("input"));
      await wait(400);
      check(cards().length >= 1 && cards().length < state.catalog.plugins.length, "search narrows list to " + cards().length);
      $("q").value = "";
      $("q").dispatchEvent(new Event("input"));
      await wait(400);
      const kinds = {};
      for (const p of state.catalog.plugins) {
        const k = L.installState(p, L.pickRelease(p, state.zoteroVersion), state.installed).kind;
        kinds[k] = (kinds[k] || 0) + 1;
      }
      log("install states " + JSON.stringify(kinds) + " installedAddons=" + state.installed.size);
      // 确认框:打开后点「取消」,确认没有开始任何安装
      const target = state.catalog.plugins.find((p) => L.installState(p, L.pickRelease(p, state.zoteroVersion), state.installed).kind === "not-installed");
      if (target) {
        const done = onInstallClick(target.id);
        await wait(300);
        const dlg = $("confirm");
        check(dlg.open, "confirm dialog opened for " + target.id);
        const source = $("confirm-host").textContent;
        const url = $("confirm-url").textContent;
        check(source.toLowerCase().endsWith("/" + target.id) && url.indexOf("https://" + source + "/") === 0 && L.isReleaseUrlForPlugin(url, target.id), "confirm shows source=" + source + " matching plugin id and url");
        await snap("confirm");
        $("confirm-cancel").click();
        await done;
        check(!dlg.open && state.busy.size === 0 && !state.results.has(target.id), "cancel closes dialog without installing");
      }
      // 版本比较与 Zotero 自带的比较一致
      const samples = [["1.0", "1.0.0"], ["1.0b1", "1.0"], ["1.0.0-beta.1", "1.0.0"], ["2.10", "2.9"], ["1.0+", "1.1pre"], ["7.0.*", "7.0.99"], ["10.0.8", "10.*"], ["1.a", "1.b"]];
      let mismatch = 0;
      for (const [a, b] of samples) if (Math.sign(Services.vc.compare(a, b)) !== L.compareVersions(a, b)) mismatch++;
      check(mismatch === 0, "compareVersions matches Services.vc (" + samples.length + " samples)");
      log("dark=" + window.matchMedia("(prefers-color-scheme: dark)").matches + " bg=" + getComputedStyle(document.body).backgroundColor);
      const rect = cards()[0].getBoundingClientRect();
      log("layout window=" + window.innerWidth + "x" + window.innerHeight + " firstCard=" + Math.round(rect.width) + "x" + Math.round(rect.height) + " columns=" + getComputedStyle($("list")).gridTemplateColumns.split(" ").length);
      await snap("list");
    } catch (e) {
      failures++;
      log("FAIL exception " + ((e && e.stack) || e));
    } finally {
      log(failures === 0 ? "done ok" : "done with " + failures + " failure(s)");
      later(() => window.close(), 500);
    }
  }

  window.addEventListener("load", init, { once: true });
})();
