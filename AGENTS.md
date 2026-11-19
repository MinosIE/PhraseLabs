# AGENTS.md

> 面向 AI Agent 的项目开发指南。最后更新：2026-11-19 · 适用：当前 `main` 分支（已有提交，未 push）。
> 维护约定：改动架构 / 接口 / 约定 / 内容规模后，必须同步更新本文件对应小节与 `docs/`。
> 本文件不含框架托管区块；若未来出现 `<!-- BEGIN:xxx -->` 成对标记，原样保留，勿删。

## 0. 快速上手（30 秒版）

- 项目一句话：纯前端、无后端的英语**短语**键盘训练站；用户看提示输入英文短语或中文释义，即时判定，用 Leitner 盒子安排复习，进度只存浏览器 localStorage。
- 技术栈：Vue 3 `^3.5.44` + Pinia `^4.1.0` + vue-router `^5.5.1` + Vite `^8.3.6` + TypeScript `~6.0.3` + Vitest `^5.1.0` + GSAP `^3.15.1`，包管理器 pnpm（CI 固定 v12 / Node 22）。
- 命令（均来自 `package.json`）：`pnpm dev` / `pnpm test` / `pnpm typecheck` / `pnpm build` / `pnpm preview` / `pnpm test:watch`。
- 改代码前必读：第 3 节（尤其是 3.3 改动联动表和 3.4 真实踩坑清单）。

## 1. 项目全局认知

### 1.1 项目目标与定位

- 训练单位是**短语**，不是孤立单词；`StudyMode` 仅有 `zh-en` / `en-zh` / `cloze` 三种，`mixed` 只在生成队列时解析。
- 已明确移除：跟写模式（`shadow`）、听写模式（`dictation`）、`autoSpeak` 设置。**不要重新引入**。
- 用户旅程：首页选模式/分类 → 学习页输入 → 弹框判定反馈 → 错词进本轮队尾重练 → 统计页看掌握度。全程键盘可达，无需登录。

### 1.2 整体架构

依赖方向单向：`views → stores → lib → types/data`。`lib` 不依赖 Vue，便于单测。无运行时网络请求，内容打包进 bundle。

```text
src/
  main.ts               入口：createApp + Pinia + router + style.css
  App.vue               外壳：导航 / 主题 data-theme / skip-link / RouterView
  router/index.ts       hash 路由 + 标题；5 个页面 + 通配重定向
  views/                页面与交互
    HomeView.vue         模式/分类入口（分类只影响本轮），今日目标进度
    StudyView.vue        ★答题主流程：队列、输入、判定、弹框、快捷键、草稿恢复
    LibraryView.vue      词库搜索/筛选/收藏/朗读/分批渲染/一键开练
    StatsView.vue        掌握度、连续天数、最该复习的 5 条
    SettingsView.vue     目标/模式/分类/严格度/主题/音色/导入导出
  components/           可复用交互
    AnswerInput.vue      单输入框 + 提交/跳过/提示；输入期间不干预
    AnswerFeedback.vue   结果弹框（Teleport + GSAP 动画）
    SelectField.vue      自定义下拉（listbox + 键盘导航）
  composables/useDebounce.ts  搜索框防抖
  stores/
    session.ts           本轮队列/索引/连对/逐题对错；草稿恢复；撤回重练
    progress.ts          短语记忆状态 + 每日统计，deep watch 落盘
    settings.ts          用户设置，deep watch 落盘
  lib/                   纯函数
    grade.ts / normalize.ts   判定与归一化
    session.ts / srs.ts / date.ts   队列、Leitner、日期
    storage.ts           localStorage 读写 + 导入导出 + 旧数据迁移 + 本轮草稿(sessionStorage)
    speech.ts            Web Speech 朗读、音色单次探测与能力检测、playback Promise
    feedback.ts          结果标题/鼓励文案
  data/
    categories.ts        分类登记（id/名/描述/图标）
    phrases/*.ts         11 个分类的内容文件
    phrases/index.ts     汇总 phrases / phraseById / phraseCountByCategory
  types/
    phrase.ts            CategoryId / Level / StudyMode / ModeSetting / Phrase
    progress.ts          Settings / AppData / PhraseProgress / QueueItem
  style.css             全部全局样式与语义色变量（单文件）
  lib/__tests__/core.test.ts  唯一测试文件
```

### 1.3 技术栈说明（来自 `package.json`）

