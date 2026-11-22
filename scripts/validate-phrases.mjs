#!/usr/bin/env node
/**
 * 内容校验：短语形态、别名长度、例句可挖空、分类计数与文档数字的一致性。
 * 用法：`pnpm check:content`（`pnpm test` 的 pretest 会自动跑一遍）
 *
 * 数据是 TS + `@` 别名，这里借 Vite 的 SSR 加载器读取，
 * 避免再写一份正则解析（正则解析会随字段顺序变化而静默失效）。
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROBLEM_LIMIT = 12

/** 与 StudyView.clozePattern 保持一致：`…` 当作可插入内容 */
function clozePattern(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped.replace(/…/g, '.{0,60}?'), 'i')
}

async function loadData() {
  const server = await createServer({
    root,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true },
  })
  try {
    const [phraseModule, detailModule, categoryModule, normalizeModule] = await Promise.all([
      server.ssrLoadModule('/src/data/phrases/index.ts'),
      server.ssrLoadModule('/src/data/phrases/details/index.ts'),
      server.ssrLoadModule('/src/data/categories.ts'),
      server.ssrLoadModule('/src/lib/normalize.ts'),
    ])
    return {
      phrases: phraseModule.phrases,
      phraseDetails: detailModule.phraseDetails,
      phraseCountByCategory: phraseModule.phraseCountByCategory,
      categories: categoryModule.categories,
      normalizeChinese: normalizeModule.normalizeChinese,
      normalizeEnglish: normalizeModule.normalizeEnglish,
    }
  } finally {
    await server.close()
  }
}

function validatePhrases({
  phrases,
  phraseDetails,
  phraseCountByCategory,
  categories,
  normalizeChinese,
  normalizeEnglish,
}) {
  const problems = []
  const seenIds = new Set()
  const seenEns = new Map()

  for (const phrase of phrases) {
    if (seenIds.has(phrase.id)) problems.push(`重复 id：${phrase.id}`)
    seenIds.add(phrase.id)

    const normalized = normalizeEnglish(phrase.en ?? '')
    if (seenEns.has(normalized)) {
      problems.push(`重复 en：${phrase.en}（与 ${seenEns.get(normalized)} 相同）`)
    }
    seenEns.set(normalized, phrase.id)

    // 训练单位是短语：含空格，或叠词习语用连字符
    if (!/[ -]/.test(phrase.en ?? '')) {
      problems.push(`${phrase.id} 的 en「${phrase.en}」是孤立单词，必须含空格或连字符`)
    }
    if (!phrase.zh?.trim()) problems.push(`${phrase.id} 缺少中文释义`)
    if (!Number.isInteger(phrase.level) || phrase.level < 1 || phrase.level > 5) {
      problems.push(`${phrase.id} 的难度 ${phrase.level} 不在 1–5`)
    }
    if (!phrase.aliases?.length) problems.push(`${phrase.id} 没有中文别名`)

    for (const alias of phrase.aliases ?? []) {
      if (normalizeChinese(alias).length < 2) {
        problems.push(`${phrase.id} 的别名「${alias}」归一化后不足 2 个汉字，会被中文判定过滤掉`)
      }
    }

    const forms = [phrase.en, ...(phrase.enAliases ?? [])].filter(Boolean)
    // 例句与提示存在 details 模块里：基础条目不重复存一份，避免首页为全量例句买单
    const detail = phraseDetails[phrase.id]
    if (!detail) {
      problems.push(`${phrase.id} 缺少例句详情（data/phrases/details/）`)
    } else {
      if (!detail.exampleEn?.trim()) problems.push(`${phrase.id} 缺少英文例句`)
      if (!detail.exampleZh?.trim()) problems.push(`${phrase.id} 缺少中文例句`)
      if (!forms.some((form) => clozePattern(form).test(detail.exampleEn ?? ''))) {
        problems.push(`${phrase.id} 的例句没有包含「${phrase.en}」，例句填空题挖不出空`)
      }
    }
  }

  const detailIds = Object.keys(phraseDetails)
  if (detailIds.length !== phrases.length) {
    problems.push(`例句详情 ${detailIds.length} 条与短语 ${phrases.length} 条不一致`)
  }
  for (const id of detailIds) {
    if (!seenIds.has(id)) problems.push(`例句详情里有孤儿条目：${id}`)
  }

  const registered = new Set(categories.map((category) => category.id))
  const counted = new Map()
  for (const phrase of phrases) {
    counted.set(phrase.category, (counted.get(phrase.category) ?? 0) + 1)
    if (!registered.has(phrase.category)) {
      problems.push(`${phrase.id} 的分类 ${phrase.category} 没有在 data/categories.ts 登记`)
    }
  }

  for (const category of categories) {
    const actual = counted.get(category.id) ?? 0
    if (actual === 0) problems.push(`分类 ${category.id} 没有任何短语`)
    const fromTable = phraseCountByCategory[category.id] ?? -1
    if (fromTable !== actual) {
      problems.push(`分类 ${category.id} 的计数 ${fromTable} 与实际 ${actual} 不符`)
    }
  }

  const declared = Object.values(phraseCountByCategory).reduce((sum, count) => sum + count, 0)
  if (declared !== phrases.length) {
    problems.push(`phraseCountByCategory 合计 ${declared} 与短语总数 ${phrases.length} 不符`)
  }

  return problems
}

