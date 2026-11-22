# QA 验证记录

## 2026-11-22 · F1/F2 训练强度与切页反馈（roadmap F1/F2）

### 自动化

- `pnpm test`：**68/68**（63 → 68：新增三档混合比例与槽位、回炉上限与截断、旧设置回退、反馈副文案）。回炉上限由单测直接覆盖：`requeueCurrent()` 连续调用返回 `true, true, true, false, false`，`pendingRepeats` 停在 3；「本轮重练已满」文案由 `feedbackSubline` 断言。
- `pnpm check:content`：11 类 / 819 条通过；软指标 L1 24% / L2 38% / L3 27% / L4 10% / L5 2%，`tip` 7%。
- `pnpm typecheck` / `pnpm build` 通过，`[postbuild]` 报告「11 个分类 / 819 条短语」，预渲染 13 页。

### 首屏体积（gzip，静态 import 图实测）

| 阶段 | 首屏静态 JS | 变化 |
| --- | --- | --- |
| E2 完成 | 74.2 KiB | — |
| F2 完成 | **75.2 KiB** | +1.0 KiB（+1.3%） |

chunk 明细：`app` 53.46 + `HomeView` 7.62 + `progress` 7.24 + `daily` 6.84。增量来自 `useRouteProgress` / `useRoutePrefetch` 进入 app chunk；gsap 仍在首帧后按需加载，全量基座与 `details` 都不在首屏。

### 难度档位（浏览器实测，preview :4193）

- 设置页「训练强度」三档可切：轻松 → 挑战 → 刷新 → 切回轻松，选择持久化（`phraselabs:v1:settings` 的 `difficulty`）。
- 轻松档连错两题：提示框自动展开并标注「连错两题，已自动展开」，页脚出现「连错缓冲中」，题头提示按钮显示为「已显示提示」；答对一题后自动收起。
- 全程 console 0 报错。

### 切页反馈（preview :4195，JS 延迟 600ms 的本地代理）

- 点未预取的「统计」：`.route-progress` 在 **146ms** 出现，`main[aria-busy="true"]`，626ms 后消失；`StatsView` chunk `duration ≈ 604ms`，证明确实走的是慢网。
- 悬停「词库」后再点：`LibraryView-*.js` 已由预取命中（`performance.getEntriesByType('resource')` 可见），切页几乎瞬时，进度条按设计不出现。
- 空闲预热：首页停留约 1.5s 后 `StudyView` chunk 已在资源列表中；`prefers-reduced-motion` 下进度条为静态填充（CSS 规则）；console 全程 0 报错。

### 验证注意事项

- 同一 origin 重复访问会命中 HTTP 缓存（或被预取），懒加载 <120ms，进度条按设计不出现——不是缺陷。复现慢网要用**新端口（新 origin）** + 延迟返回 JS 的本地代理，别在旧缓存页面上判断。
- 首屏 75.2 KiB 是静态 import 图的 gzip 合计，不等于线上传输（还有 HTML/CSS）。
- 窄屏与深色主题本轮只做抽查，未重跑全量截图（布局改动仅顶部进度条与连错提示框）。

## 2026-11-22 · E2 首页去语料（roadmap E2）

### 自动化

- `pnpm check:content`：11 类 / 819 条通过；`validateSummary` 覆盖总量、分类计数、分类示例短语、标签计数、装饰短语与语料一致；摘要过期会提示「跑 pnpm gen:summary」。
- `pnpm test`：**63/63**（新增「首页摘要与语料一致」扩展了分类示例）；`pnpm typecheck` / `pnpm build` 通过，`[postbuild]` 报告「11 个分类 / 819 条短语」。

### 首屏体积（gzip，静态 import 图实测）

| 阶段 | 首屏静态 JS | 变化 |
| --- | --- | --- |
| D3 完成 | 130.1 KiB | — |
| E1 完成 | 112.8 KiB | −13.3% |
| E2 完成 | **74.2 KiB** | **−38.6 KiB（−34.2%）** |

chunk 明细：`app` 53.8 + `HomeView` 7.8 + `progress` 7.4 + `daily` 7.0。全量基座 `phrases` 28.7 与全量 `details` 30.9 都不在首屏；`app` chunk 中语料 id 出现次数为 0（「book a table」等字符串只来自摘要里的分类示例与短语带）。

