import type { GuideEntry, PluginCategory, PluginEntry } from "./content.ts";

function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase().trim();
}

function matches(haystack: string[], query: string): boolean {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = haystack.map(norm).join(" ");
  return terms.every((t) => text.includes(t));
}

export function filterPlugins(
  list: readonly PluginEntry[],
  opts: { query?: string; category?: PluginCategory | "all" },
): PluginEntry[] {
  const category = opts.category ?? "all";
  return list.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      matches([p.name, p.author, p.summary], opts.query ?? ""),
  );
}

export function filterGuides(
  list: readonly GuideEntry[],
  opts: { query?: string; topic?: GuideEntry["topic"] | "all" },
): GuideEntry[] {
  const topic = opts.topic ?? "all";
  return list.filter(
    (g) => (topic === "all" || g.topic === topic) && matches([g.title, g.summary, g.topic], opts.query ?? ""),
  );
}

/** 全站搜索:教程 + 插件,各自保持原顺序。 */
export function searchAll(
  plugins: readonly PluginEntry[],
  guides: readonly GuideEntry[],
  query: string,
): { plugins: PluginEntry[]; guides: GuideEntry[] } {
  return { plugins: filterPlugins(plugins, { query }), guides: filterGuides(guides, { query }) };
}
