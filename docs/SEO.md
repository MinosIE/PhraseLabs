# SEO / GEO 与 SSG 方案

> 状态：P0–P3 已落地（2026-11-20），P4 未开始。实施结果见第 4 节 ✅ 与第 5 节实测。
> 适用部署：GitHub Pages 项目站点，默认基址 `https://minosie.github.io/PhraseLabs/`（以仓库 Settings → Pages 为准，若绑定自定义域名需同步改 `src/lib/seo.ts` 的 `SITE_URL`）。
> 关联文档：[ARCHITECTURE.md](./ARCHITECTURE.md)（分层与部署）、[PRODUCT.md](./PRODUCT.md)（内容体系）。

## 1. 目标

1. **可索引**：搜索引擎不执行 JS 也能拿到正文与独立 URL；可索引 URL 从实施前的 1 个提升到 13 个。
2. **可引用**：生成式引擎（ChatGPT / Claude / Perplexity / 豆包等）能低成本抓取、理解并引用站点的短语与规则。
3. **不牺牲体验**：保持纯前端、无后端、离线可用、秒级构建；不引入第二套框架。

非目标：不做服务端渲染常驻服务；不做登录与个性化 SEO；不做全量 703 条详情页（见 P4 的薄内容约束）。

## 2. 实施前体检（2026-11-19，4 项已全部修复）

| 问题 | 位置 | 影响 |
| --- | --- | --- |
| 全站仅一份 HTML，正文由 JS 渲染 | `index.html` 只有 `<div id="app">` | 不执行 JS 的爬虫看到空页；AI 抓取器多数只取原始 HTML |
| hash 路由 | `src/router/index.ts` 使用 `createWebHashHistory` | `#/library` 等共享同一 URL 与同一份 title/description，5 个页面只产出 1 个可索引地址 |
| 元信息单薄 | `index.html` 仅有 title + description | 无 canonical / OG / Twitter / JSON-LD / robots.txt / sitemap / llms.txt；分享无卡片 |
| 路由标题仅在客户端设置 | `router.afterEach` 里写 `document.title` | 爬虫拿到的是静态标题，所有 URL 标题相同 |

以上四类问题已由 P0–P2 修完：元信息交给 `src/App.vue` 的 `useHead` 按路由输出、路由改 history + 预渲染、新增 11 个分类落地页与 `robots.txt` / `sitemap.xml` / `llms.txt`。

已有的有利条件（实施时不要破坏）：

- `lang="zh-CN"` 正确；`public/.nojekyll` 已存在。
- `src/lib/storage.ts` 对 `localStorage` / `sessionStorage` 全部做了 `typeof` 守卫，SSR 安全。
- 除 `App.vue` 外，`window` / `document` 访问均在事件处理或 `onMounted` 内（`StudyView` 的 `setBackgroundInert` 由非 immediate 的 `watch` 触发，SSR 不会执行）。
- 内容是静态 TS 数据，可零成本参与构建期渲染。

## 3. 信息架构与索引策略

| 路由 | 页面 | 处理 | `robots` |
| --- | --- | --- | --- |
| `/` | 首页：定位、模式与分类入口 | 预渲染 | index, follow |
| `/library` | 词库（筛选 + 搜索） | 预渲染 | index, follow |
| `/phrases/:category` | 分类落地页（11 个，一条动态路由） | 预渲染 | index, follow |
| `/study` | 答题界面 | 不预渲染，404.html + 客户端路由兜底 | noindex, follow |
| `/stats` | 个人统计（依赖本地数据） | 不预渲染，同上 | noindex, nofollow |
| `/settings` | 设置 | 不预渲染，同上 | noindex, nofollow |

要点：

- 应用界面（学习/统计/设置）不参与收录，也不预渲染：它们渲染依赖 localStorage，预渲染只能得到空壳；直链会落到 `404.html`，客户端路由接管后正常显示，状态码 404 对个人页面没有 SEO 影响。
- 分类落地页是 SEO 主力：标题、条数、难度分布、全部条目的 `en` / `zh` / 例句（703 条文本一次进入静态 HTML），且与训练界面共用同一份数据源，不额外维护。
- 分类落地页的「练这一类」按钮先 `sessionStore.start({ categories: [id] })` 再跳 `/study`，不改设置里的长期分类，也不影响预渲染。

