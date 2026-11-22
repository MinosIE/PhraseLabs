# QA 验证记录

## 2026-11-21 · D2 PWA 离线与主屏安装（roadmap D2）

### 自动化

- `pnpm test`：61/61 通过；`pnpm typecheck`：通过。
- `pnpm build`：`precache 38 entries`，生成 `dist/sw.js` 与 `dist/workbox-2fbc6a65.js`；`postbuild` 新增门禁（`sw.js` / `manifest.webmanifest` / icons）均通过。
- 带 `VITE_BASE_PATH=/PhraseLabs/` 构建复测：`manifest.webmanifest` 的 `start_url`、`scope`、图标路径均自动带前缀；precache 用相对路径（`library.html`、`phrases/daily.html`）。

### 浏览器实测（preview :4185）

- SW 徽标：`navigator.serviceWorker.controller.scriptURL` = `http://localhost:4185/sw.js`，注册 scope 为 `/`。
- 预缓存：`workbox-precache-v2-…` 共 34 项，含 `index.html`、`library.html`、`phrases/daily.html`。
- 首次访问未弹「新版本已就绪」条（正常）。
- **断网语义实测**：kill 掉 preview 进程后刷新首页、直访 `/study`（未预渲染，走 app shell）、`/library`，三者均正常渲染，本地 JS/CSS 全部由 SW 命中；console 0 错误（仅百度统计第三方脚本请求失败）。

### 发现并修掉的问题

| 现象 | 根因 | 修复 |
| --- | --- | --- |
| `pnpm build` 报 `Rolldown failed to resolve import "workbox-window"` | `virtual:pwa-register` 需要 `workbox-window` 作为 peer | 显式 `pnpm add -D workbox-window` |
| `index.html` 引用的 `/apple-touch-icon.png` 一直 404 | 图标从未落盘，只存在于 index.html 的 `<link>` | 由 `favicon.svg` 栅格化为 180px 放到 `public/` 根 |
| 首次用 `qlmanage -t -s 512` 得到的 PNG 只有 64px 内容贴在左上角 | `-s` 是缩略图盒尺寸，不缩放 SVG 内容 | 先用 `width=512` 的 SVG 副本再栅格化，最后 `sips -Z` 导出 192/180 |

### 未验证

- 真机「添加到主屏幕」安装流程；iOS Safari 独立窗口下的安全区（`viewport-fit=cover` 未开，理由同 B2）。
- 「新版本已就绪」条的真实触发：需推一次新构建后不关页面刷新才能复现，本地用双次构建无法可靠模拟。

## 2026-11-21 · D1 标签练习与错词优先（roadmap D1）

### 自动化

- `pnpm check:content`：11 类 / 789 条通过，软指标不变（L5 0%、tip 3%）。
- `pnpm test`：61/61 通过（新增标签汇总/筛选/首页顺序 4 项、队列错词插队 3 项）。
- `pnpm typecheck` / `pnpm build`：通过，预渲染 13 页，`postbuild` 校验无误。

### 浏览器实测（dev :4179）

- 首页「按主题练一轮」：8 个跨分类 chip（口语 / 高频 / 职场 / 邮件 / 影视 / 正式 / 基础 / 重复），点击进入 `/study`，来源文案为「主题 · 口语 · 20 条」，console 无报错。
- 词库主题行：点「邮件 · 25」后页头「25 条结果」，列表每条都带「邮件」badge，并出现「练这 25 条」。
- 尺寸与布局：chip 行沿用分类 chip 的换行规则，窄屏无横向滚动。

### 发现并修掉的问题

| 现象 | 根因 | 修复 |
| --- | --- | --- |
| 首页主题里看不到「职场」「邮件」 | 首版按条数取前 8，习语 / 动词短语 / 介词搭配这些「本身就是分类」的标签占位，把职场（71 条，第 9）挤掉 | 改为 `pickFeaturedTags`：跨分类标签策展优先，缺失跳过、剩余按条数补，并加单测锁住顺序 |
| 错词永远进不了队列 | `isDue(undefined)` 为真，未学新词全算「到期」，一次就把每日目标占满 | `due` 改为「学过（有 `progress` 记录）且到期」；未学词归入随机补充，错词才能按 30% 上限插队 |

