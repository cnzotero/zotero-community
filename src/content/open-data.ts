// 「开放数据」页的字段说明。字段表必须与生成脚本(scripts/catalog-feed.mjs、scripts/styles-index.mjs)实际输出的字段一一对应,
// 测试会核对两边是否一致;改生成脚本的字段时同步改这里。

export interface FieldDoc {
  /** 字段名;嵌套字段写成 a.b */
  name: string;
  type: string;
  /** 是否可能缺省或为空;写明具体情形 */
  empty: string;
  desc: string;
  source: string;
}

const GH = "GitHub 公开数据(每日刷新)";

export const CATALOG_TOP: FieldDoc[] = [
  { name: "schema", type: "整数", empty: "不会缺省", desc: "格式版本号,目前是 1。", source: "固定值" },
  { name: "generatedAt", type: "日期 YYYY-MM-DD", empty: "不会缺省", desc: "生成这份文件的构建日期(UTC)。", source: "构建流程" },
  { name: "site", type: "字符串", empty: "不会缺省", desc: "本站地址,固定为 https://zoterocn.org。", source: "固定值" },
  { name: "count", type: "整数", empty: "不会缺省", desc: "plugins 的条数,即在架插件数。", source: "构建流程" },
  { name: "categories", type: "数组", empty: "不会缺省", desc: "本站分类:每项是 { key, label },key 是分类键(如 reading),label 是中文名(如「阅读」)。", source: "本站分类" },
  { name: "plugins", type: "数组", empty: "不会缺省", desc: "在架插件,按 GitHub 星标从多到少排列,同分按名称。下架的插件不会出现。", source: "见下表" },
];

export const CATALOG_PLUGIN: FieldDoc[] = [
  { name: "id", type: "字符串", empty: "不会缺省", desc: "插件的唯一标识,即代码仓库的「所有者/仓库名」,全部小写。", source: "收录数据" },
  { name: "name", type: "字符串", empty: "不会缺省", desc: "插件名称(已去掉控制字符,限制长度)。", source: "收录数据" },
  { name: "summary", type: "字符串", empty: "可能是空字符串", desc: "一句话用途简介。", source: "收录数据(初始整理自 zotero-chinese/zotero-plugins)" },
  { name: "category", type: "字符串", empty: "不会缺省", desc: "主分类,取值是 categories 里的某个 key。", source: "本站分类" },
  { name: "author", type: "字符串", empty: "不会缺省", desc: "作者名称。", source: "收录数据" },
  { name: "homepage", type: "字符串(https 地址)", empty: "不会缺省", desc: "项目主页。", source: "收录数据" },
  { name: "stars", type: "整数", empty: "不会缺省", desc: "GitHub 星标数,只代表热度,不代表质量。", source: GH },
  { name: "updated", type: "日期 YYYY-MM-DD", empty: "没有发布记录时整个字段省略", desc: "本站记录到的最近一次发布日期。", source: GH },
  { name: "cadence", type: "对象", empty: "读不到发布记录时整个字段省略", desc: "更新节奏:r12 是近 12 个月(按每月 30 天计)的正式发布次数,days12 是其中有发布的天数(同一天发布多次只算一天,可能省略),last 是最近一次正式发布日期。预发布与草稿不计。", source: GH },
  { name: "dl", type: "对象", empty: "没有下载数据时整个字段省略", desc: "安装包下载:total 是发布页上全部 .xpi 安装包的累计下载次数之和,at 是统计日期。", source: GH },
  { name: "dlWeek", type: "整数或 null", empty: "算不出时为 null", desc: "近 7 天新增下载:最近一次统计与恰好 7 天前的统计之差。两次统计缺一,或累计数变小,就是 null,不推算。", source: "由每日统计算出" },
  { name: "archived", type: "true", empty: "仓库未归档时整个字段省略", desc: "代码仓库已在 GitHub 上归档时出现,值只会是 true。归档本身不是下架理由。", source: GH },
  { name: "zotero", type: "对象", empty: "不会缺省", desc: "适配范围:declared 表示作者是否声明了适配的 Zotero 版本;majors 是声明范围覆盖的 Zotero 大版本(如 [7, 8, 9, 10])。未声明不等于不兼容。", source: "作者发布信息" },
  { name: "releases", type: "数组", empty: "可能是空数组", desc: "每个 Zotero 大版本(7 及以上)对应的最新安装包,按大版本从小到大。只收 github.com 上、属于该插件自己仓库的 .xpi 地址,其余地址不进这份文件。", source: "见下表" },
];

