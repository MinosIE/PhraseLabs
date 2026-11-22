# 下一步计划（Roadmap）

> 维护约定：每完成一项就在这里勾掉并把细节挪进 `docs/PRODUCT.md` / `docs/ARCHITECTURE.md`；新增计划先写清「做 / 不做 / 验收」，再动代码。
> 最后更新：2026-11-22 · 适用：`main` 分支（E2 已实施；F1/F2 已实施，待提交）

## 0. 基线快照

| 维度 | 现状 |
| --- | --- |
| 内容 | 11 类 / 819 条短语，`pnpm check:content` 全过（id/en 唯一、别名 ≥2 汉字、`exampleEn` 可挖空、文档数字一致） |
| 题型 | 中→英 / 英→中 / 例句填空 + 混合（`mixed` 只在生成队列时解析，英→中占比按难度 40% / 30% / 20%） |
| 记忆 | 记忆稳定度 + 保留率 \(R=0.9^{\Delta t/S}\)，答对 ×1.9、答错 ×0.4，≥15 天算掌握；旧 Leitner `box` 自动换算为 1/1/2/4/7/15 天 |
| 测试 | Vitest 单文件 68 项，`pretest` 自动跑内容校验 |
| 构建 | vite-ssg 预渲染 13 页（首页 + 词库 + 11 分类）；`postbuild` 生成 404 / sitemap / llms.txt 并校验产物 |
| 部署 | GitHub Pages + Actions（先测后构建）；`main` 推送即发布；PWA 产物（`sw.js` / `manifest.webmanifest`）随构建生成，`postbuild` 校验 |
| 首屏 | 首页静态 JS 共 4 个 chunk / 75.2 KiB（gzip）：`app`（外壳 + 框架 + settings/progress store + 路由进度/预取）53.5 + `HomeView` 7.6 + `progress` 7.2 + `daily`（日常口语基座，供今日一句/演示区）6.8；全量基座 28.7 与全量 `details` 30.9 都不进首屏；gsap + ScrollTrigger 首帧后按需加载 |
| 已知债务 | 配置层用正则读 TS 源（`vite.config.ts` / `postbuild.mjs`）；分类文案里举例了具体条目 |

## 1. 优先级总览

| 编号 | 主题 | 用户价值 | 成本 | 依赖 | 建议窗口 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | 线上可用性核查 | 高（站点打不开等于 0） | 0.5 天 | 无 | 立即 | ✅ 已完成 2026-11-20 |
| A2 | 高频错词本 | 高（补完复习闭环） | 1.5 天 | 无 | 下一迭代 | ✅ 已完成 2026-11-20 |
| A3 | 内容自检常态化 | 中（防止口径腐化） | 0.5 天 | 无 | 下一迭代 | ✅ 已完成 2026-11-20 |
| B1 | `style.css` 拆分 | 低（维护性） | 2 天 | A2 完成后再动，减少冲突 | R2 | ✅ 已完成 2026-11-20 |
| B2 | 移动端输入体验 | 中高（真实使用场景） | 1 天 | 需真机/模拟器验证 | R2 | ✅ 已完成 2026-11-20（真机待验） |
| B3 | 别名与判定抽检 | 中（减少误判） | 0.5 天/轮 | 人工语料 | R2 起常态 | 第 1 轮已完成 2026-11-20 |
| C1 | SEO P4 短语详情页 | 中（长尾流量） | 3–4 天 | 上线数据观察 4–6 周 | R3 | 阻塞（缺数据） |
| C2 | 成绩卡分享 | 低中（传播） | 1 天 | 设计定稿 | R3 可选 | 待产品确认 |
| C3 | 依赖升级 | 中（安全） | 0.5 天/轮 | 见 §2.C3 约束 | 每季度 | 待做 |
| D1 | 标签练习 + 错词优先入队 | 高（直接决定「今天练什么」） | 1 天 | 无 | 立即 | ✅ 已完成 2026-11-21 |
| D2 | PWA 离线与主屏安装 | 中高（习惯养成 / 断网可用） | 1 天 | D1 后做，避免合并冲突 | 紧随 D1 | ✅ 已完成 2026-11-21 |
| D3 | 首屏瘦身（动画库移出关键路径） | 中（移动端首屏） | 0.5 天 | 依赖 D2 的缓存策略 | R4 | ✅ 2026-11-21 |
| D4 | 内容补齐（L5 难度 + tip 覆盖） | 中（内容纵深） | 长尾 | 无 | 持续 | 第 1 轮已完成 2026-11-21（819 条，L5 2%、tip 7%），后续继续 |
| E1 | 首屏数据二次拆分（例句/提示懒加载） | 高（移动端首屏） | 2 天 | 无 | 紧跟 D3 | ✅ 2026-11-22（130.1 → 112.8 KiB，−13.3%） |
| E2 | 首页去语料（入口协议 + 摘要常量） | 高（移动端首屏） | 1 天 | E1 | 紧跟 E1 | ✅ 2026-11-22（112.8 → 74.2 KiB，−34.2%） |
| F1 | 训练难度档位（轻松 / 标准 / 挑战） | 高（降低连错挫败） | 0.5 天 | 无 | 立即 | ✅ 2026-11-22 |
| F2 | 切页进度条 + 悬停/空闲预取 | 高（消除「假死」感） | 0.5 天 | 无 | 立即 | ✅ 2026-11-22 |

## 2. 详细方案

### A1 · 线上可用性核查（P0，先做）

**背景**：此前出现过「仓库已推送但 https://minosie.github.io/PhraseLabs 打不开」，原因未定因；本次推送后再未复测。