### 边界说明

- 错词插队只在普通队列生效；`phraseIds` 指定集合（词库筛选、统计页清单、今日一句）不插入额外条目。
- 「错词上限至少 1 条」意味着每日目标很小时（如 3）也会挤进 1 条错词，属有意行为。
- 未验证：真机上 chip 行滑动手感（仍待 D2 后统一回归）。

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

- `pnpm check:content`（`pnpm test` 前置）：11 类 / 789 条通过。
- `pnpm test`：46/46 通过；`pnpm typecheck`：通过。
- `pnpm build`：`vue-tsc -b && vite-ssg build && postbuild` 全通过，预渲染 13 页。ScrollTrigger 被拆为独立 chunk（gzip 17.57 kB），仅在浏览器侧加载。
- 预渲染产物抽查：`dist/index.html` 含 `landing-hero` 1、`ambient-phrase` 6、`loop-step` 3、`landing-cta` 1；训练入口「开始今日训练」「浏览词库」各 2 处，「按题型开练」「按场景找短语」「练这一条」各 1 处。
- IDE lint 诊断：无新增错误。

### 交互复核（2026-11-20，preview :4180 实测）

- 词库搜索：输入 `book` 后出现圆形 ✕；点击或 `Esc` 均清空，结果回到 789 条，焦点留在输入框（可直接继续输入）。
- 学习页：故意输入 `zzz` 提交，弹框同时给出「正确答案 catch up with」与「你的答案 zzz」；按 `Enter` 进入下一题后输入框已清空并重新获得焦点，再答一题正常，console 无报错。
- 截图：词库清空按钮、结果弹框「你的答案」各一张（本轮浏览器复核留存）。
- 单条训练（今日一句）：答错后弹框按钮为「看本轮结果 ↵」，直接进结算页而不重复同一条；结算页主按钮「再练 5 条同类」、次按钮「随机 5 条」，点同类后范围标签为「同类 5 条 · 习语俗语」且题量为 5，点随机后为「随机 5 条」5 题。
- 词库工具栏：只剩搜索/难度/排序，无页面级清空按钮；搜不到结果时才有空状态「清空筛选」链接。

### 遗忘曲线复核（2026-11-20，preview :4180 实测）

- 首页：首屏「其余按艾宾浩斯遗忘曲线安排下次见面」、演示区「遗忘曲线管下次什么时候再见」与「记忆稳定 · 4 天 / 下次见面 · 4 天后」、三步循环第 03 步、特色卡第 03 张均含遗忘曲线表述。
- 旧数据迁移：把 `phraselabs:v1:progress` 写成旧版 `{ box: 5 }` 后刷新，词库中该条显示「已掌握」（换算为 15 天稳定度），无报错。
- 答错：新词答错后稳定度落到 0.5 天，统计页薄弱列表显示「记忆稳定 0.5 天」。
- console 无报错。
- 首页专题：三步循环之后新增「Memory model / 遗忘曲线」区块，含衰减示意图（金色复习日圆点 + 90% 虚线）、图例与 4 格数字（90% / ×1.9 / 15 天 / ×0.4）；窄屏 636px 下变单列、无横向滚动。

### 高频错词本复核（2026-11-20，preview :4180 实测）

