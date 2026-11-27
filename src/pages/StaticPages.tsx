import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";
import { useDelisted } from "./DelistedPage.tsx";
import { pageMeta } from "../seo/pages.ts";
import { FORUM_FAQS, SUBMISSION_FAQS } from "../seo/faqs.ts";

const REPO = "https://github.com/cnzotero/zotero-community";

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-link">{children}</a>;
}

export function Rules() {
  const delisted = useDelisted(); // 在架数、下架数与当前 Zotero 大版本都由数据算出
  return (
    <article className="section prose">
      <h1 className="page-title">{pageMeta("/rules").h1}</h1>
      <p className="lead">插件广场收录什么、不收录什么、怎么排序、怎么申请收录或下架。规则对所有插件一视同仁。</p>

      <h2>1. 收录范围</h2>
      <p>收录面向 Zotero 7 及以上版本的插件,即以 <code>.xpi</code> 安装包发布、可在 Zotero 的「工具 → 插件」里安装的扩展。仅适配 Zotero 6 及更早版本的插件不再收录。</p>

      <h2>2. 收录标准</h2>
      <ul>
        <li><b>源码可见:</b>项目有公开的代码仓库(GitHub 或 Gitee),便于用户查看来源与更新记录。</li>
        <li><b>可获取安装包:</b>在发布页提供 <code>.xpi</code> 安装包,本站的下载按钮只会指向作者自己的发布页。</li>
        <li><b>用途真实:</b>名称与简介和实际功能相符,不夸大、不误导。</li>
        <li><b>没有已知的恶意行为:</b>不得窃取数据、静默上传用户内容、植入广告或捆绑与功能无关的软件。</li>
        <li><b>遵守法律法规:</b>不含违法违规内容,不侵犯他人知识产权。</li>
      </ul>
      <p>卡片上的维护状态标签只是提示。插件是否展示,只看第 3 章写明的下架条件。</p>

      <h2>3. 不收录与下架的情形</h2>
      <p><b>自动下架。</b>每次更新数据时,本站按同一套条件把所有插件重新判断一遍,满足下面任意一条就会下架:</p>
      <ol>
        <li><b>超过 1 年未发布,且没有可下载的安装包:</b>最近一次发布距今超过 1 年(365 天),或者没有任何发布记录,并且在作者的发布页上找不到可以下载安装的 <code>.xpi</code> 安装包。近 1 年内有发布的插件不会因为这一条下架;本站暂时没有收录到安装包的,详情页只提供仓库链接。</li>
        <li><b>最近一次发布超过 2 年:</b>最近一次发布距今超过 2 年(730 天)。</li>
        <li><b>超过 1 年未发布,且未声明适配当前 Zotero 版本:</b>最近一次发布距今超过 1 年(365 天),并且作者没有声明适配的 Zotero 版本,或声明适配的最高版本低于目前最新的 Zotero 大版本{delisted?.current ? <>(目前是 Zotero {delisted.current})</> : null}。</li>
      </ol>
      <ul>
        <li><b>恢复是自动的:</b>作者发布新版本、不再符合上面任何一条后,本站下一次更新数据时会自动重新上架,不需要申请。</li>
        <li><b>下架记录公开:</b>每个下架插件的原因、最近一次发布日期与下架日期列在<Link to="/delisted" className="inline-link">已下架插件与原因</Link>里。{delisted ? <>目前在架 {delisted.listed} 款,已下架 {delisted.records.length} 款。</> : null}</li>
        <li>「距今」按本站更新数据、重新生成页面的日期计算;仓库已归档本身不是下架理由。</li>
      </ul>
      <p><b>人工下架。</b>以下情形经核实后下架:</p>
      <ul>
        <li>存在恶意行为,或经核实有严重的安全问题且作者长期未处理。</li>
        <li>侵犯他人权利,且权利人提出有效的投诉。</li>
        <li>安装包长期无法下载,且仓库已删除或归档、无人维护。</li>
        <li>作者本人提出下架,并能证明其对该项目的所有权(例如从该仓库的账号提出)。</li>
        <li>将本站用于推广与插件功能无关的内容。</li>
      </ul>
      <p>下架会在本站公开记录原因(涉及投诉人隐私的细节除外)。除上述情形外,我们不会因为某个插件和其他插件功能相近、或与本站运营者有竞争关系而拒绝收录。</p>

      <h2>4. 一视同仁:排序、标签与推荐</h2>
      <ul>
        <li><b>目录内的插件没有推荐位、没有付费置顶,也没有广告位。</b>唯一例外是本社区自己维护的「Zotero中文社区」插件,它在插件广场顶部单独展示,不参与排序和计数,不接受其他插件申请这一位置。目录内的所有插件使用同一套排序,由你选择:GitHub 星标(热度)、最近更新、更新频率(近一年有发布的天数,同一天发布多次只算一天)、下载量(以本站下载为准,次数相同时按 GitHub 累计下载)、名称。首页的「星标最多」「更新最勤」「下载最多(本站下载)」三个榜单直接取自这些排序,不另设算法。</li>
        <li><b>历史版本照常计入:</b>作者在发布页移除了大量旧版本的插件,累计下载与近一年发布次数保留移除前最后一次公开记录,再加上之后的新增,详情页标注「含历史版本」。作者提供移除前的累计下载数的,按作者提供的数校准,在公开的数据文件里写明校准日期与依据,并保留原先的公开记录。所有插件适用同一规则。</li>
        <li><b>每张卡片固定四个标签,全部由公开数据算出:</b>
          <ol>
            <li>分类:每个插件归入一个主分类(AI、阅读、元数据、界面、附件、集成、笔记、工具、写作、可视化)。</li>
            <li>适配版本:根据作者在发布信息里声明的 Zotero 版本范围判断。<b>「兼容范围未声明」不等于不兼容</b>,只是作者没有写,请到项目主页确认。</li>
            <li>维护状态:按最近一次发布距今分档——90 天内「近期更新」、1 年内「维护中」、2 年内「更新放缓」、超过 2 年「久未更新」。</li>
            <li>人气档位:按 GitHub 星标分档——3000 及以上「热门」、500 及以上「常用」、100 及以上「成长中」、其余「小众」。<b>人气只代表热度,不代表质量。</b></li>
          </ol>
        </li>
        <li>标签只是提示;是否下架只看第 3 章写明的条件。</li>
        <li><b>社区官方插件单独展示(唯一例外):</b>本社区自己维护的「Zotero中文社区」插件在插件广场顶部单独展示,不在插件目录里,不参与排序和计数,也不影响其他插件的收录与排序规则;这一位置不接受其他插件申请。</li>
      </ul>

      <h2>5. 数据来源与更新</h2>
      <ul>
        <li>初始收录名单与中文摘要整理自 zotero-chinese/zotero-plugins 项目的公开插件目录(MIT 协议),署名与许可证见仓库中的 <Ext href={`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`}>第三方声明</Ext>。</li>
        <li>星标数、版本号、发布日期、安装包地址来自各项目在 GitHub 上的公开页面。</li>
        <li>数据由维护者定期更新,页面上方会显示「数据更新于」的日期。两次更新之间,星标和版本可能与项目主页略有出入,以项目主页为准。</li>
        <li><b>本站不托管任何安装包。</b>下载按钮是指向作者发布页的直链,下载时请留意域名是 github.com 或 gitee.com。</li>
        <li><b>两种下载次数:</b>「累计下载(GitHub)」是作者发布页上安装包的累计下载数,来自 GitHub 公开数据;「本站下载」统计经本站发起的下载:本站的下载按钮,以及插件作者通过自己提供的下载入口(例如插件内的安装与更新)汇总给本站的数字,同一口径对所有插件开放;不含从 GitHub 直接下载,从本站开始统计之日起累计,还没有本站下载的插件不显示这一项。插件广场的「下载量」排序与首页「下载最多(本站下载)」榜以本站下载为准(按每天刷新时的数字),次数相同时按 GitHub 累计下载排序;统计初期本站下载还少,次序主要参考 GitHub 累计下载。</li>
        <li>目录数据也以 JSON 公开:<a href="/data/catalog.json" target="_blank" rel="noopener noreferrer" className="inline-link">/data/catalog.json</a>,欢迎自由引用,请注明来源。</li>
      </ul>

      <h2>6. 如何申请收录、更正或下架</h2>
      <p>请在公开仓库提交 Issue:<Ext href={`${REPO}/issues/new`}>{REPO}/issues/new</Ext>。请写清楚:</p>
      <ul>
        <li>申请收录:插件名称、仓库地址、适配的 Zotero 版本、一两句用途说明。</li>
        <li>更正信息:哪个插件、哪一项不对、正确的信息和依据。</li>
        <li>申请下架:插件名称、你与该项目的关系(作者 / 权利人 / 使用者)、下架理由。</li>
      </ul>
      <p>申请收录的 Issue 会按上面的规则自动核对:合格的直接收录并在 Issue 里回复,不合格的写明原因;按原因修改后(编辑 Issue,或作者发布新版本),系统会自动重新检查,不用重复提交。目前自动处理 GitHub 仓库的申请,Gitee 仓库由维护者人工评估;更正与下架申请由维护者人工处理。处理结果都在 Issue 里公开回复,任何人都可以看到处理过程。</p>

      <h2>7. 期刊查询的数据与使用规则</h2>
      <ul>
        <li><b>指标范围:</b>影响因子、五年影响因子、JCI、JCR 分区与学科排名、中科院分区(升级版与基础版)、SCIE / SSCI / EI 收录,以及 CCF、AJG、FT50、UTD24、北大核心、CSSCI、CSCD 等榜单。</li>
        <li><b>数据版本:</b>所有指标来自同一份数据,版本号显示在每本期刊的详情里。榜单每年更新,以发布机构的最新公布为准。</li>
        <li><b>没有数据就显示「暂无」,</b>不推算、不估计、不用相近期刊的数据顶替。</li>
        <li><b>不展示未经核实的负面名单。</b>预警类名单口径复杂、逐年变化,在能逐条核实来源与年份之前不在本站展示。</li>
        <li><b>数据仅供参考。</b>投稿前请到期刊官网和发布机构核对最新要求与指标。</li>
        <li><b>使用限制:</b>每次查询最多返回 20 条,服务有访问频率限制,不提供批量下载。请勿用程序批量抓取。</li>
        <li>不对期刊做主观评级,不做付费置顶,不收取期刊或编辑部的任何推广费用。</li>
      </ul>

      <h2>8. 免责声明</h2>
      <p>收录不代表对插件的安全性、稳定性或质量的背书。安装第三方插件前请自行评估,并建议先备份文献库。本站是社区自发运营的非官方站点,与 Zotero 官方无隶属关系;Zotero 是 Corporation for Digital Scholarship 的商标。</p>
    </article>
  );
}