**目标**：用可复现的步骤确认「推送 → Actions → Pages → 浏览器可见」链路完好，并把结论写进 `QA.md`。

**步骤**

1. 浏览器打开仓库 Actions，确认最近一次 `Deploy` 为绿色；若为红色，读失败步骤（`pnpm test` / `pnpm build` / `deploy`）。
2. `curl -sI https://minosie.github.io/PhraseLabs/` 期望 `200`；`curl -s .../llms.txt` 期望含「艾宾浩斯」。
3. 浏览器打开站点，强刷后确认：首页含遗忘曲线专题、分类页可直达（`/phrases/daily`）、刷新非首页路由不 404。
4. 百度统计：打开控制台看 `hm.baidu.com` 请求是否发出（不记录任何个人数据）。
5. 结论写进 `QA.md`「部署复核」小节，包括失败时的排查路径。

**验收**：上述 4 条全部通过并有记录；失败则另开缺陷项，不混进功能迭代。

**状态**：已完成（2026-11-20）：首页 `200`、分类页 `200`、`llms.txt` `200`、静态 HTML 含新构建特征；`/stats`、`/study` 直访为 `404` + `404.html` 兼底（既有设计，非回归）。详细记录见 `QA.md`「线上可用性核查」。

---

### A2 · 高频错词本（P1，P3 路线最后一项）

**定义**：满足 `wrong >= 2` 或 `wrong / (correct + wrong) >= 0.4` 且 `stability < 15 天` 的短语；按 `wrong` 降序、`stability` 升序排列，取前 N（默认 10）。

**数据**：直接用 `progressStore.progress[id].correct / wrong / stability`，**不新增 localStorage 键、不改 `AppData` 版本**，旧备份天然兼容。

**技术方案**

1. `src/lib/mistakes.ts`（纯函数，不 import Vue）：`isMistake(progress)`、`mistakeScore(progress)`、`pickMistakes(phrases, progress, limit)`，复用 `MASTERED_STABILITY`。
2. `StatsView.vue`：现有「最该复习的 5 条」保留（按稳定度）；新增「高频错词」卡（10 条，显示错/对次数与稳定度），按钮调用现成的 `sessionStore.startWith(ids, '错词本 · N 条')` 并跳 `/study`。空态文案「还没有错词记录，练一轮就会有了」。
3. `LibraryView.vue`：筛选区加一枚「只看错词」chip，接入 `filtered` 计算属性；不新增路由，避免预渲染集合与导航膨胀。
4. 不做：独立 `/mistakes` 页（SEO 无价值、需处理 `includedRoutes`）；不做「自动清除错词」（稳定度 ≥15 天即自动淡出榜单）。

**测试**：`core.test.ts` 新增 `isMistake` 阈值边界、`pickMistakes` 排序与截断、全部已掌握时返回空数组；现有 50 项保持通过。

**验收**：答错 2 次的新词出现在错词榜；点「练这 N 条」队列只含这些 ID；词库「只看错词」结果与榜单同源；窄屏不溢出。

**文档**：`docs/PRODUCT.md` 统计页小节、§3.3 联动表（新增 `lib/mistakes.ts` 行）、`AGENTS.md` §1.2/§1.4/§2.8、`QA.md`。

**落地记录（2026-11-20）**

- `src/lib/mistakes.ts`：`isMistake` / `errorRateOf` / `pickMistakes`。阈值按本方案（错 ≥2 次或错误率 ≥40%），**排序改为「错次降序 → 错误率降序 → 稳定度升序」**——只按稳定度排会让「错 5 次的老词」排在「错 2 次的新词」之后，与「错词榜」语义不符。
- 统计页「高频错词」卡（最多 10 条）+「练这 N 条」复用 `startWith`；词库状态筛选新增「错词」，与榜单同源（`isMistake`）。
- 测试：`core.test.ts` 由 50 项增至 54 项，覆盖阈值边界、掌握线淡出、零作答、排序与截断。
- 未做（与原方案一致）：独立路由、新存储键、`AppData` 版本变更、手动删除错词。

---

### A3 · 内容自检常态化（P1）

**现状**：`check:content` 已覆盖硬性规则；缺的是「软指标」可见性。

**方案**：在 `scripts/validate-phrases.mjs` 末尾追加**非阻断**统计输出：难度分布、各分类条数、`aliases` 平均长度、`exampleEn` 平均词数、`tips` 覆盖率。任何一项异常只警告，不退出非 0（避免阻塞贡献）。

**验收**：`pnpm check:content` 输出含上述 5 个数字，且 CI 仍以退出码判定。

**落地记录（2026-11-20）**

- `scripts/validate-phrases.mjs` 新增 `reportMetrics()`，每次运行都输出难度分布、分类分布、别名平均字数、例句平均词数、`tip` 覆盖率；硬性问题仍原样递增 `problems` 并置 `process.exitCode = 1`，软指标**不参与退出码**。
- 当前实跑（2026-11-21，819 条）：难度 L1 24% / L2 38% / L3 27% / L4 10% / **L5 2%**；别名均长 3.2 字，例句均长 7.9 词，`tip` 覆盖率 7%（D4 首轮前为 L5 0%、tip 3%）。前两项健康，`L5` 与 `tip` 仍是长尾缺口。

---

### B1 · `style.css` 拆分（P2）

**目标**：在不改变任何视觉的前提下拆成 `tokens.css`（变量 + reset）、`base.css`（排版/通用组件 `.btn`/`.chip`/`.card`）、`layout.css`（header/footer/page/section）、`pages.css`（首页/学习/词库/统计/设置/分类）、`responsive.css`（两个断点），`style.css` 只保留 `@import` 顺序入口。

