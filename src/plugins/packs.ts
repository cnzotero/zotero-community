// 按科研阶段选插件(规则驱动、完全中立):
// 每个科研阶段列出该阶段最核心的 4–5 个任务环节,每个环节绑定一个已有的功能专题(TOPICS),
// 自动从全站目录里按统一客观口径筛出「声明适配当前最新 Zotero 版本 + 近 1 年有更新 + 按 GitHub 星标排序」的前若干款插件。
// 源码里绝不写死任何单个插件名或作者名,对所有插件一视同仁。
import { ZOTERO_VERSIONS, type Plugin } from "./lib.ts";
import { topicList, topicOf } from "./topics.ts";

export interface PackSlot {
  /** 本阶段这一步要解决什么 */
  task: string;
  /** 为什么这一步在这个阶段重要 */
  why: string;
  /** 对应的通用功能专题键(见 topics.ts) */
  topicKey: string;
  /** 本环节默认展示几款插件 */
  limit: number;
}

export interface StagePack {
  key: string;
  label: string;
  subtitle: string;
  description: string;
  audience: string;
  tips: string[];
  guideSlugs: string[];
  slots: PackSlot[];
}

export const STAGE_PACKS: StagePack[] = [
  {
    key: "undergrad",
    label: "本科生与毕业论文",
    subtitle: "轻量起步：装 2–3 个刚需插件，把文献导入、英文阅读和 Word 国标引用跑顺",
    description: "面向本科课程论文与毕业设计的精简 Zotero 插件组合：覆盖英文翻译、Word/WPS 论文写作、GB/T 7714 中文引用与题录元数据补全，按公开适配版本与活跃度自动筛选。",
    audience: "本科生 / 毕业设计 / 课程论文",
    tips: [
      "刚上手先用 Zotero 原生管理 + Word 插件写完一篇小作业，再按痛点装 2–3 个插件，切忌一次装十几个。",
      "写中文毕业论文务必提前在「引用样式」里装好学校要求的 GB/T 7714 样式，并核对中文文献的语言字段。",
      "交稿前一周不要升级 Zotero 主版本，避免插件临时不兼容打乱排版节奏。",
    ],
    guideSlugs: ["install-zotero", "zotero-download-install-faq", "zotero-word-wps-plugin", "gb-t-7714"],
    slots: [
      { task: "英文文献快速阅读与翻译", why: "读英文参考资料时用划词或全文对照翻译提速，减少在网页翻译器间来回复制。", topicKey: "translate", limit: 3 },
      { task: "Word / WPS 写作与引用辅助", why: "在撰写毕业论文时顺畅插入引文、切换国标参考文献格式并核对引文编号。", topicKey: "writing", limit: 3 },
      { task: "中文文献与题录补全", why: "补齐知网/外文导入后缺失的作者、年份、卷期页码与中文元数据。", topicKey: "chinese", limit: 3 },
      { task: "文库整理与去重", why: "把几十篇参考资料按章节打标签、整理附件并清理重复条目。", topicKey: "organize", limit: 3 },
    ],
  },
  {
    key: "master",
    label: "硕士研究生与开题综述",
    subtitle: "高效精读与写综述：打通文献检索、PDF 全文翻译、期刊分区与多篇笔记梳理",
    description: "面向硕士研究生开题报告、文献综述与小论文写作的 Zotero 插件组合：涵盖文献检索、PDF 翻译、期刊分区列、笔记批注与综述梳理，按统一公开规则自动筛选。",
    audience: "硕士研究生 / 开题报告 / 文献综述",
    tips: [
      "开题阶段文献数量很快突破 100 篇，建议尽早开启期刊分区列与标签体系，先筛高质量核心文献再精读。",
      "读完每篇核心文献后沉淀结构化笔记（研究问题、方法、数据、局限），写综述时才不会变成逐篇流水账。",
      "如果同时在实验室台式机、笔记本和平板间看论文，尽早按 WebDAV 教程配好跨设备同步并保留定期备份。",
    ],
    guideSlugs: ["zotero-ai-plugins-guide", "zotero-pdf-bilingual-translate", "zotero-journal-ranking-column", "zotero-webdav-sync"],
    slots: [
      { task: "PDF 划词与保留排版全文翻译", why: "每周精读大量英文顶刊 PDF，保留双栏与公式排版能显著降低阅读阻力。", topicKey: "translate", limit: 3 },
      { task: "文献列表显示中科院 / JCR 期刊分区", why: "在文献列表直接按分区和影响因子排序，快速挑出开题必读靶子文献。", topicKey: "journal", limit: 3 },
      { task: "AI 阅读问答与论文综述梳理", why: "辅助提炼单篇核心方法与多篇研究空白，所有论断仍须回查原文确认。", topicKey: "summary", limit: 3 },
      { task: "笔记整理与 Obsidian 联动", why: "把 PDF 高亮批注汇总成可检索的结构化笔记，方便后续写开题和学位论文。", topicKey: "notes", limit: 3 },
      { task: "多设备同步与附件管理", why: "突破 300MB 附件上限并规范 PDF 存储命名，换电脑或平板阅读不丢文件。", topicKey: "sync", limit: 3 },
    ],
  },
  {
    key: "phd",
    label: "博士生与 SCI / 顶会投稿",
    subtitle: "长周期重度科研：千篇文库治理、LaTeX/Overleaf 自动同步、AI 深度研读与选刊投稿",
    description: "面向博士研究生与 SCI / SSCI / 顶会投稿场景的 Zotero 插件组合：涵盖 LaTeX/BibTeX 固定引用键、千篇文献库问答、期刊分区核查、重复清理与知识图谱。",
    audience: "博士研究生 / SCI & 顶会投稿 / 长周期课题",
    tips: [
      "投稿英文期刊或顶会（LaTeX / Overleaf）务必尽早固定 Citekey 规则，避免后期改题录导致全文引用报错。",
      "文库超过 500 篇后，定期做去重清理和本地完整数据目录冷备份比装新插件更重要。",
      "安装任何新插件前先核对代码透明度、下载源和 Zotero 大版本声明，核心写作期保持环境稳定。",
    ],
    guideSlugs: ["zotero-latex-overleaf", "zotero-obsidian-workflow", "zotero-plugins-safety-guide", "zotero-migration-new-computer"],
    slots: [
      { task: "LaTeX / Overleaf 与固定 BibTeX 导出", why: "保持稳定引用键并自动更新 .bib 文件，避免编译报错与专有名词大小写错乱。", topicKey: "latex", limit: 3 },
      { task: "AI 文库问答与研究空白挖掘", why: "在数百篇课题文献中快速定位原话证据、比较方法差异并追踪新文献。", topicKey: "ai-chat", limit: 3 },
      { task: "期刊分区、影响因子与顶会目录核对", why: "选刊与回应审稿人引文核查时快速确认期刊分区与核心收录情况。", topicKey: "journal", limit: 3 },
      { task: "Obsidian / Markdown 长期知识沉淀", why: "把跨年积累的论文批注沉淀成个人双向链接知识库，方便多篇论文复用。", topicKey: "obsidian", limit: 3 },
      { task: "自动化工作流与文库去重治理", why: "批量打标签、清理重复条目和无效附件，让千篇大文库长期保持轻快。", topicKey: "automation", limit: 3 },
    ],
  },
  {
    key: "researcher",
    label: "科研教师与课题组协作",
    subtitle: "稳健、可复核、跨平台：面向项目申报、基金综述与跨设备/团队协作",
    description: "面向高校教师、博士后与课题组的稳健 Zotero 插件组合：优先高活跃度与明确声明兼容当前版本的工具，覆盖文献追踪、期刊指标核对、全量导出备份与跨工具集成。",
    audience: "高校教师 / 博士后 / 课题组",
    tips: [
      "团队共享群组文库时，注意群组附件走 Zotero 官方配额而非个人 WebDAV，提前规划存储与权限。",
      "基金申报书与长篇综述引用跨度大，优先挑选长期稳定维护、导出格式开放（CSL JSON / BibTeX）的插件，避免数据锁死。",
      "在单位受控电脑上安装插件前，可先参考安全核查指南确认开源仓库与网络通信范围。",
    ],
    guideSlugs: ["zotero-plugins-safety-guide", "sync-vs-backup", "zotero-ipad-mobile-sync", "import-export-formats"],
    slots: [
      { task: "文献检索与新文发现", why: "快速追踪细分方向最新发表并一键导入对应课题文件夹。", topicKey: "search", limit: 3 },
      { task: "期刊分区与收录指标核验", why: "指导学生选刊与填报项目成果清单时快速核对中科院、JCR 与核心榜单。", topicKey: "journal", limit: 3 },
      { task: "文献可视化与引文关系梳理", why: "快速把握一个陌生方向的核心奠基文献与演进脉络。", topicKey: "visual", limit: 3 },
      { task: "跨工具导出与开放格式备份", why: "把题录、笔记与批注无损导出为通用格式，兼顾归档与团队共享。", topicKey: "export", limit: 3 },
    ],
  },
];

