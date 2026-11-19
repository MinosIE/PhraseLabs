# 短语贡献指南

欢迎通过 issue 或 Pull Request 补充短语、修正释义和例句。

## 新增一条短语

1. 在 `src/data/phrases/` 找到对应分类的文件；新分类需先在 `types/phrase.ts`、`data/categories.ts` 登记。
2. 按现有格式追加对象，`id` 使用 `<分类>-<三位序号>`，且全库唯一。
3. 字段要求：
   - `en`：完整短语，小写，不带头尾空格；
   - `zh`：中文释义，多个义项用 `；` 分隔；
   - `aliases`：至少 2 个、每个至少 2 个汉字的常见说法，用于键盘输入判定；
   - `enAliases`：可选，记录常见时态/拼写变体；
   - `level`：1–5，按使用频率和难度评估；
   - `exampleEn` / `exampleZh`：自然、可直接使用的双语例句，英文例句中应包含该短语；
   - `tip`：可选，写易错点或介词搭配说明。

示例：

```ts
{ id: 'daily-011', en: 'on the same boat', zh: '处境相同', aliases: ['处境相同', '同一条船'],
  category: 'daily', tags: ['口语'], level: 3,
  exampleEn: 'We are all in the same boat.', exampleZh: '我们处境相同。' },
```

## 提交前检查

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

自检清单：

- [ ] `id` 唯一，序号未与现有条目冲突
- [ ] `aliases` 覆盖常见中文说法，且每个关键词不少于 2 字
- [ ] 英文例句自然并包含该短语
- [ ] 中文释义与例句语义一致
- [ ] 没有重复收录已有短语（同形不同义的词请成对放进 `polysemy.ts`，用释义和例句区分语境）

## Pull Request 流程

1. Fork 仓库并新建分支。
2. 提交修改，说明新增/修改的短语条数与理由。
3. 确保上述命令全部通过。
4. 发起 PR，等待合并；CI 会自动跑测试与 Pages 构建预览。

内容类 PR 一次建议不超过 20 条，便于审阅。