**硬约束**：`@import` 顺序必须与当前文件内顺序一致（层叠依赖）；`@media` 全部集中到 `responsive.css`，不得前移；拆分后逐页对比深/浅主题截图。

**验收**：拆分前后对 6 个页面 × 2 主题做像素级目检；`build` 产物 CSS 体积差 < 5%；对比度抽检仍满足 `QA.md` 既有基线。

**风险**：层叠顺序错会导致局部样式回退 → 单文件可一键 revert，故放在功能空窗期做。

**落地记录（2026-11-20）**

- 实际拆成 5 个分片：`tokens`（变量/reset/排版）/ `base`（外壳、标题段落、按钮）/ `home`（首页全部）/ `views`（分类页、学习页、反馈弹框、词库、统计、表单弹窗）/ `responsive`（三个断点）；`style.css` 只剩 5 条 `@import`。
- 拆分手法是**连续区段切分**而非重新归类：拼接后与原文件逐行 `diff` 一致，层叠顺序零风险；代价是 `base` 里同时含外壳与通用组件，暂不再细分。
- `@media (hover: none)` 留在 `views.css` 原位，**没有**上移到 `responsive.css`——移动后位于其他同名选择器之前会改变覆盖结果，与本项「不改视觉」目标冲突。
- 验证：`pnpm build` 通过，产物 CSS 仍为单文件（Vite 内联 `@import`），体积 34.4 KB；首页与统计页深浅主题截图无异常，`.site-header` 仍为 `sticky`、`link[rel=stylesheet]` 仍只有 1 个。
- 后续新增样式：按归属写进对应分片，不要再往 `style.css` 里塞规则。

---

### B2 · 移动端输入体验（P2）

**范围**

- `AnswerInput.vue`：`inputmode="text"`、`autocapitalize="off"`、`autocorrect="off"`、`spellcheck="false"`、`enterkeyhint="go"`；输入框获得焦点时用 `scrollIntoView({ block: 'center' })` 避免被软键盘遮挡（仅在 `visualViewport.height` 明显缩小时触发）。
- `StudyView.vue`：抽认卡在键盘弹出时压缩上下留白；底部按钮跟随 `env(safe-area-inset-bottom)`。
- `StudyView` 快捷键监听忽略 `event.isComposing`，避免中文输入法选词误触发提交（已有提交入口保护，但快捷键路径需单独核对）。

**不做**：不做手势滑动翻卡（与「输入不干预」原则冲突）。

**验收**：iOS Safari + Android Chrome 真机或模拟器各 1 次：输入不被遮挡、Enter 提交、中文选词不误提交、切后台回前台草稿仍在。

**落地记录（2026-11-20）**

- `AnswerInput.vue`：补 `inputmode="text"`，`enterkeyhint` 改 `go`；新增 `keepVisible()`，仅在 `visualViewport.height < innerHeight × 0.8` 时把输入框滚到可视区中间，`@focus` 后延迟 260ms 测量（等键盘动画），桌面端不产生任何滚动。
- `StudyView.vue`：`onGlobalKey` 开头加 `event.isComposing` 早退，中文选词期间的回车不会触发全局快捷键。
- `responsive.css`：新增 `@media (max-height: 520px)`，压缩学习卡留白与标题字号。
- **没做**：`viewport-fit=cover` + `env(safe-area-inset-*)`。当前 viewport 未开 `cover`、也没有固定底栏，`env()` 恒为 0，加了是空声明；等真机上真出现遮挡再说。
- 验证：375×667 模拟下输入框属性正确、无横向滚动、聚焦不跳动；矮视口规则手动触发后生效。真机（iOS/Android）尚未实测。

---

### B3 · 别名与判定抽检（P2，常态）

每轮从词库随机抽 20 条，用「本应接受」的同义表达手工测试判定，命中 `wrong` 的记为缺别名；补 `aliases` 时保持 ≥2 汉字。产出记录进 `QA.md`「判定抽检」小节，连续两轮 0 缺陷则改为季度抽检。

**第 1 轮记录（2026-11-20）**：固定种子（20261120）抽 20 条，每条 3 个候选共 60 个表达，命中 39、未命中 21。其中 15 个属于真实缺别名，补到 11 条短语（+17 个别名）；剩下 6 个经营养等价性判断后不补（如「总的来说」属 `all in all`、「早点休息」不是 `good night`）。补完后同批未命中 5 个且均属不该接受。手法：临时脚本用 Vite SSR 加载器直接调 `gradeAnswer(phrase, 输入, 'en-zh', 'normal')`，不手改判定逻辑。

---

### C1 · SEO P4 短语详情页（P3，需数据）

**前置**：Search Console 收录与点击数据观察 4–6 周；只做搜索需求明确的前 100 条。

**约束**（`docs/SEO.md` 已定）：每条必须有释义、2 条例句、常见错误、3 条同类内链，避免薄内容；`includedRoutes` 需从静态数组改为按 `topPhrases` 生成，`sitemap.xml` 与 `llms.txt` 同步；详情页 canonical 指向自身。

**验收**：预渲染页数 13 → 113；关闭 JS 可见完整正文；结构化数据为 `DefinedTerm`；首页/分类页到详情页均有内链。

---

### C2 · 成绩卡分享（P3 可选）

结算页生成一张本地渲染的卡片（Canvas，不引入第三方库、不上传服务端），包含本轮正确率、最高连对、错词数；导出 PNG 走 `a[download]`。**不做**分享链接与社交 SDK。需先确认设计口径（是否露昵称——当前无账号体系，默认不露）。

---

