#!/usr/bin/env node
/**
 * 生成首页用的语料摘要（src/data/phrases/summary.ts）。
 * 首页不 import 全量语料，只读这份摘要；语料改动后跑 `pnpm gen:summary`，
 * `pnpm check:content` 会校验摘要与真实数据一致，防止数字腐化。
 */
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 首页「按主题练」的标签顺序；改这里要同步首页文案与 docs */
const FEATURED_TAGS = ['口语', '高频', '职场', '邮件', '影视', '正式', '基础', '重复']
/** 首页视差背景的挑选池，取语料里的真实短语 */
const AMBIENT_SOURCE = ['good morning', 'no problem', 'be careful']
/** 首页短语带的挑选池 */
const RIBBON_SOURCE = ['book a table', 'in the long run', 'on the other hand', 'no problem']

const server = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true },
})

let phrases
try {
  const module = await server.ssrLoadModule('/src/data/phrases/index.ts')
  phrases = module.phrases
} finally {
  await server.close()
}

const categoryCounts = {}
const tagCounts = {}
for (const phrase of phrases) {
  categoryCounts[phrase.category] = (categoryCounts[phrase.category] ?? 0) + 1
  for (const tag of phrase.tags ?? []) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
}

const featured = FEATURED_TAGS.map((tag) => `  '${tag}': ${tagCounts[tag] ?? 0},`)
const ambient = AMBIENT_SOURCE.map((en) => phrases.find((phrase) => phrase.en === en)).filter(Boolean)
const ribbon = RIBBON_SOURCE.filter((en) => phrases.some((phrase) => phrase.en === en))

if (ambient.length < 2) throw new Error('AMBIENT_SOURCE 在语料里不足 2 条，首页视差层会退化')
if (ribbon.length < 2) throw new Error('RIBBON_SOURCE 在语料里不足 2 条，首页短语带会退化')

const categoryLines = Object.entries(categoryCounts)
  .map(([id, count]) => `  ${id}: ${count},`)
  .join('\n')
/** 分类页 meta 描述里的示例短语：每个分类取前 3 条，避免外壳为了 SEO 引入全量语料 */
const sampleLines = Object.keys(categoryCounts)
  .map((id) => {
    const sample = phrases.filter((phrase) => phrase.category === id).slice(0, 3)
    return `  ${id}: [${sample.map((phrase) => `'${phrase.en.replace(/'/g, "\\'")}'`).join(', ')}],`
  })
  .join('\n')
const ambientLines = ambient
  .map((phrase) => `  { id: '${phrase.id}', en: '${phrase.en}' },`)
  .join('\n')
const ribbonLines = ribbon.map((en) => `  '${en}',`).join('\n')

const source = `import type { CategoryId } from '@/types/phrase'

/**
 * 站点外壳与首页用的语料摘要：总量、分类计数与示例、主题标签计数、装饰短语。
 * 由 \`pnpm gen:summary\` 从真实语料生成，\`pnpm check:content\` 会校验一致性。
 * 外壳与首页只读这份文件，不 import 全量语料——否则首屏会重新背上 819 条数据。
 */
export const PHRASE_TOTAL = ${phrases.length}

export const CATEGORY_COUNTS: Record<CategoryId, number> = {
${categoryLines}
}

/** 分类页 meta 描述里列举的示例短语（每类 3 条，顺序即语料顺序） */
export const CATEGORY_SAMPLES: Record<CategoryId, string[]> = {
${sampleLines}
}

/** 首页「按主题练」展示的标签与条数（顺序即展示顺序） */
export const FEATURED_TAG_COUNTS: Record<string, number> = {
${featured.join('\n')}
}

/** 首页视差背景用的真实短语 */
export const AMBIENT_PHRASES: { id: string; en: string }[] = [
${ambientLines}
]

/** 首页短语带用的真实短语 */
export const RIBBON_PHRASES: string[] = [
${ribbonLines}
]
`

await writeFile(resolve(root, 'src/data/phrases/summary.ts'), source)
console.log(
  `[gen:summary] 已写入 ${phrases.length} 条摘要：${Object.keys(categoryCounts).length} 个分类 / ${featured.length} 个标签`,
)