> 未达到开盘时估的 ~65 KiB：`app` 剩下的 53.8 KiB 主要是 Vue / Router / Pinia / unhead 与 store 的框架成本；首页保留 `daily` 基座 7.0（今日一句 + 演示区）与 `progress`（掌握度 / 到期计数）。

### 预渲染产物

- 13 个页面正常生成；`dist/phrases/academic.html` 标题「学术写作英语短语 · 60 条」，meta 描述含「in light of、contribute to、account for」。
- 分类页含 2 段 `application/ld+json`：站点级（`WebSite/Organization/WebApplication`）与页面级（`BreadcrumbList/CollectionPage/FAQPage`）；首页只有站点级 1 段。

### 浏览器实测（preview :4192）

- 首页 console 0 报错。点「练这一条」（今日一句 `not gonna lie`）→ `/study`，URL 无 query，首题正是该短语；点「开始今日训练」→ `/study` 正常出题。
- 点「5 条快练」→ `/study`，轮次标签「5 条快练」、SESSION 01/05；点主题「口语」→「主题 · 口语 · 20 条」；两处 URL 均无 query。
- 在 `/study` 刷新：按草稿恢复同一轮，无报错。
- 写入一条到期进度（`phraselabs:v1:progress`，`daily-001` 的 `nextReview` 在过去）后刷新首页，出现「待复习 1 条」入口；点击后进 `/study`、轮次标签「到期复习」、URL 无 query；清除进度后首页恢复正常。
- `/phrases/academic`：60 条，可见 `in light of`；全程 console 错误 0。

### 未验证 / 边界

- 同上：74.2 KiB 是静态 import 图的 gzip 合计，不等于线上传输（还有 HTML/CSS）。
- 窄屏与深色主题本轮未重跑截图（布局未改，仅数据来源与导航方式变化）。

## 2026-11-22 · E1 首屏数据二次拆分（roadmap E1）

### 自动化

- 数据迁移：819 条从旧语料按字段重排为「基座 + details」，脚本逐条比对 `id/en/zh/aliases/enAliases/tags/level/exampleEn/exampleZh/tip` 全部一致，且无孤儿 detail；脚本用后已删。
- `pnpm check:content`：11 类 / 819 条通过；新增两类硬校验（每条都有 detail、无孤儿 detail），原「例句可挖空」改从 detail 读；软指标回到 L1 24% / L2 38% / L3 27% / L4 10% / L5 2%，例句均 7.9 词，`tip` 7%。
- `pnpm test`：**62/62**（新增「基座与详情一一对应」）；`pnpm typecheck` / `pnpm build` 通过，`[postbuild]` 报告「11 个分类 / 819 条短语」。

### 首屏体积（gzip，静态 import 图实测）

| 阶段 | 首屏静态 JS | 变化 |
| --- | --- | --- |
| D3 完成 | 130.1 KiB | — |
| E1 完成 | **112.8 KiB** | **−17.3 KiB（−13.3%）** |

chunk 明细：`app` 30.9 + 共享（settings 视图/基座语料/store）66.8 + `HomeView` 8.0 + `details/daily` 7.0 + `session` 1.8 + `progress` 1.0。全量 `details` 30.9 KiB 不在首屏。

> 为什么不是预估的 −35%：例句按字符占 49.3%，但自然语言 gzip 压缩率低，实测只占原语料体积 33%；另外首页经 `stores/session.ts` 仍持有全量基座语料。详见 `docs/ROADMAP.md` E1 落地记录。

### 预渲染产物

`dist/` 13 个页面逐页统计 `phrase-example` 节点：首页 1、词库 60（首批）、11 个分类页分别为 60/54/44/148/44/174/77/84/44/44/46，与各分类条数一致。

### 浏览器实测（preview :4191）

- `/`：今日一句 `not gonna lie` 的例句「Not gonna lie, that movie scared me. — 说实话，那部电影把我吓到了。」正常；演示区例句 `I'm a little bit tired today.` 正常。
- `/study`（zh-en）：提示区中文例句正常；切到「例句填空」模式后句子为 `After that hike, ______.`，挖空与中文提示正常。
- `/library`：第一条 `catch up with` 的例句 `/ 中文` 正常。
- `/phrases/academic`：60 条，第一条 `in light of` 的例句正常。
- Console 错误 0、未捕获异常 0、hydration mismatch 警告 0。