## 4. 分阶段任务

### P0 · 元信息地基 ✅ 已完成

- `index.html`：保留 `<div id="app"></div>`；favicon 改绝对路径 `/favicon.svg`（修复嵌套路径 404）；加入首屏主题内联脚本（读 `phraselabs:v1:settings` 的 `theme` + `matchMedia` 写 `data-theme`，避免深色模式闪白）；删除静态 title/description，交给 `useHead` 按页输出。
- 元信息由 `src/App.vue` 的 `useHead` 在构建期落到每个预渲染页：`title`、`description`、`robots`、`canonical`、`og:*`、`twitter:*`、`htmlAttrs.lang`，以及 `WebSite` + `Organization` + `WebApplication`（`offers.price: 0`）的 JSON-LD `@graph`。
- 站点常量集中在 `src/lib/seo.ts`：`SITE_NAME`、`SITE_URL`、`OG_IMAGE`、`canonicalUrl()`、`legacyHashTarget()`；`scripts/postbuild.mjs` 也从这里读 `SITE_URL`。
- `public/robots.txt`：全站允许 + 显式允许 `GPTBot` / `ClaudeBot` / `PerplexityBot` / `Google-Extended` / `Bytespider`，带 `Sitemap` 绝对地址。
- `public/og.png`：1792×1024 分享图。

### P1 · 路由可索引 ✅ 已完成

- `src/router/index.ts` 只导出 `routes` 路由表与 `RouteMeta` 增强（`title` / `robots`）；**禁止在本文件 `createRouter`**：构建期没有 `window`，vue-router 的 web history 会直接崩。history 由 vite-ssg 注入（构建期 memory、运行期 web）。
- 新增 `/phrases/:category` 一条动态路由承载全部分类落地页，避免 11 条重复路由；通配路由重定向首页。
- 标题不再由 `afterEach` 写 `document.title`，改由 `App.vue` 的 `useHead` 输出，构建期即为静态 HTML。
- 旧链兼容：`src/main.ts` 在挂载前用 `legacyHashTarget(window.location.href)` 映射并 `history.replaceState`，不刷新页面（`#/library?q=a` → `/library?q=a`）。
- 深链兜底：`scripts/postbuild.mjs` 复制 `dist/index.html` → `dist/404.html`。
- `scrollBehavior: () => ({ top: 0 })` 放入 `main.ts` 传给 vite-ssg 的路由选项；`base` 用 `import.meta.env.BASE_URL`。

### P2 · SSG 预渲染 ✅ 已完成

选型结论：用 `vite-ssg@^28.3.0`，不换框架。peer 为 `vite ^8.0.0-0`、`vue-router ^5.0.0-0`、`vue ^3.2.10`，与现有栈匹配；`@unhead/vue` 锁定 `^2.1.17` 与 vite-ssg 共用同一实例（装 3.x 会出现两套 head）。

| 文件 | 实际改动 |
| --- | --- |
| `src/main.ts` | `export const createApp = ViteSSG(App, { routes, base, scrollBehavior }, ({ app }) => { app.use(createPinia()) })` |
| `src/router/index.ts` | 只导出 `routes`；无 history、无 `document` 访问 |
| `src/App.vue` | `matchMedia` 移入 `onMounted`，`applyTheme` 加 `typeof document` 守卫，首屏主题由 `index.html` 内联脚本兑现 |
| `vite.config.ts` | `ssgOptions`：`dirStyle: 'flat'` + `includedRoutes`（`/`、`/library` + 11 个 `/phrases/<id>`，分类 id 由 `src/data/categories.ts` 正则读取）|
| `src/views/CategoryView.vue` | 新增分类落地页：面包屑、条数、难度区间、分类互链、全部词条与「练这一类」 |
| `package.json` | `"build": "vue-tsc -b && vite-ssg build && node scripts/postbuild.mjs"` |
| `scripts/postbuild.mjs` | 新增（见下）|