| 用途 | 包 | 版本 |
| --- | --- | --- |
| 框架 | `vue` | `^3.5.44` |
| 状态 | `pinia` | `^4.1.0` |
| 路由 | `vue-router` | `^5.5.1`（hash history） |
| 构建 | `vite` / `@vitejs/plugin-vue` | `^8.3.6` / `^6.0.10` |
| 语言 | `typescript` / `vue-tsc` | `~6.0.3` / `^3.3.14` |
| 测试 | `vitest` | `^5.1.0` |
| 动效 | `gsap` | `^3.15.1` |

`@` 别名指向 `src/`（`vite.config.ts` + `tsconfig.app.json` 双处配置）。`tsconfig.app.json` 开启 `noUnusedLocals` / `noUnusedParameters` / `erasableSyntaxOnly`。

### 1.4 核心模块职责

| 模块 | 路径 | 负责 | 不负责 |
| --- | --- | --- | --- |
| 答题流程 | `views/StudyView.vue` | 队列消费、提交/判定/弹框、快捷键、loading、草稿恢复、空答案拦截 | 判定算法、记忆算法 |
| 判定 | `lib/grade.ts` | 返回 `correct \| near \| wrong`、距离、文案 | 更新进度、UI |
| 归一化 | `lib/normalize.ts` | 英文转小写/统一标点/编辑距离；中文去标点 | 业务判词 |
| 队列 | `lib/session.ts` | 到期优先 + 随机补充 + `mixed` 题型分配 + 临时范围（分类/模式/指定集合） | 落盘 |
| 记忆 | `lib/srs.ts` | 6 格 Leitner、到期判断、连续天数 | 统计口径以外的 UI |
| 存储 | `lib/storage.ts` | `phraselabs:v1:*` 读写、导出/导入、旧数据迁移、sessionStorage 草稿 | 业务校验 |
| 朗读 | `lib/speech.ts` | 音色优选、单次探测+缓存、`hasEnglishVoice` 能力检测、`rate=1`、`onstart` 即结束 loading | 判定、入口显隐 |
| 内容 | `data/phrases/` | 静态短语与分类计数 | 运行时逻辑 |

### 1.5 数据流 / 关键链路

```text
启动 → settings/progress store load*(localStorage, 失败回退默认值)
     → sessionStore 自动 restore(sessionStorage 当天草稿)，没有草稿才等待首页开始
     → HomeView 选模式/分类 → sessionStore.start(可选临时范围) → buildQueue(到期优先 + dailyGoal 截断)
词库/统计 → 筛选结果或薄弱清单 → sessionStore.startWith(ids) → buildQueue(指定集合，不截断)
提交 → AnswerInput 拦空答案后 emit submit(trimmed)
     → StudyView.submit：submitting=true → 150ms 后 gradeAnswer(...)
     → progressStore.recordAnswer → applyReview + 当日统计(deep watch 落盘)
     → sessionStore.record + 答错 requeueCurrent → revealed=true → 弹框
「我会了」→ progressStore.markMastered(srs.masterProgress 抬盒到 4) + sessionStore.dropRepeat(只撤重练)；答案/正确率/连对/当日统计均不改
下一题 → sessionStore.next → 清空 inputKey 重建输入框（草稿随 watch 自动写回 sessionStorage）
导入 → SettingsView.onImport(确认覆盖 → importing=true) → importData → normalizeSettings → replace 三个 store
```

### 1.6 关键设计原则（逐条可验证）

1. **短语定位**：`en` 必须是完整短语（含空格；叠词习语可用连字符，如 `so-so`、`fifty-fifty`）；禁止孤立单词、禁止跟写/听写题型。
2. **输入不干预**：单一输入框，输入期间不实时判定、不上色、不自动跳格、不拦截普通输入；仅提交后给结果。
3. **纯函数边界**：`lib/` 不 import Vue；判定/队列/记忆可在 Node 下单测。
4. **持久化**统一走 `lib/storage.ts`，键前缀 `phraselabs:v1:`；写入失败静默降级内存态。
5. **反馈双通道**：结果同时用文字 + 图标 + 颜色表达；动效在 `prefers-reduced-motion` 下关闭。
6. **部署**：hash 路由（`#/study`）避免静态托管 404；Vite `base` 取 `VITE_BASE_PATH`，CI 注入 `/<repo>/`。

## 2. 开发规则

### 2.1 代码组织

- 新页面放 `views/` 并在 `router/index.ts` 注册；可复用交互放 `components/`；无状态纯函数放 `lib/`；常量数据放 `data/`。
- 业务判定/算法改动必须伴随 `lib/__tests__/core.test.ts` 的用例。
- 主题、布局、组件外观统一改 `style.css` 的语义变量，不要在各组件里堆内联色值。

