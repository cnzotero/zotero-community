// 教程分类:取值固定,顺序即教程总览页的展示顺序。纯函数,浏览器、预渲染与测试共用。
// 每类文章的 order 用各自的区间(见 ORDER_RANGES),组内按 order 排序。
import type { Article } from "./markdown.ts";

export const GUIDE_CATEGORIES = [
  { key: "start", label: "入门" },
  { key: "plugins", label: "插件" },
  { key: "styles", label: "样式与引用" },
  { key: "sync", label: "同步与备份" },
  { key: "library", label: "文库整理与阅读" },
  { key: "writing", label: "写作与引用" },
  { key: "dev", label: "开发" },
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]["key"];

export const GUIDE_CATEGORY_KEYS: readonly string[] = GUIDE_CATEGORIES.map((c) => c.key);

export const isGuideCategory = (v: string): v is GuideCategory => GUIDE_CATEGORY_KEYS.includes(v);

/** 各分类的 order 区间(含两端)。新增文章按所属分类取区间内的数。 */
export const ORDER_RANGES: Record<GuideCategory, [number, number]> = {
  dev: [1, 5],
  start: [100, 199],
  plugins: [200, 299],
  styles: [300, 399],
  sync: [400, 499],
  library: [500, 599],
  writing: [600, 699],
};

export const guideCategoryLabel = (key: string | undefined): string => GUIDE_CATEGORIES.find((c) => c.key === key)?.label ?? "其他";

/** 教程总览页上分类小节的锚点 id。 */
export const categoryAnchor = (key: string): string => `cat-${key}`;

export interface GuideGroup {
  key: GuideCategory | "other";
  label: string;
  articles: Article[];
}

const byOrder = (a: Article, b: Article) => a.order - b.order || a.slug.localeCompare(b.slug);

/**
 * 按分类分组:分类顺序固定,没有文章的分类不出现,组内按 order。
 * 没写分类的文章不丢,放在最后的「其他」组里。
 */
export function groupArticles(articles: readonly Article[]): GuideGroup[] {
  const groups: GuideGroup[] = [];
  for (const c of GUIDE_CATEGORIES) {
    const list = articles.filter((a) => a.category === c.key).sort(byOrder);
    if (list.length) groups.push({ key: c.key, label: c.label, articles: list });
  }
  const rest = articles.filter((a) => !a.category).sort(byOrder);
  if (rest.length) groups.push({ key: "other", label: "其他", articles: rest });
  return groups;
}

/** 同分类的文章(按 order,含自己);没写分类的文章彼此算同一组。 */
export const sameCategory = (articles: readonly Article[], a: Article): Article[] =>
  articles.filter((x) => x.category === a.category).sort(byOrder);

const dateOf = (a: Article): string => a.updated ?? a.published ?? "";

/**
 * 首页「教程」区块:每个分类最多挑两篇。第一篇是组内 order 最小的(该分类的起点),
 * 第二篇是其余文章里最近更新的(日期相同按 order)。完全由文件头算出,不写死文章列表。
 */
export function homePicks(articles: readonly Article[], perGroup = 2): GuideGroup[] {
  return groupArticles(articles).map((g) => {
    const [first, ...rest] = g.articles;
    const latest = [...rest].sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || byOrder(a, b));
    return { ...g, articles: [first, ...latest].slice(0, perGroup) };
  });
}