export const PACK_KEYS = STAGE_PACKS.map((p) => p.key);
export const packOf = (key: string): StagePack | undefined => STAGE_PACKS.find((p) => p.key === key);

/** 当前最新 Zotero 大版本(取 ZOTERO_VERSIONS 最大值)。 */
const LATEST_MAJOR = Math.max(...ZOTERO_VERSIONS);

/**
 * 按统一客观规则为某一环节挑选候选插件:
 * 优先选「声明适配当前最新 Zotero 大版本(如 Zotero 10)且近 1 年有更新」的插件,按 GitHub 星标降序;
 * 若不足 limit 个,则按星标顺序从同专题声明适配 Zotero 7+ 的在架插件补齐。
 * 不看作者、无人工白名单。
 */
export function selectSlotPlugins(all: Plugin[], topicKey: string, limit: number, now: Date): Plugin[] {
  const candidates = topicList(all, topicKey);
  const yearAgo = now.getTime() - 365 * 86400_000;
  const isFresh = (p: Plugin) => {
    const d = p.latest?.date || p.updated;
    if (!d) return false;
    const t = Date.parse(d);
    return !Number.isNaN(t) && t >= yearAgo;
  };
  const tier1 = candidates.filter((p) => p.zotero.declared && p.zotero.majors.includes(LATEST_MAJOR) && isFresh(p));
  if (tier1.length >= limit) return tier1.slice(0, limit);
  const picked = new Set(tier1.map((p) => p.id));
  const tier2 = candidates.filter((p) => !picked.has(p.id) && p.zotero.declared);
  const merged = [...tier1, ...tier2];
  if (merged.length >= limit) return merged.slice(0, limit);
  const picked2 = new Set(merged.map((p) => p.id));
  return [...merged, ...candidates.filter((p) => !picked2.has(p.id))].slice(0, limit);
}

/** 某个阶段方案涉及到的全部去重插件(按星标降序),用于结构化数据 ItemList。 */
export function packAllPlugins(all: Plugin[], pack: StagePack, now: Date): Plugin[] {
  const seen = new Set<string>();
  const out: Plugin[] = [];
  for (const s of pack.slots) {
    for (const p of selectSlotPlugins(all, s.topicKey, s.limit, now)) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out;
}

export const PACK_RULE_NOTE = `筛选口径：本页所有推荐均由同一套公开规则自动计算，不设人工指定位或付费推荐。每个环节对应一个公开功能专题，优先从声明适配 Zotero ${LATEST_MAJOR} 且近一年保持更新的在架插件中按 GitHub 星标选取前若干款；点击对应专题可查看该方向的全部插件。`;

export const packTopicLabel = (topicKey: string): string => topicOf(topicKey)?.label ?? topicKey;