### C3 · 依赖升级（常态）

- 大版本分步升，一次只升一个包；每次升级跑 `check:content` / `test` / `typecheck` / `build` 四门禁。
- `@unhead/vue` 必须与 `vite-ssg` 依赖的实例一致（当前 2.x），**不要升到 3.x**，否则 head 标签可能重复或丢失。
- `pnpm-lock.yaml` 只允许 `pnpm install` 更新，禁止手改；CI 使用 `--frozen-lockfile`。
- TypeScript / Vite 大版本升级后重点回归：`ssgOptions.includedRoutes`、`vue-tsc -b`、`erasableSyntaxOnly` 相关写法（禁止 enum / 参数属性）。

---

### D 组 · 训练针对性与体验（2026-11-21 立项）

#### D1 · 标签练习 + 错词优先入队（P0）

**背景**：819 条短语共带 14 类主标签（口语 215 / 习语 209 / 高频 179 / 正式 120 / 动词短语 100 / 基础 98 / 介词搭配 86 / 一词多义 84 / 职场 76 / 重复 62 / 连接词 47 / 影视 40 / 邮件 27 / 叠词 24），目前只作为徽标展示与搜索词，练不进去；错词本只能「看榜 + 手动开练」，未到期的错词不会优先出现在每天队列里。

**做什么**

1. `src/lib/tags.ts`（纯函数）：`collectTags(phrases)` 返回 `{ tag, count }[]`（按条数降序、同数按名称），`pickByTag(phrases, tag)` 过滤；`data/phrases/index.ts` 导出派生好的 `tagCounts`，与 `phraseCountByCategory` 并列。
2. `LibraryView`：在分类 chip 行下新增「主题」chip 行（全部主题 + 14 个标签带条数），接入 `filtered`，计入 `hasFilter` / `resetFilters` / 重置 `visibleCount` 的 watch。
3. `HomeView`：在「按场景找短语」下方新增「按主题练」紧凑 chip 行（前 8 个高频标签），点击直接开练该标签下随机 20 条（`startWith`，标签如 `主题 · 口语 · 20 条`）；不新增路由。
4. `lib/session.ts` `buildQueue`：在到期项之后插入「未到期但属于错词」的条目，按 `pickMistakes` 的顺序（错次 → 错误率 → 稳定度），上限 `max(1, round(dailyGoal × 0.3))`，再随机补足剩余名额；指定集合（`phraseIds`）时不做这一步。

**不做**：不做「按标签设每日目标」（设置字段膨胀）；不改 `AppData` 版本；不新增存储键。

**测试**：`collectTags` 排序与计数、`pickByTag` 空结果；`buildQueue` 「错词未到期也会入队」「错词上限 ≤ 30% 且不挤掉到期项」「指定集合不受影响」。

**验收**：词库能按主题筛选并一键练筛选结果；首页主题 chip 开练队列只含该标签；答错 2 次的短语在第 2 天（未到期）仍出现在队列中且位置靠前。

**文档**：`PRODUCT` 学习流程/词库小节、`AGENTS` §1.2/§1.4/§3.3、`QA`、本文件。

**落地记录（2026-11-21）**

- `lib/tags.ts`：`collectTags`（条数降序、同数按名称）、`pickByTag`、`pickFeaturedTags`（保证首页先展示跨分类标签；缺失自动跳过、剩余按条数补齐）；`data/phrases/index.ts` 导出派生常量 `tagCounts`。
- 词库：分类 chip 行下方新增主题 chip 行（14 个标签带条数），参与 `filtered` / `hasFilter` / `resetFilters` / 重置分页的 watch；「练这 N 条」沿用原有逻辑。
- 首页：「按场景找短语」下方新增「按主题练一轮」，展示 口语 / 高频 / 职场 / 邮件 / 影视 / 正式 / 基础 / 重复 8 个跨分类标签，点击随机 20 条开练。第一期按条数取前 8 会把 职场（71 条，第 9）挤掉，因此改为「策展优先 + 条数补齐」。
- `buildQueue`：`due` 改为「学过（`progress` 有记录）且到期」，错词从剩余池按 `pickMistakes` 顺序插入，上限 `max(1, round(dailyGoal × 0.3))`，其余随机补足；`phraseIds` 指定集合不受影响。
- **顺手修掉的坑**：旧实现把「没学过的新词」也算 `isDue`（保留率 0），未学条目一多就把每日目标占满，错词根本没有机会插入 → 现在未学词归入随机补充。
- 测试 54 → 61 项（标签汇总/筛选/首页顺序、错词插队与上限、到期项不被挤掉、指定集合不插错词）。
- 浏览器实测：首页 8 个主题 chip 点击进入 `/study`，来源文案「主题 · 口语 · 20 条」；词库点「邮件」筛出 25 条且均带该 badge；console 无报错。

#### D2 · PWA 离线与主屏安装（P1）

**做什么**：`vite-plugin-pwa`（`registerType: 'prompt'`）+ `manifest`（名称、主题色、192/512 图标、`display: standalone`、`start_url` 带 base）；`App.vue` 加「有新版本，点此刷新」条；离线策略只用 precache（不缓第三方域名），`navigateFallback` 指向预渲染的 `404.html`；`postbuild` 已有的产物不受影响。

**不做**：不做后台同步、不做推送通知、不缓存百度统计脚本。

**约束**：`pnpm-lock.yaml` 只由 `pnpm add` 更新；`deploy.yml` 不改；SW 文件名固定带版本号，避免旧 SW 长期驻留。

**验收**：`build` 产物含 `sw.js` + `manifest.webmanifest`；断网刷新仍可进入首页与学习页；旧缓存版本下首页出现更新提示；Lighthouse PWA 项全绿。