export const CATALOG_RELEASE: FieldDoc[] = [
  { name: "t", type: "整数", empty: "不会缺省", desc: "这个安装包面向的 Zotero 大版本(7 及以上)。同一插件内不重复。", source: "作者发布信息" },
  { name: "v", type: "字符串", empty: "不会缺省", desc: "插件版本号。", source: "作者发布信息" },
  { name: "u", type: "字符串(https 地址)", empty: "不会缺省", desc: "安装包直链,指向作者在 GitHub 上的发布页,本站不托管安装包。", source: "作者发布页" },
  { name: "i", type: "字符串", empty: "取不到时省略", desc: "安装包里声明的 Zotero 插件标识(如 xxx@example.com),可用来判断某个插件是否已安装。", source: "zotero-chinese/zotero-plugins 的公开目录,没有的读取自安装包本身" },
  { name: "min", type: "字符串", empty: "作者未声明时省略", desc: "作者声明的最低 Zotero 版本。", source: "作者发布信息" },
  { name: "max", type: "字符串", empty: "作者未声明时省略", desc: "作者声明的最高 Zotero 版本,可能带通配符 *(如 8.*)。", source: "作者发布信息" },
  { name: "d", type: "日期 YYYY-MM-DD", empty: "没有日期时省略", desc: "这个安装包的发布日期。", source: "作者发布页" },
];

export const STYLES_TOP: FieldDoc[] = [
  { name: "schema", type: "整数", empty: "不会缺省", desc: "格式版本号,目前是 1。", source: "固定值" },
  { name: "checkedAt", type: "日期 YYYY-MM-DD", empty: "不会缺省", desc: "最近一次从来源仓库逐个读取样式文件头、核对这份一览的日期。", source: "生成脚本" },
  { name: "site", type: "字符串", empty: "不会缺省", desc: "本站地址。", source: "固定值" },
  { name: "note", type: "字符串", empty: "不会缺省", desc: "使用说明:只含元数据,不含样式文件。", source: "固定值" },
  { name: "sources", type: "数组", empty: "不会缺省", desc: "来源仓库:每项是 { key, label, repo, site, styleCount },styleCount 是核对当天该来源的样式总数(官方取 Zotero 样式库公开索引的条数,社区仓库取样式目录数)。", source: "来源仓库" },
  { name: "count", type: "整数", empty: "不会缺省", desc: "styles 的条数。", source: "生成脚本" },
  { name: "styles", type: "数组", empty: "不会缺省", desc: "样式元数据,官方在前、社区在后,各自按国标版本从新到旧。", source: "见下表" },
];

