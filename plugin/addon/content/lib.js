/*
 * Zotero中文社区 · 插件市场:纯逻辑(不碰界面、不联网、不读写文件),便于单元测试。
 * 同一份文件在 Zotero 窗口里以普通脚本加载(挂到 ZoteroCommunityMarket 上),在 Node 测试里以 CommonJS 加载。
 * 规则对所有插件一视同仁:排序、筛选、安装判断只看目录里的公开数据,没有任何按插件或作者区分的分支。
 */
(function (root, factory) {
  const lib = factory();
  if (typeof module === "object" && module && module.exports) module.exports = lib;
  else root.ZoteroCommunityMarket = lib;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SITE = "https://zoterocn.org";
  const CATALOG_URL = SITE + "/data/catalog.json";
  const SCHEMA = 1;
  /** 安装包只允许来自 GitHub(主机写死,不从目录里读取,避免目录被改时连主机一起改)。 */
  const ALLOWED_HOSTS = ["github.com"];
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  /** 插件 id:owner/repo,两段各 1–100 个字母、数字或 . _ -;任一段不能是 . 或 ..(见 isValidPluginId)。 */
  const ID_RE = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;
  /** 读取目录时最多接受这么多字节(目录实际约 0.5MB)。 */
  const MAX_CATALOG_BYTES = 4 * 1024 * 1024;
  /** 缓存文件最多读这么多字节(目录文本存进缓存时会被转义,留出一倍余量);超过当作没有缓存。 */
  const CACHE_MAX_BYTES = 8 * 1024 * 1024;
  const FETCH_TIMEOUT_MS = 10000;
  /** 缓存最长保存 30 天,超过当作没有。 */
  const CACHE_MAX_AGE_MS = 30 * 86400000;
  const ADDON_ID_RE = /^[A-Za-z0-9._+\-@{}]+$/;

  const SORTS = [
    { key: "stars", label: "星标最多" },
    { key: "updated", label: "最近更新" },
    { key: "cadence", label: "更新最勤" },
    { key: "downloads", label: "下载最多" },
  ];

  // ---------- 版本比较(与 Zotero/Firefox 的版本比较规则一致) ----------

  const INT_MAX = 2147483647;

  /** C 语言 strtol 的行为:跳过空白、可选正负号、十进制数字;没有数字时返回 [0, 起点]。 */
  function strtol(s, i) {
    let j = i;
    while (j < s.length && /\s/.test(s[j])) j++;
    let sign = 1;
    if (s[j] === "+" || s[j] === "-") {
      if (s[j] === "-") sign = -1;
      j++;
    }
    const start = j;
    while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
    if (j === start) return [0, i];
    return [sign * Math.min(Number(s.slice(start, j)), INT_MAX), j];
  }

  function parsePart(part) {
    const r = { a: 0, b: null, c: 0, d: null };
    if (part === null || part === undefined) return r;
    let rest;
    if (part === "*") {
      r.a = INT_MAX;
      rest = "";
    } else {
      const [n, end] = strtol(part, 0);
      r.a = n;
      rest = part.slice(end);
    }
    if (rest === "") return r;
    if (rest[0] === "+") {
      r.a += 1;
      r.b = "pre";
      return r;
    }
    const m = rest.search(/[0-9+-]/);
    if (m < 0) {
      r.b = rest;
      return r;
    }
    r.b = rest.slice(0, m);
    const [n2, end2] = strtol(rest, m);
    r.c = n2;
    const extra = rest.slice(end2);
    r.d = extra === "" ? null : extra;
    return r;
  }

  /** 有字符串排在没有字符串之前(1.0b1 < 1.0)。 */
  function cmpStr(x, y) {
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return x < y ? -1 : x > y ? 1 : 0;
  }

  /** 比较两个版本号,返回 -1 / 0 / 1。规则与 Zotero 判断插件版本时用的一致(如 1.0 = 1.0.0,1.0b1 < 1.0,* 最大)。 */
  function compareVersions(a, b) {
    const pa = String(a ?? "").split(".");
    const pb = String(b ?? "").split(".");
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = parsePart(i < pa.length ? pa[i] : null);
      const y = parsePart(i < pb.length ? pb[i] : null);
      const r = Math.sign(x.a - y.a) || cmpStr(x.b, y.b) || Math.sign(x.c - y.c) || cmpStr(x.d, y.d);
      if (r) return r;
    }
    return 0;
  }

  /** Zotero 版本号里的大版本(10.0.8 → 10);认不出返回 null。 */
  function zoteroMajor(version) {
    const m = /^\s*(\d+)/.exec(String(version ?? ""));
    return m ? Number(m[1]) : null;
  }

  // ---------- 安装包地址校验 ----------

  /**
   * 安装包地址必须:是字符串、https、主机正好是 github.com(小写、无端口、无用户名密码)、
   * 路径以 .xpi 结尾、没有查询串与锚点,并且与标准化后的地址逐字一致(挡住大小写、反斜杠、空白、编码等变形)。
   */
  function isAllowedXpiUrl(url) {
    if (typeof url !== "string" || url.length > 2048) return false;
    if (/[\s\u0000-\u001f\u007f\\]/.test(url)) return false;
    if (!/^https:\/\/github\.com\//.test(url)) return false;
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return false;
    }
    if (u.href !== url) return false;
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.search || u.hash) return false;
    if (ALLOWED_HOSTS.indexOf(u.hostname) < 0) return false;
    // 路径里不许有百分号编码(%2e%2e、%2f、%5c、%00 等都可能被当成路径穿越或截断);按 / 切开后不许有空段、. 或 ..
    if (u.pathname.indexOf("%") >= 0) return false;
    const segs = u.pathname.split("/").slice(1);
    if (segs.length < 3 || segs.some((x) => x === "" || x === "." || x === "..")) return false;
    if (!/\.xpi$/i.test(segs[segs.length - 1]) || segs[segs.length - 1].length <= 4) return false;
    return true;
  }

  /** 插件 id 是否合法:owner/repo 格式,且两段都不是 . 或 ..。 */
  function isValidPluginId(id) {
    if (typeof id !== "string" || !ID_RE.test(id)) return false;
    return id.split("/").every((x) => x !== "." && x !== "..");
  }

  /** 安装包地址路径的前两段(owner/repo,保留原大小写);地址不合法返回 null。 */
  function urlRepo(url) {
    if (!isAllowedXpiUrl(url)) return null;
    const segs = new URL(url).pathname.split("/");
    return segs[1] + "/" + segs[2];
  }

  /**
   * 安装包地址是否属于这个插件:地址本身合法(https://github.com、路径规则见 isAllowedXpiUrl),
   * 且路径前两段 owner/repo 与插件 id 小写后完全相等。主机写死为 github.com,不参考目录里的任何其它字段。
   * 目录构建、目录解析、缓存读回、选版本、安装前校验都走这一个函数。
   */
  function isReleaseUrlForPlugin(url, id) {
    if (!isValidPluginId(id)) return false;
    const repo = urlRepo(url);
    return repo !== null && repo.toLowerCase() === id.toLowerCase();
  }

  // ---------- 文字清理 ----------

  const NAME_MAX = 100;
  const SUMMARY_MAX = 300;
  /** 去掉控制字符与双向文字控制符(可用来伪装显示顺序),合并空白,超长截断并加省略号。 */
  function cleanText(s, max) {
    if (typeof s !== "string") return "";
    const t = s.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
    const chars = Array.from(t);
    return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : t;
  }

  /** 确认框里显示的完整来源「github.com/owner/repo」,直接由将要下载的地址算出;地址不合法返回空串。 */
  function sourceOf(url) {
    const repo = urlRepo(url);
    return repo === null ? "" : new URL(url).hostname + "/" + repo;
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return "";
    }
  }

  // ---------- 目录解析与校验 ----------

  const isStr = (v) => typeof v === "string" && v.length > 0;
  const isCount = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;

  function normalizeRelease(r, id) {
    if (!r || typeof r !== "object") return null;
    if (!Number.isInteger(r.t) || !isStr(r.v) || !isReleaseUrlForPlugin(r.u, id)) return null;
    const out = { t: r.t, v: r.v, u: r.u };
    if (isStr(r.i) && r.i.length <= 200 && ADDON_ID_RE.test(r.i)) out.i = r.i;
    if (isStr(r.min)) out.min = r.min;
    if (isStr(r.max)) out.max = r.max;
    if (typeof r.d === "string" && DAY_RE.test(r.d)) out.d = r.d;
    return out;
  }

  function normalizePlugin(p) {
    if (!p || typeof p !== "object") return null;
    if (!isValidPluginId(p.id) || !cleanText(p.name, NAME_MAX) || !isCount(p.stars)) return null;
    if (!p.zotero || typeof p.zotero.declared !== "boolean" || !Array.isArray(p.zotero.majors)) return null;
    const rawReleases = Array.isArray(p.releases) ? p.releases : [];
    const releases = rawReleases.map((r) => normalizeRelease(r, p.id)).filter(Boolean);
    // 有发布记录却没有一条合格(例如安装包不在这个插件自己的 GitHub 仓库里):整条丢弃
    if (rawReleases.length > 0 && releases.length === 0) return null;
    const out = {
      id: p.id,
      name: cleanText(p.name, NAME_MAX),
      summary: cleanText(p.summary, SUMMARY_MAX),
      category: typeof p.category === "string" ? p.category : "",
      author: cleanText(p.author, NAME_MAX),
      stars: p.stars,
      zotero: { declared: p.zotero.declared, majors: p.zotero.majors.filter((m) => Number.isInteger(m)) },
      releases,
    };
    if (typeof p.updated === "string" && DAY_RE.test(p.updated)) out.updated = p.updated;
    if (p.cadence && isCount(p.cadence.r12)) {
      out.cadence = { r12: p.cadence.r12 };
      if (isCount(p.cadence.days12)) out.cadence.days12 = p.cadence.days12;
      if (typeof p.cadence.last === "string" && DAY_RE.test(p.cadence.last)) out.cadence.last = p.cadence.last;
    }
    if (p.dl && isCount(p.dl.total)) out.dl = { total: p.dl.total };
    if (p.archived === true) out.archived = true;
    return out;
  }

  /**
   * 解析目录文本。返回 { ok: true, catalog } 或 { ok: false, reason: "schema" | "invalid", message }。
   * schema 不是 1 时提示更新插件市场;格式不对的单个条目丢弃并计数,不影响其它条目。
   */
  function parseCatalog(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, reason: "invalid", message: "目录数据格式不对" };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: "invalid", message: "目录数据格式不对" };
    if (data.schema !== SCHEMA) return { ok: false, reason: "schema", message: "目录数据的格式已更新,请更新插件市场" };
    if (!Array.isArray(data.plugins)) return { ok: false, reason: "invalid", message: "目录数据格式不对" };
    const plugins = [];
    const seen = new Set();
    let dropped = 0;
    for (const raw of data.plugins) {
      const p = normalizePlugin(raw);
      if (!p || seen.has(p.id)) {
        dropped++;
        continue;
      }
      seen.add(p.id);
      plugins.push(p);
    }
    const categories = (Array.isArray(data.categories) ? data.categories : []).filter((c) => c && isStr(c.key) && isStr(c.label)).map((c) => ({ key: c.key, label: c.label }));
    return {
      ok: true,
      catalog: {
        generatedAt: typeof data.generatedAt === "string" && DAY_RE.test(data.generatedAt) ? data.generatedAt : null,
        categories,
        plugins,
        dropped,
      },
    };
  }

  // ---------- 适配判断 ----------

  /** 作者声明的适配范围是否含当前 Zotero 大版本(与站点「适配版本」口径一致;未声明的不算适配)。 */
  function supportsMajor(p, major) {
    return !!p.zotero && p.zotero.declared === true && p.zotero.majors.indexOf(major) >= 0;
  }

  /** 安装包声明的 Zotero 版本范围是否覆盖当前版本;没声明范围的不算覆盖。 */
  function releaseCovers(r, zoteroVersion) {
    if (!r.min && !r.max) return false;
    if (r.min && compareVersions(zoteroVersion, r.min) < 0) return false;
    if (r.max && compareVersions(zoteroVersion, r.max) > 0) return false;
    return true;
  }

  /** 能装在当前 Zotero 上的安装包:地址合法、范围覆盖当前版本,取版本最新的一个(同版本取大版本最接近的)。没有返回 null。 */
  function pickRelease(p, zoteroVersion) {
    const major = zoteroMajor(zoteroVersion);
    const ok = (p.releases || []).filter((r) => isReleaseUrlForPlugin(r.u, p.id) && releaseCovers(r, zoteroVersion));
    if (ok.length === 0) return null;
    ok.sort((a, b) => compareVersions(b.v, a.v) || Math.abs(a.t - major) - Math.abs(b.t - major));
    return ok[0];
  }

  /** 目录里版本号最新的一条发布记录(用于卡片上的「最新版本」);没有返回 null。 */
  function latestRelease(p) {
    const list = (p.releases || []).slice();
    if (list.length === 0) return null;
    list.sort((a, b) => compareVersions(b.v, a.v) || b.t - a.t);
    return list[0];
  }

  /** 适配范围文字:「适配 Zotero 7–10」「适配 Zotero 8/10」「兼容范围未声明」。 */
  function compatText(p) {
    if (!p.zotero || !p.zotero.declared) return "兼容范围未声明";
    const m = p.zotero.majors.slice().sort((a, b) => a - b);
    if (m.length === 0) return "适配范围较早";
    const first = m[0];
    const last = m[m.length - 1];
    if (m.length === 1) return "适配 Zotero " + first;
    return m.length === last - first + 1 ? "适配 Zotero " + first + "–" + last : "适配 Zotero " + m.join("/");
  }

  // ---------- 搜索、筛选、排序(与站点同一套口径) ----------

  function norm(s) {
    return String(s).toLowerCase().normalize("NFKC");
  }

  function matchesQuery(p, query) {
    const q = norm(String(query || "").trim());
    if (!q) return true;
    const hay = norm([p.name, p.author, p.summary, p.id].join(" "));
    return q.split(/\s+/).every((w) => hay.indexOf(w) >= 0);
  }

  /** f: { query, category("all" 或分类键), onlyCompatible, major } */
  function filterPlugins(list, f) {
    return list.filter((p) => {
      if (f.category && f.category !== "all" && p.category !== f.category) return false;
      if (f.onlyCompatible && !supportsMajor(p, f.major)) return false;
      return matchesQuery(p, f.query);
    });
  }

  function byName(a, b) {
    return a.name.localeCompare(b.name, "zh-Hans-CN") || a.id.localeCompare(b.id);
  }

  /** 排序:星标 / 最近更新 / 更新最勤(近一年有发布的天数)/ 下载最多;同分按名称。 */
  function sortPlugins(list, sort) {
    const out = list.slice();
    out.sort((a, b) => {
      if (sort === "updated") return (b.updated || "").localeCompare(a.updated || "") || byName(a, b);
      if (sort === "downloads") return (b.dl ? b.dl.total : -1) - (a.dl ? a.dl.total : -1) || b.stars - a.stars || byName(a, b);
      if (sort === "cadence") {
        const d = (p) => (p.cadence && typeof p.cadence.days12 === "number" ? p.cadence.days12 : -1);
        const r = (p) => (p.cadence ? p.cadence.r12 : -1);
        return d(b) - d(a) || r(b) - r(a) || b.stars - a.stars || byName(a, b);
      }
      return b.stars - a.stars || byName(a, b);
    });
    return out;
  }

  // ---------- 安装状态 ----------

  /**
   * 安装状态。installed: Map<插件标识, { version, active }>。
   * kind:
   *   "update"        已安装且目录里有更新的版本
   *   "installed"     已安装
   *   "not-installed" 未安装
   *   "unknown"       目录里没有这个插件的标识,无法判断(安装后可在附加组件里查看)
   *   "no-package"    没有能装在当前 Zotero 上的安装包
   */
  function installState(p, release, installed) {
    if (!release) {
      for (const r of p.releases || []) {
        if (r.i && installed.has(r.i)) return { kind: "installed", version: installed.get(r.i).version, active: installed.get(r.i).active !== false };
      }
      return { kind: "no-package" };
    }
    if (!release.i) return { kind: "unknown" };
    const inst = installed.get(release.i);
    if (!inst) return { kind: "not-installed" };
    const active = inst.active !== false;
    if (compareVersions(release.v, inst.version) > 0) return { kind: "update", version: inst.version, active };
    return { kind: "installed", version: inst.version, active };
  }

  /**
   * 点击「安装 / 更新」时重新取安装目标:只从目录里这个插件适配当前版本的那条发布记录取地址,并再次校验。
   * 返回 { ok: true, release, host } 或 { ok: false, message }。
   */
  function installTarget(p, zoteroVersion) {
    const release = p ? pickRelease(p, zoteroVersion) : null;
    if (!release) return { ok: false, message: "目录里没有适配当前 Zotero 版本的安装包" };
    if (!isReleaseUrlForPlugin(release.u, p.id)) return { ok: false, message: "安装包地址没有通过安全校验(只允许该插件自己在 github.com 上的仓库里的 .xpi 文件),已拒绝安装" };
    // 显示的来源与实际下载地址都取自同一个字段 release.u
    return { ok: true, release, url: release.u, source: sourceOf(release.u), host: hostOf(release.u) };
  }

  // ---------- 目录的网络读取与缓存 ----------

  /**
   * 读取目录文本。fetchImpl 是 fetch 的实现(Zotero 窗口里用自带的 fetch,测试里注入假的)。
   * 不跟随重定向;Content-Type 必须含 json;Content-Length 超上限直接拒绝;边读边计数,超上限立即中止;10 秒超时。
   * 返回 Promise<string>,失败时抛出带中文说明的错误。
   */
  async function fetchCatalogText(fetchImpl, opts) {
    const o = opts || {};
    const maxBytes = o.maxBytes || MAX_CATALOG_BYTES;
    const ctrl = new AbortController();
    if (o.onController) o.onController(ctrl);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, o.timeoutMs || FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(o.url || CATALOG_URL, { signal: ctrl.signal, redirect: "error", cache: "no-cache", credentials: "omit" });
      if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) throw new Error("服务器要求跳转到其它地址,已拒绝");
      if (!res.ok) throw new Error("服务器返回 " + res.status);
      const type = (res.headers.get("content-type") || "").toLowerCase();
      if (type.indexOf("json") < 0) throw new Error("服务器返回的不是目录数据");
      const len = res.headers.get("content-length");
      if (len !== null && len !== "" && Number(len) > maxBytes) throw new Error("目录数据超过大小上限");
      if (!res.body || typeof res.body.getReader !== "function") throw new Error("无法读取目录数据");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let size = 0;
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          try {
            await reader.cancel();
          } catch (e) {
            // 已经中止
          }
          ctrl.abort();
          throw new Error("目录数据超过大小上限");
        }
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    } catch (e) {
      if (timedOut) throw new Error("连接超时(10 秒)");
      // fetch 的网络错误(含因不跟随重定向而被拒绝)都是 TypeError,英文原文对用户没有帮助
      if (e instanceof TypeError) throw new Error("网络连接失败,或服务器要求跳转到其它地址");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 读回缓存:{ savedAt, text } 格式正确、保存时间在 30 天内(且不在未来)、目录重新解析校验通过,才返回解析结果;否则 null。
   */
  /** 缓存文件大小是否在上限内(读文件之前先查;大小未知时不读)。 */
  function cacheSizeOk(size) {
    return typeof size === "number" && Number.isFinite(size) && size >= 0 && size <= CACHE_MAX_BYTES;
  }

  function readCacheEntry(raw, now) {
    if (typeof raw === "string" && raw.length > CACHE_MAX_BYTES) return null;
    let c;
    try {
      c = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      return null;
    }
    if (!c || typeof c.text !== "string" || typeof c.savedAt !== "string") return null;
    const saved = Date.parse(c.savedAt);
    const t = now instanceof Date ? now.getTime() : Number(now);
    if (Number.isNaN(saved) || saved > t + 86400000 || t - saved > CACHE_MAX_AGE_MS) return null;
    const parsed = parseCatalog(c.text);
    if (!parsed.ok || isFutureDated(parsed.catalog, t)) return null;
    return { savedAt: c.savedAt, text: c.text, catalog: parsed.catalog };
  }

  function makeCacheEntry(text, now) {
    return JSON.stringify({ savedAt: (now instanceof Date ? now : new Date(now)).toISOString(), text });
  }

  /** 目录日期晚于「现在 + 2 天」:视为无效(防止被篡改成未来日期的缓存长期挡住合法的新目录)。 */
  function isFutureDated(catalog, now) {
    if (!catalog || !catalog.generatedAt) return false;
    const t = now instanceof Date ? now.getTime() : Number(now);
    return Date.parse(catalog.generatedAt + "T00:00:00Z") > t + 2 * 86400000;
  }

  /** 新取到的目录是否比已保存的旧(回滚):两者都有日期且新的更早时为 true。 */
  function isRollback(fresh, cached) {
    if (!fresh || !cached || !fresh.generatedAt || !cached.generatedAt) return false;
    return fresh.generatedAt < cached.generatedAt;
  }

  /**
   * 安装过程的监听器。下载完成时(此时 Zotero 已读出包里的 manifest,install.addon.id 就是包内的插件标识)
   * 若目录记录了标识而包内的不同,就取消安装:返回 false 让 Zotero 停止后续步骤,并调用 install.cancel() 清理下载的文件。
   * done 只会被调用一次,参数为 { ok, addon?, code?, message?, postponed? }。
   */
  function installListener(release, done) {
    let finished = false;
    const finish = (r) => {
      if (!finished) {
        finished = true;
        done(r);
      }
    };
    return {
      onDownloadEnded(install) {
        const got = install && install.addon ? install.addon.id : null;
        if (release.i && got !== release.i) {
          finish({ ok: false, message: "安装包里的插件标识(" + (got || "未知") + ")与目录记录的(" + release.i + ")不一致,已取消安装" });
          try {
            install.cancel();
          } catch (e) {
            // 已经不在可取消的状态
          }
          return false;
        }
        return true;
      },
      onDownloadFailed: (i) => finish({ ok: false, code: i.error }),
      onDownloadCancelled: () => finish({ ok: false, message: "下载已取消" }),
      onInstallFailed: (i) => finish({ ok: false, code: i.error }),
      onInstallCancelled: () => finish({ ok: false, message: "安装已取消" }),
      onInstallPostponed: () => finish({ ok: true, postponed: true }),
      onInstallEnded: (i, addon) => finish({ ok: true, addon }),
    };
  }

  /**
   * 打开插件市场时决定用哪份目录。fetched 为 { text } 或 { error };cache 为 readCacheEntry 的结果或 null。
   * 新目录格式不对、日期在未来、比缓存旧,都不采用而回退到缓存;schema 不对时提示更新插件市场。
   * 返回 { catalog, source: "network" | "cache" | null, save: 是否写入缓存, notice: 提示文字或 null, retry: 是否给重试按钮 }。
   */
  function decideCatalog(fetched, cache, now) {
    let problem = null;
    if (fetched && typeof fetched.text === "string") {
      const parsed = parseCatalog(fetched.text);
      if (!parsed.ok && parsed.reason === "schema") return { catalog: null, source: null, save: false, notice: parsed.message, retry: false };
      if (!parsed.ok) problem = parsed.message;
      else if (isFutureDated(parsed.catalog, now)) problem = "取到的目录日期(" + parsed.catalog.generatedAt + ")不合理,已忽略";
      else if (cache && isRollback(parsed.catalog, cache.catalog)) problem = "取到的目录(" + parsed.catalog.generatedAt + ")比本机已保存的(" + cache.catalog.generatedAt + ")更旧,已忽略";
      else return { catalog: parsed.catalog, source: "network", save: true, notice: null, retry: false };
    } else {
      problem = (fetched && fetched.error) || "未知错误";
    }
    if (cache) return { catalog: cache.catalog, source: "cache", save: false, notice: "无法读取最新的插件目录(" + problem + "),下面显示的是上次保存的目录。", retry: true };
    return { catalog: null, source: null, save: false, notice: "无法读取插件目录:" + problem + "。请检查网络后重试。", retry: true };
  }

  /**
   * 卡片上「安装 / 更新」按钮的状态。checking:先显示了本机保存的目录、后台检查还没完成;
   * 这期间一律不可点,等检查完成(成功或失败)后恢复,避免按可能已过时的目录安装。
   */
  function installButtonState(kind, busy, checking) {
    if (busy) return { label: "正在安装…", disabled: true, title: "" };
    const label = kind === "update" ? "更新" : "安装";
    if (checking) return { label, disabled: true, title: "正在检查更新…" };
    return { label, disabled: false, title: "" };
  }

  /** 安装失败原因(按 Zotero 返回的错误码)。 */
  const INSTALL_ERRORS = {
    "-1": "下载失败,请检查网络后重试",
    "-2": "安装包校验不一致",
    "-3": "安装包已损坏或不是有效的插件",
    "-4": "无法写入插件文件",
    "-5": "安装包需要签名",
    "-6": "安装包类型不对",
    "-7": "安装包里的插件标识与预期不一致",
    "-8": "来源不被允许",
    "-9": "安装包版本与预期不一致",
    "-10": "该插件已被列入阻止名单",
    "-11": "该插件与当前 Zotero 版本不兼容",
    "-12": "不支持这种类型的插件",
    "-13": "只能由管理员安装",
    "-14": "该插件已被列入阻止名单",
  };
  function installErrorText(code) {
    return INSTALL_ERRORS[String(code)] || "安装失败(错误码 " + code + ")";
  }

  /** 站内详情页地址;插件 id 格式不对返回 null。 */
  function detailUrl(id) {
    if (!isValidPluginId(id)) return null;
    const [owner, repo] = id.split("/");
    return SITE + "/plugins/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
  }

  function formatStars(n) {
    if (n >= 10000) return (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  return {
    SITE,
    CATALOG_URL,
    SCHEMA,
    ALLOWED_HOSTS,
    SORTS,
    compareVersions,
    zoteroMajor,
    MAX_CATALOG_BYTES,
    CACHE_MAX_AGE_MS,
    CACHE_MAX_BYTES,
    cacheSizeOk,
    installButtonState,
    isAllowedXpiUrl,
    isValidPluginId,
    isReleaseUrlForPlugin,
    cleanText,
    NAME_MAX,
    SUMMARY_MAX,
    isFutureDated,
    decideCatalog,
    installListener,
    sourceOf,
    hostOf,
    fetchCatalogText,
    readCacheEntry,
    makeCacheEntry,
    isRollback,
    parseCatalog,
    supportsMajor,
    releaseCovers,
    pickRelease,
    latestRelease,
    compatText,
    matchesQuery,
    filterPlugins,
    sortPlugins,
    installState,
    installTarget,
    installErrorText,
    detailUrl,
    formatStars,
  };
});
