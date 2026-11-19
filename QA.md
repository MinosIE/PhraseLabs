# QA 验证记录

## 2026-11-19 · 配色系统审查（ui-studio）

依据 `discipline-mode.md` §1/§2/§4、`dark-mode.md` §1–4/§8、`craft-floor.md` §3，对 `style.css` 全套 token 与反色用法做一轮有界审查。

### 自动化

- 对比度脚本（WCAG 2.1 AA）：浅色 / 深色 / 反色卡片共 **21 组组合全部 ≥4.5:1**，修正前 7 组不达标。
- `pnpm test`：26/26 通过；`pnpm typecheck`、`pnpm build`：通过（69 modules）。
- IDE lint 诊断：无新增错误；旧色值与背景光斑扫描无残留。

### 真实问题（已修）

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| high | `.today-card` 文字 | `--accent`/`--muted` 压在反色 `--ink` 底：浅 3.24:1、深 2.49:1 | 新增 `--on-ink-muted` / `--on-ink-accent` 双主题值：8.15 / 7.76 / 6.06 / 5.52:1 | 反色卡片不能再复用为浅底定义的辅助色；`dark-mode.md` §8「彩色底上的文字」 |
| high | `--muted`（浅） | `#78766d`：paper 4.04:1、surface 4.48:1 | `#67655b`：5.19 / 4.78 / 5.76:1 | 12px 辅助文字按正文 4.5:1 门槛 |
| high | `--gold` / `--gold-soft`（浅） | `#98701f`：3.86:1 | `#856116`：4.85:1 | 状态标签为 11–14px，非大字号 |
| medium | `--accent-soft`（浅） | `#f7e6db`，强调色压底 4.34:1 | `#faeee7`：4.63:1 | 保品牌色不动，调浅承载底色 |
| high | `body` 背景 | `radial-gradient` 光斑 + 硬编码 `rgba(184,72,31,0.07)` | 移除 | `discipline-mode.md` 红线 12 禁背景光斑；同时消除色值泄漏 |
| medium | 深色 `--accent` / `--red` | 饱和度反升（76% vs 浅 72% / 57%） | `#d98a63` / `#e5968e`，去饱和提亮度 | `dark-mode.md` §3 防深底振翅（halation） |
| medium | `.today-card .progress-track` | 白色 14% 半透明，深色模式浅底上不可见 | `color-mix(in srgb, var(--paper) 16%, transparent)` | 槽位需随主题反向；填充改 `--on-ink-accent` 达 3.95:1（UI 组件门槛 3:1） |
| low | 三处中文标签 | `.reveal-label` / `.meta-item span` / `.select-label` 带 `text-transform: uppercase` | 移除 | `discipline-mode.md` 红线 13：中文无大小写，纯噪音 |

### 误报 / 有意保留

| 项 | 判定 | 理由 |
|---|---|---|
| `--teal` / `--gold` / `--red` 多色相 | 有意保留 | 仅用于 correct / near / wrong / due / mastered 状态语义，非装饰色，符合 §1「语义色不是强调色」 |
| 彩纸三色、收藏星标 `--gold` | 有意保留 | 一次性庆祝视觉语言与通用收藏约定，属既有身份（`craft-floor.md` §3 精修保留身份） |
| `.eyebrow` 的 `uppercase` | 误报 | 实际内容均为英文（Phrase Labs / Progress / Session 等），中文规则不适用 |
| `.modal-backdrop` 固定深色 `rgba` | 有意保留 | 遮罩职责是压暗内容，跟随主题反而失效；内容层已是实底 `--surface` |
| 深色模式仍有 `--shadow` | 有意保留 | 层级主要靠 `--paper` → `--surface` → `--surface-2` 亮度阶梯与 1px `--line` 勾边，阴影仅作辅助 |

### 已考虑但拒绝