async function checkDocs(total, categoryCount, problems) {
  // 文档里的数字是人工维护的，这里只校验能被识别的写法；文案改写过就跳过，避免误报
  const targets = [
    { file: 'README.md', pattern: /(\d+) 条短语、(\d+) 个分类/ },
    { file: 'docs/PRODUCT.md', pattern: /现有 (\d+) 条，分 (\d+) 类/ },
  ]
  for (const { file, pattern } of targets) {
    const text = await readFile(resolve(root, file), 'utf8')
    const match = text.match(pattern)
    if (!match) continue
    if (Number(match[1]) !== total || Number(match[2]) !== categoryCount) {
      problems.push(
        `${file} 写的是 ${match[1]} 条 / ${match[2]} 类，实际 ${total} 条 / ${categoryCount} 类`,
      )
    }
  }
}

/** 软指标：只输出不判定，帮助发现「内容偏斜」（难度堆在一级、别名过短、例句过短、秘诀覆盖率低） */
function reportMetrics({ phrases, phraseDetails, categories, normalizeChinese }) {
  const levels = new Map()
  let aliasChars = 0
  let aliasCount = 0
  let exampleWords = 0
  let withTip = 0

  for (const phrase of phrases) {
    levels.set(phrase.level, (levels.get(phrase.level) ?? 0) + 1)
    for (const alias of phrase.aliases ?? []) {
      aliasChars += normalizeChinese(alias).length
      aliasCount += 1
    }
    exampleWords += (phraseDetails[phrase.id]?.exampleEn ?? '').trim().split(/\s+/).filter(Boolean).length
    if (phraseDetails[phrase.id]?.tip?.trim()) withTip += 1
  }

  const total = phrases.length || 1
  const levelText = [1, 2, 3, 4, 5]
    .map((level) => {
      const count = levels.get(level) ?? 0
      return `L${level} ${count}（${Math.round((count / total) * 100)}%）`
    })
    .join(' / ')
  const categoryText = categories
    .map((category) => `${category.name} ${phrases.filter((p) => p.category === category.id).length}`)
    .join(' / ')

  console.log('[check:content] 软指标（仅供参考，不影响退出码）')
  console.log(`  - 难度分布：${levelText}`)
  console.log(`  - 分类分布：${categoryText}`)
  console.log(`  - 别名平均字数：${(aliasChars / (aliasCount || 1)).toFixed(1)}`)
  console.log(`  - 例句平均词数：${(exampleWords / total).toFixed(1)}`)
  console.log(`  - 要点（tip）覆盖率：${Math.round((withTip / total) * 100)}%`)
}

async function main() {
  const data = await loadData()
  const problems = validatePhrases(data)
  await checkDocs(data.phrases.length, data.categories.length, problems)

  if (problems.length) {
    console.error(`[check:content] 发现 ${problems.length} 个问题：`)
    for (const problem of problems.slice(0, PROBLEM_LIMIT)) console.error(`  - ${problem}`)
    if (problems.length > PROBLEM_LIMIT) {
      console.error(`  … 其余 ${problems.length - PROBLEM_LIMIT} 个已省略`)
    }
    process.exitCode = 1
  } else {
    console.log(
      `[check:content] ${data.categories.length} 个分类 / ${data.phrases.length} 条短语，全部通过`,
    )
  }

  // 软指标只做可见性提醒：异常不改变退出码，避免阻塞内容贡献
  reportMetrics(data)
}

main().catch((error) => {
  console.error('[check:content] 无法完成校验：', error)
  process.exitCode = 1
})