- `dirStyle: 'flat'` → `/phrases/daily` 产出 `dist/phrases/daily.html`，GitHub Pages 原生支持无扩展名访问，canonical 无需尾斜杠。
- `scripts/postbuild.mjs` 负责四件事：
  1. 复制 `dist/index.html` → `dist/404.html`
  2. 生成 `dist/sitemap.xml`（`/` + `/library` + 11 个分类，带 `lastmod` / `changefreq` / `priority`）
  3. 生成 `dist/llms.txt`（站点事实、主要页面、分类链接与条数、索引说明）
  4. 校验预渲染产物、`robots.txt`、`sitemap.xml`、`llms.txt` 齐全，任一项缺失即非零退出
- 需要保持 SSR 安全的既有代码，不要在新代码里破坏：
  - `lib/storage.ts` 的 `typeof` 守卫
  - 语音相关只经 `lib/speech.ts`，且 `detectVoices()` 仅在 `onMounted`
  - GSAP 只在 `AnswerFeedback` 的交互回调里调用
- 客户端默认不开启 hydration：各 store 初始状态依赖 localStorage，强行 hydration 会出现不一致；vite-ssg 默认行为（客户端重新渲染）足够。

### P3 · GEO 强化 ✅ 已完成（2026-11-20）

1. **分类文案**：`src/data/categoryContent.ts` 为 11 个分类各写一段唯一介绍（≥ 80 字）加一句典型场景，回答「这类表达是什么 / 什么场景用 / 难点在哪」；类型是 `Record<CategoryId, CategoryContent>`，漏一类就编译失败。
2. **FAQ**：每类 3 条，写在同一个文件里，同时用于页面展示与 `FAQPage`；问答都有最小长度断言，避免空壳。
3. **结构化数据**（`App.vue` 的 `buildStructuredData()` 按页输出）：
   - 分类页：`BreadcrumbList` + `CollectionPage`（`numberOfItems` 取实时条数）+ `DefinedTermSet`（前 12 条 `DefinedTerm`）+ `FAQPage`
   - 首页与其余页：只有 `WebSite` / `Organization` / `WebApplication`
4. **可选事实**：条数不在文案里写死，分类页由数据实时渲染，避免扩充后文案过期。
5. **`llms.txt` 分节**：主要页面 / 分类清单（带 URL 与条数）/ 判定与复习规则 / 数据与隐私 / 说明，均由 `scripts/postbuild.mjs` 在构建期生成。
6. **内链**：分类页之间、分类页 ↔ 词库、首页 ↔ 分类页全部用 `RouterLink` 渲染成真实 `<a href>`，锚文本写分类名。
7. **轻量入口**：首页「今日一句」（`lib/daily.ts` 按日期哈希，同日稳定）+ 分类页「5 条快练」（`sessionStore.startWith` 5 条，约 30 秒）。两者都只影响本轮队列，不改设置。

> 待上线后验证：Google Rich Results Test 能识别 `FAQPage` 与 `BreadcrumbList`（本地已用 JSON 解析核验结构与字段）。

### P4 · 可选：短语详情页

- 只做搜索需求明确的前 100 条（`/phrase/:id`），页面需包含：短语、释义、2 条例句、常见错误、同类短语 3 条内链。
- 全量 703 页先不做：例句结构相近，容易构成薄内容，反而拉低整站质量评估。
- 前置条件：P2 上线并观察 4–6 周的收录与点击数据。

## 5. 验收结果（2026-11-20 实测）

