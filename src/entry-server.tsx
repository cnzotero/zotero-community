// 预渲染入口(只在构建时运行):把每个页面真正渲染成 HTML,浏览器加载后由 main.tsx 接管。
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App, preloadAllRoutes } from "./App.tsx";
import type { History } from "./plugins/charts-lib.ts";
import type { DelistedData } from "./plugins/delisted.ts";
import { setServerData } from "./plugins/data.ts";
import type { Plugin } from "./plugins/lib.ts";
import { setServerLocation } from "./ssr.ts";

export interface RenderData {
  generatedAt: string;
  plugins: Plugin[];
  history: History;
  /** 下架记录(只有下架记录页与收录规则页用到);缺省为没有下架 */
  delisted?: DelistedData;
  /** 构建日期 YYYY-MM-DD:页面里「几天前」等按它计算 */
  now: string;
}

let ready: Promise<unknown> | null = null;

/** 加载全部页面组件并注入数据;之后 render 可同步调用。 */
export async function prepare(data: RenderData): Promise<(path: string) => string> {
  await (ready ??= preloadAllRoutes());
  setServerData(data);
  return (path: string) => {
    setServerLocation({ path, search: "", now: data.now });
    try {
      return renderToString(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    } finally {
      setServerLocation(null);
    }
  };
}
