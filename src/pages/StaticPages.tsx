import { Link } from "../link.tsx";
import { PageHero } from "../pageHero.tsx";

const REPO = "https://github.com/cnzotero/zotero-community";

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-link">{children}</a>;
}

export function Rules() {
  return (
    <article className="section prose">
      <h1 className="page-title">收录规则</h1>
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
      <p>维护活跃度不是收录条件。长期未更新的插件仍会收录,但会在卡片上标注「久未更新」,让你自己判断。</p>

      <h2>3. 不收录与下架的情形</h2>
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
        <li><b>没有付费置顶,没有推荐位,没有广告位。</b>所有插件使用同一套排序:按 GitHub 星标(热度)、最近发布时间、名称三种,由你选择。</li>
        <li><b>每张卡片固定四个标签,全部由公开数据算出:</b>
          <ol>
            <li>分类:每个插件归入一个主分类(AI、阅读、元数据、界面、附件、集成、笔记、工具、写作、可视化)。</li>
            <li>适配版本:根据作者在发布信息里声明的 Zotero 版本范围判断。<b>「兼容范围未声明」不等于不兼容</b>,只是作者没有写,请到项目主页确认。</li>
            <li>维护状态:按最近一次发布距今分档——90 天内「近期更新」、1 年内「维护中」、2 年内「更新放缓」、超过 2 年「久未更新」。</li>
            <li>人气档位:按 GitHub 星标分档——3000 及以上「热门」、500 及以上「常用」、100 及以上「成长中」、其余「小众」。<b>人气只代表热度,不代表质量。</b></li>
          </ol>
        </li>
        <li>标签只是提示,不会让任何插件被隐藏。</li>
      </ul>

      <h2>5. 数据来源与更新</h2>
      <ul>
        <li>初始收录名单与中文摘要整理自 zotero-chinese/zotero-plugins 项目的公开插件目录(MIT 协议),署名与许可证见仓库中的 <Ext href={`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`}>第三方声明</Ext>。</li>
        <li>星标数、版本号、发布日期、安装包地址来自各项目在 GitHub 上的公开页面。</li>
        <li>数据由维护者定期更新,页面上方会显示「数据更新于」的日期。两次更新之间,星标和版本可能与项目主页略有出入,以项目主页为准。</li>
        <li><b>本站不托管任何安装包。</b>下载按钮是指向作者发布页的直链,下载时请留意域名是 github.com 或 gitee.com。</li>
      </ul>

      <h2>6. 如何申请收录、更正或下架</h2>
      <p>请在公开仓库提交 Issue:<Ext href={`${REPO}/issues/new`}>{REPO}/issues/new</Ext>。请写清楚:</p>
      <ul>
        <li>申请收录:插件名称、仓库地址、适配的 Zotero 版本、一两句用途说明。</li>
        <li>更正信息:哪个插件、哪一项不对、正确的信息和依据。</li>
        <li>申请下架:插件名称、你与该项目的关系(作者 / 权利人 / 使用者)、下架理由。</li>
      </ul>
      <p>我们会在 Issue 里公开回复处理结果。任何人都可以看到处理过程。</p>

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
      <h1 className="page-title">关于本站</h1>
      <p className="lead">Zotero 中文社区是一个由社区自发运营的非官方站点,把 Zotero 用顺手所需要的东西放在一起。</p>

      <h2>这里有什么</h2>
      <ul>
        <li><b>教程:</b>从安装到日常使用的中文教程整理。</li>
        <li><b>插件广场:</b>按公开数据整理的 Zotero 插件,可以搜索、筛选并下载,见<Link to="/rules" className="inline-link">收录规则</Link>。</li>
        <li><b>期刊查询:</b>按名称、缩写或 ISSN 查询期刊的收录、分区、影响因子与核心榜单,规则见<Link to="/rules" className="inline-link">收录规则</Link>第 7 条。</li>
        <li><b>投稿建议:</b>筹备中,上线前会写清内容来源与使用规则。</li>
        <li><b>引用样式、问答讨论:</b>筹备中。</li>
      </ul>

      <h2>我们的原则</h2>
      <ul>
        <li><b>公开透明:</b>站点代码公开在 <Ext href={REPO}>GitHub</Ext>,规则写在页面上,处理记录公开可查。</li>
        <li><b>一视同仁:</b>没有付费置顶、没有推荐位。</li>
        <li><b>不收集你的信息:</b>目前站点没有账号系统,不要求登录。账号和讨论功能上线前,会先公布会收集什么、怎么使用。</li>
        <li><b>不夸大:</b>没有的数据不编造,没做完的功能标为「筹备中」。</li>
      </ul>

      <h2>参与和反馈</h2>
      <p>发现错误、想收录插件、想补充教程,都可以在 <Ext href={`${REPO}/issues`}>公开仓库的 Issue</Ext> 里提。</p>

      <h2>声明</h2>
      <p>本站与 Zotero 官方无隶属关系。Zotero 是 Corporation for Digital Scholarship 的商标。</p>
    </article>
  );
}

function Planned({ title, lead, items, rules }: { title: string; lead: string; items: string[]; rules: string[] }) {
  return (
    <article className="section prose">
      <PageHero kind="hero-submission" title={title} lead={lead} />
      <div className="notice">这个板块正在筹备中,下面是计划提供的内容和使用规则,上线时会按此执行。</div>
      <h2>计划提供</h2>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
      <h2>数据与使用规则(预先说明)</h2>
      <ul>{rules.map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="data-note">想第一时间知道上线,可以关注 <Ext href={REPO}>公开仓库</Ext>。</p>
    </article>
  );
}

export function Submission() {
  return (
    <Planned
      title="投稿建议"
      lead="从选刊、改稿到回复审稿意见,把投稿前后的经验整理成清单。"
      items={[
        "选刊清单:怎么按研究内容、周期、版面费与录用率缩小候选范围。",
        "投稿前检查表:格式、图表、参考文献、伦理与利益冲突声明。",
        "回复审稿意见的写法与示例(使用匿名化的公开范例)。",
        "常见退稿原因与补救办法。",
      ]}
      rules={[
        "只发布公开可查或经投稿人授权的内容,涉及具体稿件与审稿人的信息一律匿名化。",
        "不承诺录用,不提供代写代投服务,不推荐任何收费的“包发表”渠道。",
        "建议仅供参考,最终要求以期刊官网的投稿须知为准。",
      ]}
    />
  );
}