| 被拒方案 | 理由 |
|---|---|
| 删除 teal/gold/red，只留单一 brand 色相 | 会丢失判定结果「文字 + 颜色」双通道语义，且属既有设计身份 |
| 把暖纸底换成 discipline 模板的冷灰 `ink-50` | 品牌身份重设计，超出本轮配色修正范围 |
| 反色卡片改用 `filter: brightness()` 提亮 | 不解决「为浅底定义的 token 被复用」的根因，且会影响整卡内容 |

## 2026-11-19 · 动效与交互精修（ui-studio）

### 自动化

- `pnpm build`：通过（vue-tsc -b + vite build，69 modules）
- `pnpm test`：26/26 通过
- IDE lint 诊断：无新增错误
- `lint_behavior.py src`：**1 error / 3 warn / 11 info**
  - error `range-without-aria` @ `style.css:1126` = **误报**：规则按文件扫描，`style.css` 里只有 `input[type='range']` 选择器文本，脚本会剥离注释；真实的 `role=slider` + `aria-valuemin/max/now` 已补在 `SettingsView.vue` 的 input 模板上。
  - 3 warn（`SelectField.vue` 的 `no-touch-action` / `no-user-select` / `no-pointer-capture`）= **误报**：该文件用 `pointerdown` 做「点击外部关闭」下拉，不是拖拽；无拖拽语义。
  - 11 info `no-live-region` = 提示级，反馈弹框已有 `role="status" aria-live="polite"`，进度条为纯展示。
- `lint_slop.py src`：24 error 全部为 `emoji-icon`，集中在 App 主题切换、判定图标、朗读按钮与 11 个分类图标 = **有意保留**：emoji 是本产品已确立的视觉身份（暖纸底 + 分类 emoji），按 `craft-floor.md` §3「精修保留现有身份」，不整体替换为线性图标。另有 1 error `colored-glow` @ `style.css:20` 为深棕中性阴影 `rgba(44,36,24,0.45)`，非高饱和发光，误报。

### 浏览器

- 未在本轮渲染截图验证（当前环境无浏览器 MCP 配置）；动效改动为参数级替换，属性保持 transform/opacity，风险低。若后续接入 Chrome，应补做一次结果弹框的入场/彩纸/进度条回归。

### 交互改动

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| high | `AnswerFeedback.vue` 图标 | `scale:0` + `back.out(2)`，0.5s | `scale:0.95 + autoAlpha`，`power2.out`，0.24s | 入场禁 scale(0)、禁回弹、<300ms |
| high | `AnswerFeedback.vue` 里程碑 | `back.out(2.5)`，0.5s | `scale:0.95`，`power2.out`，0.26s | 同上 |
| medium | 彩纸 | 1.1s / stagger 0.025 | 0.6s / stagger 0.02 | 一次性庆祝允许回弹但需压短；本实现改 power2.out 更克制 |
| high | `style.css` 进度条 | `transition: width 0.45s` + 4 处 `width:%` | `transform: scaleX()` + `transform-origin:left`，0.28s | 布局动画改合成属性，`gsap-performance` / `motion-decisions` §8 |
| medium | `style.css` 裸缓动 | 6 处 `ease` | `cubic-bezier(0.2,0,0,1)` | 禁 generic easing |
| high | `SettingsView.vue` 滑块 | 无 aria 值语义 | `role=slider` + `aria-valuemin/max/now/text` | 键盘与读屏契约 |
| low | `prefers-reduced-motion` | 已有 | 保留（JS 早退 + CSS 全局降级） | 分层降级 |

### 已考虑但拒绝

| 被拒方案 | 理由 |
|---|---|
| 把 emoji 全量换成线性 SVG 图标集 | 属品牌身份重设计，超出本次精度范围；用户未要求换视觉语言 |
| 给 `SelectField` 加 `touch-action` / `setPointerCapture` | 它是点击外部关闭的下拉，无拖拽，加了是误导性代码 |
| 为消除 CSS 误报往 `style.css` 塞 aria 属性 | 属性不属于样式层，错误位置；真实契约已在模板 |

### 上次结果

无（首次记录）。