### 未验证 / 边界

- 未升级为真实移动端大包体测量；112.8 KiB 是静态 import 图的 gzip 合计，不等于线上实际传输（还有 HTML 与 CSS）。
- 今日一句池子从全库改为日常口语 148 条，属于产品取舍，已在 `docs/PRODUCT.md` 与 ROADMAP 记录；用户侧可见变化是轮换范围变窄。

## 2026-11-21 · D4 内容补齐第 1 轮（roadmap D4）

### 自动化

- `pnpm check:content`：11 类 / 819 条通过（`id`/`en` 唯一、别名 ≥2 汉字、`exampleEn` 可挖空、README 与 PRODUCT 条数一致）。
- 软指标：L1 24% / L2 38% / L3 27% / L4 10% / **L5 2%**；`tip` 覆盖率 3% → 7%。
- `pnpm test`：61/61 通过；`pnpm typecheck` / `pnpm build`：通过，预渲染 13 页，`postbuild` 报告「11 个分类 / 819 条短语」。

### 新增内容

| 分类 | 新增 | 编号 | 备注 |
| --- | --- | --- | --- |
| 学术写作 | 12 | `academic-051`–`062` | 7 条 L5（如 `on the grounds that`、`call into question`、`lend itself to`） |
| 商务邮件 | 10 | `business-049`–`058` | 5 条 L5（如 `in due course`、`subject to approval`、`at the discretion of`） |
| 习语俗语 | 8 | `idioms-168`–`175` | 2 条 L5（`read between the lines`、`draw a distinction`） |

30 条全部带 `tip`；`lend itself to` 补 `enAliases` 覆盖 `lends itself to` / `lend themselves to`（例句用复数）。

### 浏览器实测（preview :4189）

- `/phrases/academic`：页头 60 条，`on the grounds that` / `call into question` / `in the interim` 三条的中文、例句、难度 5 与标签均正常渲染。
- `/library`：搜索 `in due course` 命中 1 条（商务邮件 / 难度 5 / 邮件+正式）；点「正式 · 120」筛出 120 条，列表可见 `subject to approval`、`in the wake of`。
- `/`：站点数据条 819、学术写作 60、商务邮件 54，「按主题练一轮」出现「正式 · 120」。
- console 0 报错。

### 未验证 / 边界

- 未做真人判定抽检（新条目均为长短语与正式搭配，中文侧以 `aliases` 覆盖常见说法；若后续 B3 抽检命中再补别名）。
- `tip` 只写作一条可操作提醒，未接入判题；`check:content` 仍只输出软指标，不阻断。

## 2026-11-21 · D3 首屏瘦身（roadmap D3）

### 自动化

- `pnpm test`：61/61 通过；`pnpm typecheck` / `pnpm build`：通过，13 页预渲染 + postbuild + PWA 门禁（`precache 38 entries`）。

### 体积实测（gzip，`vite preview` 产物）

| 文件 | raw | gzip |
| --- | --- | --- |
| `app-*.js` | 72759 | 30380 |
| `settings-*.js`（全量语料 + 共享代码） | 290275 | 92291 |
| `HomeView-*.js` | 19458 | 7783 |
| `session-*.js` | 4154 | 1802 |
| `progress-*.js` | 2146 | 1005 |
| `gsap-*.js`（已移出关键路径） | 70564 | 27398 |
| `ScrollTrigger-*.js`（本来就是动态） | 42839 | 17438 |

- 首页首屏静态 JS：**156.9 KiB → 130.1 KiB gz（−26.8 KiB，−17.4%）**；`HomeView` chunk 头部不再有 `from"./gsap-*.js"`。

### 浏览器实测（preview :4187）

- console 0 报错；`gsap-C_a4uAT2.js` 与 `ScrollTrigger-Dg2oAicK.js` 在首帧之后才请求，`window.gsapVersions` = 3.15.1。
- 首屏截图无闪烁、无布局跳动；`reveal-item` 动画结束后 `transform: none`（`clearProps` 生效）；滚动到页面底部内容完整。

### 未验证 / 未做

- 语料拆包（评估后判定收益 < 复杂度，理由见 `ROADMAP` D3「不做」）；CSS 侧（字体、`scroll-behavior`）本轮未测。
- 未验证：真机弱网下的 `requestIdleCallback` 调度表现（timeout 1500ms 兜底）。

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