### 2.2 命名

- 组件文件名 PascalCase（`.vue`），组合式函数 `useXxx.ts`；短语 ID `<分类>-<三位序号>`，全库唯一。
- store 用 `defineStore` setup 写法，导出 `useXxxStore`；纯函数导出小驼峰。
- `aliases` 每个归一化后至少 2 个汉字；`enAliases` 仅记时态/拼写变体。

### 2.3 文件结构约定

Vue SFC 统一 `<script setup lang="ts">` → `<template>` →（无 `<style scoped>`，样式集中在 `style.css`）。

### 2.4 拆分原则

仅当同一交互被 2 个以上页面复用时抽组件；纯计算抽 `lib/`，不把计算塞进组件 setup。

### 2.5 数据模型规范

类型定义只在 `src/types/`。`Phrase` / `Settings` / `AppData` / `QueueItem` 是跨模块契约，改动见 3.3。`importData` 校验 `version === 1`，失败抛中文 Error，由 `SettingsView` 捕获展示。

### 2.6 错误处理

- 存储读写 `try/catch` 静默降级；不要改成抛错打断训练。
- 导入/导出错误在 `SettingsView` 用 `message` ref 展示，不污染 `lib`。
- 朗读失败 `.catch(() => undefined)` 后必须清 loading，避免按钮永久禁用。

### 2.7 日志规范

无日志框架。禁止在 `lib/` 与生产路径留 `console.log`；调试完即删。

### 2.8 测试要求

Vitest，唯一测试文件 `src/lib/__tests__/core.test.ts`，当前 27 项。覆盖判定、队列（含临时范围与指定集合）、Leitner、归一化、存储迁移、本轮草稿跨天失效、数据结构不变量。**提交前必跑** `pnpm test && pnpm typecheck && pnpm build`；CI（`.github/workflows/deploy.yml`）先测后构建，任一失败不部署。

## 3. AI Agent 开发指导 ★最高优先级★

### 3.1 改动前必须了解

- 目标行为是否属于短语训练；若涉及题型，先确认 `StudyMode` 现状（仅 3 种）。
- 读 `types/phrase.ts` + `types/progress.ts` 确认字段真实存在，勿凭文档记忆。
- 确认 `src/data/phrases/index.ts` 的汇总与计数逻辑是否受影响。
- 确认是否需要同步 `docs/PRODUCT.md`（业务规则/内容数）与 `docs/ARCHITECTURE.md`（契约）。

### 3.2 禁止随意修改的文件

| 文件 | 原因 |
| --- | --- |
| `pnpm-lock.yaml` | 锁文件，只能由 `pnpm install` 更新；手改会让 `--frozen-lockfile` 失败 |
| `.github/workflows/deploy.yml` | 发布流程；改错会导致 Pages 部署失败或跳过测试门禁 |
| `public/.nojekyll` | 保证 Pages 正确处理资源目录，删掉后静态资源可能 404 |
| `lib/storage.ts` 的 `normalizeSettings` | 已上线的迁移层：把旧 `shadow` / `dictation` 设置回退为 `mixed`；删掉会让老用户卡在已删除模式 |
| `src/lib/__tests__/core.test.ts` 的迁移用例 | 上述兼容性的回归防线 |

### 3.3 强依赖关系（改动联动表）

