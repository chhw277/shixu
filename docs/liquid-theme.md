# Liquid Theme Reveal 接入与验收

拾序 1.1.2 沿用 React 19 / Vite / Electron、原有配色、任务 reducer 与备份格式，接入液体主题切换、声音设置及窄屏 CSS。新增模块用 TypeScript，原业务组件继续使用 JSX。

## 运行

需要 Node.js 22.12+（本次检查使用 Node 26）和 npm。

```sh
npm ci
npm run dev
```

访问 http://127.0.0.1:5173/，点击顶部月亮/太阳图标。也可在设置里选择主题，或用 Cmd/Ctrl K 的主题命令。设置 → 切换音效，开启后可调音量并点击“试听水声”。音效默认关闭。浏览器预览使用该 origin 的本地存储；Electron 仍使用原有本机数据，不上传内容。

```sh
npm run typecheck
npm test
npm run test:liquid
npm run test:liquid-ui
npm run test:ui
npm run build
npm start                 # Electron；需 npm ci 完整安装 Electron 二进制
```

Playwright 配置优先使用 macOS 的已安装 Google Chrome，其他平台使用 Chrome channel；机器上需有 Chrome。测试使用独立浏览器上下文和样例数据。生产网页可运行 `npx vite preview --host 127.0.0.1 --port 4173`，不应直接以 file:// 打开 Vite 网页；Electron 可使用打包后的 file:// 入口。

## 模块接口

- `src/liquid-theme/types.ts`：Theme、LiquidFrame、LiquidSoundAdapter、LiquidThemeOptions 等类型。
- `useLiquidTheme.ts`：受控主题回调、可配置 600–12000ms 时长（默认 2800ms）、单 RAF、监听及清理；调用 `requestTheme(target, button)`。
- `geometry.ts`：按实际视口像素生成液柱、分离液滴、飞溅与波浪的联合封闭路径，phaseAt 与音效共用进度。
- `snapshot.ts`：一次 DOM/CSS/SVG 视觉复制、表单/滚动同步、ID 与引用重映射、inert/aria-hidden；不挂载第二棵 React 业务树。
- `audio.ts`：Web Audio 本机合成；可注入现有 AudioContext，不会关闭调用方的 Context。begin 仅从点击/选择事件触发，异常吞掉并继续视觉切换。
- `LiquidThemeToggle.tsx`：可复用的受控按钮。`Example.tsx` 是完整调用例子。`index.ts` 是统一导出。

最小调用：

```tsx
import { LiquidThemeToggle } from './liquid-theme';
import type { Theme } from './liquid-theme';

const [theme, setTheme] = useState<Theme>('light');
<LiquidThemeToggle
  theme={theme}
  onThemeChange={setTheme}
  root={() => document.getElementById('root')}
  duration={2800}
/>
```

`root()` 必须返回覆盖视口的应用根容器，沿用本项目 100% 高度与容器内滚动布局；不要传任意局部卡片。底层只有一套业务事件与 React 状态。无 sound 参数即可只使用视觉效果；也可传入自己的适配器：

```ts
const sound: LiquidSoundAdapter = {
  begin(target, reducedMotion) { /* 用户手势内解锁已有 Context */ },
  update({ progress, phase, target, reducedMotion }) { /* 使用实际进度，按阶段去重 */ },
  stop(reason) { /* complete 可短收尾，interrupted/unmount 必须停声 */ },
  setVolume(volume) { /* 可选，0..1 */ },
};
```

适配器异常不会阻止主题提交。已有音效系统可在此复用；拾序原项目没有声音设置或 AudioContext，因此新增一个懒初始化共享 Context。默认设置存在 `shixu-liquid-sound-v1`，不改严格校验的业务备份 schema。声音偏好是设备设置，不随任务 JSON 导出；主题偏好继续写入原 settings.theme。`LiquidAudio.setSettings()` 控制静音/音量，卸载时调用 `dispose()`。隐藏或 pagehide 时停止音源。AudioContext 由浏览器回收，多个组件可复用，不反复新建或关闭。

## 主题样式与首次恢复

原有配色不变。CSS tokens 在 `:root`（正式主题）和 `[data-liquid-theme=light|dark]`（临时副本）设置同一组变量。日常卡片图标与头像的原硬编码主题样式改为变量，以便两方向正确显示。原 SVG/CSS 图表使用这些主题变量或原来的业务色；副本保留 SVG 并重映射内部 ID 引用。

