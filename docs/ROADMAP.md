# 下一步计划（Roadmap）

> 维护约定：每完成一项就在这里勾掉并把细节挪进 `docs/PRODUCT.md` / `docs/ARCHITECTURE.md`；新增计划先写清「做 / 不做 / 验收」，再动代码。
> 最后更新：2026-11-20 · 适用：`main` 分支（当前 `a4818c7`）

## 0. 基线快照

| 维度 | 现状 |
| --- | --- |
| 内容 | 11 类 / 789 条短语，`pnpm check:content` 全过（id/en 唯一、别名 ≥2 汉字、`exampleEn` 可挖空、文档数字一致） |
| 题型 | 中→英 / 英→中 / 例句填空 + 混合（`mixed` 只在生成队列时解析） |
| 记忆 | 记忆稳定度 + 保留率 \(R=0.9^{\Delta t/S}\)，答对 ×1.9、答错 ×0.4，≥15 天算掌握；旧 Leitner `box` 自动换算为 1/1/2/4/7/15 天 |
| 测试 | Vitest 单文件 54 项，`pretest` 自动跑内容校验 |
| 构建 | vite-ssg 预渲染 13 页（首页 + 词库 + 11 分类）；`postbuild` 生成 404 / sitemap / llms.txt 并校验产物 |
| 部署 | GitHub Pages + Actions（先测后构建）；`main` 推送即发布 |
| 已知债务 | 配置层用正则读 TS 源（`vite.config.ts` / `postbuild.mjs`）；分类文案里举例了具体条目 |

## 1. 优先级总览

| 编号 | 主题 | 用户价值 | 成本 | 依赖 | 建议窗口 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | 线上可用性核查 | 高（站点打不开等于 0） | 0.5 天 | 无 | 立即 | ✅ 已完成 2026-11-20 |
| A2 | 高频错词本 | 高（补完复习闭环） | 1.5 天 | 无 | 下一迭代 | ✅ 已完成 2026-11-20 |
| A3 | 内容自检常态化 | 中（防止口径腐化） | 0.5 天 | 无 | 下一迭代 | ✅ 已完成 2026-11-20 |
| B1 | `style.css` 拆分 | 低（维护性） | 2 天 | A2 完成后再动，减少冲突 | R2 | ✅ 已完成 2026-11-20 |
| B2 | 移动端输入体验 | 中高（真实使用场景） | 1 天 | 需真机/模拟器验证 | R2 | 待做 |
| B3 | 别名与判定抽检 | 中（减少误判） | 0.5 天/轮 | 人工语料 | R2 起常态 | 待做 |
| C1 | SEO P4 短语详情页 | 中（长尾流量） | 3–4 天 | 上线数据观察 4–6 周 | R3 | 阻塞（缺数据） |
| C2 | 成绩卡分享 | 低中（传播） | 1 天 | 设计定稿 | R3 可选 | 待产品确认 |
| C3 | 依赖升级 | 中（安全） | 0.5 天/轮 | 见 §2.C3 约束 | 每季度 | 待做 |

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
- 当前实跑：难度 L1 25% / L2 39% / L3 28% / L4 8% / **L5 0%**；别名均长 3.1 字，例句均长 7.8 词，`tip` 覆盖率 3%。前两项健康，`L5` 与 `tip` 是已知缺口（不阻断，留给内容扩充）。

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

---

### B3 · 别名与判定抽检（P2，常态）

每轮从词库随机抽 20 条，用「本应接受」的同义表达手工测试判定，命中 `wrong` 的记为缺别名；补 `aliases` 时保持 ≥2 汉字。产出记录进 `QA.md`「判定抽检」小节，连续两轮 0 缺陷则改为季度抽检。

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
| 记忆/排期算法 | `lib/srs.ts` → 测试 → `PRODUCT` 记忆算法 → `ARCHITECTURE` 契约 → 首页文案（数字引用常量） |
| 新增分类 | `CategoryId` → `categories.ts` → `categoryContent.ts` → 数据文件 → `phrases/index.ts` → 测试断言 → `sitemap`/`llms.txt` 自动 → 文档条数 |
| 新增路由 | `router/index.ts` → `App.vue` 导航 → `ssgOptions.includedRoutes` → `postbuild` sitemap → `SEO.md` |
| 样式层 | `src/styles/tokens.css` 语义变量 → 必要时 `App.vue` `applyTheme` → `QA.md` 对比度 |

## 5. 待决策的开放问题

1. **是否保留「这条我会了」**：它是误判兜底，但也让「已掌握」数字含人工因素；若要更纯的指标，需要把 `markMastered` 与自然掌握分开统计。
2. **错词本是否按时间窗口**：当前方案是终身累计；若要「最近 30 天错词」，需在 `progress` 增 `wrongAt` 队列或改用每日统计聚合，属于契约变更，先不动。
3. **SEO P4 的 100 条如何选**：依赖 Search Console 数据；在数据到手前不做任何页面结构预留。
4. **是否引入 e2e**：现有手工浏览器实测成本可控；若 A2 之后交互继续变多，再评估 Playwright（会新增 CI 时长与锁文件变更）。