| 改什么 | 必须同时改 | 漏了会怎样 |
| --- | --- | --- |
| 新增分类 | `types/phrase.ts` `CategoryId` → `data/categories.ts` → 新数据文件 → `data/phrases/index.ts`（import + 数组）→ `core.test.ts` 分类数断言 → 文档 | 分类不出现在 UI，或测试断言失败 |
| 新增短语 | 对应 `data/phrases/*.ts`、`phraseCountByCategory` 自动更新、文档总数 | `id` 冲突或计数与文档不符 |
| 新增/删除题型 | `types/phrase.ts` `StudyMode` → `HomeView.vue` modes → `SettingsView.vue` modes → `StudyView.vue` `modeLabel` + 提示模板 → `lib/storage.ts` `normalizeSettings` 迁移 → `core.test.ts` 夹具/断言 → 文档（**共 7 处**） | 老设置指向不存在的模式，页面标签空白，判定分支缺失 |
| 新增设置字段 | `types/progress.ts` `Settings` → `lib/storage.ts` `DEFAULT_SETTINGS` + `normalizeSettings` → `SettingsView.vue` 控件 + handler → `stores/settings.ts` setter → 文档契约 | 导入旧数据缺字段，或设置无默认值 |
| 改判定规则 | `lib/grade.ts` / `lib/normalize.ts` → `core.test.ts` → `docs/PRODUCT.md` | 测试仍按旧规则，用户与文档预期不一致 |
| 改路由/导航 | `router/index.ts` → `App.vue` nav → 路由 `meta.title` | 导航项与可访问路由不一致 |
| 改朗读 | `lib/speech.ts` → `stores/settings.ts` `voiceAvailable` → `SettingsView.vue` 音色下拉 → `StudyView.vue`（答题前仅 `en-zh` 可读）/ `AnswerFeedback.vue` / `LibraryView.vue` 朗读按钮与 `⌥R`、`Ctrl+P` | loading 卡住、没音色仍显示按钮、答题前朗读泄题 |
| 改主题/布局/配色 token | `style.css` 语义变量 → 必要时 `App.vue` `applyTheme` → `QA.md` 记录对比度实测 | 深浅主题不一致、反色卡片文字不达标 |

### 3.4 常见错误模式（真实踩坑）

| 现象 | 根因 | 正确做法 |
| --- | --- | --- |
| 点击提交无响应（IME 期间） | `@click="submit"` 把 MouseEvent 当 `fromKeyboard` 参数传入，composing 时被拦截 | 按钮写 `@click="submit()"`，键盘路径才传 `true` |
| 朗读按钮转 1–2 秒才恢复 | loading 绑在 `onend` 上，覆盖了整句播放时长，再叠加 400ms 最小时长 | 改为 `onstart` 完成 Promise（1.2s 兜底），loading 只覆盖「点击到出声」 |
| 每次朗读都像卡一下 | 每次 `speakEn` 都 `await refreshVoices()`，语音列表未就绪时白等 800ms | 音色单次探测并缓存（含空结果），`App.vue` 启动即预热 |
| 没有英文音色的设备留下死按钮 | 只判断 API 是否存在，没判断有没有英文音色 | `hasEnglishVoice` + `settings.voiceAvailable` 统一控制四处入口；首次为空时挂 `voiceschanged` 自动恢复 |
| 中→英答题前能听出答案 | 卡片头的朗读按钮在所有题型都显示 | 答题前仅 `en-zh` 提供朗读，弹框打开后不限；`⌥R`/`Ctrl+P` 同样走 `canSpeakNow` 判断 |
| 老用户设置里出现空标签/错误题型 | 移除 `shadow`/`dictation` 后 localStorage 仍存旧值 | 在 `normalizeSettings` 迁移并在测试中覆盖 |
| 词库出现孤立单词 | 一词多义分类曾直接写 `book`/`can` 等 | 一律改成含空格短语对，如 `book a table` / `read a book`；叠词习语是唯一例外，写成带连字符的 `so-so`、`fifty-fifty`，判定时 `normalizeEnglish` 会把连字符归一化为空格 |
| 中文判定漏词 | `aliases` 含单字（如 `迷`），`normalizeChinese` 后长度 < 2 被过滤 | 别名至少 2 个汉字；提交前跑别名长度扫描 |
| TS6133 未使用变量 | `noUnusedLocals: true`；重构弹框后遗留 `goalText` | 删除未使用声明，`pnpm typecheck` 必跑 |
| 填空不挖空（泄题） | `exampleEn` 只写了时态变形，`clozePattern` 匹配不到 `en`；含 `one’s`/`someone` 的短语本就不可能原样出现 | 例句尽量用 `can/will/seems to` 等保留原形；确实只能写变形的，把实际形式加进 `enAliases`（如 `lost his temper`、`cover for me`），提交前跑一次挖空自检 |
| 重复条目/ID | 同一短语被写进多个语义相近的分类（如 `call it a day` 同时在职场/习语/旅行），或批量追加时序号冲突。曾出现 629 条里只有 602 个唯一 `en` | 新增后立即用脚本查 `id` 与 `en` 全局唯一；同一短语只留在最贴切的分类 |
| 空答案被判错 | 提交未校验 `trim`，空串进入判定会降盒、计入错误并 requeue | 在 `AnswerInput` 与 `StudyView.submit` 双层拦空答案，只抖动提示 |
| 判定中点「跳过」吞掉作答 | `skip()` 把 `submitting` 置 false，150ms 回调直接 return，但索引已前进 | `skip()` 在判定中直接 return，跳过按钮同步 `disabled` |
| 进度条随重练倒退 | 分母用 `queue.length`，答错追加后总数变大 | 分母固定为 `plannedTotal`，重练单独显示 `pendingRepeats` |
| 首页点分类后长期设置被改 | 直接写 `settings.categories` | 用 `session.start({ categories, label })`，只影响本轮 |
| 反色卡片辅助文字看不清 | 把为浅底定义的 `--muted` / `--accent` 复用到 `--ink` 反色底，实测仅 2.43–3.75:1 | 用 `--on-ink-muted` / `--on-ink-accent` 双主题 token；进度条填充同理 |
| 「改判答对」留下两套账 | 翻案同时改本轮正确率与 SRS：答错降 2 级、答对只升 1 级，box 回不到原值，`wrong` 还永久 +1 | 判定不可推翻；只提供「这条我会了」抬高盒子 + 撤回重练，统计学口径保持不变 |

