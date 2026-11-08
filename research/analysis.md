# 滴答清单本地逆向与重新实现记录

调查日期：2026-11-08（Asia/Shanghai）。目标由用户明确指定为本机“滴答清单”。已交付独立本地应用“拾序”，核心功能重新实现，外观按成熟设计系统重做。本报告区分观察、推断和未验证内容。

## 目标与身份：已回答

安装路径 `/Applications/TickTick.app`，标识 `com.TickTick.task.mac`，版本 **8.2.41 / build 925**。REA 的 plist 结果直接解析该元信息。Mach-O 为 x86_64 / arm64 通用程序，本次选择 arm64；可执行文件 SHA-256：

`81a4ac1e51d19193e64a427e89674be8f56b63ab052fc7a56869ad0927865cc2`

Mach-O 声明最低 macOS 12.0。105 条依赖声明中包含 AppKit、SwiftUI、WebKit、GRDB、SQLite、Alamofire。它们证明静态链接依赖存在，不能单凭这些名字证明运行时数据路径或调用顺序。包内原生 nib 和 Swift 类名与此相互印证，因此“原生 macOS 应用”是有依据的判断；没有把它当 Electron 包处理。

桌面目录扫描检查 1993 个条目，探测 43 个文件、3268 字节；108 个符号链接未跟随。其 complete-within-scan 仅表示该扫描范围内完成，不能说整个目录逐字节都检查过。

## 信息架构与界面：部分回答

普通 macOS 窗口截图确认了模块栏、智能清单 / 清单侧栏、任务主列、右侧详情的多列布局；确认可见“今天、最近7天、收集箱、清单、标签、已完成、垃圾桶”。截图仅在本地 `evidence/original-window.png`，包含原账户当前可见内容，不打入分发应用。

REA `observe_native_ui` 返回 `capability_unavailable / accessibility-denied`，原始错误保留在 `evidence/native-ui.json`。因此没有原应用的 Accessibility 树，没有自动点击其按钮，也未证明其页面之间的动态行为完全一致。普通截图来自系统 screencapture 工具，应与 REA Evidence 区别。

初次 REA Interface Builder 解码达到 max-documents=64 上限，报告明确保留截断限制；没有用它声称解码全部界面。为聚焦核心模块，把 **9 个指定 nib 与 Info.plist 的字节一致副本**放到 `selected-resources.app`，各文件原路径与 SHA-256 见 `evidence/selected-resources-provenance.json`。REA 随后完整解码这些选定文件：1131 个图节点、1091 条边。资源根是选定副本，而非原始完整 app；不包含 executable 身份。

| 选定资源 | 对象 / 连接 | 实际观察到的结构 |
|---|---:|---|
| TTAddTaskBarViewController | 53 / 12 | add / date / list / priority 按钮连接 |
| TTCalendarViewController | 169 / 35 | 日历控制器和 sidebar 连接 |
| TTEisenhowerMatrixViewController | 30 / 5 | 四象限控制器与 more 连接 |
| TTFocusViewController | 148 / 37 | action / addTimer / associate / plus / minus / rings 连接 |
| TTHabitDetailViewController | 223 / 52 | 习惯详情、monthTitle / prev / next 连接 |
| TTProjectListView | 37 / 2 | 清单视图对象 |
| TTTaskListViewController | 142 / 40 | sort / date / lists / tag / status / emptyTrash / saveFilter 连接 |
| TTThemePreferencesViewController | 22 / 4 | 主题偏好控制器对象 |
| TabBarViewController | 67 / 9 | 模块栏、avatar 连接 |

连接属于编译期 UI 元数据，不能证明同名 selector 的函数实现存在，也不能还原自动布局后像素位置。Focus 与 TaskList 的连接覆盖仍有 unsupported_connection_type 限制。完整对象、selector、每个资源 hash 与覆盖信息见 `evidence/focused-interface-builder.json`；较小摘要为 `evidence/focused-ui-summary.json`。

## 功能与主题资源：部分回答

普通 plutil/Python 补充解析得到 **3567 条中文本地化键值**；按明确功能词筛选到606条，保存原键值以便复核。包内 **42 份 CSV 主题色表**，例如 `blue.csv` 声明 base `#4772FA`、tabbar_background `#4773FA`。补充证据中保留源文件 hash 与原始内容：`evidence/supplemental-resources.json`。这属于普通文件取证，不冒称 REA 输出。

原版声明 ticktick / dida URL scheme、NSAppleScriptEnabled、任务 / 日历 / 四象限 / 习惯 / 番茄相关 App Intent 名。包里还有协作、AI、倒数日、集成等本地化资源。资源证明这些声明和文案存在，不证明当前账户可用、订阅开放程度、后端协议或实际服务行为。

