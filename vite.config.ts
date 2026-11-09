import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 5250, proxy: { "/api/journals": "http://127.0.0.1:18091" } },
  build: {
    // 公开站点禁止产出 source map:.map 自带源码原文,线上谁都能下载。
    sourcemap: false,
  },
});