### 3.5 推荐开发流程

1. 改前：确认契约与联动表 → 跑 `pnpm test` 建立基线。
2. 改中：按依赖顺序改（类型 → lib → store → view → data → docs）。
3. 改后：`pnpm test && pnpm typecheck && pnpm build`；内容类改动额外查重 ID/en、别名长度、单词条目。
4. 提交：说明改动范围与同步更新的文档；确认本文件、`docs/`、`QA.md` 已同步，工作区无意外文件。

### 3.6 Debug 排查顺序

1. `pnpm typecheck` 排类型/契约错误 → 2. `pnpm test` 排纯函数回归 → 3. 确认 store 是否落盘（`phraselabs:v1:*`）→ 4. 页面交互用真实浏览器复现（注意 IME、快捷键、Teleport 弹框焦点）→ 5. 朗读问题先查 `speechSynthesis.getVoices()` 是否就绪。

### 3.7 回归清单

- [ ] `pnpm test` / `pnpm typecheck` / `pnpm build` 全过
- [ ] 无重复 `id` / `en`（跨分类有意重复需确认）
- [ ] `aliases` 全部 ≥ 2 汉字；`exampleEn` 含 `en`
- [ ] 新增分类/题型/字段已按 3.3 联动表改全
- [ ] 文档中的条数与分类数与实际一致

## 4. 文档索引

| 文档 | 路径 | 用途 | 重要度 | 何时查看 |
| --- | --- | --- | --- | --- |
| 产品与内容设计 | `docs/PRODUCT.md` | 交互规则、判定/记忆算法、内容体系 | 🔴必读 | 改判定/内容/交互前 |
| 架构与数据契约 | `docs/ARCHITECTURE.md` | 分层、接口、localStorage、部署 | 🔴必读 | 改结构/契约前 |
| 贡献指南 | `docs/CONTRIBUTING.md` | 短语字段规范、PR 检查 | 🟡常用 | 增改短语数据时 |
| README | `README.md` | 功能概览与启动方式 | 🟢参考 | 对外说明时 |
| CI 部署 | `.github/workflows/deploy.yml` | 测试门禁与 Pages 发布 | 🟡常用 | 改构建/发布时 |
| UI 验证记录 | `QA.md` | ui-studio 动效/配色审查、对比度实测与误报判定 | 🟡常用 | 改动效/配色/交互前 |

快捷路由：架构问题 → `docs/ARCHITECTURE.md`；数据模型 → `src/types/` + `docs/ARCHITECTURE.md`；业务规则 → `docs/PRODUCT.md`；动效/配色 → `QA.md` + `src/style.css`；部署环境 → `vite.config.ts` + deploy workflow；内容贡献 → `docs/CONTRIBUTING.md`。

## 5. 当前项目状态

### 5.1 已完成模块

五种模式中的三种具体题型 + 混合、Leitner 复习、统计页、词库筛选、导入导出、主题、严格度、收藏、音色按设备能力显隐的手动朗读、加载态、自定义下拉、判定弹框与逐题对错、11 类 703 条短语（已完成跨分类去重，全库 `en` 唯一；补齐过高频口语/习语/短语动词，后又新增 26 条影视高频台词、14 条电影常见习语、24 条叠词习语；全部 `exampleEn` 均含可挖空形式）；词库分批渲染与「练这 N 条」、统计页「最该复习的 5 条」、本轮草稿刷新恢复、弹框内朗读与背景 `inert`；UI 动效与配色已按 ui-studio 做有界精修与对比度验证（见 `QA.md`）。