export function About() {
  return (
    <article className="section prose">
      <h1 className="page-title">{pageMeta("/about").h1}</h1>
      <p className="lead">Zotero 中文社区是一个由社区自发运营的非官方站点,把 Zotero 用顺手所需要的东西放在一起。</p>

      <h2>这里有什么</h2>
      <ul>
        <li><b>教程:</b>从安装到日常使用的中文教程整理。</li>
        <li><b>插件广场:</b>按公开数据整理的 Zotero 插件,可以搜索、筛选并下载,见<Link to="/rules" className="inline-link">收录规则</Link>。</li>
        <li><b>期刊查询:</b>按名称、缩写或 ISSN 查询期刊的收录、分区、影响因子与核心榜单,规则见<Link to="/rules" className="inline-link">收录规则</Link>第 7 条。</li>
        <li><b>投稿建议:</b>整理选刊核对流程、投稿前检查清单与审稿意见回复框架,见<Link to="/submission" className="inline-link">投稿建议</Link>。</li>
        <li><b>引用样式:</b>按 Zotero 官方文档整理的样式添加与切换说明,以及中文样式的查找入口,见<Link to="/styles" className="inline-link">引用样式</Link>。</li>
        <li><b>问答讨论:</b>汇总高频排错入口与 GitHub Discussions 公开交流社区,见<Link to="/forum" className="inline-link">问答讨论</Link>。</li>
      </ul>

      <h2>我们的原则</h2>
      <ul>
        <li><b>公开透明:</b>站点代码公开在 <Ext href={REPO}>GitHub</Ext>,规则写在页面上,处理记录公开可查。</li>
        <li><b>一视同仁:</b>目录内的插件没有推荐位、没有付费置顶。唯一例外是本社区自己维护的「Zotero中文社区」插件,它在插件广场顶部单独展示,不参与排序和计数,不接受其他插件申请这一位置。</li>
        <li><b>不收集你的信息:</b>目前站点没有账号系统,不要求登录。页面右上角的访问量只是页面被打开次数的汇总,插件的「本站下载」次数只是下载按钮被点击次数按插件的汇总,都不使用第三方统计,也不做用户画像。账号和讨论功能上线前,会先公布会收集什么、怎么使用。</li>
        <li><b>不夸大:</b>没有的数据不编造,没做完的功能标为「筹备中」。</li>
      </ul>

      <h2>参与和反馈</h2>
      <p>发现错误、想收录插件、想补充教程,都可以在 <Ext href={`${REPO}/issues`}>公开仓库的 Issue</Ext> 里提。</p>

      <h2>声明</h2>
      <p>本站与 Zotero 官方无隶属关系。Zotero 是 Corporation for Digital Scholarship 的商标。</p>
    </article>
  );
}

