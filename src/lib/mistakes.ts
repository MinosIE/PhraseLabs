import { MASTERED_STABILITY, stabilityOf } from './srs'
import type { Phrase } from '@/types/phrase'
import type { PhraseProgress } from '@/types/progress'

/** 至少错两次，或错误率过四成（且不是手滑一次）：一次失误不该进错词本 */
const MIN_WRONG = 2
const MIN_ATTEMPTS = 2
const HIGH_ERROR_RATE = 0.4

export interface MistakeEntry {
  phrase: Phrase
  progress: PhraseProgress
  /** 错误率 0–1，错次相同时用来排序 */
  errorRate: number
}

export function errorRateOf(progress: PhraseProgress): number {
  const attempts = progress.correct + progress.wrong
  return attempts === 0 ? 0 : progress.wrong / attempts
}

/**
 * 错词定义：还在复习周期内（稳定度没到掌握线），并且错得够多或错得够频繁。
 * 稳定度 ≥15 天后自动淡出，不需要「删除错词」这类手动操作。
 */
export function isMistake(progress: PhraseProgress | undefined): boolean {
  if (!progress || progress.wrong === 0) return false
  if (stabilityOf(progress) >= MASTERED_STABILITY) return false
  if (progress.wrong >= MIN_WRONG) return true
  return (
    progress.correct + progress.wrong >= MIN_ATTEMPTS &&
    errorRateOf(progress) >= HIGH_ERROR_RATE
  )
}

/** 错得多 → 错误率高 → 稳定度低；末尾用 id 兜底，保证同一份数据顺序稳定 */
export function compareMistakes(a: MistakeEntry, b: MistakeEntry): number {
  return (
    b.progress.wrong - a.progress.wrong ||
    b.errorRate - a.errorRate ||
    stabilityOf(a.progress) - stabilityOf(b.progress) ||
    a.phrase.id.localeCompare(b.phrase.id)
  )
}

/** 从进度表里挑出错词，默认前 10 条 */
export function pickMistakes(
  phrases: Phrase[],
  progress: Record<string, PhraseProgress>,
  limit = 10,
): MistakeEntry[] {
  const entries: MistakeEntry[] = []
  for (const phrase of phrases) {
    const record = progress[phrase.id]
    if (!record || !isMistake(record)) continue
    entries.push({ phrase, progress: record, errorRate: errorRateOf(record) })
  }
  return entries.sort(compareMistakes).slice(0, Math.max(0, limit))
}
