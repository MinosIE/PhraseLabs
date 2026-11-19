import type { Phrase } from '@/types/phrase'
import { dailyPhrases } from './daily'
import { workPhrases } from './work'
import { phrasalPhrases } from './phrasal'
import { prepPhrases } from './prep'
import { businessPhrases } from './business'
import { academicPhrases } from './academic'
import { travelPhrases } from './travel'
import { idiomPhrases } from './idioms'
import { emotionPhrases } from './emotions'
import { connectorPhrases } from './connectors'
import { polysemyPhrases } from './polysemy'

export const phrases: Phrase[] = [
  ...dailyPhrases,
  ...workPhrases,
  ...phrasalPhrases,
  ...prepPhrases,
  ...businessPhrases,
  ...academicPhrases,
  ...travelPhrases,
  ...idiomPhrases,
  ...emotionPhrases,
  ...connectorPhrases,
  ...polysemyPhrases,
]

export const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]))

/** 每个分类的短语数量，供分类卡片和筛选 chip 展示 */
export const phraseCountByCategory = phrases.reduce<Record<string, number>>((counts, phrase) => {
  counts[phrase.category] = (counts[phrase.category] ?? 0) + 1
  return counts
}, {})