- 构造数据「daily-001 错 3 次、daily-003 错 2 次、daily-002 错 1 次」后刷新：统计页「高频错词」卡只显示 2 条（错 1 次的 daily-002 不入榜），daily-001 排第一；每条带「错 N / 对 M」与「记忆稳定 X 天」两个徽标；按钮文案随条数变化（「练这 2 条」）。
- 点「练这 N 条」：跳 `/study`，本轮范围为「错词本 · 2 条」，队列只含这两个 ID；仅影响本轮，不改每日目标与分类设置。
- 词库状态筛选新增「错词」，结果与榜单同源；与「只看收藏」同时只能选一个（单选 chip 组）。
- 稳定度到达 15 天（掌握线）的短语自动淡出错词榜，不需要手动删除。
- console 无报错。

### 移动端输入与判定抽检（2026-11-20）

**移动端（375 × 667 模拟环境 + 手动模拟矮视口）**

- 输入框属性实测：`inputmode=text`、`enterkeyhint=go`、`autocapitalize=off`、`autocorrect=off`、`spellcheck=false`；聚焦后 `scrollY` 保持 0，桌面端不会因避让逻辑跳动。
- 无横向滚动（`scrollWidth == innerWidth`），学习卡与输入框均无溢出，console 无报错。
- `@media (max-height: 520px)` 生效：`.study-card` padding 变 `16px 20px 12px`、`.prompt` 字号 `26px`（软键盘弹出/横屏矮视口下让题干和输入框同屏）。
- 未做：`viewport-fit=cover` 与 `env(safe-area-inset-*)`。当前 viewport 声明不含 `cover`，页面也没有固定底栏，加了也是 0 值空声明；等真机上确实有遮挡再加。
- 真机（iOS Safari / Android Chrome）未实测：软键盘弹出时的实际滚动行为需真机确认，逻辑上只在 `visualViewport.height < innerHeight × 0.8` 时触发。

**判定抽检（固定种子抽 20 条 / 60 个候选表达）**

- 首轮命中 39/60，未命中 21 个，逐条判后被认定为缺别名的 15 个已补（涉及 11 条短语，共 +17 个别名）：`connectors-006`（总而言之/综上）、`connectors-043`（总结一下）、`polysemy-069`（开一家公司/经营企业/经营一家企业）、`polysemy-025`（棕色的熊）、`polysemy-082`（正好八点）、`emotions-019`（羞耻）、`idioms-019`（祸中有福）、`idioms-070`（稳妥为好/小心驶得万年船）、`idioms-156`（人越多越好/人多热闹）、`phrasal-036`（造成）、`daily-119`（就是这样/拿去吧）。
- 剩余 5 个候选经判定为**不应接受**，不补别名：`famous last words` 的「话说太满」、`to sum up` 的「总的来说」（归 `all in all`）、`good night` 的「早点休息」「晚上安」、`I can’t put my finger on it` 的「摸不着头脑」（更像「一头雾水」）。
- 补完后同批候选未命中降至 5/60，均为上述不该接受的表达。下一轮若仍 0 缺陷，按 ROADMAP 改为季度抽检。

### 线上可用性核查（2026-11-20，线上 https://minosie.github.io/PhraseLabs/ 实测）

- 首页 `200`（约 3.0s），`llms.txt` `200`；静态 HTML 已含新构建特征（`viewBox="0 0 490 128"`、曲线路径 `M 20.0 44.0 C …`、两处「下次什么时候再见」），说明 `a4818c7` 已完成 Pages 发布。
- 分类页 `/phrases/daily.html` `200`，预渲染正文可直出。
- 应用内路由 `/stats`、`/study` 直接访问时 HTTP 状态为 `404`：由 `dist/404.html` 兼底，客户端路由渲染后页面可正常使用。这是「应用界面不预渲染」决定的既有行为，不是本次回归；若要改成 200，只能把这些页加入 `ssgOptions.includedRoutes`（会把训练/统计页暴露给搜索引擎，与现有 robots 策略冲突）。
- 首页已包含百度统计 `hm.baidu.com` 脚本 1 处，隐私说明与 README 已同步。
- 早前「打不开」未复现；排查路径：Actions 构建状态 → 首页 HTTP 码 → 静态 HTML 是否含新构建特征。

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
