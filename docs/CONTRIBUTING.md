# 短语贡献指南

欢迎通过 issue 或 Pull Request 补充短语、修正释义和例句。

## 新增一条短语

1. 在 `src/data/phrases/` 找到对应分类的**基座文件**（`id/en/zh/别名/tags/level`），再在 `src/data/phrases/details/` 的**同名详情文件**里补例句与提示；新分类需先在 `types/phrase.ts`、`data/categories.ts` 登记，并在两条 barrel（`data/phrases/index.ts`、`details/index.ts`）都登记。
2. 按现有格式追加对象，`id` 使用 `<分类>-<三位序号>`，且全库唯一；**基座与详情用同一个 `id` 作键**，两边必须同时增删。
3. 字段要求：
   - `en`：完整短语，小写，不带头尾空格；叠词习语可只用连字符（如 `fifty-fifty`），其余必须是含空格的短语；
   - `zh`：中文释义，多个义项用 `；` 分隔；
   - `aliases`：至少 2 个、每个至少 2 个汉字的常见说法，用于键盘输入判定；
   - `enAliases`：可选，记录常见时态/拼写变体；含 `one’s` / `someone` 的短语必须在这里补上例句里的实际形式，否则填空模式挖不出空；
   - `level`：1–5，按使用频率和难度评估；
   - 详情文件里的 `exampleEn` / `exampleZh`：自然、可直接使用的双语例句，英文例句中应包含该短语或它的 `enAliases` 形式；
   - 详情文件里的 `tip`：可选，写易错点或介词搭配说明。

> 当前内容缺口（`pnpm check:content` 软指标）：L5 仅 2%、`tip` 覆盖 7%。新增条目优先选「高频但中文容易说错」的正式搭配/难句（学术写作、商务邮件、合同与制度用语），并在 `tip` 里写一条能照着用的提醒（40 字以内）；只写“注意用法”之类的空话不算。

示例：

```ts
// src/data/phrases/daily.ts
export const dailyPhrases: Phrase[] = [
  { id: 'daily-042', en: 'in the same boat', zh: '处境相同；同病相怜', aliases: ['处境相同', '同病相怜', '同舟共济'],
    category: 'daily', tags: ['口语', '习语'], level: 3 },
]

// src/data/phrases/details/daily.ts
export const dailyDetails: Record<string, PhraseDetail> = {
  'daily-042': { exampleEn: 'We’re all in the same boat, so let’s help each other.', exampleZh: '我们处境相同，所以互相帮忙吧。' },
}
```

> 为什么拆两个文件：例句占语料近半字符，但首页只需要计数与今日一句；详情单独成块后，首页不必下载 819 条例句（见 `docs/ROADMAP.md` E1）。

## 提交前检查

```bash
pnpm install
pnpm check:content   # 内容自检：id/en 唯一、别名长度、例句可挖空、基座与详情一一对应、文档条数
pnpm test            # pretest 会先自动跑一遍上面的检查
pnpm typecheck
pnpm build
```

自检清单：

- [ ] `pnpm check:content` 无输出问题项
- [ ] `id` 唯一，序号未与现有条目冲突
- [ ] `aliases` 覆盖常见中文说法，且每个关键词不少于 2 字
- [ ] 英文例句自然并包含该短语（或 `enAliases` 里的变体），填空模式能挖出空
- [ ] 中文释义与例句语义一致
- [ ] 没有重复收录已有短语（同形不同义的词请成对放进 `polysemy.ts`，用释义和例句区分语境）

## Pull Request 流程

1. Fork 仓库并新建分支。
2. 提交修改，说明新增/修改的短语条数与理由。
3. 确保上述命令全部通过。
4. 发起 PR，等待合并；CI 会自动跑测试与 Pages 构建预览。

内容类 PR 一次建议不超过 20 条，便于审阅。
