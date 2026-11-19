import type { CategoryId, ModeSetting, Phrase, StudyMode } from '@/types/phrase'
import type { PhraseProgress, QueueItem, Settings } from '@/types/progress'
import { isDue } from './srs'

/** 本轮训练的临时范围：不写入设置，只影响本次队列 */
export interface QueueScope {
  categories?: CategoryId[]
  mode?: ModeSetting
  /** 指定短语集合（词库筛选结果），此时忽略分类并且不按每日目标截断 */
  phraseIds?: string[]
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 混合模式：约 70% 中→英，30% 英→中 */
function resolveMode(setting: ModeSetting, index: number): StudyMode {
  if (setting !== 'mixed') return setting
  return index % 10 === 2 || index % 10 === 6 || index % 10 === 9 ? 'en-zh' : 'zh-en'
}

export function buildQueue(
  phrases: Phrase[],
  progress: Record<string, PhraseProgress>,
  settings: Pick<Settings, 'categories' | 'dailyGoal' | 'mode'>,
  now: number = Date.now(),
  scope: QueueScope = {},
): QueueItem[] {
  const picked = scope.phraseIds ? new Set(scope.phraseIds) : null
  const categories = scope.categories ?? settings.categories
  const mode = scope.mode ?? settings.mode
  const pool = phrases.filter((phrase) => {
    if (picked) return picked.has(phrase.id)
    return categories.length === 0 || categories.includes(phrase.category)
  })

  // 到期最久的先复习，新词排在其后；未到期的随机打乱作为补充
  const due = pool
    .filter((phrase) => isDue(progress[phrase.id], now))
    .sort(
      (a, b) =>
        (progress[a.id]?.nextReview ?? now) - (progress[b.id]?.nextReview ?? now),
    )
  const upcoming = shuffle(pool.filter((phrase) => !isDue(progress[phrase.id], now)))

  // 指定集合是一次明确的选择，按集合大小练完，不受每日目标截断
  const limit = picked ? pool.length : settings.dailyGoal

  return [...due, ...upcoming]
    .slice(0, limit)
    .map((phrase, index) => ({ phraseId: phrase.id, mode: resolveMode(mode, index) }))
}
