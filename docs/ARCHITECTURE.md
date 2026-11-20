# 架构与数据契约

## 分层

```text
views/        页面与交互（Home / Study / Library / Category / Stats / Settings）
components/   可复用交互（AnswerInput / AnswerFeedback / SelectField）
composables/  Vue 组合式工具（useDebounce）
router/       路由表与 RouteMeta 契约（不创建 router 实例）
stores/       Pinia：settings / progress / session
lib/          纯函数：grade / srs / session / storage / normalize / date / speech / feedback / seo / daily
data/         静态短语内容 + 分类文案（categoryContent.ts）
types/        数据契约
scripts/      构建后处理（postbuild.mjs）
```

依赖方向是单向的：页面 → store → lib → types/data。`lib` 不依赖 Vue，便于单元测试；内容打包进 bundle，不依赖运行时网络请求。

## 关键数据契约

```ts
interface Phrase {
  id: string
  en: string
  zh: string
  aliases: string[]       // 中文判定关键词
  enAliases?: string[]    // 英文时态/拼写变体
  category: CategoryId
  tags: string[]
  level: 1 | 2 | 3 | 4 | 5
  exampleEn: string
  exampleZh: string
  tip?: string
}

interface PhraseProgress {
  stability: number      // 记忆稳定度（天）：到期时保留率降到 90%
  correct: number
  wrong: number
  lastReviewed: number    // 毫秒时间戳
  nextReview: number
}

interface Settings {
  dailyGoal: number
  mode: StudyMode | 'mixed'
  categories: CategoryId[] // 空数组代表全部
  strictness: 'strict' | 'normal' | 'lenient'
  theme: 'system' | 'light' | 'dark'
  voiceURI: string         // 空字符串代表自动挑选音色
  favorites: string[]
}

interface AppData {        // 导出/导入格式
  version: 1
  exportedAt: string
  progress: Record<string, PhraseProgress>
  settings: Settings
  stats: Record<string, { reviewed: number; correct: number; learned: number }>
  bestCombo?: { combo: number; day: string }  // 可选：旧备份没有这个字段
}
```

## localStorage

统一前缀 `phraselabs:v1:`：

| 键 | 内容 |
| --- | --- |
| `phraselabs:v1:progress` | 短语 ID 到记忆状态的映射 |
| `phraselabs:v1:settings` | 用户设置与收藏 |
| `phraselabs:v1:stats` | 按 `YYYY-MM-DD`（本地时区）的每日统计 |
| `phraselabs:v1:best-combo` | 历史最高连对 `{ combo, day }`，只增不减 |

写入由 store 的 `watch(..., { deep: true })` 自动触发；读取失败会回退默认值，写入失败（隐私模式/容量不足）静默降级为内存态。进度记录在读取与导入时统一过 `normalizeProgress`：缺 `stability` 的旧数据按 Leitner 盒子（1/1/2/4/7/15 天）换算，缺失或非数字字段归一。未来升级不兼容格式时，提升前缀版本号并增加迁移函数。

本轮训练快照单独放 sessionStorage（同样前缀 `phraselabs:v1:session`）：只存当天有效的队列、当前位置、连对与逐题结果，刷新页面可继续，关掉标签页或跨天自动失效，不占长期容量。`session` store 创建时会尝试 `restore()`，失败则新建队列。

## 一次答题的数据流

1. `session` store 用当前设置和进度生成队列，记录当前短语与题型；队列可以带一次性范围（临时分类、临时模式、词库指定的短语集合），不写回设置。
2. 用户提交后 `lib/grade` 归一化输入并返回 `correct | near | wrong`；空输入在组件层就被拦下，不进入判定。
3. `progress` store 调用 `applyReview` 更新记忆状态，并把结果累加到当日统计。
4. `session` store 记录本轮正确数、连对与最佳连对，用户确认后推进到下一题；答错或接近会把当前题追加到队尾重练，计划题数（`plannedTotal`）保持不变，因此进度条分母不增长。
5. 页面展示答案、例句和用法提示；弹框内可直接朗读正确答案，提示按钮和 `⌥H` 调用 store 的 `noteHint` 记录使用次数，不影响判定。
6. 「这条我会了」调用 `progress.markMastered()`（`srs.masterProgress` 把稳定度抬到 15 天并推后排期）与 `session.dropRepeat()`（只撤回队尾重练）；答案、正确率、连对与当日统计一律不改。
7. 答完最后一题进入结算页：`session.record()` 每答对一题就把连对交给 `progress.noteCombo()`，结算前 `session.syncBestCombo()` 再补记一次（刷新恢复的已完成草稿也能写入历史记录）；`masteredGained` = 当前已掌握数 − `masteredAtStart`，`dueTomorrow` 用 `srs.countDueBefore(progress, 今天 23:59:59.999 + 1 天)` 计算，即明天结束前会到期的条数。
8. 「再来一轮」调用 `session.start(session.lastOptions)` 沿用本轮临时范围；`lastOptions` 只存内存，刷新后回退到设置里的长期范围。

## 视觉与交互原则