**文档**：`AGENTS` §1.2/§1.3、`ARCHITECTURE` 部署小节、`SEO.md`（`manifest` 与 sitemap 无冲突说明）、`QA`。

**落地记录（2026-11-21）**

- 依赖：`vite-plugin-pwa@2`（`registerType: 'prompt'`、`injectRegister: false`）+ `workbox-window`（`virtual:pwa-register` 的 peer，不装会构建失败）。`pnpm-lock.yaml` 由 `pnpm add` 更新。
- `vite.config.ts`：`manifest` 名称/短名/主题色/背景色/`display: standalone`/`start_url`与`scope` 取 `base`/192+512 图标；`workbox.globPatterns` 含 html（13 个预渲染页入缓存）、`navigateFallback: 'index.html'`、`navigateFallbackDenylist: /\.(xml|txt)$/`、`cleanupOutdatedCaches`。不做运行时缓存、不缓第三方域名。
- 新增 `composables/usePwaUpdate.ts`（`virtual:pwa-register` 只在客户端调用，构建期 `window` 不存在直接跳过）；`App.vue` 顶部「新版本已就绪 / 刷新启用 / 稍后再说」条，样式 `.update-bar` 在 `styles/base.css`。
- 图标：从 `public/favicon.svg` 用 `qlmanage -t -s 512` + `sips` 生成 `icons/icon-512.png`、`icons/icon-192.png`，并把 `apple-touch-icon.png` 放到 `public/` 根（ `index.html` 早就引用了它，之前一直是 404）。
- `scripts/postbuild.mjs` 新增门禁：`sw.js`、`manifest.webmanifest` 必须存在，且 manifest 带 icons。
- 实测（preview :4185）：SW 激活并控制页面（scope `/`），34 项预缓存含 `index.html` / `library.html` / `phrases/daily.html`；**kill 掉预览进程后**首页、`/study`（未预渲染，走 app shell）、`/library` 均正常渲染，console 0 错误（只有百度统计第三方脚本请求失败，与应用无关）。
- 带 `VITE_BASE_PATH=/PhraseLabs/` 构建复测：manifest 的 `start_url`/`scope`/图标路径均自动带前缀，precache 36–38 项。
- **未做**：推送通知、后台同步、运行时接口缓存；`viewport-fit=cover` 仍未开（理由同 B2）。
- **未验证**：真机「添加到主屏幕」安装流程与 iOS Safari 独立窗口下的安全区表现。

#### D3 · 首屏瘦身（P2）

**现状**：按 gzip 实测，首屏静态 JS = `settings`（全量语料 + 共享代码）92.3 KiB + `app` 30.4 KiB + `HomeView` 7.8 KiB + `session`/`progress` 2.8 KiB ≈ 133 KiB；另外 `HomeView` 还静态 import 了 gsap（27.4 KiB gz）。

**做什么**：把动画库移出关键路径。`HomeView` 不再静态 `import gsap`，改成首帧画完（`requestIdleCallback`，Safari 退化 200ms）再与 `ScrollTrigger` 一起动态加载；`prefers-reduced-motion` 的用户直接跳过、一个字节都不下载。

**不做**：不拆语料。实测语料本身 92 KiB gz，且首页要用它算 `phrases.length`、已掌握数（与 `progress` 求交）、`tagCounts`、今日一句与演示区；按分类拆成动态 import 会同时牺牲预渲染正文的首屏可见性与首页计数，收益却远小于复杂度。`AnswerFeedback` 的 gsap 保留静态导入（学习页首次答题就要动画，动态化没有收益）。

**验收（按 gzip 计，可复测）**：首页首屏静态 JS 从 156.9 KiB 降到 130.1 KiB（−17.4%）；`HomeView` chunk 里不再出现 `gsap-*.js` 静态 import；gsap / ScrollTrigger 在首帧之后才请求，关闭动效时不请求；首页、词库、学习、统计、设置功能与 13 页预渲染正文不变；`build` 通过 postbuild 与 PWA 门禁。

**落地记录（2026-11-21）**

- 改动只在 `HomeView.vue`：删掉静态 `import gsap from 'gsap'`，`mm` 的类型从 `ReturnType<typeof gsap.matchMedia>` 换成 `{ revert: () => void }`（类型引用也会把 gsap 拉回依赖图），挂载后按 `requestIdleCallback(timeout 1500)` 调度 `setupMotion()`，内部 `Promise.all([import('gsap'), import('gsap/ScrollTrigger')])`。
- 实测（`vite preview`，gzip）：`app` 30380 + `settings` 92291 + `HomeView` 7783 + `session` 1802 + `progress` 1005 = **133261 B（130.1 KiB）**，改动前同口径 160659 B（156.9 KiB）。
- 浏览器验证：console 0 报错；`gsap-C_a4uAT2.js` / `ScrollTrigger-Dg2oAicK.js` 在首帧后按需加载（`gsapVersions` = 3.15.1），首屏无闪烁、无布局跳动，reveal 元素动画结束后 `transform: none`。
- **未做**：语料拆包；`scroll-behavior` / 字体等 CSS 侧收益本轮未测。

#### D4 · 内容补齐（P2，长尾）

**现状**：`check:content` 软指标显示 L5 占 0%、`tip` 覆盖率 3%（D4 第 1 轮后为 L5 2%、tip 7%）。

**做什么**：每轮补 20–30 条，优先「高频但易错」的 L4/L5 短语（学术写作、商务邮件、习语），同步补 `tip`（≤40 字的一条用法提醒）；保持每个 `aliases` ≥2 汉字、`exampleEn` 逐字含 `en`。

