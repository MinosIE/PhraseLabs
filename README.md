# PhraseLabs

一个免费、纯前端的英语短语键盘训练网站。参考 TypeWords 的键盘流体验：中英互译与例句填空即时判定，错词自动循环，按记忆情况安排复习。无需注册，进度只保存在浏览器本地。

## 功能

- 703 条短语、11 个分类，覆盖日常口语、职场、短语动词、习语、旅行等；除叠词习语用连字符（如 “fifty-fifty”）外，全部以含空格的短语为单位，不收录孤立单词，全库短语唯一，日常口语为重点（148 条，多为简单高频表达与影视台词）；习语收录地道习语与叠词（如 “so-so”“chit-chat”）；另设「一词多义」分类用成对短语展示同词异义（如“book a table”与“read a book”）
- 首页、词库、设置页的分类入口都显示各类条目数量；每个分类有独立的落地页（`/phrases/daily` 等），带该类的专属介绍、练习建议、典型场景与 FAQ，列出全部词条与例句，可直接开练
- 轻量入口：首页「今日一句」每天自动换一条（同一天刷新不变），可直接练这一条或听一遍；每个分类页都有「5 条快练 · 30 秒」
- 静态预渲染：首页、词库与 11 个分类页在构建时就生成完整 HTML，未启用 JavaScript 的爬虫与 AI 抓取器也能读到正文；个人练习界面不参与索引
- 四种训练模式：混合、中 → 英、英 → 中、例句填空
- 键盘优先：`Enter` 提交/下一题，`Esc` 跳过，`⌥H` 提示，`⌥F` 收藏，`⌥R` / `Ctrl+P` 朗读；兼容中文输入法
- 发音：自动优选自然英文音色，语速/音量归一化；设置里可手动换音色
- 单一输入框：中英文模式共用一个输入框，输入期间不做实时判定、不上色、不自动跳格，只在提交后给反馈
- 答错或接近的短语自动排到本轮末尾再练，同时进入后续间隔复习
- 每题答完弹出结果弹框：对错大字、正确答案、例句、连对里程碑、GSAP 庆祝粒子、分场景鼓励文案与今日目标进度；进度下方另留 `✓/✗` 逐题记录
- 本轮结算页：作答数、正确率、本轮最高连对（破纪录时挂「新纪录」徽标）、明天到期；页脚补本轮新掌握、提示次数与历史最高连对日期，「再来一轮」沿用本轮范围，键盘焦点直接落在它上面
- 判定容错：大小写/标点/连字符归一化，支持英文变体与中文别名，三档严格度
- 简化 Leitner 复习：答对升级、答错降级，到期短语优先出现
- 本地进度、每日目标、连续天数、历史最高连对、双色趋势图、周环比、分类掌握度
- 词库防抖搜索、排序、筛选、收藏与朗读；下划线式下拉框支持方向键/Enter/Esc 操作
- 进度支持 JSON 导出/导入（含历史最高连对；旧备份缺该字段时归零）
- 暖纸墨色主题、深浅色切换、焦点可见、跳转链接与 `reduced-motion` 支持；触屏设备上主要按钮与筛选项的可点区域不小于 44px

## 技术栈

`pnpm` · `Vite` · `Vue 3` · `TypeScript` · `Vue Router`（history 模式）· `Pinia` · `Vitest` · `vite-ssg`（构建期预渲染）· `GSAP`。无后端、无运行时 API。

## 本地开发

```bash
pnpm install
pnpm dev          # 开发服务器
pnpm test         # 单元测试
pnpm typecheck    # 类型检查
pnpm build        # 类型检查 + SSG 预渲染构建（含 sitemap/llms.txt/404.html），输出到 dist/
pnpm preview      # 预览构建产物
```

## 部署到 GitHub Pages

1. 把代码推送到 `main` 分支。
2. 在仓库 `Settings → Pages → Build and deployment` 中把 Source 设为 **GitHub Actions**。
3. `.github/workflows/deploy.yml` 会在推送时执行测试、构建并自动部署；`VITE_BASE_PATH` 会按仓库名自动注入，无需手改。
4. 首次部署完成后， Pages 页面地址即为网站地址。

构建会预渲染首页、词库与 11 个分类页（`dist/phrases/<分类>.html`），并生成 `sitemap.xml`、`llms.txt` 与 GitHub Pages 用的 `404.html`；分类页额外输出 `BreadcrumbList`、`CollectionPage`/`DefinedTermSet` 与 `FAQPage` 结构化数据。旧链接若还是 `#/library` 形式，打开后会自动改成 `/library`。绑定自定义域名时，只需修改 `src/lib/seo.ts` 的 `SITE_URL` 后重新构建。

本地如果想复现生产路径，可设置 `VITE_BASE_PATH=/<仓库名>/` 后执行 `pnpm build`。

## 数据与隐私

所有学习记录写在 `localStorage`，键名前缀为 `phraselabs:v1:`。不采集任何用户信息，也不上传数据。清理浏览器数据会丢失进度，请先在「设置 → 数据备份」中导出 JSON。

## 目录结构

```text
scripts/       postbuild（404.html / sitemap.xml / llms.txt / 产物校验）
src/
  data/         短语内容与分类
  lib/          判定、复习算法、存储、SEO 常量与日期工具
  stores/       Pinia 状态（设置/进度/会话）
  views/        六个页面（含分类落地页）
  components/   答题输入与弹框组件
  types/        数据契约
docs/           产品、架构、贡献与 SEO 文档
```

## 文档

- [产品与内容设计](docs/PRODUCT.md)
- [架构与数据契约](docs/ARCHITECTURE.md)
- [短语贡献指南](docs/CONTRIBUTING.md)
- [SEO / GEO 与 SSG](docs/SEO.md)
