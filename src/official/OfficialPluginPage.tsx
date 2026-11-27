import { Link } from "../link.tsx";
import { DownloadIcon } from "../icons.tsx";
import { pageMeta } from "../seo/pages.ts";
import { OFFICIAL_PLUGIN_FAQS } from "../seo/faqs.ts";
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
        <Link to={OFFICIAL.docUrl} className="inline-link">使用教程</Link>
      </p>

      <h2>它能做什么</h2>
      <ul>
        <li>在 Zotero 里浏览本站插件广场收录的插件,按名称、简介或作者搜索,按分类筛选。</li>
        <li>默认只显示声明适配你当前 Zotero 版本的插件;排序方式与本站相同:星标最多、最近更新、更新最勤、下载最多(插件里的「下载最多」按 GitHub 累计下载排序)。</li>
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
      {OFFICIAL_PLUGIN_FAQS.map((item, idx) => (
        <div key={item.q}>
          <h3>{item.q}</h3>
          <p>
            {item.a}
            {idx === OFFICIAL_PLUGIN_FAQS.length - 1 ? <>（<Link to="/rules" className="inline-link">查看收录规则</Link>）</> : null}
          </p>
        </div>
      ))}

      <h2>开源与反馈</h2>
      <p>插件以 MIT 许可证开源,源代码见 <Ext href={OFFICIAL.sourceUrl}>GitHub 仓库</Ext>。问题与建议欢迎在仓库提交 Issue。</p>
    </article>
  );
}
