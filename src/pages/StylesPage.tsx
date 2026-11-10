import type { ReactNode } from "react";
import { STYLE_LINKS, STYLE_SOURCES, type StyleSource } from "../content/styles.ts";
import { pageMeta } from "../seo/pages.ts";
import { buildDate } from "../ssr.ts";

// 引用样式页:只做导航与安装说明,不搬运、不托管任何样式文件。
// 每条说明都对应段末「来源」里的页面;改动前先核对原文。

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-link">{children}</a>;
}

function Sources({ list }: { list: StyleSource[] }) {
  return (
    <p className="source-line">
      来源:
      {list.map((s, i) => (
        <span key={s.url}>
          {i > 0 && "、"}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-link">{s.label}</a>
        </span>
      ))}
    </p>
  );
}

export function StylesPage() {
  const S = STYLE_SOURCES;
  const date = buildDate();
  return (
    <article className="section prose">
      <h1 className="page-title">{pageMeta("/styles").h1}</h1>
      <p className="lead">按 Zotero 官方文档整理引用样式的基本用法:样式是什么、怎么添加、怎么在 Word 与 LibreOffice 里切换,以及中文样式到哪里找。每段末尾列出来源,本站不提供样式文件下载。</p>

      <h2>1. 引用样式是什么</h2>
      <p>Zotero 用引用样式决定引文和参考文献表的格式。这些样式都用 Citation Style Language(CSL)编写,许多其他软件也支持这种格式。</p>
      <p>Zotero 自带若干常用样式;官方的 <Ext href={STYLE_LINKS.repository}>Zotero 样式库</Ext>(Zotero Style Repository)另外收录了超过一万种样式,可以按需添加。</p>
      <p>已安装的样式可以在 Zotero 设置的 Cite 面板里查看:其中的样式管理器(Style Manager)列出当前安装的样式及各自的最后更新日期。</p>
      <Sources list={[S.styles, S.cite]} />

      <h2>2. 在 Zotero 里添加样式</h2>
      <p><b>从官方样式库安装:</b></p>
      <ol>
        <li>打开 Zotero 的设置(Settings),进入 Cite 面板。</li>
        <li>在样式管理器里点「Get additional styles…」,打开 Zotero 样式库。</li>
        <li>搜索需要的样式,点击样式标题,即可安装到 Zotero。</li>
      </ol>
      <p>样式库可以按名称搜索,并按样式类型和学科筛选。勾选「Show only unique styles」后,格式完全相同的重复样式会被隐藏,例如 Nature 旗下各期刊的样式只显示独立的「Nature」一个。</p>
      <p>浏览器里装了 Zotero Connector 时,也可以直接在浏览器中打开 Zotero 样式库网页,把样式装进 Zotero。</p>
      <p><b>从本地文件安装:</b>在样式管理器里点「+」,选择电脑上扩展名为 <code>.csl</code> 的样式文件,例如自己编辑的样式或从其他网站下载的样式。</p>
      <p><b>删除样式:</b>在样式管理器里选中样式,点「-」。</p>
      <Sources list={[S.styles, S.cite]} />

      <h2>3. 在 Word 和 LibreOffice 里选择样式</h2>
      <p>Zotero 会为电脑上的 Word 和 LibreOffice 自动安装文字处理软件插件;需要时可以在设置 Cite 面板的 Word Processors 标签页重新安装。</p>
      <ul>
        <li><b>Word:</b>插件会在 Word 里添加 Zotero 选项卡。点其中的「Document Preferences」,在打开的窗口里选择引用样式。</li>
        <li><b>LibreOffice:</b>插件会添加 Zotero 工具栏,同样点「Document Preferences」选择引用样式。</li>
      </ul>
      <p>Document Preferences 里的设置只对当前文档生效;同一窗口还可以设置引文和参考文献使用的语言。</p>
      <Sources list={[S.wordPlugins, S.cite, S.word, S.libreoffice]} />

      <h2>4. 中文样式(GB/T 7714 等)</h2>
      <p>除了 Zotero 样式库,GitHub 上的 zotero-chinese 组织(与本站是不同的项目)维护着一个中文 CSL 样式仓库。按其说明,仓库提供一系列中文期刊和学位论文的 CSL 样式,其中大部分由 GB/T 7714—2015《信息与文献 参考文献著录规则》衍生。</p>
      <ol>
        <li>打开 <Ext href={S.cnSite.url}>中文 CSL 样式</Ext> 页面,选择合适的样式。</li>
        <li>点样式名进入样式详情页,在「下载」一节点任一可用链接安装。</li>
        <li>也可以先下载 <code>.csl</code> 文件,再按上文「从本地文件安装」的方法添加。</li>
      </ol>
      <ul>
        <li>安装时 Zotero 可能提示该文件不是有效的 CSL 1.0.2 样式文件。仓库说明这是因为样式用到了 CSL-M 扩展功能,属于正常现象,可以忽略。</li>
        <li>使用支持中英文混排的样式时,需要在 Zotero 里为每条文献设置「语言」字段:中文条目可填 <code>zh-CN</code>,英文条目可填 <code>en-US</code>,不能写成 English、中文 等。修改后在 Word 插件中点 Refresh。</li>
        <li>仓库中的样式文件按 CC BY-SA 3.0 协议分发。本站不转载、不托管这些文件,请到原仓库或其页面获取。</li>
        <li>没有找到合适的样式,可以在该仓库提交 Issue,反馈已有样式的问题或申请新样式。</li>
      </ul>
      <Sources list={[S.cnRepo, S.cnSite]} />

      <h2>5. 样式不对怎么办,投稿前核对什么</h2>
      <ul>
        <li>样式输出不符合预期时,官方文档建议先确认 Zotero 是最新版本,并从 Zotero 样式库安装该样式的最新版。确认样式确实与样式指南、作者须知或已发表的示例不符后,可以到 Zotero 论坛报告,帖子标题写成「Style Error: 样式名」。</li>
        <li>在 Zotero 样式库里找不到需要的样式,可以按官方说明 <Ext href={STYLE_LINKS.requestStyles}>申请新样式</Ext>。</li>
        <li><b>投稿前以目标期刊的最新要求为准。</b>同一个著录标准,不同期刊、学校的具体要求可能不同;投稿或提交学位论文前,请对照目标期刊或学校发布的最新说明,逐条检查生成的参考文献。</li>
      </ul>
      <Sources list={[S.styles]} />

      <p className="data-note">
        {date ? `核对日期:${date}(页面生成日期)。` : ""}
        本页的菜单与按钮名称按 Zotero 官方英文文档书写,中文界面中的名称可能不同;各项说明以来源页面的最新内容为准。
      </p>
    </article>
  );
}