**验收**：每轮 `check:content` 通过且 L5 占比、`tip` 覆盖率单调上升；文档条数与分类数同步。

**落地记录（2026-11-21，第 1 轮）**

- 新增 30 条：学术写作 12（`academic-051`–`062`）、商务邮件 10（`business-049`–`058`）、习语 8（`idioms-168`–`175`），全部带 `tip`；其中 L5 14 条（`on the grounds that`、`call into question`、`stands to reason`、`at the outset`、`by virtue of`、`lend itself to`、`in the interim`、`bring to your attention`、`in due course`、`subject to approval`、`at the discretion of`、`in the wake of`、`read between the lines`、`draw a distinction`），L4 16 条。
- 软指标：L5 0% → 2%（14 条），L4 8% → 10%，`tip` 覆盖率 3% → 7%，总量 789 → 819；`check:content` 硬指标全过（`id`/`en` 唯一、别名 ≥2 汉字、`exampleEn` 含可挖空形式）。
- 新增条目的选型标准：① 真实高频但中文容易说错的正式搭配；② 能写出一条可操作的用法提醒（所以 `tip` 才不是凑数）；③ 例句里保留原形，避免堆在 `enAliases`。`lend itself to` 因主谓一致需要 `enAliases` 收录 `lends itself to` / `lend themselves to`。
- 已先查重：候选里 `with respect to`、`give rise to`、`in accordance with`、`touch base with`、`in the pipeline`、`off the top of my head`、`bite the bullet`、`up in the air` 等存量已有，全部剔除。
- **下一轮建议**：继续补 L5（目标 5%+），优先合同/学术高频（`insofar as`、`notwithstanding`、`on the premise that`）与口述型习语；每轮 20–30 条，保持一主题一提交。

### E 组 · 首屏数据瘦身（2026-11-22 立项）

D3 只把动画库移出了关键路径；首屏最大的一块仍是全量语料（92.3 KiB gz）。按字段实测（819 条、字段字符总量 85192）：`exampleEn`+`exampleZh` 占 **49.3%**，`tip` 1.7%，其余 49.0%。因此「按字段拆」而不是「按分类拆」才是真正有效的那一刀。

#### E1 · 例句与提示改为按需模块（P1）

**做什么**

- 类型拆成两份：`Phrase` 只留 `id/en/zh/aliases/enAliases/category/tags/level`；新增 `PhraseDetail { exampleEn, exampleZh, tip? }`。
- 语料字段重排：`data/phrases/<分类>.ts` 只留基础字段；例句/提示移到 `data/phrases/details/<分类>.ts`，导出 `Record<string, PhraseDetail>`。
- 新增 `data/phrases/details/index.ts` 聚合 `phraseDetails`，但 **`data/phrases/index.ts` 不 import 它**——基座与详情两条 barrel 彻底分开，首页才不会被详情拖回全量。
- 首页只静态 import `details/daily`：用于「今日一句」与演示区；其余页面（学习 / 词库 / 分类）静态 import `details`（全量）。
- `AnswerFeedback` 改为接收 `detail` prop，例句与 `tip` 都从它取。

**不做**：不改判定/排期算法；不做运行时 fetch（仍是打包进 bundle 的静态 chunk）；不给详情做单独的 URL/SEO 页。

**产品取舍（写清楚免得后人看不懂）**：今日一句改为**只从日常口语池取**（原来从全库 819 条取）。理由：首页若允许任意分类，就必须静态 import 全量详情，E1 收益归零；而今日一句的文案本就是「今天带走一句，晚上就能用」，限定口语池更贴题。演示区 `a little bit` 本来就属日常口语，不受影响。

**验收（可复测）**

- 首页首屏静态 JS 从 130.1 KiB gz 降到 **≤ 115 KiB**；首页 chunk 图里不出现 `phraseDetails`（全量）模块，只应出现 `details/daily`。
- `check:content` 新增两类硬校验：每条短语都有对应 detail；不存在孤儿 detail 键。原「例句可挖空」校验改从 detail 读。
- 学习页（含 cloze）、词库、分类页、结果弹框的例句与 `tip` 显示不变；13 页预渲染 HTML 仍逐页包含例句文本（抽查 `grep example`）。
- `pnpm test` / `typecheck` / `build` 全过，测试数只增不减。

**风险**

- 数据重排是一次大 diff：用一次性脚本从旧数据生成新文件，生成后逐条比对 `id/en/zh/aliases/tags/level` 与例句、提示完全一致，再删脚本。
- 详情键用 `id` 而不是数组下标，避免顺序耦合；`phraseDetails` 缺失时页面降级为不显示例句（不白屏、不报错）。

**落地记录（2026-11-22）**

- 首屏静态 JS：130.1 KiB → **112.8 KiB gz（−13.3%）**，chunk 明细：app 30.9 + 共享（settings 视图/语料基座/store）66.8 + HomeView 8.0 + `details/daily` 7.0 + session 1.8 + progress 1.0。
- **没达到开盘时估的 −35%，原因已查清**：按字符占比，例句占 49.3%，但例句是自然语言、gzip 压缩率远低于 `en/zh/aliases/tags` 这类高重复短文本——全量详情实测为 30.9 KiB，只占原语料 92.3 KiB 的 **33%**。按字符占比估算会高估收益，后续一律以 gzip 实测为准。
- 另一个没算进去的入口：首页通过 `stores/session.ts`（静态 import `phrases/phraseById`）仍然背着全量基座语料，所以即使 HomeView 不直接引用，语料也回不到零。
- 已验证：819 条 base 与 detail 逐字段比对通过；新增两条硬校验；62 项测试（原 61 + 1）；`typecheck` / `build` 通过；13 页仍为 `vocabulary` 预渲染页面，分类页 HTML 仍有例句。
- **下一刀**：见 E2（首页去语料）。

