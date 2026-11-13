var e=`---
title: "Zotero 插件开发入门：先理解结构与开发环境"
description: "理解 Zotero 7 起的插件结构、当前模板的版本要求，以及独立开发环境的准备。"
slug: "dev-01-overview"
order: 1
published: "2026-11-10"
updated: "2026-11-10"
sources:
  - "https://www.zotero.org/support/dev/zotero_7_for_developers"
  - "https://www.zotero.org/support/dev/zotero_8_for_developers"
  - "https://www.zotero.org/support/kb/profile_directory"
  - "https://www.zotero.org/support/zotero_data"
  - "https://github.com/zotero/make-it-red"
---

# Zotero 插件开发入门：先理解结构与开发环境

写插件可以从很小的任务开始：给选中的条目显示一段信息，增加一个菜单动作，或者改善自己每天重复的步骤。先说清楚输入、操作与期望结果，再决定是否需要插件；若只是一次性查看数据，开发者菜单里的“运行 JavaScript”可能已经够用。本系列面向能读懂基础 JavaScript 的读者，不要求先掌握整个应用的内部代码。

## 从 Zotero 7 起发生了什么

旧教程常用 install.rdf 和 XUL overlay 注入界面。Zotero 7 起采用 manifest.json 描述插件，并以 bootstrap.js 管理生命周期。名称相似不代表普通浏览器扩展可以直接装进 Zotero：插件仍有自己的运行环境和可用能力。接触旧文章时，先看它针对哪个大版本，再决定代码能否参考。[官方迁移说明](https://www.zotero.org/support/dev/zotero_7_for_developers)解释了这些差别。

可以把插件理解为三部分：声明“我是谁、支持什么版本”的清单；在启动、禁用和窗口变化时登记或撤销功能的生命周期；真正完成任务的业务代码。添加菜单、监听器和偏好设置，都应同时想好退出时怎样清理。只关注启动成功，容易留下重复按钮或重复响应事件的问题。

## 版本起点要看实际文件

本系列于2026年11月10日核对文档。当前社区模板的清单声明最低 Zotero 8.0，最高11.*；这只说明模板声明的范围，并不证明你写的新功能已在这些版本全部测过。第2篇会固定所核对的源码快照。准备支持 Zotero 7 的读者，可从[官方最小示例](https://github.com/zotero/make-it-red)理解结构，再核实适用于7的工具版本。不能只把最低版本数字改小就宣布兼容。Zotero 8 的平台变化也有独立官方说明，新旧接口混用时应继续查证。

## 准备可独立丢弃的实验环境

安装 Git、代码编辑器和模板要求的 Node.js 版本。开发用 Zotero 与日常文库分开：配置目录保存设置和插件，数据目录保存数据库及附件，它们是两件事。新建配置后仍应检查数据目录，避免实验配置继续指向日常资料。只放几条测试文献和不重要的文件，先验证读取，再尝试写入。

开发环境不要登录日常同步账号。下载陌生插件或运行示例前先读来源和代码；插件能接触文库与计算机资源，安装成功不是安全证明。遇到问题也不要直接删除数据目录重来，应先确认自己正在操作实验目录。

## 先画一条最小路径

第一天的目标不是做完整设置页，而是完成一次可见动作，并确认禁用、重新启用及关闭窗口后行为合理。给每个实验记录 Zotero 版本、系统、模板提交号和复现步骤。一次只增加一个能力，就更容易知道问题来自环境还是刚写的代码。

建议先读清单和启动文件，再看一个菜单或界面示例，最后才碰批量修改。查资料时优先用官方开发文档、官方源代码和所用模板的原仓库。本文解释结构；具体命令、真实验证范围和下一步操作见第2篇。
`,t=`---
title: "十分钟认识第一个 Zotero 插件：模板与构建"
description: "从可核对的模板快照开始，修改插件身份、安装依赖并生成安装包。"
slug: "dev-02-first-plugin"
order: 2
published: "2026-11-10"
updated: "2026-11-10"
sources:
  - "https://github.com/windingwind/zotero-plugin-template/tree/15f7538c854d5f9751a470bf846389f744f9e920"
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/.env.example"
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/addon/manifest.json"
  - "https://github.com/zotero-plugin-dev/zotero-plugin-scaffold"
---

# 十分钟认识第一个 Zotero 插件：模板与构建

本篇的“十分钟”是熟悉流程的练习目标，不保证下载或安装依赖所需时间。你将拿到一个可继续修改的模板，完成一次构建，并知道运行前还需要配置什么。正式开发建议在模板仓库点击 Use this template 创建自己的仓库；下面直接下载原模板只用于本地实验，不替别人项目发布版本。

## 先固定参考版本

本文核对模板3.1.0、提交15f7538c854d5f9751a470bf846389f744f9e920。该快照清单声明 Zotero 8.0–11.*，不是现成的 Zotero 7 模板。实际新功能仍须逐版本测试。以下安装与构建于2026年11月10日在 macOS、Node.js26.4.0、npm11.17.0跑通；这是一组验证环境，不表示其他版本一定不可用。日常安装优先参考 Node.js 当前长期支持版本及依赖要求。

\`\`\`sh
# 仅取得模板并切换到本文核对快照；目录名可自定
# 验证范围：macOS / Node.js 26.4.0 / npm 11.17.0
# clone、checkout 均为读取公开源码的操作
 git clone https://github.com/windingwind/zotero-plugin-template.git zotero-first-plugin
 cd zotero-first-plugin
 git checkout 15f7538c854d5f9751a470bf846389f744f9e920
 npm ci
 npm run build
\`\`\`

构建成功后查看 .scaffold/build/，其中有安装包及构建后的资源。源码目录便于阅读与修改，安装包则供应用安装；不要把两者混用，也不要手动编辑构建产物来代替修改源码。本文实际执行了同一快照的依赖安装和构建，尚未用该模板安装包做 Zotero 真机运行验收。终端显示成功只能证明构建路径通过，不能代替功能测试。依赖安装若出现版本冲突，先核对锁文件与运行环境，不要第一步就强制安装或自动大幅升级依赖。

## 把模板改成自己的身份

在自己的项目修改 package.json 中名称、描述、作者和仓库地址，尤其要换 addonID、addonRef、addonInstance 与 prefsPrefix。这些字段应保持项目内部一致，避免菜单、偏好项或实例与其他插件冲突。不要只换界面名称就把模板直接发布。

从 src/hooks.ts 找到生命周期入口，再沿调用关系读 src/modules/examples.ts。先保留一个能看懂的示例，逐项移除无关演示；每移除一项，同时确认它的注册和退出清理是否成对。第一步可以只修改某段可见提示，用它区分自己构建的安装包与下载的旧版本。

## 运行之前配置隔离环境

复制 .env.example 为 .env，填写开发用 Zotero 程序、独立配置目录和独立数据目录。三个路径承担不同用途；数据目录留空可能继续使用默认资料，不能因为配置目录是新的就省略核对。Windows 读者按示例处理路径分隔符。配置文件不应提交到公开仓库。

下面命令已核对上游脚本，但本篇未执行真机启动：

\`\`\`sh
# 待核实：填写隔离开发路径后，在目标 Zotero 版本上验证
npm start
\`\`\`

它应完成开发构建、启动配置的 Zotero，并观察源码变化。若启动的是日常实例，立即停止这次实验，先纠正路径。成功看到自己的功能后，再测试禁用、启用和窗口重开，记录实际支持的版本。下一篇介绍如何读条目与缩小调试范围。
`,n=`---
title: "Zotero 插件 API 与调试：从只读到可控修改"
description: "学习读取条目、安排写入、监听事件、添加界面与偏好设置，并建立调试步骤。"
slug: "dev-03-api-and-debug"
order: 3
published: "2026-11-10"
updated: "2026-11-10"
sources:
  - "https://www.zotero.org/support/dev/client_coding/javascript_api"
  - "https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/notifier.js"
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/src/hooks.ts"
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/src/modules/examples.ts"
---

# Zotero 插件 API 与调试：从只读到可控修改

遇到一个 API 名称时，先问它属于文库数据还是某个窗口。核心数据对象和窗口界面不是同一作用域，后台生命周期里也不能假定始终存在当前窗口。官方 JavaScript API 文档可作为入口；遇到文档没有覆盖的能力，应继续查目标 Zotero 版本的源码和模板示例，不把类型提示当作完整兼容保证。

## 第一个实验只读标题

在独立测试文库选中普通文献条目，再打开“工具→开发者→运行 JavaScript”。下面示例按官方 API 组织，用于了解输入与返回值；核对日期为2026年11月10日，尚未在目标 Zotero 版本逐一真机执行，结果待核实。

\`\`\`js
// 文档示例：先确认实验配置中已选中测试条目
const pane = Zotero.getActiveZoteroPane();
const selected = pane ? pane.getSelectedItems() : [];
return selected.map(item => ({
  id: item.id,
  title: item.getField('title')
}));
\`\`\`

没有选中条目时返回空数组是合理结果。先用这种无写入例子确认自己理解所选对象；附件、笔记和普通文献有不同字段，不能假定每一种对象都能执行相同操作。异步模式需要等待后再返回，控制台里看到一个 Promise 并不等于操作已经完成。

## 写入从一条测试数据开始

修改条目的通常顺序是检查对象类型与权限、读取旧值、设定字段，再等待保存完成。新建对象也要明确所属文库。事务、集合、附件和笔记各有约束，复制一段字段修改示例不能推出其他操作也相同。本篇不提供面向日常文库的批量改写脚本；请先在自己新建的测试条目验证，并保留修改前后的可比较结果。

保存成功后重新读取数据，确认实际值和界面都符合预期。失败时保留错误，不把提示框“已完成”当作保存证据。若准备触及附件文件或大量记录，先独立设计失败恢复办法，再把操作接入按钮。

## 事件、界面与设置要能退出

事件通知可以让插件响应条目或窗口变化。读模板的 registerNotifier 示例时，留意登记返回的标识，以及退出时对应的 unregisterObserver。回调里只处理自己关心的事件和对象；写入触发新通知时，还要避免同一任务反复执行。

界面优先参考目标版本提供的注册能力和模板示例，不要为插入一个菜单而到处搜索并修改任意节点。窗口打开时登记，关闭或插件禁用时移除；连续启用两次仍只有一份界面，才是值得保留的基本检查。偏好设置使用项目独有前缀，区分默认值、已保存值和当前界面状态，避免和其他插件同名。

## 一次只定位一个问题

先记录最短复现步骤，再观察输出。轻量信息可用 Zotero.debug；错误控制台帮助找异常，开发工具用于查看界面与断点。不要把完整文库内容或凭证写入调试日志。模板的 npm start 支持修改后的重建与重载，但热重载能工作也不说明退出清理完整，正式验收还要测试禁用、重启和新窗口。

排查时可依次确认：功能入口是否执行、选择对象是否正确、异步操作是否结束、结果是否真正保存。每次只改变一个条件，用相同测试数据比较前后；这样比同时改多个地方后碰巧恢复更容易查清原因。
`,r=`---
title: "Zotero 插件打包发布：安装包、版本与更新清单"
description: "检查安装包、兼容声明与更新地址，了解发布和升级验证的完整路径。"
slug: "dev-04-build-release"
order: 4
published: "2026-11-10"
updated: "2026-11-10"
sources:
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/zotero-plugin.config.ts"
  - "https://github.com/windingwind/zotero-plugin-template/blob/15f7538c854d5f9751a470bf846389f744f9e920/.github/workflows/release.yml"
  - "https://www.zotero.org/support/dev/zotero_7_for_developers#updaterdf_updatesjson"
  - "https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository"
---

# Zotero 插件打包发布：安装包、版本与更新清单

发布的目标不只是让别人下载到一个文件，还包括新用户能安装、老用户能更新，以及维护者能说明这次改变了什么。先在测试环境完成这些路径，再决定对外发布。本文解释已核对模板的流程，不会替读者执行提交、推送、打标签或创建公开版本。

## 从构建结果检查安装包

模板把源码和资源组合成 XPI。它本质上是带有规定目录结构的压缩包，而不是普通源码目录。本文所核对的模板快照15f7538c854d5f9751a470bf846389f744f9e920，于2026年11月10日使用 Node.js26.4.0、npm11.17.0构建通过，产物在 .scaffold/build/。

\`\`\`sh
# 已验证：模板3.1.0；上述提交及 Node.js/npm 环境
npm run build
\`\`\`

发布前打开构建后的清单，核对名称、插件标识、版本、最低和最高 Zotero 版本、图标与更新地址。检查是否还残留模板占位符，也检查示例功能和测试资源是否混入。能生成 XPI 不等于适配声明正确；实际支持的每个目标版本都需要安装和功能测试。

## 一个版本要能对上三处信息

源码中的版本、发布标签和安装包清单应表达同一次发布，用户看到的说明也要一致。模板可以协助生成这些内容，但你仍需要理解脚本会修改哪些文件、创建哪些标签和上传哪些产物。试验命令与正式发布命令不要混为一谈。

当前模板提供 npm run release。上游说明它会引导选择版本，并可能修改文件、创建提交与标签以及推送；仓库中的发布工作流还会继续构建和发布。该命令本篇未执行，真实发布行为待你在自己的仓库核实，不能把它当成无副作用的构建检查。先阅读 package.json、配置及工作流，再准备最小必要的发布权限，凭证不要写进源码。

## 更新清单是一条独立路径

插件清单中的 update_url 指向更新信息；更新信息再把某个版本指向实际 XPI。当前模板将常规版本与预发布版本的更新文件分别处理，并把更新文件放到专用 release 标签对应的发布资源里。具体地址应以自己仓库的构建结果为准，不照搬模板作者地址。

官方文档说明 JSON 更新清单中包含插件标识、版本和下载链接等信息。检查它是否能公开读取、返回真正的 JSON，以及下载链接是否指向同一个版本。若使用校验值，也要与实际上传文件一致。不要让更新清单提前指向尚未上传完成的文件。

## 兼容与升级分别验证

先用干净的实验配置安装新包，再在另一份实验环境装旧包，检查升级到新包的路径。升级后确认设置、菜单和既有内容仍能正常使用，并测试禁用后重新启用。预发布用户与常规用户也应各自走一遍，不让常规使用者意外收到试验版本。

发布说明只写用户能感知的变化与必要操作；维护者可以另附开发文档解释内部调整。保留可追溯的源码、构建环境与产物记录，出问题时先确认受影响版本，再决定停止提供有问题的更新或发布修复。不要无声覆盖同一版本安装包，让用户无法判断自己拿到哪份文件。
`,i=`---
title: "提交 Zotero 插件与持续维护：收录、适配和反馈"
description: "准备可核对的公开资料，说明兼容范围，并建立持续维护与问题反馈方式。"
slug: "dev-05-submit-and-maintain"
order: 5
published: "2026-11-10"
updated: "2026-11-10"
sources:
  - "https://zoterocn.org/rules"
  - "https://github.com/cnzotero/zotero-community"
  - "https://www.zotero.org/support/plugins"
  - "https://www.zotero.org/support/dev/zotero_8_for_developers"
  - "https://www.zotero.org/support/reporting_problems"
---

# 提交 Zotero 插件与持续维护：收录、适配和反馈

插件发布之后，使用者还需要知道它做什么、适合哪个 Zotero 版本、去哪里下载，以及遇到问题该怎样联系维护者。把这些信息整理好，比一段夸张的宣传更有帮助。社区收录提供发现入口，不等于安全审计、官方认证或质量保证。

## 准备可查证的收录资料

提交前先阅读本站当前的[收录与数据规则](https://zoterocn.org/rules)，再查看[公开仓库](https://github.com/cnzotero/zotero-community)说明的参与方式。当前规则要求在公开仓库[新建 Issue](https://github.com/cnzotero/zotero-community/issues/new)，写清申请类型、插件资料与依据；更正信息时指出具体项目和字段，下架申请还需说明申请者与项目的关系。不要把第三方站点的表单当成本社区入口，具体要求以提交时的规则为准。

建议一次提供插件名称、原仓库链接、简短用途、维护者、可下载的发布版本、许可证和适配声明。用途写成具体任务，例如“为条目增加某种查看方式”，不要只写“科研神器”。截图用自己的测试资料，避免展示私人文献、账户或尚未公开的内容。商业条件、外部服务要求及数据去向也应在项目文档里说清楚。

## 兼容声明应该有依据

最低版本和最高版本不只是展示文字。先看安装包声明，再用准备支持的版本实际验证。新大版本发布时，应检查官方开发者说明、核心工作流和退出清理，确认确实可用后再调整声明。无法验证的版本写“待验证”或不声明，不因界面能出现就认定全部功能兼容。

检查至少覆盖全新安装、已有版本升级、日常主要操作、禁用再启用，以及多窗口和深浅色等相关场景。涉及附件或批量数据时增加针对性样例，确认失败不会留下难以恢复的结果。维护者可以公开一张简短测试表，让使用者知道结论来自哪个系统和版本，而不是猜测。

## 让问题报告更容易处理

在项目里放清楚的反馈入口。报告模板可以询问系统、Zotero 与插件版本、预期结果、实际结果及最短复现步骤。日志只索取排查所需部分，提醒使用者先检查个人信息。对“不能用了”这样的报告，先确认具体入口和现象，再请对方补足证据，不要求一开始就上传整个文库。

复现后注明影响范围，修复后邀请报告者在相同条件下验证。暂时不能处理时也可以说明状态与已知替代操作，不要让没有回复的讨论被误读为已经解决。长时间没有版本发布不必然等于停止维护；同样，频繁发布和很多星标也不能证明质量。

## 常见疑问

“插件已收录，为什么不能安装？”先核对 Zotero 版本、XPI 的适配范围及下载文件是否正确，收录本身不会改变安装条件。“下载次数就是用户数吗？”不是，重复下载、自动获取等都会影响次数，只能按公开下载口径解释。“可以申请置顶吗？”不可以。目录内的插件都使用同一规则，没有推荐位和付费置顶；唯一例外是本社区自己维护的「Zotero中文社区」插件，它在插件广场顶部单独展示，不参与排序和计数，这一位置不接受其他插件申请。

如果项目暂停维护，明确写出最后测试的版本和已知限制，并说明是否接受接手维护；若项目地址迁移，尽量保留指向新地址的说明。持续维护不一定意味着不断增加功能，也包括准确记录现状、响应可复现问题，以及让使用者能够作出知情选择。
`,a=e=>e.trim().replace(/^"(.*)"$/s,`$1`).replace(/^'(.*)'$/s,`$1`),o=/^\d{4}-\d{2}-\d{2}$/;function s(e){let t=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(e);if(!t)throw Error(`缺少文件头`);let n={title:``,description:``,slug:``,order:0,sources:[]},r=!1;for(let e of t[1].split(/\r?\n/)){let t=/^\s+-\s+(.*)$/.exec(e);if(r&&t){n.sources.push(a(t[1]));continue}r=!1;let i=/^([a-z]+):\s*(.*)$/.exec(e);if(!i)continue;let[,s,c]=i;if(s===`sources`)r=!0;else if(s===`title`)n.title=a(c);else if(s===`description`)n.description=a(c);else if(s===`slug`)n.slug=a(c);else if(s===`order`)n.order=Number(c)||0;else if(s===`published`||s===`updated`){let e=a(c);if(!o.test(e))throw Error(`${s} 日期格式应为 YYYY-MM-DD: ${e}`);n[s]=e}}if(!n.title||!n.slug)throw Error(`文件头缺少 title 或 slug`);if(!/^[a-z0-9][a-z0-9-]*$/.test(n.slug))throw Error(`slug 不合法: ${n.slug}`);return{meta:n,body:e.slice(t[0].length)}}var c=/^(https?:\/\/[^\s<>"']+|\/(?!\/)[^\s<>"']*|#[\w-]+)$/;function l(e){let t=[],n=/`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g,r=0;for(let i of e.matchAll(n))i.index>r&&t.push({t:`text`,v:e.slice(r,i.index)}),i[1]===void 0?i[4]===void 0?c.test(i[3])?t.push({t:`link`,v:i[2],href:i[3],external:/^https?:/.test(i[3])}):t.push({t:`text`,v:i[2]}):t.push({t:`strong`,v:i[4]}):t.push({t:`code`,v:i[1]}),r=i.index+i[0].length;return r<e.length&&t.push({t:`text`,v:e.slice(r)}),t}var u=/[　-鿿＀-￯]$/;function d(e){let t=e.split(/\r?\n/),n=[],r=0,i=!1,a=[],o=()=>{if(a.length){let e=``;for(let t of a)e+=e&&!u.test(e)?` `+t:t;n.push({t:`p`,inline:l(e)}),a.length=0}};for(;r<t.length;){let e=t[r],s=/^```(\w*)\s*$/.exec(e);if(s){o();let e=[];for(r++;r<t.length&&!/^```\s*$/.test(t[r]);)e.push(t[r++]);r++,n.push({t:`code`,lang:s[1],v:e.join(`
`)});continue}if(!e.trim()){o(),r++;continue}let c=/^(#{1,3})\s+(.*)$/.exec(e);if(c){if(o(),c[1]===`#`&&!i){i=!0,r++;continue}n.push(c[1]===`###`?{t:`h3`,inline:l(c[2].trim())}:{t:`h2`,inline:l(c[2].trim())}),r++;continue}if(/^\s*>\s?/.test(e)){o();let e=[];for(;r<t.length&&/^\s*>\s?/.test(t[r]);)e.push(t[r++].replace(/^\s*>\s?/,``));n.push({t:`quote`,inline:l(e.join(` `))});continue}let u=/^\s*([-*]|\d+\.)\s+(.*)$/.exec(e);if(u){o();let e=/\d/.test(u[1]),i=[];for(;r<t.length;){let n=/^\s*([-*]|\d+\.)\s+(.*)$/.exec(t[r]);if(n&&/\d/.test(n[1])===e)i.push(l(n[2])),r++;else if(i.length&&/^\s{2,}\S/.test(t[r])&&!/^\s*([-*]|\d+\.)\s/.test(t[r]))i[i.length-1]=l(t[r].trim()?f(i[i.length-1])+` `+t[r].trim():``),r++;else break}n.push(e?{t:`ol`,items:i}:{t:`ul`,items:i})}else a.push(e.trim()),r++}return o(),n}function f(e){return e.map(e=>e.t===`link`?`[${e.v}](${e.href})`:e.t===`code`?`\`${e.v}\``:e.t===`strong`?`**${e.v}**`:e.v).join(``)}function p(e){let{meta:t,body:n}=s(e);return{...t,blocks:d(n)}}function m(e){let t=e.map(e=>e.t===`ul`||e.t===`ol`?e.items.map(f).join(` `):e.t===`code`?``:f(e.inline)).join(` `);return(t.match(/[一-鿿]/g)??[]).length+(t.replace(/[一-鿿]/g,` `).match(/[A-Za-z0-9]+/g)??[]).length}var h=Object.values(Object.assign({"../content/guides/dev-01-overview.md":e,"../content/guides/dev-02-first-plugin.md":t,"../content/guides/dev-03-api-and-debug.md":n,"../content/guides/dev-04-build-release.md":r,"../content/guides/dev-05-submit-and-maintain.md":i})).map(e=>p(e)).sort((e,t)=>e.order-t.order),g=e=>h.find(t=>t.slug===e),_=e=>`/guides/${e}`,v=e=>/^\/guides\/([a-z0-9][a-z0-9-]*)\/?$/.exec(e)?.[1]??null;export{m as a,v as i,g as n,_ as r,h as t};