import type { ReactNode } from "react";
import { Link } from "../link.tsx";
import { pageMeta } from "../seo/pages.ts";
import {
  CATALOG_EXAMPLE, CATALOG_EXAMPLE_DATE, CATALOG_PLUGIN, CATALOG_RELEASE, CATALOG_TOP, CURL_EXAMPLE, FETCH_EXAMPLE, STYLES_ITEM, STYLES_TOP, type FieldDoc,
} from "../content/open-data.ts";
import stylesIndex from "../content/styles-index.json" with { type: "json" };

// 开放数据页:说明本站公开的机器可读文件。字段表与示例都来自 src/content/open-data.ts,
// 许可与再利用只转述仓库里已有的声明(README、THIRD_PARTY_NOTICES.md、收录规则),不另立新许可。

const REPO = "https://github.com/cnzotero/zotero-community";

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-link">{children}</a>;
}

function Fields({ list, caption }: { list: FieldDoc[]; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">字段</th><th scope="col">类型</th><th scope="col">含义</th><th scope="col">可否为空</th><th scope="col">来源</th></tr>
        </thead>
        <tbody>
          {list.map((f) => (
            <tr key={f.name}>
              <td><code>{f.name}</code></td>
              <td>{f.type}</td>
              <td>{f.desc}</td>
              <td>{f.empty}</td>
              <td>{f.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OpenDataPage() {
  return (
    <article className="section prose">
      <h1 className="page-title">{pageMeta("/open-data").h1}</h1>
      <p className="lead">本站页面上的插件目录与中文引用样式一览,也以 JSON 文件公开,方便你用程序读取、做统计或接入自己的工具。本页逐字段说明格式、更新方式和兼容承诺。</p>

      <h2>1. 公开的文件</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th scope="col">地址</th><th scope="col">内容</th><th scope="col">什么时候更新</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><a href="/data/catalog.json" target="_blank" rel="noopener noreferrer" className="inline-link">/data/catalog.json</a></td>
              <td>插件目录:插件广场上全部在架插件的名称、分类、适配范围、星标、下载与各 Zotero 大版本的安装包地址。</td>
              <td>随站点构建生成。站点通常每天自动刷新一次数据并重新构建(北京时间凌晨),代码更新时也会重新构建;以文件里的 <code>generatedAt</code> 为准。</td>
            </tr>
            <tr>
              <td><a href="/data/styles.json" target="_blank" rel="noopener noreferrer" className="inline-link">/data/styles.json</a></td>
              <td>中文引用样式一览:样式 ID、标题、适用场景、引文方式、来源与许可等元数据,不含样式文件本身。与<Link to="/styles" className="inline-link">引用样式</Link>页上的表格是同一份数据。</td>
              <td>维护者手动运行核对脚本时更新,以文件里的 <code>checkedAt</code> 为准(目前是 {stylesIndex.checkedAt})。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>两份文件都是 UTF-8 编码的 JSON,内容随站点一起公开发布,不需要登录或密钥。</li>
        <li>站点地图 <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="inline-link">/sitemap.xml</a> 与站点说明 <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="inline-link">/llms.txt</a> 也可以被程序读取,但它们只列页面地址,不是数据文件,格式不做下面的承诺。</li>
        <li><b>期刊查询不属于开放数据。</b>它的接口只为本站页面服务:每次最多返回 20 条,有访问频率限制,不提供批量下载,请勿用程序批量抓取,见<Link to="/rules" className="inline-link">收录规则</Link>第 7 条。</li>
      </ul>

      <h2>2. 插件目录 /data/catalog.json</h2>
      <p>只包含在架插件;按<Link to="/rules" className="inline-link">收录规则</Link>下架的插件不会出现,作者发布新版本重新上架后会自动回到这份文件里。生成时会先校验格式,并核对条数与站点上的插件详情页数一致,不一致就不发布。</p>
      <Fields list={CATALOG_TOP} caption="顶层字段" />
      <Fields list={CATALOG_PLUGIN} caption="plugins 数组里每一项" />
      <Fields list={CATALOG_RELEASE} caption="releases 数组里每一项" />
      <p><b>示例:</b>下面是 {CATALOG_EXAMPLE_DATE} 生成的文件里 Translate for Zotero 这一条,原样摘出,只把 <code>releases</code> 删减到最后一项。数值会随每日数据变化。</p>
      <pre className="codeblock"><code>{JSON.stringify(CATALOG_EXAMPLE, null, 2)}</code></pre>

      <h2>3. 中文引用样式一览 /data/styles.json</h2>
      <p>收录 CSL 官方样式仓库里默认语言为中文的样式,以及 zotero-chinese/styles 仓库里的 GB/T 7714 系列样式。每一条都是脚本逐个读取样式文件头(<code>&lt;info&gt;</code> 里的标题、ID、类别、许可等)得到的,读不到或缺字段的不收。<b>这份文件只有元数据,本站不搬运、不托管任何样式文件</b>;要安装样式,请按 <code>page</code> 或 <code>file</code> 到来源获取,并遵守 <code>license</code> 写明的许可。</p>
      <Fields list={STYLES_TOP} caption="顶层字段" />
      <Fields list={STYLES_ITEM} caption="styles 数组里每一项" />

      <h2>4. 示例请求</h2>
      <p><b>命令行(curl + jq):</b></p>
      <pre className="codeblock"><code>{CURL_EXAMPLE}</code></pre>
      <p><b>JavaScript(fetch):</b></p>
      <pre className="codeblock"><code>{FETCH_EXAMPLE}</code></pre>
      <p>截至本页核对时,服务器没有为这些文件开放浏览器跨域读取(响应里没有 <code>Access-Control-Allow-Origin</code>),所以上面的代码适合在 Node.js、脚本或你自己的服务器上运行;别的网站的网页里直接用 <code>fetch</code> 读取会被浏览器拦下。文件一天通常只变一次,建议缓存在自己那边,不必频繁重复下载。</p>

      <h2>5. 兼容承诺</h2>
      <ul>
        <li>每份文件顶层都有 <code>schema</code>,目前都是 1。<b>同一个 schema 下字段只增不改:</b>已有字段的名称、类型与含义不变,不会删除;新增的字段可能出现在任何一层。</li>
        <li>读取时请先检查 <code>schema</code>,并忽略自己不认识的字段。表里写着「省略」的字段可能整个不存在,请按可选处理。</li>
        <li>确需改变已有字段时会换用新的 schema 号,不在原号下悄悄改动。</li>
        <li>数组的顺序按上文写明的规则排列,但不要依赖某一项的位置,请用 <code>id</code> 定位。</li>
      </ul>

      <h2>6. 再利用与署名</h2>
      <ul>
        <li>插件目录:<Link to="/rules" className="inline-link">收录规则</Link>写明,目录数据欢迎自由引用,请注明来源。</li>
        <li>目录的初始收录名单与中文摘要整理自 zotero-chinese/zotero-plugins 项目的公开插件目录(MIT 协议),安装包的插件标识也主要取自该目录;星标、版本、发布日期与下载数来自各项目在 GitHub 上的公开页面。署名与许可证全文见<Ext href={`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`}>第三方声明</Ext>。</li>
        <li>引用样式一览:每条元数据摘自样式文件自己的文件头,样式文件本身的许可以 <code>license</code> 字段和来源仓库的说明为准。</li>
        <li>仓库里的社区插件代码采用 MIT 许可证,但该授权不自动覆盖整个站点仓库;复用站点其他内容前请先确认相应授权,见<Ext href={`${REPO}/blob/main/README.md`}>项目说明</Ext>。</li>
        <li>数据可能有遗漏或滞后,以各项目主页和来源仓库为准;发现错误欢迎在<Ext href={`${REPO}/issues`}>公开仓库的 Issue</Ext> 里指出。</li>
      </ul>
    </article>
  );
}