**文档**：`ARCHITECTURE`（数据层与 chunk 划分）、`AGENTS`（目录树、字段契约、§3.3 联动表、变更记录）、`CONTRIBUTING`（新增短语仍要写详情文件）、`PRODUCT`（今日一句池子）、`QA`、本文件。

---

#### E2 · 首页去语料（P1）

**背景**：E1 只把例句拆了出去，首页仍然静态 import 全量基座。更隐蔽的一层：**真正背着语料的是外壳 `App.vue`**——它为 SEO 的 meta 描述与分类页 JSON-LD 直接 import 了 `phrases` 与 `categoryContent`，而外壳在每个页面都加载。

**做什么**

- 首页只负责导航：所有入口（开始 / 到期复习 / 5 条快练 / 主题练 / 今日一句）改为跳 `/study?autostart=1&scope=...`，由 `StudyView.startFromQuery()` 取数开练，随后 `router.replace('/study')` 清 query（刷新时回到草稿恢复）。
- `buildQueue` 会把 `phraseIds` 与语料求交，未知 id 天然被丢弃，因此首页不必再用 `phraseById.has()` 过滤。
- 新增 `scripts/gen-summary.mjs` 生成 `src/data/phrases/summary.ts`：总量、分类计数、分类示例短语（SEO 描述用）、主题标签计数、装饰短语；`package.json` 加 `gen:summary`。
- `App.vue` 改读摘要；分类页的面包屑 / 词条集合 / FAQ 的 JSON-LD 移到 `CategoryView.vue`（语料与分类文案本来就由它加载），外壳不再为 SEO 带语料。
- `validate-phrases.mjs` 新增 `validateSummary`，`core.test.ts` 新增摘要一致性用例：摘要任一项与实际语料不符即失败。
- `HomeView` 的「是否有草稿」改到 `onMounted` 里读（`loadSessionDraft` 依赖 sessionStorage），避免 SSG 预渲染与客户端首帧不一致。

**不做**：不做运行时 fetch；不新增路由；不改判定/记忆/队列算法；不为拆包调整 `ssgOptions.includedRoutes`。

**验收（可复测）**

- 首页首屏静态 JS 从 112.8 KiB 降到 **≤ 80 KiB**；首屏 chunk 图里不出现全量语料（`phrases` / `details`），`app` chunk 中不再出现语料 id。
- 五个首页入口都能直达并开练，地址栏不残留 `autostart`；刷新 `/study` 按草稿恢复。
- 分类页预渲染仍输出两段 JSON-LD（站点级 + 面包屑/词条/FAQ），meta 描述仍列举示例短语。
- `check:content` / `test` / `typecheck` / `build` 全过。

**落地记录（2026-11-22）**

- 首屏静态 JS：112.8 KiB → **74.2 KiB gz（−34.2%）**，4 个 chunk：`app` 53.8 + `HomeView` 7.8 + `progress` 7.4 + `daily` 7.0。全量基座（`phrases` 28.7）与全量详情（`details` 30.9）都不在首屏；`app` chunk 中语料 id 计数为 0。
- 外壳减重是主要贡献：`App.vue` 原先同时带着全量基座（约 35 KiB gz）与 `categoryContent`（约 7.3 KiB gz），两者都随每个页面加载。
- 未达到开盘时估的 ~65 KiB：剩下的 `app` 53.8 KiB 基本是 Vue / Router / Pinia / unhead 与 store 的框架成本，压缩空间有限；首页仍保留 `daily` 基座 7.0 KiB（今日一句 + 演示区）与 `progress`（掌握度 / 到期计数）。
- 验证：`check:content` 11 类 / 819 条全过；63 项测试；13 页预渲染正常，分类页 `dist/phrases/academic.html` 含 2 段 JSON-LD（`WebSite/Organization/WebApplication` + `BreadcrumbList/CollectionPage/FAQPage`）、标题「学术写作英语短语 · 60 条」；浏览器实测五个首页入口 + 到期复习（写入一条到期进度）均开练正确、query 已清、刷新恢复，console 0 报错。
- **下一步候选**：`app` 53.8 KiB 里可再拆的只有 store 初始化与 unhead 的按页 head；继续压首屏性价比已下降，建议转向功能与内容。

---

### F 组 · 训练难度与切页反馈（2026-11-22 立项）

**背景**：两个真实使用反馈：

1. 「训练有点难了，一连错几个就没心思了」——默认 20 题、混合 70% 中→英，且答错一律回炉，连错时队列越练越长。
2. 「切换页面有点慢，需要有个交互，不然页面会假死」——路由懒加载的 chunk 下载期间没有任何反馈；首页点「学习」要等学习页 + 全量基座 + 例句约 70 KiB gzip。

#### F1 · 难度档位（P1）

**做什么**

- `types/progress.ts` 新增 `Difficulty = 'easy' | 'normal' | 'challenge'`，`Settings.difficulty` 默认 `easy`；旧设置缺字段或值未知时在 `normalizeSettings` 回退为 `easy`。
- 新增 `lib/difficulty.ts`：档位元数据、混合题型槽位（英→中占比 40% / 30% / 20%）、回炉上限（3 / 6 / 9）、是否自动提示。
- `lib/session.ts` 的 `resolveMode` 按档位分配混合题型；`stores/session.ts` 的 `requeueCurrent()` 到达上限后不再追加，并返回是否真的追加。
- 轻松档连错两题自动展开提示，答对一题收起；自动提示不写入 `hintsUsed`。
- 反馈文案区分「已排到本轮末尾」与「本轮重练已满，下一轮再见」。
- 设置页新增「训练强度」下拉，附当前档位的一句话说明。