export const STYLES_ITEM: FieldDoc[] = [
  { name: "id", type: "字符串", empty: "不会缺省", desc: "样式 ID,即样式文件 <id> 的原文。Zotero 用它区分样式。", source: "样式文件头" },
  { name: "title", type: "字符串", empty: "不会缺省", desc: "样式标题,即 <title> 的原文。", source: "样式文件头" },
  { name: "titleShort", type: "字符串", empty: "文件里没有时省略", desc: "简称,即 <title-short> 的原文。", source: "样式文件头" },
  { name: "source", type: "字符串", empty: "不会缺省", desc: "来自哪个仓库:csl(CSL 官方样式仓库)或 zotero-chinese。", source: "生成脚本" },
  { name: "use", type: "字符串", empty: "不会缺省", desc: "适用场景。标题含 GB/T 7714 的写「国家标准 GB/T 7714—年份」;其余按标题、摘要与文档链接写明用途。", source: "样式文件头" },
  { name: "standard", type: "字符串", empty: "不是国标样式时省略", desc: "对应的国标版本,如「GB/T 7714—2015」。", source: "样式标题" },
  { name: "citationFormat", type: "字符串", empty: "不会缺省", desc: "引文方式,即 <category citation-format> 的值:numeric(数字编号)、author-date(著者-出版年)、note(注释)等。", source: "样式文件头" },
  { name: "fields", type: "字符串数组", empty: "可能是空数组", desc: "学科类别,即 <category field> 的值,如 generic-base、law。", source: "样式文件头" },
  { name: "defaultLocale", type: "字符串", empty: "不会缺省", desc: "样式的默认语言,如 zh-CN。", source: "样式文件头" },
  { name: "updated", type: "日期时间", empty: "不会缺省", desc: "样式文件自己记录的更新时间(<updated>)。", source: "样式文件头" },
  { name: "license", type: "对象", empty: "不会缺省", desc: "样式文件自带的许可:url 是 <rights license> 的地址,text 是 <rights> 的原文。", source: "样式文件头" },
  { name: "page", type: "字符串(https 地址)", empty: "不会缺省", desc: "样式的介绍网页:官方样式指向 Zotero 样式库里该样式的检索结果,社区样式指向其样式详情页。", source: "来源网站" },
  { name: "file", type: "字符串(https 地址)", empty: "不会缺省", desc: "样式文件在来源仓库里的位置,用来核对本条元数据。", source: "来源仓库" },
  { name: "documentation", type: "字符串数组", empty: "文件里没有时省略", desc: "样式文件头里 rel=\"documentation\" 的链接,通常是期刊须知或标准原文。", source: "样式文件头" },
  { name: "template", type: "字符串", empty: "文件里没有时省略", desc: "样式文件头里 rel=\"template\" 的链接:这个样式是以哪个样式为模板改出来的。", source: "样式文件头" },
];

/**
 * 目录源示例:2026-11-17 构建产物里 windingwind/zotero-pdf-translate 这一条的原样内容,
 * 只把 releases 删减到最后一项。数值会随每日数据变化。
 */
export const CATALOG_EXAMPLE = {
  id: "windingwind/zotero-pdf-translate",
  name: "Translate for Zotero",
  summary: "在阅读器中划词翻译，翻译标题、摘要与批注，支持多种翻译引擎。",
  category: "reading",
  author: "windingwind",
  homepage: "https://github.com/windingwind/zotero-pdf-translate",
  stars: 12302,
  updated: "2026-10-03",
  cadence: { days12: 9, r12: 9, last: "2026-10-03" },
  dl: { total: 2359212, at: "2026-11-16" },
  dlWeek: 18430,
  zotero: { declared: true, majors: [7, 8, 9, 10] },
  releases: [
    {
      t: 10,
      v: "2.4.8",
      u: "https://github.com/windingwind/zotero-pdf-translate/releases/download/v2.4.8/translate-for-zotero.xpi",
      i: "zoteropdftranslate@euclpts.com",
      min: "7.9.9",
      max: "10.9.9",
      d: "2026-10-03",
    },
  ],
};
export const CATALOG_EXAMPLE_DATE = "2026-11-17";

export const CURL_EXAMPLE = `# 下载目录源并查看插件数量与生成日期(需要 jq)
curl -s https://zoterocn.org/data/catalog.json | jq '{generatedAt, count}'

# 列出声明适配 Zotero 10 的插件 id
curl -s https://zoterocn.org/data/catalog.json \\
  | jq -r '.plugins[] | select(.zotero.majors | index(10)) | .id'

# 引用样式一览:列出全部国标样式的 ID 与标题
curl -s https://zoterocn.org/data/styles.json \\
  | jq -r '.styles[] | select(.standard) | "\\(.id)\\t\\(.title)"'`;

export const FETCH_EXAMPLE = `// Node.js 18 及以上(自带 fetch),保存为 .mjs 后运行
const res = await fetch("https://zoterocn.org/data/catalog.json");
if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
const feed = await res.json();
if (feed.schema !== 1) throw new Error("不认识的格式版本");

// 每个插件在 Zotero 10 上能装的安装包(没有就跳过)
for (const p of feed.plugins) {
  const r = p.releases.find((x) => x.t === 10);
  if (r) console.log(p.id, r.v, r.u);
}`;
