// 浏览器里切换页面时同步更新 <head>:标题、描述、规范链接、Open Graph 与收录设置,
// 与预渲染写进静态页面的内容保持一致。
import { isIndexable, ogImage, pageUrl, type PageMeta } from "./pages.ts";

function upsert(selector: string, create: () => HTMLElement, attr: string, value: string): void {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

const meta = (key: "name" | "property", name: string) => () => {
  const el = document.createElement("meta");
  el.setAttribute(key, name);
  return el;
};

export function applyMeta(m: PageMeta): void {
  const url = pageUrl(m.path);
  document.title = m.title;
  upsert('meta[name="description"]', meta("name", "description"), "content", m.description);
  upsert('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", url);
  upsert('meta[name="robots"]', meta("name", "robots"), "content", isIndexable(m) ? "index,follow,max-image-preview:large" : "noindex,follow");
  upsert('meta[property="og:title"]', meta("property", "og:title"), "content", m.title);
  upsert('meta[property="og:description"]', meta("property", "og:description"), "content", m.description);
  upsert('meta[property="og:url"]', meta("property", "og:url"), "content", url);
  upsert('meta[property="og:image"]', meta("property", "og:image"), "content", ogImage(m.kind));
}