`public/theme-init.js` 是 CSP 允许的同源阻塞脚本，在主体脚本与样式前读取主题/强调色缓存并解析跟随系统；随后原本的有效业务数据为最终权威。Electron 的异步数据加载完成后先应用主题再挂载业务界面。刷新无需等 React effect 才恢复颜色。禁止存储或缓存损坏时安全降级。主题跟随系统可实时响应系统主题变化，无声直接切换。

## 对齐、状态与中断策略

- 动画开始只读一次按钮矩形与视口；一次复制 DOM、控件当前值和每个已滚动容器的滚动偏移。根副本与原根同宽高，临时层位于视口原点，不施加位移或缩放。
- 揭示层仍由浏览器用另一套 CSS 变量绘制 DOM/SVG，不是着色的位图。clip-path 引用动态 SVG clipPath，每帧只更新一个 path 的 d；没有每帧 setState、DOM 重建、布局读取或多条视觉循环。
- ID、SVG url(#id)、label/ARIA/form 引用重映射；原生事件处理器不复制，副本无 React 事件树。副本 inert、aria-hidden，所有可聚焦元素 tabindex=-1，radio name 独立。
- 使用时保留真实输入焦点与 selection。原表单、过滤、任务与计时状态始终挂载，DOM 副本只负责显示。
- 原 sticky 位于复制的同尺寸滚动容器；fixed 仍相对于同尺寸视口。窗口缩放、方向/visualViewport 变化、任何容器滚动、键盘操作、用户开始编辑或点击其他业务操作，立即提交目标主题并销毁临时层，再由原有业务继续处理。不会冻结交互或阻止用户操作。
- 同一次动画中的主题按钮重复点击会忽略，不倒播、不排队、不叠加声音。用键盘 Enter/空格重复触发同样忽略。设置里的其他操作会先中断。
- 正常完成提交后删除副本；中断保留用户请求的目标主题并停止所有音源，不播完成提示。卸载只清理，不再调用业务回调。外部受控主题变更可终止旧动画。
- 页面后台/pagehide 立即中断；reduced-motion 或不支持 SVG CSS 裁剪时直接切换。开启声音的 reduced-motion 只发短反馈，不播长流水。

## 视觉副本的明确限制

副本在最长 2.8 秒内冻结动画开始时的内容，原业务仍运行；时钟/计时等自动变化会在切换结束后显示最新值。用户编辑、滚动、导航等会先结束动画，因此不会继续展示过期表单。

Canvas（包括 WebGL）、视频、iframe、object/embed、可检测的开放 Shadow DOM 无法自动按另一主题重绘。本实现检测到这些元素时直接切换，避免伪装成能重绘。封闭 Shadow DOM 无法可靠检测，不在快照支持范围，应由接入方直接降级或提供真正支持双主题的视觉层。CSS 伪元素可随变量重新绘制，但浏览器原生弹出菜单、系统提示、密码字段内容、跨文档 portal/top-layer 不保证可复制。密码值不会复制。当前拾序页面使用普通 DOM/CSS/SVG，不使用这些媒体类型。

浏览器必须实际支持 CSS 对 SVG clipPath 的 URL 引用；支持检测覆盖 API/语法，不等于已验证所有浏览器的渲染缺陷。旧 Safari、WebView 等仍需在目标设备实测。移动布局为本次新增 CSS，桌面业务布局不重写。

## 验收

新增 `tests/liquid-theme.spec.js`（10 个浏览器用例）覆盖双向揭示、桌面/平板/手机对齐、滚动及 sticky/fixed 测试夹具、表单状态、ID 引用、刷新、重复点击、中断、真实 AudioContext 的手势初始化、音量/开关记忆、后台、媒体不支持和 reduced-motion 降级。

`tests/liquid-audio.test.mjs` 用严格音频节点替身验证阶段去重、静音、音量零、正常短尾、中断/卸载清理、异步解锁失败和关闭动态效果下的反馈；几何测试覆盖多种视口，检查有限路径与最终全视口覆盖。这些检查不能替代浏览器视觉/听感验收。

本次实际执行与限制见 `docs/liquid-validation.md`。平台安装包和发布结果见仓库 Releases，变更内容见 CHANGELOG.md。