**不做**：不改判定严格度（仍是独立设置）；不改每日目标默认值；不按用户水平自动切换档位。

**验收（可复测）**

- 三档混合题型的英→中数量按 20 题计为 8 / 6 / 4；标准档保持原 2 / 6 / 9 槽位。
- 轻松档答错回炉最多 3 条，第 4 次起不再追加；标准/挑战上限为 6 / 9。
- 轻松档连错两题后下一题出现提示框与「连错缓冲中」，答对一题后消失；提示计数不增加。
- 旧数据导入后 `difficulty === 'easy'`；设置页切换后刷新仍保留。

**落地记录（2026-11-22）**：`core.test.ts` 新增 5 项（比例、槽位、上限、回炉截断、旧设置回退），总计 68 项；浏览器实测连错两题自动提示与「轻松 → 挑战 → 刷新 → 切回」持久化通过。

#### F2 · 切页进度条与预取（P1）

**做什么**

- `composables/useRouteProgress.ts`：`beforeEach` 启动 120ms 延迟计时，超时才显示顶部 2px 进度条；`afterEach` / `onError` 收尾。SSG 构建期直接返回恒假状态。
- `App.vue` 渲染进度条（含读屏状态 `aria-live`），`<main>` 绑定 `aria-busy`。
- `composables/useRoutePrefetch.ts`：悬停 / 按下 / 键盘聚焦内部链接时直接调用目标路由的懒加载函数；空闲 1.5s 后预热 `/study`；`saveData` 或 2G/3G 下跳过空闲预热。
- CSS 进度条动画在 `prefers-reduced-motion` 下改为静态。

**不做**：不引入整页遮罩或骨架屏；不改路由表与 `ssgOptions.includedRoutes`；不预取外部链接。

**验收（可复测）**

- 人为给 JS 加 600ms 延迟时，点击未预取页面约 146ms 出现进度条、`aria-busy="true"`，落地后消失。
- 命中缓存或预取完成的切页不出现进度条（不闪）。
- 悬停「词库」后 `LibraryView-*.js` 提前出现在资源列表；首页空闲后 `/study` 的 chunk 已就绪。
- 深/浅主题、窄屏下进度条不遮挡内容；console 无报错。

**落地记录（2026-11-22）**：首屏增加约 1.0 KiB gzip（74.2 → 75.2 KiB），来自进度条与预取逻辑；浏览器实测 600ms 慢网下进度条 146ms 出现、626ms 后消失，悬停预取命中 `LibraryView`，console 0 报错。

---

## 3. 每次迭代的统一门禁

- [ ] `pnpm check:content`（或 `pnpm test` 自动带出）
- [ ] `pnpm test` 全绿，新增逻辑必须有用例
- [ ] `pnpm typecheck`（`noUnusedLocals` 会拦死代码）
- [ ] `pnpm build`：13 页预渲染 + postbuild 校验通过
- [ ] 浏览器实测：桌面 + 窄屏（≤420px）、深/浅主题、console 无报错
- [ ] 文档同步：见 §4 矩阵
- [ ] 提交粒度：一个主题一个 commit；内容/文案/算法/文档拆开时在正文写明

## 4. 文档同步矩阵

| 改动类型 | 必须同步 |
| --- | --- |
| 新增/删除题型 | `types/phrase.ts` → `HomeView` → `SettingsView` → `StudyView` → `normalizeSettings` → 测试 → `PRODUCT` / `AGENTS` §3.3 |
| 新增设置字段 | `types/progress.ts` → `DEFAULT_SETTINGS` / `normalizeSettings` → `SettingsView` → store setter → 文档契约 |
| 难度档位 | `lib/difficulty.ts` → `lib/session.ts` `resolveMode` → `stores/session.ts` 回炉上限 → `StudyView` 连错提示 → `SettingsView` → 测试 → `PRODUCT` / `AGENTS` |
| 记忆/排期算法 | `lib/srs.ts` → 测试 → `PRODUCT` 记忆算法 → `ARCHITECTURE` 契约 → 首页文案（数字引用常量） |
| 新增分类 | `CategoryId` → `categories.ts` → `categoryContent.ts` → 数据文件 → `phrases/index.ts` → 测试断言 → `sitemap`/`llms.txt` 自动 → 文档条数 |
| 新增路由 | `router/index.ts` → `App.vue` 导航 → `ssgOptions.includedRoutes` → `postbuild` sitemap → `SEO.md` |
| 样式层 | `src/styles/tokens.css` 语义变量 → 必要时 `App.vue` `applyTheme` → `QA.md` 对比度 |

## 5. 待决策的开放问题

1. **是否保留「这条我会了」**：它是误判兜底，但也让「已掌握」数字含人工因素；若要更纯的指标，需要把 `markMastered` 与自然掌握分开统计。
2. **错词本是否按时间窗口**：当前方案是终身累计；若要「最近 30 天错词」，需在 `progress` 增 `wrongAt` 队列或改用每日统计聚合，属于契约变更，先不动。
3. **SEO P4 的 100 条如何选**：依赖 Search Console 数据；在数据到手前不做任何页面结构预留。
4. **是否引入 e2e**：现有手工浏览器实测成本可控；若 A2 之后交互继续变多，再评估 Playwright（会新增 CI 时长与锁文件变更）。
