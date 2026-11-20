# QA 验证记录

## 2026-11-20 · 首页宣传化与产品演示区（ui-studio / gsap-core）

依据 `creative-mode.md` §1/§5、`motion-decisions.md` §1/§4/§6/§7 与 `gsap-core` 的 `matchMedia()` 纪律。设计论点：沿用暖纸 + 衬线 + 陶土橙走 editorial 方向；**核心亮点是真实数据驱动的答题演示区**（深色舞台 + 浅色产品卡），首屏短语视差与横向短语带退为辅助纹理；首尾各一块深色反色区形成节奏。所有训练入口原样保留。

### 视觉复核发现并修复的真实缺陷

| Severity | 现象 | 根因 | 修复 |
|---|---|---|---|
| high | 首屏只剩巨大淡短语，主标题与按钮看不见 | `gsap.from` 用 `autoAlpha:0` 设了 `visibility:hidden`，headless 截图时 rAF 未推进动画；对 SSG 首屏也是渐进增强隐患 | 首屏与区块入场一律改为纯 `y` 位移 + `clearProps:'transform'`，不碰 `autoAlpha`；预渲染内容始终可见 |
| high | 视差短语喧宾夺主，看不出宣传感 | 6 条 72px 短语铺满首屏，opacity 0.055 仍压过正文 | 收敛为 3 条 28–52px、opacity 0.035，移到边缘；标题放大到 44–78px |
| high | 没有任何产品画面，宣传亮点缺失 | 上一轮只有装饰与文字卡 | 新增演示区：用 `a little bit` 的真实 `zh` / `en` / `exampleEn` 展示「提示 → 输入 → 判定 → 下次见面」闭环 |
| medium | 结尾收口平淡 | 结尾 CTA 是浅色卡片，与中段同质感 | 改为深色反色块，与演示区首尾呼应 |

### 浏览器验证（本机 Chrome headless 截图）

- 1440×3300 全页截图复核：首屏主标题、三个入口按钮、今日卡、今日一句、数据条、演示区、三步循环、题型卡、分类网格、结尾深色 CTA 均可见且层级清晰。
- 演示区深色舞台上的中文提示、输入行、绿色「答对了」反馈与「记忆状态 / 下次见面」页脚完整渲染，无溢出。
- 首屏短语纹理已退到边缘，不再遮挡标题；深色结尾 CTA 与演示区形成首尾呼应。
- 未覆盖：滚动过程中的视差手感、移动端真机换行与 `prefers-reduced-motion` 终态仍需真机回归。

### 动效决策

| 动效 | 频率 / 理由 | 实现 | 纪律依据 |
|---|---|---|---|
| 首屏文案入场 | 1 次 / 品牌 moment | `y:16 + autoAlpha:0`，0.5s，`power2.out`，stagger 0.06 | §1 允许 600ms、§6 禁 `scale(0)` |
| 首屏短语视差 | 滚动同步 / 空间纵深 | 6 条真实短语不同 `y`/`x`，`scrub:true` + `ease:'none'`（1:1 跟输入） | §3 滚动无固定时长、§4 滚动禁缓动 |
| 今日卡 / 短语带 | 同上 | 卡片 `y:-26`、短语带 `xPercent:-12`，与背景反向分层 | 只动 transform，§8 |
| 区块标题 reveal | 每屏 1 次 / 防止突变 | `y:18 + autoAlpha:0`，0.45s，`once:true` | §2 防止 jarring changes |
| 移动端 | 前庭负荷 | `isDesktop` 守卫：关闭大幅位移，只保留入场淡入 | §7 分层降级 |
| `prefers-reduced-motion` | 无障碍 | `conditions.reduceMotion` 为真直接 return，元素保持静态终态 | §7 大位移优先砍 |

- 入场起点未用 `scale(0)`；全页无 back/elastic/bounce 回弹；无裸 `ease`。
- 视差层 6 条短语同为“运动元素”，但 `opacity:0.055` 且 `aria-hidden`，属背景纹理而非注意力竞争，按 §6 的 1/3 预算人工放行。
- `will-change: transform` 只加在 `.ambient-phrase` 与 `.ribbon-track`；`mm.revert()` 在卸载时统一清理。

### 自动化

- `pnpm check:content`（`pnpm test` 前置）：11 类 / 703 条通过。
- `pnpm test`：46/46 通过；`pnpm typecheck`：通过。
- `pnpm build`：`vue-tsc -b && vite-ssg build && postbuild` 全通过，预渲染 13 页。ScrollTrigger 被拆为独立 chunk（gzip 17.57 kB），仅在浏览器侧加载。
- 预渲染产物抽查：`dist/index.html` 含 `landing-hero` 1、`ambient-phrase` 6、`loop-step` 3、`landing-cta` 1；训练入口「开始今日训练」「浏览词库」各 2 处，「按题型开练」「按场景找短语」「练这一条」各 1 处。
- IDE lint 诊断：无新增错误。

### 对比度

新区块全部复用已验证 token：`--muted` / `--accent` / `--line` / `--surface`（上轮 21 组实测均 ≥4.5:1）。装饰短语为 `aria-hidden` 背景纹理，`opacity:0.055` 不适用正文对比阈值，且颜色取 `var(--ink)` 使深浅主题自动反向。

### 已考虑但拒绝

| 被拒方案 | 理由 |
|---|---|
| CSS `background-attachment: fixed` 做视差 | 移动端支持差，且无法让 6 条短语以不同速度分层 |
| 顶层静态导入 ScrollTrigger | SSG 构建期 Node 环境无 `window`，已实测报错；改为 `onMounted` 动态导入 |
| 引入第三方视差库 | 项目已有 GSAP core，ScrollTrigger 随包提供，无新增依赖必要 |
| 给装饰短语写死 `rgba()` 色值 | 破坏 token 唯一出处且深色模式会失效；改用 `var(--ink)` + opacity |

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