- 暖纸底色 + 墨色文字 + 陶土橙强调色，深浅色主题共用同一套语义变量；不使用紫色渐变。
- 排版层级靠字号、字重、字距和衬线/等宽字体区分，而不是靠更多卡片和圆角。
- 反馈同时用文字、图标与颜色表达，按钮/输入有明确焦点态；动效仅在 `prefers-reduced-motion` 未开启时播放。
- `AnswerFeedback` 用 GSAP 做图标弹出、标题入场、庆祝粒子与连对里程碑；通过 `gsap.context()` 在卸载时统一清理，避免动画残留。
- `HomeView` 的宣传动效走 `gsap.matchMedia()`：桌面做滚动视差、移动端只做入场位移、`prefers-reduced-motion` 直接到位；ScrollTrigger 只在 `onMounted` 内动态导入并注册（构建期 Node 无 `window`），卸载时 `mm.revert()`。首屏入场不设 `autoAlpha`，保证预渲染内容始终可见。
- 词库搜索使用 `useDebounce` 延迟筛选，避免每次按键都遍历全库；搜索范围包含英文、中文、别名与标签。
- 词库列表按 60 条一批渲染，底部 sentinel 进入视口后自动加载下一批，789 条不会一次性进入 DOM；筛选条件变化时回到第一批，收藏或进度变化不打断浏览位置。
- 朗读能力由设备决定：`lib/speech.ts` 的 `ensureVoices()` 只探测一次并缓存结果（含空结果），`voiceschanged` 补齐后更新缓存；`settings` store 的 `voiceAvailable` 作为全局开关，无英文音色时学习页/弹框/词库都不渲染朗读入口，设置页下拉显示不可用文案。
- `speakEn()` 的 Promise 在 `onstart` 时就完成，加载态只覆盖「点击到出声」；`cancel()` 与 `speak()` 之间留 60ms 间隔规避 Chrome 的静默问题。

## 路由、SEO 与部署

- 路由是 history 模式（`/library`、`/phrases/daily`），每条可索引页面都有独立 URL 与预渲染 HTML。
- `src/router/index.ts` **只导出 `routes` 路由表**。路由实例由 `vite-ssg` 在 `main.ts` 里按环境创建（构建期 memory history、运行期 web history），因此禁止在该文件 `createRouter`——构建期没有 `window`，web history 会直接崩。
- 页面标题、描述、`robots`、canonical、OG/Twitter 与 JSON-LD 统一由 `src/App.vue` 的 `useHead` 按 `route.meta` 与 `src/lib/seo.ts` 输出；构建期即写成静态 HTML，不依赖客户端 JS。
- 索引策略：`/`、`/library`、`/phrases/:category` 为 `index, follow`；`/study` 为 `noindex, follow`；`/stats`、`/settings` 为 `noindex, nofollow`。
- 预渲染集合在 `vite.config.ts` 的 `ssgOptions.includedRoutes`：首页、词库与 11 个分类页（`dirStyle: 'flat'` → `dist/phrases/daily.html`）。应用界面不预渲染，由 `dist/404.html` + 客户端路由兜底。
- `scripts/postbuild.mjs` 在 `vite-ssg build` 之后生成 `404.html`、`sitemap.xml`、`llms.txt` 并校验产物；它用正则从 `src/lib/seo.ts`（`SITE_URL`）、`src/data/categories.ts`（分类表）、`src/data/phrases/<id>.ts`（条数）取值，改数据即自动生效。
- 旧 hash 链接（`#/library`）在 `main.ts` 挂载前由 `legacyHashTarget` 改写为 history 路径，书签与已收录链接不断链。
- Vite `base` 读取 `VITE_BASE_PATH`，本地默认 `/`；GitHub Actions 构建时注入 `/<仓库名>/`。
- `public/.nojekyll` 避免 Jekyll 处理资源目录。
- 工作流先执行 `pnpm test` 再构建，任一失败都不会部署。

## 扩展点

- 新增题型：扩展 `StudyMode`，在 `lib/session.ts` 的 `resolveMode` 分配，并在 `StudyView.vue` 增加提示与判定分支。
- 新增分类：在 `types/phrase.ts` 增加 ID、在 `data/categories.ts` 登记、在 `data/categoryContent.ts` 补一整条 intro/scenario/tips/faq（`Record<CategoryId, …>` 漏键会编译失败），并新增对应数据文件后在 `data/phrases/index.ts` 汇总；分类落地页、sitemap、llms.txt、结构化数据会自动跟随（预渲染集合读 `categories.ts`）。
- 新增页面：在 `router/index.ts` 注册路由并给 `meta.title` / `meta.robots`，在 `App.vue` 的 `DESCRIPTIONS` 补充描述；若要参与收录，还要加入 `vite.config.ts` 的 `includedRoutes`。
- 让任意短语集合开练：调用 `session.startWith(ids, label)`，队列会忽略分类设置、不按每日目标截断；临时分类/模式用 `session.start({ categories, mode, label })`，均不写回设置。
- 更换存储：只需替换 `lib/storage.ts` 的读写函数，保持 `AppData` 与 `SessionDraft` 契约即可。
- 内容校验：`scripts/validate-phrases.mjs` 借 Vite 的 SSR 加载器直接 import TS 数据（不写正则解析），检查 `id`/`en` 唯一、短语形态、别名长度、例句可挖空、分类计数与 README/PRODUCT 数字；挂在 `package.json` 的 `pretest`，`pnpm test` 前自动执行。

## 已知边界

- 中文同义词依赖人工维护的 `aliases`，未收录的表达可能误判；用户可用「这条我会了」把该短语直接标为已掌握并跳过重练，但判定结果与统计不会被改写。
- `localStorage` 通常只有几 MB，当前只存进度与统计，足够长期使用。
- 本轮草稿依赖 `sessionStorage`，隐私模式或极旧浏览器可能不可用；不可用时退化为不落盘，刷新即重开一轮。草稿里不含 `recordBeaten`（「新纪录」徽标）与 `lastOptions`（再来一轮的范围），刷新后这两个状态重置。
- Web Speech API 的可用性和音色由浏览器/系统决定；朗读仅为辅助，不影响作答与判定。没有英文音色时入口整体隐藏，而不是留一个点了没反应的按钮；音色在页面加载后才异步就绪的环境，会在 `voiceschanged` 后自动放出入口。