export function Submission() {
  return (
    <section className="section">
      <PageHero
        kind="hero-submission"
        title={pageMeta("/submission").h1}
        lead="从选刊核对、投稿前 10 项终检到审稿意见（Response to Reviewers）回复框架，帮科研人员少踩初审拒稿与格式返工的坑。"
      >
        <Link to="/journals" className="inline-link hero-link">去查期刊分区与影响因子 →</Link>
        <span className="hero-sep"> · </span>
        <Link to="/styles" className="inline-link hero-link">核对引用样式</Link>
      </PageHero>

      <div className="info-grid">
        <div className="card info-card">
          <h3>一、选刊 4 步核对</h3>
          <ol className="compact-list">
            <li>先读目标期刊官网的 <b>Aims &amp; Scope</b> 与近一年已发表文章，确认主题与方法契合。</li>
            <li>在<Link to="/journals" className="inline-link">期刊查询</Link>核对中科院分区、JCR 分区、影响因子与中文核心收录情况，并以所在单位认定目录为准。</li>
            <li>查清审稿周期、开放获取（OA）版面费（APC）政策与字数/图表上限。</li>
            <li>警惕承诺“包录用”的第三方中介，始终通过期刊官网的正式投稿系统提交。</li>
          </ol>
        </div>
        <div className="card info-card">
          <h3>二、常见初审拒稿（Desk Reject）避坑</h3>
          <ul className="compact-list">
            <li><b>不在收稿范围</b>：最常见原因，投前先用自己参考文献里高频出现的期刊做候选池。</li>
            <li><b>创新点没写透</b>：摘要和 Cover Letter 首段未用 2–3 句话说明研究空白与核心贡献。</li>
            <li><b>格式与引用杂乱</b>：参考文献体例混用、缺少 DOI 或页码、图表文字模糊不可读。</li>
            <li><b>合规声明缺失</b>：遗漏伦理审批编号、资金资助信息、作者贡献或利益冲突声明。</li>
          </ul>
        </div>
        <div className="card info-card">
          <h3>三、审稿意见回复 4 原则</h3>
          <ol className="compact-list">
            <li><b>逐条编号全回应</b>：把每位审稿人的意见拆分成独立条目（R1-C1、R1-C2），绝不遗漏合并。</li>
            <li><b>先致谢再亮结论</b>：每条开头先给出明确答复，再粘贴修改后的原文段落并标明页码与行号。</li>
            <li><b>补实验客观说明</b>：确因条件限制无法补做的实验，先在现有数据内做补充稳健性检验，并在正文 Limitation 如实说明。</li>
            <li><b>保持专业克制</b>：即使遇到误解，也用数据与文献证据平和解释，避免情绪化措辞。</li>
          </ol>
        </div>
      </div>

      <article className="prose sub-card">
        <h2>投稿前 10 项终检清单</h2>
        <ol>
          <li><b>标题与摘要</b>：关键词覆盖核心方法与研究对象，英文稿件避免中式长难句与拼写错误。</li>
          <li><b>参考文献体例</b>：已在 Zotero 中切换目标期刊或 <Link to="/guides/gb-t-7714" className="inline-link">GB/T 7714</Link> 最新样式并在 Word / LaTeX 中刷新全篇；中文混排确认已填 <code>zh-CN</code> / <code>en-US</code> 语言字段。</li>
          <li><b>正文引文与文末列表一一对应</b>：核对无遗漏引用、无重复条目、无预印本冒充正式发表版本。</li>
          <li><b>图表清晰度与自明性</b>：线图尽量导出矢量图（PDF / EPS / SVG），位图满足期刊 DPI 要求（常见 ≥ 300 DPI），图注不看正文也能读懂。</li>
          <li><b>统计与可复现细节</b>：样本量、显著性检验方法、软件版本与随机种子说明完整；开源代码与数据按要求附链接或匿名仓库。</li>
          <li><b>盲审去痕迹</b>：双盲评审期刊务必清理文档属性里的作者信息、正文自引暴露措辞、致谢与基金号。</li>
          <li><b>作者顺序与单位邮箱</b>：通讯作者邮箱、ORCID、全部作者署名顺序与单位英文译名经全体作者书面确认。</li>
          <li><b>伦理与利益冲突声明</b>：涉及人体/动物实验附审批机构与批号，所有稿件明确填写利益冲突与资助来源声明。</li>
          <li><b>Cover Letter 针对性定制</b>：写对主编与期刊全称，说明未一稿多投且所有作者同意投稿，简述 3 点核心发现。</li>
          <li><b>合并 PDF 逐页通览</b>：投稿系统生成最终校样 PDF 后，从头到尾翻看一遍公式、表格跨页与中文/特殊符号是否乱码，再点提交。</li>
        </ol>
        <p className="data-note">免责说明：本页整理通用学术投稿核对规范，不承诺录用、不提供代写代投服务；具体体例与政策一律以目标期刊官网最新 Author Guidelines 为准。</p>
      </article>

      <h2 className="faq-heading">投稿常见问题</h2>
      <div className="faq-list">
        {SUBMISSION_FAQS.map((item, idx) => (
          <details key={item.q} className="faq-item" open={idx === 0}>
            <summary className="faq-q">{item.q}</summary>
            <p className="faq-a">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

const FORUM_CATEGORIES = [
  {
    title: "安装与版本升级",
    desc: "官网下载慢、Zotero 7 / 8 / 10 版本选择、升级后插件变灰或提示不兼容排查。",
    links: [
      { to: "/guides/zotero-download-install-faq", label: "官方下载与安装常见问题" },
      { to: "/guides/zotero-upgrade-plugin-incompatible", label: "升级后插件不兼容排查" },
      { to: "/compat/zotero-10", label: "Zotero 10 兼容清单" },
    ],
  },
  {
    title: "插件安装与挑选",
    desc: "`.xpi` 装不上、浏览器自动解压、翻译/AI/期刊分区等高频插件按需选型。",
    links: [
      { to: "/guides/plugin-wont-install", label: "插件装不上怎么办" },
      { to: "/guides/zotero-ai-plugins-guide", label: "Zotero AI 插件怎么选" },
      { to: "/guides/zotero-pdf-bilingual-translate", label: "PDF 翻译插件选型" },
    ],
  },
  {
    title: "Word / WPS 与 LaTeX 引用",
    desc: "Word 或 WPS 菜单栏不显示 Zotero、无法通信、BibTeX 与 Overleaf 自动同步。",
    links: [
      { to: "/guides/zotero-word-wps-plugin", label: "Word / WPS 不显示插件恢复" },
      { to: "/guides/zotero-latex-overleaf", label: "LaTeX / Overleaf 协作指南" },
      { to: "/guides/word-switch-style", label: "在 Word 中切换引用样式" },
    ],
  },
  {
    title: "同步、WebDAV 与换机迁移",
    desc: "300MB 空间满报错、iPad / 手机端同步打不开 PDF、换新电脑完整迁移数据目录。",
    links: [
      { to: "/guides/zotero-webdav-sync", label: "300MB 满配 WebDAV 排查" },
      { to: "/guides/zotero-ipad-mobile-sync", label: "iPad / 手机端同步配置" },
      { to: "/guides/zotero-migration-new-computer", label: "换新电脑无损迁移教程" },
    ],
  },
  {
    title: "中文文献、样式与期刊分区",
    desc: "GB/T 7714 中英文混排“等 / et al.”、文献列表显示中科院/JCR 分区与影响因子。",
    links: [
      { to: "/guides/gb-t-7714", label: "GB/T 7714 样式查找与配置" },
      { to: "/guides/chinese-references-language", label: "解决中文显示 et al." },
      { to: "/guides/zotero-journal-ranking-column", label: "列表显示期刊分区列" },
    ],
  },
  {
    title: "笔记联动、开发与插件收录",
    desc: "Zotero 联动 Obsidian 记笔记、插件开发入门、向插件广场申请收录或更正信息。",
    links: [
      { to: "/guides/zotero-obsidian-workflow", label: "Zotero 联动 Obsidian 流程" },
      { to: "/guides/dev-01-overview", label: "Zotero 插件开发入门" },
      { to: "/rules", label: "查看插件收录与更正规则" },
    ],
  },
];

export function Forum() {
  return (
    <section className="section">
      <PageHero
        kind="hero"
        title={pageMeta("/forum").h1}
        lead="先按问题场景速查排错方案；未解决的问题欢迎直接前往社区公开讨论区（GitHub Discussions）发帖交流，所有解答公开可检索。"
      >
        <a href={`${REPO}/discussions`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">前往社区讨论区</a>{" "}
        <a href={`${REPO}/discussions/new/choose`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">发起新提问</a>{" "}
        <a href={`${REPO}/issues/new`} target="_blank" rel="noopener noreferrer" className="inline-link hero-link">提交插件收录 / 纠错</a>
      </PageHero>

      <h2>按场景速查排错方案</h2>
      <div className="info-grid forum-grid">
        {FORUM_CATEGORIES.map((c) => (
          <div key={c.title} className="card info-card">
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
            <ul className="compact-list">
              {c.links.map((l) => (
                <li key={l.to}><Link to={l.to} className="inline-link">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <article className="prose sub-card">
        <h2>发帖前建议附上的 4 项信息（更快定位原因）</h2>
        <p>在 <Ext href={`${REPO}/discussions`}>GitHub Discussions</Ext> 提问时，复制下面模板填完关键信息，其他用户和维护者通常一轮就能帮定位原因（发图前请遮挡个人账号与本地隐私路径）：</p>
        <pre className="codeblock"><code>{`1. 操作系统与版本：例如 Windows 11 / macOS 15
2. Zotero 版本号：例如 Zotero 8.0.x 或 10.0.x（在「帮助 → 关于 Zotero」查看）
3. 涉及插件及版本：例如某插件 vX.Y.Z（或未使用第三方插件）
4. 复现步骤与现象：做了哪一步操作 → 期望结果 → 实际报错文字或截图`}</code></pre>
      </article>

      <h2 className="faq-heading">高频问答</h2>
      <div className="faq-list">
        {FORUM_FAQS.map((item, idx) => (
          <details key={item.q} className="faq-item" open={idx === 0}>
            <summary className="faq-q">{item.q}</summary>
            <p className="faq-a">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