REA 资产目录观察到4份catalog、2681条记录，当前仅交付 offset0 / limit1000 的记录页；资源 key / catalog coverage 的未知项和 symlink 限制保留。未提取原版图片用于新应用。

## 业务逻辑：重新实现，未恢复商业源码

本机没有可用 Hopper / Ghidra / IDA 原生反编译引擎。REA CLI 6.8.0 可用，MCP 未注册；直接使用已安装 CLI 完成取证，未修改客户端配置、未安装分析引擎。没有做函数级反编译、网络接口抓取、数据库解密或账号凭证访问。服务端同步、冲突解决、提醒细节、完整任务 schema 都仍未知。

拾序的数据结构、重复生成、四象限规则、日历拖动、计时器、JSON 存储是根据明确产品需求重新设计并通过测试的实现。**新应用采用 Electron + React，而原版是原生 macOS；不能将新技术选择误写为恢复出的原版架构。**

四象限约定：“紧急”=截止日期为今天或已逾期；“重要”=用户勾选的重要事项。日历周视图是按日列出任务，未实现原版可能存在的小时网格、时间块与日历订阅。重复规则只覆盖每日、每周、每月；每月按源任务日号锚定，若原始任务已永久删除且最早保留实例被短月截断，无法知道被删除的原始日号。搜索覆盖未完成任务的标题、备注和标签。

## 设计：来源可验证，高赞数字未验证

采用 Things 的任务层级、Linear 多面板布局与克制分隔、Radix Slate + Indigo 语义色值。正文 Slate12 `#1C2024`，侧栏 Slate2 `#F9F9FB`，主色 Indigo9 `#3E63DD`，选中背景以 Indigo3 `#EDF2FE` 为参考，实际随强调色按比例混合生成。白字 / Indigo9 对比度 5.21:1，正文 / 白色16.39:1。间距、栏宽、图标、中文样例文案属于新应用设计决策。

Things 官方列两次 Apple Design Award；Todoist 官方显示347K+五星评论，这是产品官方宣称，不能等同设计稿点赞。Dribbble 检索返回202空正文，Behance请求超时，未获得可核实单作品点赞数。没有伪造高赞作品。详细来源、抓取时间、CSS、HTML、对比度计算与hash见 `design-references.md` 和 `sources/manifest.json`。联网检索前按 UUMit 技能做了一次只读发现，无付费交易。

## 交付范围与剩余事项

已实现：任务 / 清单 / 标签 / 检查事项 / 简单重复 / 提醒、列表与优先级看板、月周日历、四象限、习惯、专注、搜索、主题、本地备份。数据独立于原版，没有读取或迁移用户原账户任务。演示使用新建样例数据。

未实现：原版云同步、登录、团队协作、附件、富文本 / Markdown、复杂或农历重复、时间轴 / 时间块、第三方集成、AI、倒数日、桌面小组件、菜单栏入口、全局快捷键。没有把这些显示成可点却不起作用的入口。macOS提醒仅app运行期间检查，且依赖系统允许通知；应用退出后的专注在重新打开时结算。

完整性检查：目标身份已回答；原生结构和所选UI资源已回答；全界面动态行为部分回答；核心本地复刻完成并验收；商业源码与云协议未恢复；设计来源已回答但单作品点赞未验证。完整原应用行为等价性仍未证明。

## REA 证据索引

- `plist.json` — `ev_c334c2ca3d587887899ad8156931b1865daf2678144ae881c2a4313e15817d8c`
- `macho.json` — `ev_1d26bf92ee5c53e268804cc2192b3577b3a667029ddb7577815e9c7cb2a2806a`
- `desktop.json` — `ev_30e54db18a96ee8232000133eab9f5a7e93b47581e1f77c41448ef97bcd52288`
- `interface-builder.json` — `ev_270e9c9b2b7408b689d9525407823be585a74dd041a2441d15560bbecdaac899`
- `focused-interface-builder.json` — `ev_27c1f437ec93f66465e30efda11cf10353b95c51e94dfb075e90838f3488e649`
- `assets.json` — `ev_efc394b5fa4d381f027e8d85f57182109c6718f1555a17f58535ace06742bf1b`

证据均保存在 `research/evidence/`。其中 `*-nib.json` 是一次错误选择 inspect_keyed_archive 的原始失败记录：目标为 compiled NIBArchive，而不是 Foundation plist archive；已按返回建议改为上述聚焦 decode_interface_builder 流程。失败记录没有用作功能结论。

验证结果与可复现命令见 `validation.md`；运行、数据路径、备份与具体能力边界见仓库 README。

## 1.0.1 本地实现补充

废纸篓新增一键清空，操作前显示全部已删除任务数量及不可撤销说明。以单次领域操作清空全部已删除任务；保留其他任务、清单、习惯与专注记录，已删除任务的专注关联转为null。这是新应用的实现补充，不增加对原版运行时行为已验证的声称。
