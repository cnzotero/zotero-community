// 教程用的小型 Markdown 解析:只支持教程实际用到的语法(标题、段落、列表、代码块、引用、
// 行内代码/加粗/链接)。不使用 innerHTML:浏览器里转成 React 元素,构建时转成已转义的 HTML 字符串。
// 链接只允许 http(s) 与站内路径,其余一律当普通文字,杜绝 javascript: 之类的注入。

export interface Frontmatter {
  title: string;
  description: string;
  slug: string;
  order: number;
  sources: string[];
}

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; v: string }
  | { t: "link"; v: string; href: string; external: boolean };

export type Block =
  | { t: "h2"; inline: Inline[] }
  | { t: "h3"; inline: Inline[] }
  | { t: "p"; inline: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "quote"; inline: Inline[] }
  | { t: "code"; lang: string; v: string };

export interface Article extends Frontmatter {
  blocks: Block[];
}

const unquote = (s: string) => s.trim().replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1");

/** 解析文件头的简单 YAML:title / description / slug / order / sources(列表)。 */
export function parseFrontmatter(src: string): { meta: Frontmatter; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) throw new Error("缺少文件头");
  const meta: Frontmatter = { title: "", description: "", slug: "", order: 0, sources: [] };
  let inSources = false;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (inSources && item) { meta.sources.push(unquote(item[1])); continue; }
    inSources = false;
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, k, v] = kv;
    if (k === "sources") { inSources = true; continue; }
    if (k === "title") meta.title = unquote(v);
    else if (k === "description") meta.description = unquote(v);
    else if (k === "slug") meta.slug = unquote(v);
    else if (k === "order") meta.order = Number(v) || 0;
  }
  if (!meta.title || !meta.slug) throw new Error("文件头缺少 title 或 slug");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(meta.slug)) throw new Error(`slug 不合法: ${meta.slug}`);
  return { meta, body: src.slice(m[0].length) };
}

// 站内路径必须是单个 / 开头:以 // 开头的是「协议相对地址」,会跳到别的网站,必须拒绝
const SAFE_HREF = /^(https?:\/\/[^\s<>"']+|\/(?!\/)[^\s<>"']*|#[\w-]+)$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ t: "text", v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] });
    else if (m[4] !== undefined) out.push({ t: "strong", v: m[4] });
    else if (SAFE_HREF.test(m[3])) out.push({ t: "link", v: m[2], href: m[3], external: /^https?:/.test(m[3]) });
    else out.push({ t: "text", v: m[2] }); // 不安全的链接只留文字
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

const CJK = /[　-鿿＀-￯]$/;

export function parseBlocks(body: string): Block[] {
  const lines = body.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  let firstH1Skipped = false;
  const para: string[] = [];
  const flush = () => {
    if (para.length) {
      let text = "";
      for (const l of para) text += text && !CJK.test(text) ? " " + l : l;
      blocks.push({ t: "p", inline: parseInline(text) });
      para.length = 0;
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++; // 结束围栏
      blocks.push({ t: "code", lang: fence[1], v: code.join("\n") });
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      if (h[1] === "#") { if (!firstH1Skipped) { firstH1Skipped = true; i++; continue; } }
      blocks.push(h[1] === "###" ? { t: "h3", inline: parseInline(h[2].trim()) } : { t: "h2", inline: parseInline(h[2].trim()) });
      i++;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", inline: parseInline(q.join(" ")) });
      continue;
    }
    const li = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m && /\d/.test(m[1]) === ordered) { items.push(parseInline(m[2])); i++; continue; }
        // 缩进的续行并入上一项
        if (items.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) {
          items[items.length - 1] = parseInline(lines[i].trim() ? textOf(items[items.length - 1]) + " " + lines[i].trim() : "");
          i++;
          continue;
        }
        break;
      }
      blocks.push(ordered ? { t: "ol", items } : { t: "ul", items });
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return blocks;
}

function textOf(inline: Inline[]): string {
  return inline.map((x) => (x.t === "link" ? `[${x.v}](${x.href})` : x.t === "code" ? `\`${x.v}\`` : x.t === "strong" ? `**${x.v}**` : x.v)).join("");
}

export function parseArticle(src: string): Article {
  const { meta, body } = parseFrontmatter(src);
  return { ...meta, blocks: parseBlocks(body) };
}

// ---------- 构建时:转成已转义的 HTML 字符串(供预渲染,正文进入静态页面) ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inlineToHtml(inline: Inline[]): string {
  return inline.map((x) => {
    if (x.t === "code") return `<code>${esc(x.v)}</code>`;
    if (x.t === "strong") return `<strong>${esc(x.v)}</strong>`;
    if (x.t === "link") return x.external ? `<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${esc(x.v)}</a>` : `<a href="${esc(x.href)}">${esc(x.v)}</a>`;
    return esc(x.v);
  }).join("");
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map((b) => {
    if (b.t === "h2" || b.t === "h3") return `<${b.t}>${inlineToHtml(b.inline)}</${b.t}>`;
    if (b.t === "p") return `<p>${inlineToHtml(b.inline)}</p>`;
    if (b.t === "quote") return `<blockquote>${inlineToHtml(b.inline)}</blockquote>`;
    if (b.t === "code") return `<pre><code>${esc(b.v)}</code></pre>`;
    return `<${b.t}>${b.items.map((it: Inline[]) => `<li>${inlineToHtml(it)}</li>`).join("")}</${b.t}>`;
  }).join("");
}

/** 字数(汉字按 1 个,英文单词按 1 个),用来估算阅读时间。 */
export function wordCount(blocks: Block[]): number {
  const text = blocks.map((b) => (b.t === "ul" || b.t === "ol" ? b.items.map(textOf).join(" ") : b.t === "code" ? "" : textOf(b.inline))).join(" ");
  return (text.match(/[一-鿿]/g) ?? []).length + (text.replace(/[一-鿿]/g, " ").match(/[A-Za-z0-9]+/g) ?? []).length;
}
