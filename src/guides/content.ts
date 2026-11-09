// 浏览器端:读取教程文稿(src/content/guides/*.md),按 order 排序。
// 构建时的预渲染脚本直接用文件系统读取同一批文件,两边内容一致。
import { parseArticle, type Article } from "./markdown.ts";

const raw = import.meta.glob("../content/guides/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const ARTICLES: Article[] = Object.values(raw).map((src) => parseArticle(src)).sort((a, b) => a.order - b.order);

export const articleBySlug = (slug: string): Article | undefined => ARTICLES.find((a) => a.slug === slug);
export const articlePath = (slug: string) => `/guides/${slug}`;
export const articleSlugFromPath = (pathname: string): string | null => /^\/guides\/([a-z0-9][a-z0-9-]*)\/?$/.exec(pathname)?.[1] ?? null;
