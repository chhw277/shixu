# 滴答清单本地复刻：设计参考核验与可实施方案

核验日期：2026-11-08（Asia/Shanghai）。本报告仅讨论设计来源；原应用行为另以 REA 证据为准。

## 参考选择与公开认可

| 来源 | 已核实内容 | 对本项目有用的部分 | 证据边界 |
|---|---|---|---|
| [Things 官方产品页](https://culturedcode.com/things/) | 官方称两次获得 Apple Design Award；引用 Wirecutter、WIRED、App Store Editors’ Choice 等评价，明确强调清晰、快速搜索、快捷键、轻盈界面 | 今天为中心的信息层级；列表排版、克制色彩、功能逐步展开 | 获奖与引文已见于官方网页。未独立复核全部原始评奖记录；不称为 Dribbble 高赞 |
| [Linear 2024 UI 重设计原文](https://linear.app/now/how-we-redesigned-the-linear-ui) | 官方明确讲述减少视觉噪声、对齐侧栏/标题/面板、提高层次与导航密度；颜色系统使用 LCH，以 base、accent、contrast 生成主题 | 语义颜色变量、轻分隔、多面板对齐、可读层级 | 文中原则可直接核实；本方案不声称复用了其私有色值，也不声称已测其运行应用 |
| [Todoist 官方页](https://www.todoist.com/) | 抓取时页面显示“347K+ ★★★★★ reviews”“50+ million professionals” | 成熟任务软件作为交互密度、快速捕获、列表/看板切换参考 | 这是官方公开声称的评论/用户数量，不是独立审计，也不是一件设计作品的点赞数 |
| [Radix Colors 色阶说明](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) | 官方定义 1–2 背景、3–5 交互填充、6–8 边框、9–10 实色背景、11–12 文字 | 可验证、完整的浅/深色语义系统；精确色值可从 npm 包复用 | 开源色板是色彩来源，不是“高赞设计作品” |

### 对“高赞”的核验结果

曾请求 Dribbble task-management 搜索与 popular/product-design 页面，两者均返回 HTTP 202、空正文；Behance 按 appreciations 排序检索超时，通用搜索连接被重置。本次没有取得可验证的单作品点赞数，因此不得给任何图稿虚构“高赞”“数千赞”标签。采用上面可核验的成熟产品、公开评论与设计系统作为基础。

特别排除：`https://www.awwwards.com/sites/things` 实为一个 European design & innovation agency 页面（2020 Honorable Mention），不是 Cultured Code 的 Things 任务管理器，不能作为 Things 获奖证据。原始网页保留以说明排除原因。

UUMit 只读能力发现已完成，检索命中付费配色/效率工具资料；未购买、未调用付费能力。其候选不能替代对官方源的核验。

## 推荐视觉方案：浅 Slate + Indigo

采用白色主工作面、微冷灰侧栏、蓝色单一强调色。理由是长时间阅读任务文本需要稳定的明暗层级，功能模块多时颜色应服务选中/优先级/状态。避免每个区块都上鲜艳底色。

以下色值为 [@radix-ui/colors 3.0.0 Slate](https://unpkg.com/@radix-ui/colors@3.0.0/slate.css)、[Indigo](https://unpkg.com/@radix-ui/colors@3.0.0/indigo.css) 的原值；“用途”是本项目映射决策，非对滴答清单原色的还原。

| 令牌 | 色值 | 用途 |
|---|---|---|
| canvas | #FFFFFF | 主列表、详情面板 |
| app-bg / slate1 | #FCFCFD | 应用外层背景 |
| sidebar / slate2 | #F9F9FB | 清单侧栏 |
| hover / slate3 | #F0F0F3 | 中性 hover 填充 |
| separator / slate6 | #D9D9E0 | 结构分隔；任务行分隔可用更浅色 |
| text-secondary / slate11 | #60646C | 次级说明、日期、分组标题 |
| text-primary / slate12 | #1C2024 | 任务正文与标题 |
| selected-bg / indigo3 | #EDF2FE | 当前侧栏项、当前日 |
| selected-hover / indigo4 | #E1E9FF | 选中项 hover |
| accent / indigo9 | #3E63DD | 主按钮、焦点、选中状态 |
| accent-hover / indigo10 | #3358D4 | 主按钮 hover |
| accent-text / indigo11 | #3A5BC7 | 选中项文字、可操作链接 |

依 WCAG sRGB 相对亮度公式计算：正文 #1C2024/白色约 16.39:1；次文 #60646C/白色约 5.94:1；白字/#3E63DD 约 5.21:1；#3A5BC7/#EDF2FE 约 5.35:1。具体数值以 `sources/contrast-check.json` 为准。分隔线无需承担文字可读性；优先级必须同时配标签或图标，不能只靠红/黄/蓝区别。

### 布局与排版（本项目设计建议）

- 模块竖栏 64px，清单侧栏 236px；主列表自适应，任务详情默认 344px，可关闭。原生 Mac 窗口最小尺寸可先设 1100×720；窄窗口合并侧栏或详情，避免文字被挤成单字列。
- 顶部工具行 56px；任务行 52px，子任务 40px。主列表左右内距 32px，行内图标/文字间距 12px，分组上下留白 24px。采用 4px 基础网格。
- 系统字体 `-apple-system/BlinkMacSystemFont/Segoe UI`（原生实现用系统字体）；标题 28–30px/600，正文 14–15px/400，次级说明 12–13px。不要给全界面混用多种装饰字体。
- 图标统一 18px/1.6px 描边；圆角按钮 6–8px，弹窗 12px。结构面板不堆大圆角卡片。
- 保留主要操作：快速新增、今天/最近七天/所有、项目/标签、任务详情、日期/优先级/重复/子任务。二级操作收进明确可发现的菜单，避免每行显示一排按钮。
- 空状态、错误、加载、已完成、逾期、选中、键盘焦点、hover、禁用需有明确状态；动画 120–180ms，不能延迟勾选、输入与保存。
- 四象限使用同一基础背景与 4 个淡色标题标记；专注视图保留单一大计时器；习惯用轻量点阵/进度，不引入与任务模块完全不同的视觉语言。

## 证据保存与局限

原始 HTML、文本提取、Radix CSS、UUMit 发现结果位于 `research/sources/`，校验和与来源索引见 `sources/manifest.json`。获取页面不代表观察了运行时交互；官网宣称的市场规模、奖项与媒体引文均保留这一边界。未以字体/图标图片资源的提取或复用作为设计方案前提。