- [x] `pnpm build` 通过：预渲染 13 个页面（首页 + 词库 + 11 分类），`[postbuild]` 报告「11 个分类 / 703 条短语」
- [x] `dist/index.html` 内含首页正文与 `703`、`11 个分类` 文案；`<title>英语短语键盘训练 · PhraseLabs</title>` 与 canonical 均为静态输出
- [x] `dist/phrases/daily.html`（79.9 KiB）含 148 条词条与专属介绍；`dist/phrases/idioms.html` 含 `so-so`
- [x] 分类页预渲染 HTML 内含「这一类怎么练」「什么时候会用到」「常见问题」「5 条快练」四处入口
- [x] 分类页 `ld+json` 解析通过：`WebSite, Organization, WebApplication, BreadcrumbList, CollectionPage, FAQPage`；`numberOfItems` 为 148（daily），`FAQPage` 为 3 问
- [x] 首页 `ld+json` 只有 `WebSite, Organization, WebApplication`，且 HTML 含「今日一句」区块
- [x] `dist/404.html`、`dist/sitemap.xml`（13 条 URL）、`dist/llms.txt`（含判定规则与数据隐私分节）、`dist/robots.txt`、`dist/og.png` 均存在
- [x] 旧链接 `#/library` 会被 `legacyHashTarget` 改写成 `/library`（单测覆盖）
- [x] 路由 robots 策略有单测：`/`、`/library`、`/phrases/:category` 为 `index, follow`；`/study` 为 `noindex, follow`；`/stats`、`/settings` 为 `noindex, nofollow`
- [x] 关闭 JS 打开 `/phrases/daily` 能看到标题、条数与词条列表（预渲染 HTML 即正文）
- [x] 分类文案、FAQ 与今日一句有单测：11 类齐全且文案不重复、每类 3 条 FAQ、`hashDay` 锁定固定值、同日稳定跨天轮换
- [x] `pnpm test`（40 项）/ `pnpm typecheck` / `pnpm build` 全绿
- [ ] Lighthouse SEO ≥ 95：需线上环境实测
- [ ] 搜索引擎收录与 AI 引回：上线后 2–4 周观察 Search Console / Bing Webmaster

> 注：应用界面（`/study`、`/stats`、`/settings`）不预渲染，直链返回 `404.html` 的 404 状态码，天然不被收录；客户端 `useHead` 仍会补上对应 `robots` 值。

## 6. 风险与回滚

| 风险 | 应对 |
| --- | --- |
| 路由从 hash 改 history，旧书签/已收录链接失效 | P1 的启动重定向；发布后抽测 `#/library`、`#/study`、带查询串的旧链接 |
| SSG 期 `window` / `document` 报错 | 已踩：`src/router/index.ts` 里 `createRouter(createWebHistory())` 会在构建期直接崩；已改为只导出路由表，history 由 vite-ssg 注入 |
| GitHub Pages 子路径导致资源 404 | 全程使用 `import.meta.env.BASE_URL`；CI 的 `VITE_BASE_PATH` 不变 |
| 分类页与词库页内容重复被判近似 | 分类页有独立介绍与 FAQ，词库页保持工具属性并 `canonical` 指向自身；不做跨页复制整段文案 |
| 百度对 `github.io` 抓取不稳定 | 先保证 Google/Bing；若重视中文搜索，评估绑定自定义域名或迁 Cloudflare Pages |
| 构建链变化影响 CI | `deploy.yml` 不改，仍只跑 `pnpm build`；构建失败时 postbuild 会非零退出，门禁照旧 |

回滚方式：P0–P2 每阶段单独提交，出问题按阶段 revert；hash 路由的重定向代码可独立保留，不阻碍回滚。

## 7. 工作量与顺序

| 阶段 | 预估 | 依赖 | 产出 | 状态 |
| --- | --- | --- | --- | --- |
| P0 | 1h | 无 | 元信息、robots、OG 图、JSON-LD | 已完成 |
| P1 | 1.5h | P0 | history 路由、旧链重定向、404 兜底 | 已完成 |
| P2 | 3h | P1 | 预渲染首页 / 词库 / 11 分类页，构建期 sitemap 与 llms.txt | 已完成 |
| P3 | 2h | P2 | 分类文案、FAQ、按页 JSON-LD、内链、今日一句与 5 条快练 | 已完成 |
| P4 | 3h+ | P2 数据观察 | 前 100 条详情页 | 未开始 |

建议节奏：P0–P3 已一次做完；P4 看上线 4–6 周的收录与点击数据再定。
