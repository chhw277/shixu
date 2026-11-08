# 拾序

## 下载安装（v1.1.1）

安装包已上传至 [GitHub Releases](https://github.com/chhw277/shixu/releases/tag/v1.1.1)，点击下表直接下载：

| 系统 | 安装包 | 使用方法 |
|---|---|---|
| Windows 10/11，64 位 | [Windows 安装版（EXE）](https://github.com/chhw277/shixu/releases/download/v1.1.1/Shixu-1.1.1-Windows-x64-Setup.exe) | 下载后运行安装程序 |
| Windows 10/11，64 位 | [Windows 免安装版（ZIP）](https://github.com/chhw277/shixu/releases/download/v1.1.1/Shixu-1.1.1-Windows-x64.zip) | 完整解压后运行 `Shixu.exe`，保留同目录所有文件 |
| macOS 13+，Apple Silicon | [macOS 应用（ZIP）](https://github.com/chhw277/shixu/releases/download/v1.1.1/Shixu-1.1.1-macOS-arm64.zip) | 解压后将拾序.app 放入“应用程序”并打开 |

[下载 SHA-256 校验文件](https://github.com/chhw277/shixu/releases/download/v1.1.1/SHA256SUMS.txt)。仓库目前为私有，下载需登录有仓库访问权限的 GitHub 账号；也可以将下载好的安装包直接发送给其他使用者。

## 直接打开

- **Windows 10/11 x64**：从 [Releases](https://github.com/chhw277/shixu/releases) 下载 `Shixu-1.1.1-Windows-x64-Setup.exe` 安装；也可完整解压同版本 Windows ZIP，双击其中的 `Shixu.exe`。免安装版必须保留同目录下的运行时与 resources 文件。
- **macOS 13+ Apple Silicon**：下载 `Shixu-1.1.1-macOS-arm64.zip`，解压后打开拾序.app。本地构建路径为 `artifacts/拾序-darwin-arm64/拾序.app`。

界面和运行时已包含在应用内，不需要 Node 或网络。Windows 未购买代码签名证书；macOS 使用本机临时签名，未做 Apple 开发者公证。首次启动带有示例任务，可直接编辑或删除。原版滴答清单的账户、数据库和任务没有被导入或修改。仓库为私有时，Release 下载也需要仓库访问权限。

**当前为本地版。Supabase 云同步、独立账号、安卓 App 和客户端自动更新仍待实现。** GitHub Actions 自动构建新版安装包，与已安装 App 自动升级是两件事。

## Windows 1.1.1

Windows 使用系统标题栏，快捷键中的 ⌘ 对应 Ctrl，例如 Ctrl K 搜索、Ctrl N 新建、Ctrl 点击多选。提供当前用户安装程序，不要求管理员权限；卸载程序保留个人任务数据。通过 Windows 构建机验证真实启动、退出重启、磁盘读写、导入导出、安装和卸载。下载文件的 SHA-256 见同一 Release 的 `SHA256SUMS.txt`。

## 已实现

- 今天（包含逾期）、最近七天、收集箱、全部、已完成、废纸篓、清单和标签视图。
- 任务添加、编辑、日期、优先级、重要性、备注、检查事项、标签、复制、删除恢复、永久删除与一键清空废纸篓。
- 每日 / 每周 / 每月重复，完成历史、下一次任务去重；月末按原始日号截断，后续月份恢复日号。
- 列表 / 看板切换，拖动调整优先级；日历月 / 周视图、拖动排期、同日更多任务；四象限拖动。
- 习惯每日目标、计数、近七天补打卡、连续天数；番茄专注 / 休息、暂停恢复、任务关联、跨页面和重启恢复计时及统计。
- 浅色 / 深色 / 跟随系统、五种强调色；全局搜索、⌘ K / ⌘ N。
- 本地 JSON 原子写入、一个历史版本自动备份、损坏恢复提示、原生导入导出、运行期间任务通知。

## 1.1.0 操作捷径

- 悬停任务可直接改期、改优先级或删除；右键可复制、移动、完成和开始专注。菜单会避开窗口边缘。
- 日期支持今天、明天、下周一与清除日期；改期同步移动已有提醒的本地时刻，清除日期也清除提醒。
- 快速输入如 `明天下午3点 开会 !高 #工作`，识别日期、提醒、优先级和标签。支持今天 / 明天 / 后天 / 下周一 / `YYYY-MM-DD`、`15:00` / `3点半`、`!高` / `!中` / `!低`，属于有限语法识别。仅输入时间且已经过时会安排到次日，显式指定日期则尊重指定日期。保存后输入框保持焦点，详情面板保持原来的任务。
- 点“多选”，或 ⌘ 点击逐个选择、Shift 点击连续选择，批量完成、改期、移动、删除；废纸篓可批量恢复或经确认永久删除。提示条提供一次撤销，重复任务产生的下次实例也会撤回；相关任务已有后续修改时拒绝覆盖。永久删除不可撤销。
- 在列表用 ↑ / ↓ 选择，空格完成，Enter 编辑，⌘ A 全选，Esc 退出多选。输入框和普通按钮保留自己的键盘行为。
- ⌘ K 同时支持搜索和命令：新建任务 / 清单、开始专注、切换页面、设置与外观；↑ / ↓ 选择，Enter 执行。已有专注计时会继续保留。
- 自动恢复页面、排序、列表 / 看板、详情显隐、所选任务和各页滚动位置。这些界面偏好保存在本机，不包含在任务 JSON 备份中。

更新时退出旧版，再打开新版应用；任务文件路径与数据格式兼容。可分享 `artifacts/拾序-macOS-Apple-Silicon.zip`，接收方解压后将应用移入“应用程序”。安装包包含独立样例，未包含你的个人任务；需要交接任务时另外使用“设置 → 导出备份”。

## 清空废纸篓

进入左侧“废纸篓”，点击工具栏右侧“清空废纸篓”，核对任务数量后选择“永久删除全部”。可取消；空废纸篓时按钮禁用。清空仅删除废纸篓中的任务，保留专注历史统计。版本 1.0.1 起提供此功能，更新后退出旧窗口并重新打开应用即可使用。

## 数据

macOS 数据位于 `~/Library/Application Support/拾序/data/state.json`；Windows 位于 `%APPDATA%\拾序\data\state.json`。备份为同目录的 `state.backup.json`。保存前校验结构，串行写入临时文件、fsync 后原子替换，退出时等待已收到的写入完成。主文件和备份同时损坏时拒绝覆盖；主文件损坏时保留损坏副本并提示恢复。

设置 → 导出备份 / 恢复备份。恢复是替换当前内容，会先要求确认。自动备份保留一个历史版本，请定期将手动备份放到其他位置。浏览器开发模式使用 localStorage，与桌面数据相互独立。

提醒每 15 秒检查一次，仅应用运行时有效，实际显示取决于系统通知权限。专注计时在关闭应用后按截止时间恢复，重新打开时结算，未运行期间不会发出结束通知。

## 边界

这是核心本地功能的重新实现，不能声称逐项等同原版。暂不提供原版云同步、账号登录、多人协作、附件、富文本 / Markdown、农历与复杂重复规则、时间轴 / 时间块周日历、第三方日历订阅、AI、倒数日、桌面小组件与全局快捷入口。没有解密原版数据库或恢复商业源码。完整逆向证据与仍未知的部分见 [research/analysis.md](research/analysis.md)。

REA 的原生辅助功能观察因 macOS Accessibility 权限不足而未完成，普通窗口截图可用；本机未配置 Hopper / Ghidra，未做函数级反编译。设计作品点赞未能取得可验证数字，没有将成熟产品资料冒称为高赞作品，来源见 [research/design-references.md](research/design-references.md)。

## 开发与验证

需要 Node 22.12+（本机为 26.9.0）和 npm。

```sh
npm ci
node node_modules/electron/install.js
npm run build
npm start
```

开发时分别运行 `npm run dev` 与 `SHIXU_DEV=1 npm start`。

```sh
npm test                 # 日期、重复、导入、领域操作、原子存储、损坏恢复与退出队列
npm run test:ui          # 本机 Chrome 中的隔离交互验收
node scripts/desktop-smoke.mjs  # 真实 Electron IPC、磁盘、退出重启、导出导入
npm run package          # Apple Silicon macOS .app
npm run package:windows  # Windows x64（可从 macOS 交叉构建）
npm run package:mac      # 显式构建 macOS arm64
```

`SHIXU_TEST_DATA_DIR` 用于指定隔离数据目录。`SHIXU_SMOKE_EXECUTABLE` 可让 smoke 脚本验证打包后的可执行文件。不要把测试数据路径指向日常使用目录。UI 测试配置使用本机已安装的 Google Chrome，不下载浏览器。

推送 main 后，GitHub Actions 在 Windows 上执行 `npm ci`、38 项领域/存储测试、Windows 打包、真实 Electron smoke、Inno Setup 安装包生成及安装/卸载 smoke，并提供安装程序、免安装 ZIP 和验证报告。安装包与依赖不直接提交到 Git；本机逆向原始资源、个人数据、凭证与运行报告也不上传。

## 设计来源

- [Things 3](https://culturedcode.com/things/)：日视图、任务层级与克制的交互。
- [Linear UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)：多面板信息结构与低噪声布局。
- [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)：语义色阶和精确色值。
- [Todoist](https://www.todoist.com/)：成熟任务产品的信息组织。

设计系统依赖色值来源及原文存档在 `research/sources/`。UI 采用自绘图标与 Lucide；没有将原版图片、图标或代码打入交付应用。源码依赖及许可证由各项目持有。
