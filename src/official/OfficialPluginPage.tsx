import { Link } from "../link.tsx";
import { DownloadIcon } from "../icons.tsx";
import { pageMeta } from "../seo/pages.ts";
import { OFFICIAL } from "./official.ts";

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-link">{children}</a>;
}

/** 社区官方插件的介绍页:是什么、怎么安装、适配版本、隐私、常见问题。 */
export function OfficialPluginPage() {
  return (
    <article className="section prose official-page">
      <p className="official-badge">{OFFICIAL.badge}</p>
      <h1 className="page-title">{pageMeta(OFFICIAL.pagePath).h1}</h1>
      <p className="lead">{OFFICIAL.summary}当前版本 v{OFFICIAL.version},{OFFICIAL.compatText}。</p>
      <p>
        <a className="btn" href={OFFICIAL.releaseUrl} target="_blank" rel="noopener noreferrer"><DownloadIcon size={14} /> 下载安装</a>{" "}
        <Ext href={OFFICIAL.docUrl}>图文使用教程</Ext>
      </p>

      <h2>它能做什么</h2>
      <ul>
        <li>在 Zotero 里浏览本站插件广场收录的插件,按名称、简介或作者搜索,按分类筛选。</li>
        <li>默认只显示声明适配你当前 Zotero 版本的插件;排序与本站一致:星标最多、最近更新、更新最勤、下载最多。</li>
        <li>显示每个插件在本机的状态:已安装、可更新或未安装。</li>
        <li>安装或更新前弹出确认框,写明插件名、版本、来源仓库和安装包地址,你确认后才安装。</li>
      </ul>

      <h2>安装四步</h2>
      <ol className="steps">
        <li>打开 <Ext href={OFFICIAL.releaseUrl}>v{OFFICIAL.version} 发布页</Ext>,下载 <code>zotero-community.xpi</code>(不要下载源码压缩包)。</li>
        <li>打开 Zotero,在菜单栏选「工具 → 插件」,点右上角的齿轮,选「从文件安装附加组件…」。</li>
        <li>选择刚下载的 <code>zotero-community.xpi</code>,按提示完成安装。</li>
        <li>回到文库界面,点工具栏里搜索框左侧的「插件市场」按钮,即可打开。</li>
      </ol>
      {/* 截图占位:安装后文库工具栏搜索框左侧的「插件市场」按钮 */}

      <h2>使用流程</h2>
      <img className="flow-img" src="/images/plugin/install-flow.webp" alt="使用流程示意:浏览目录、筛选适配的插件、核对来源后确认、安装完成" width={1600} height={700} loading="lazy" decoding="async" />
      <ol className="flow-caption">
        <li>浏览目录</li>
        <li>筛选适配的插件</li>
        <li>核对来源后确认</li>
        <li>安装完成</li>
      </ol>
      {/* 截图占位:插件市场列表(搜索、分类与适配筛选);安装确认框(名称、版本、来源仓库) */}

      <h2>适配版本</h2>
      <p>适配 Zotero {OFFICIAL.minMajor} 至 {OFFICIAL.maxMajor} 的桌面版。Zotero 发布新的大版本后,我们验证通过再发布新版本把适配范围放宽;插件会通过 Zotero 自带的更新检查收到新版本。</p>

      <h2>隐私</h2>
      <ul>
        <li>打开插件市场时读取本站公开的插件目录;Zotero 检查本插件更新时读取本仓库在 GitHub 上的更新信息。</li>
        <li>只有在你确认安装后,才从确认框里显示的仓库下载安装包。</li>
        <li>不收集、不上传任何个人信息,也不读取你的文献库。</li>
      </ul>

      <h2>常见问题</h2>
      <h3>插件市场会自动安装或更新其他插件吗?</h3>
      <p>不会。每次安装或更新都要你在确认框里核对并确认。</p>
      <h3>为什么有的插件没有安装按钮?</h3>
      <p>可能是它没有适配你当前 Zotero 版本的安装包,或者安装包不在它自己的 GitHub 仓库里。可以点「查看详情」到本站的插件页,再去作者主页核对。</p>
      <h3>入口在哪里?「工具」菜单里能找到吗?</h3>
      <p>入口在文库工具栏、搜索框左侧。需要在「工具」菜单里也显示入口的,可在 Zotero 设置的「高级 → 设置编辑器」里搜索 <code>zotero-community.showToolsMenuItem</code>,改为 true 后重启 Zotero。</p>
      <h3>插件广场为什么把它单独放在顶部?</h3>
      <p>它是本社区自己维护的工具,所以单独展示、明确标注;它不在插件目录里,不参与排序与排名,也不影响其他插件的收录与排序,见<Link to="/rules" className="inline-link">收录规则</Link>第 4 章。</p>

      <h2>开源与反馈</h2>
      <p>插件以 MIT 许可证开源,源代码见 <Ext href={OFFICIAL.sourceUrl}>GitHub 仓库</Ext>。问题与建议欢迎在仓库提交 Issue。</p>
    </article>
  );
}
