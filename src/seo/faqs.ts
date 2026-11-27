// 站内核心栏目的常见问题单一来源:页面可见文本与预渲染 FAQPage JSON-LD 共用这一份,
// 保证结构化数据与页面展示完全一致;全部只写事实与公开规则,不对任何单个插件做特殊对待。
import type { Block, Inline } from "../guides/markdown.ts";

export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FAQS: FaqItem[] = [
  {
    q: "Zotero 中文社区（zoterocn.org）是什么网站？与 Zotero 官方是什么关系？",
    a: "Zotero 中文社区（zoterocn.org）是由社区自发运营的非官方中文站点，集中提供 Zotero 插件商店与版本兼容速查、中文使用与开发教程、期刊收录与分区查询、中文引用样式指南以及开放 JSON 目录数据。本站与 Zotero 官方（Corporation for Digital Scholarship）无隶属关系，所有代码与收录规则均在 GitHub 公开。",
  },
  {
    q: "在 Zotero 中文社区下载插件安全吗？安装包来自哪里？",
    a: "本站不托管、不修改任何第三方插件安装包。插件详情页和社区插件市场中的下载按钮全部指向插件作者在 GitHub 或 Gitee 上的公开发布页直链；使用「Zotero中文社区」插件在 Zotero 内安装或更新前，还会弹窗展示插件名、版本号、来源仓库与安装包地址，需用户核对确认后才会下载。",
  },
  {
    q: "Zotero 7、8、9、10 升级后怎么快速查哪些插件还能用？",
    a: "可在首页或插件广场进入对应大版本的兼容清单（如 Zotero 10 兼容的插件、Zotero 8 兼容的插件、Zotero 7 兼容的插件），按作者在公开发布说明中声明的适配范围筛选；未声明适配范围的插件不作推定，建议点进详情页查看作者仓库确认。升级主版本前建议先完整备份本地数据目录。",
  },
  {
    q: "插件目录的收录与排序遵循什么规则？",
    a: "目录内的插件没有推荐位、没有付费置顶，也没有广告位，全部按同一套公开规则自动收录、排序与下架，支持按 GitHub 星标、最近更新、近一年更新频率、下载量与名称排序。唯一例外是本社区自己维护的开源「Zotero中文社区」插件，它在插件广场顶部单独展示，不参与目录排序与计数。",
  },
  {
    q: "找不到想用的插件、发现信息有误，或者想提交新插件怎么办？",
    a: "可直接在公开仓库 github.com/cnzotero/zotero-community 提交 Issue。符合收录条件的 GitHub 插件申请会由公开脚本自动核对并收录，信息更正与下架申请由维护者处理，全部处理记录公开可查。",
  },
];

export const OFFICIAL_PLUGIN_FAQS: FaqItem[] = [
  {
    q: "插件市场会自动安装或更新其他插件吗？",
    a: "不会。每次安装或更新都要你在确认框里核对插件名、版本、来源仓库与安装包地址并确认后才会执行。",
  },
  {
    q: "为什么有的插件没有安装按钮？",
    a: "可能是它没有适配你当前 Zotero 版本的安装包，或者安装包不在它自己的 GitHub 仓库里。可以点「查看详情」到本站的插件页，再去作者主页核对。",
  },
  {
    q: "入口在哪里？「工具」菜单里能找到吗？",
    a: "入口在文库工具栏、搜索框左侧。需要在「工具」菜单里也显示入口的，可在 Zotero 设置的「高级 → 设置编辑器」里搜索 zotero-community.showToolsMenuItem，改为 true 后重启 Zotero。",
  },
  {
    q: "插件广场为什么把它单独放在顶部？",
    a: "它是本社区自己维护的工具，所以单独展示、明确标注；它不在插件目录里，不参与排序与排名，也不影响其他插件的收录与排序，详见收录规则第 4 章。",
  },
];

export const JOURNALS_FAQS: FaqItem[] = [
  {
    q: "期刊查询支持查哪些分区和指标？",
    a: "支持按期刊全称、常见缩写或 ISSN 查询影响因子（IF）、五年影响因子、JCI、JCR 分区与学科排名、中科院分区（升级版与基础版及 Top 标识）、SCIE / SSCI / EI 收录，以及 CCF、AJG、FT50、UTD24、北大核心、CSSCI、CSCD 等常见榜单。",
  },
  {
    q: "为什么有些期刊的部分指标显示「暂无」？",
    a: "所有指标均来自同一份标注版本号的数据。某本期刊未被对应榜单收录或该年份缺少该项指标时直接显示「暂无」，不推算、不估计、不用相近期刊数据顶替。投稿前仍请以期刊官网与目标单位最新目录为准。",
  },
  {
    q: "怎么在 Zotero 文献列表里直接看到期刊分区和影响因子？",
    a: "可在 Zotero 中安装「期刊分区与影响因子」专题下的第三方插件，重启 Zotero 后在文献列表表头栏右键勾选对应的分区或影响因子列即可。如果个别条目显示空白，通常是因为预印本或缺少标准期刊名与 ISSN，补全题录后刷新即可。",
  },
];

export const STYLES_FAQS: FaqItem[] = [
  {
    q: "Zotero 怎么安装 GB/T 7714 等中文引用样式？",
    a: "在 Zotero 设置的 Cite 面板中可点击「Get additional styles…」从 Zotero 官方样式库直接安装常用样式；需要更多中文期刊或学位论文样式时，可从中文 CSL 样式仓库获取 .csl 文件后，在样式管理器中点击「+」从本地文件导入。",
  },
  {
    q: "为什么安装中文 CSL 样式时提示不是有效的 CSL 1.0.2 文件？",
    a: "部分中文双语样式使用了 CSL-M 扩展语法用于区分中英文文献的「等」与「et al.」，Zotero 提示该信息属于正常现象，忽略提示完成安装即可。",
  },
  {
    q: "中英文混排参考文献里中文文献还是显示 et al. 怎么办？",
    a: "需要在 Zotero 中为每条文献正确填写「语言（Language）」字段：中文文献填 zh-CN，英文文献填 en-US，避免写成「中文」或「English」。修改完成后回到 Word 或 LibreOffice 的 Zotero 选项卡点击 Refresh 即可更新。",
  },
];

const inlineText = (inline: Inline[]): string => inline.map((x) => x.v).join("").trim();

/**
 * 从教程正文里的「## 常见问题」小节提取问答对(**问题？** 回答),用于生成与正文完全一致的 FAQPage JSON-LD。
 * 没有「常见问题」小节或格式不匹配时返回空数组,不凭空构造。
 */
export function extractGuideFaqs(blocks: Block[]): FaqItem[] {
  const start = blocks.findIndex((b) => b.t === "h2" && inlineText(b.inline).includes("常见问题"));
  if (start === -1) return [];
  const items: FaqItem[] = [];
  for (let i = start + 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === "h2") break;
    if (b.t === "p" && b.inline.length >= 2 && b.inline[0].t === "strong") {
      const q = b.inline[0].v.trim();
      const a = inlineText(b.inline.slice(1)).replace(/^[:：\s]+/, "").trim();
      if (q.length >= 4 && a.length >= 10) items.push({ q, a });
    } else if (b.t === "h3") {
      const q = inlineText(b.inline);
      const next = blocks[i + 1];
      if (next && next.t === "p") {
        const a = inlineText(next.inline);
        if (q.length >= 4 && a.length >= 10) items.push({ q, a });
      }
    }
  }
  return items;
}
