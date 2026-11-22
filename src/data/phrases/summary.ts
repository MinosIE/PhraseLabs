import type { CategoryId } from '@/types/phrase'

/**
 * 站点外壳与首页用的语料摘要：总量、分类计数与示例、主题标签计数、装饰短语。
 * 由 `pnpm gen:summary` 从真实语料生成，`pnpm check:content` 会校验一致性。
 * 外壳与首页只读这份文件，不 import 全量语料——否则首屏会重新背上 819 条数据。
 */
export const PHRASE_TOTAL = 819

export const CATEGORY_COUNTS: Record<CategoryId, number> = {
  daily: 148,
  work: 46,
  phrasal: 77,
  prep: 44,
  business: 54,
  academic: 60,
  travel: 44,
  idioms: 174,
  emotions: 44,
  connectors: 44,
  polysemy: 84,
}

/** 分类页 meta 描述里列举的示例短语（每类 3 条，顺序即语料顺序） */
export const CATEGORY_SAMPLES: Record<CategoryId, string[]> = {
  daily: ['catch up with', 'make sense', 'no big deal'],
  work: ['follow up on', 'touch base with', 'loop in'],
  phrasal: ['put up with', 'come up with', 'look forward to'],
  prep: ['be responsible for', 'in terms of', 'be good at'],
  business: ['at your earliest convenience', 'please find attached', 'circle back'],
  academic: ['in light of', 'contribute to', 'account for'],
  travel: ['check in', 'check out', 'get stuck in'],
  idioms: ['on the fence', 'in hot water', 'read between the lines'],
  emotions: ['fed up with', 'be thrilled about', 'be anxious about'],
  connectors: ['in addition to', 'on the other hand', 'as a result'],
  polysemy: ['book a table', 'read a book', 'can drive'],
}

/** 首页「按主题练」展示的标签与条数（顺序即展示顺序） */
export const FEATURED_TAG_COUNTS: Record<string, number> = {
  '口语': 215,
  '高频': 179,
  '职场': 76,
  '邮件': 27,
  '影视': 40,
  '正式': 120,
  '基础': 98,
  '重复': 62,
}

/** 首页视差背景用的真实短语 */
export const AMBIENT_PHRASES: { id: string; en: string }[] = [
  { id: 'daily-066', en: 'good morning' },
  { id: 'daily-085', en: 'no problem' },
  { id: 'daily-103', en: 'be careful' },
]

/** 首页短语带用的真实短语 */
export const RIBBON_PHRASES: string[] = [
  'book a table',
  'in the long run',
  'on the other hand',
  'no problem',
]