### 5.2 开发中的模块

无进行中的功能分支。`main` 已有两个提交：`332a49f` 初始化站点、`b2e5632` UI 动效/交互/配色精修；工作区干净，未 push。

### 5.3 未完成计划

`docs/PRODUCT.md` P3 列出：贡献者内容校验脚本、可选高频错词本。内容扩充持续进行，优先常见、简单、日常高频短语。

### 5.4 技术债务

- `src/style.css`：单文件承载全部样式，随功能增长已较长；拆分需保持语义变量一致。

### 5.5 已知问题

- 中文同义词依赖人工维护的 `aliases`，未收录表达会误判；用户可用「这条我会了」标为已掌握并跳过重练，但判定与统计不会被改写。
- 填空挖空依赖例句与原形匹配：`StudyView.clozeSentence()` 依次尝试 `en` 与 `enAliases`，并把短语里的 `…` 当作可插入内容（`clozePattern` 转成 `.{0,60}?`）。含 `one’s` / `someone` / `something` / `your` 的短语无法在例句中原样出现，必须用 `enAliases` 记录例句里的实际形式（如 `lost his temper`、`cover for me`）；新增条目若例句只写变形而未补 `enAliases`，填空模式仍会显示完整句子。存量 192 条已于 2026-11-19 全部修正，当前全库 0 条无法挖空。
- Web Speech API 音色与可用性由浏览器/系统决定；朗读仅辅助，不影响判定。
- localStorage 容量有限，当前只存进度/统计/设置，足够长期使用。

### 5.6 后续规划 / 路线图

见 `docs/PRODUCT.md`「路线」：P0–P2 已完成，P3 进行中（当前 703 条，内容继续扩充）。架构/接口/约定变更时同步更新本文件，否则指南会快速腐化。

## 6. 变更记录（本文件）

- 2026-11-19：新建。基于实际源码、配置、CI 与文档取证，压缩为面向 Agent 的操作手册与索引；记录已移除的跟写/听写题型及真实踩坑清单。
- 2026-11-19：交互评审后的调整：空答案不判定、判定中禁跳、弹框内朗读与背景 `inert`、手动纠错同步本轮、重练不再改变进度分母、本轮草稿刷新可恢复、首页分类只影响本轮、词库分批渲染与一键开练、统计薄弱清单；测试 22 → 26 项。
- 2026-11-19：语料治理。清理 26 组跨分类重复短语（629 → 602，每组保留最贴合分类的一条，删除的 ID 变成孤儿进度但无害）；新增 41 条高频表达（日常 14、习语 18、短语动词 9），其中 `have a point`、`out of the blue`、`long time no see` 与存量重复已剔除，最终 640 条、11 类、`id`/`en` 全唯一。全文总数与分类数已同步 README / PRODUCT / ARCHITECTURE / 本文件。
- 2026-11-19：完成首次提交 `332a49f`；随后按 ui-studio 精修动效/交互与配色（21 组对比度全部达标，细节见 `QA.md`），提交 `b2e5632`。本文件同步提交状态、文档索引、配色联动与反色卡片踩坑。
- 2026-11-19：朗读入口改为按设备能力显隐、答题前仅「英 → 中」可读；「我其实答对了」改为「这条我会了」，判定与统计不再被改写，测试 26 → 27 项。
- 2026-11-19：修复填空泄题。`StudyView.clozeSentence` 改为按 `[en, ...enAliases]` 依次匹配，并把 `…` 当作通配；逐条改写 192 条例句（多改为 `can/will/seems to/deserves to` 等保留原形的句式），含 `one’s`/`someone`/`something`/`your` 的条目补 `enAliases` 记录例句实际形式。自检脚本结果：0 条无法挖空、0 重复 `id`/`en`；顺带删除与 `daily-042` 重复的 `work-024`（原 `on the same boat` 拼写不规范），总数 640 → 639，职场 47 → 46，文档数字已同步。
- 2026-11-19：补充影视与叠词。日常新增 26 条影视/美剧高频台词（`daily-128`–`daily-153`），习语新增 14 条电影常见习语（`idioms-068`–`idioms-081`）与 24 条叠词习语（`idioms-082`–`idioms-105`，含 `so-so`、`fifty-fifty`、`chit-chat`、`now now`、`there there`）；总数 639 → 703，日常 148、习语 104。叠词允许只用连字符，`core.test.ts` 的「非孤立单词」断言由「必须含空格」放宽为「含空格或连字符」，文档同步。
