import { defineConfig, type Plugin as VitePlugin } from "vite";
import react from "@vitejs/plugin-react";
import { compatIndex, homeBoards } from "./src/plugins/lib.ts";
import { BUILD_DATE_META, DELISTED_FILE, PLUGINS_FILE, buildDay, loadCatalog, type Catalog } from "./scripts/catalog.ts";

// 同一次构建只定一次构建日期;预渲染时会通过环境变量传入同一天(见 scripts/catalog.ts)。
const DAY = buildDay();

/**
 * 由插件数据在构建时生成的小模块。数据只经 scripts/catalog.ts 读取一次并按构建日期分出在架名单,
 * 这里的每个模块都只看在架的插件:
 *   virtual:plugin-catalog  插件广场、分类页、版本页、详情页、数据看板用的数据(按需加载)
 *   virtual:home-boards     首页三个榜单(首页不必加载整份插件数据)
 *   virtual:compat-index    首页「按 Zotero 版本找插件」:各版本兼容页的版本号与插件数
 *   virtual:delisted        下架记录页与收录规则页用的在架数与下架记录(不含下载地址)
 */
function catalogModules(): VitePlugin {
  const make: Record<string, (c: Catalog) => unknown> = {
    "virtual:plugin-catalog": (c) => ({ generatedAt: c.generatedAt, plugins: c.listed }),
    "virtual:home-boards": (c) => homeBoards(c.listed),
    "virtual:compat-index": (c) => compatIndex(c.listed),
    "virtual:delisted": (c) => c.delistedData,
  };
  let catalog: Catalog | null = null;
  return {
    name: "plugin-catalog",
    resolveId: (id) => (id in make ? "\0" + id : null),
    load(id) {
      if (!id.startsWith("\0") || !(id.slice(1) in make)) return null;
      this.addWatchFile(PLUGINS_FILE);
      this.addWatchFile(DELISTED_FILE);
      catalog ??= loadCatalog(DAY);
      // 数据较大:用 JSON.parse 包一层,解析比同样内容的对象字面量快
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(make[id.slice(1)](catalog)))});`;
    },
    watchChange: (id) => {
      if (id === PLUGINS_FILE || id === DELISTED_FILE) catalog = null;
    },
    // 在 index.html 里记下构建日期,预渲染据此用同一天判断(写入静态页面前会去掉)
    transformIndexHtml: () => [{ tag: "meta", attrs: { name: BUILD_DATE_META, content: DAY }, injectTo: "head" }],
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), catalogModules()],
  resolve: { dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 5250, proxy: { "/api/journals": "http://127.0.0.1:18091" } },
  build: {
    // 公开站点禁止产出 source map:.map 自带源码原文,线上谁都能下载。
    sourcemap: false,
  },
});
