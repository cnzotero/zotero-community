import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin as VitePlugin } from "vite";
import react from "@vitejs/plugin-react";
import { homeBoards } from "./src/plugins/lib.ts";

const PLUGINS_JSON = fileURLToPath(new URL("./src/data/plugins.json", import.meta.url));

/** 首页榜单用的小份数据:构建时从插件数据里算好,首页不必加载整份插件数据。 */
function homeBoardsModule(): VitePlugin {
  const ID = "virtual:home-boards";
  return {
    name: "home-boards",
    resolveId: (id) => (id === ID ? "\0" + ID : null),
    load(id) {
      if (id !== "\0" + ID) return null;
      this.addWatchFile(PLUGINS_JSON);
      const data = JSON.parse(readFileSync(PLUGINS_JSON, "utf8"));
      return `export default ${JSON.stringify(homeBoards(data.plugins))};`;
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), homeBoardsModule()],
  resolve: { dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 5250, proxy: { "/api/journals": "http://127.0.0.1:18091" } },
  build: {
    // 公开站点禁止产出 source map:.map 自带源码原文,线上谁都能下载。
    sourcemap: false,
  },
});
