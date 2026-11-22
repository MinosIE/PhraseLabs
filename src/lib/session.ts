import type { CategoryId, ModeSetting, Phrase, StudyMode } from '@/types/phrase'
import type { PhraseProgress, QueueItem, Settings } from '@/types/progress'
import { pickMistakes } from './mistakes'
import { isDue, retrievability } from './srs'

/** 错词在每日目标里最多占三成：没到期的错词被提前拉进来，但不能把到期项挤掉 */
const MISTAKE_SHARE = 0.3

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

  // 真到期（学过且到了复习日）按记忆保留率从低到高排：快忘的先复习。
  // 没学过的词不进这一档：它们数量太大，会把每日目标占满，错词就永远排不进来。
  const seen = (phrase: Phrase) => Boolean(progress[phrase.id])
  const due = pool
    .filter((phrase) => seen(phrase) && isDue(progress[phrase.id], now))
    .sort((a, b) => {
      const gap = retrievability(progress[a.id], now) - retrievability(progress[b.id], now)
      if (gap !== 0) return gap
      return (progress[a.id]?.nextReview ?? now) - (progress[b.id]?.nextReview ?? now)
    })
  const dueIds = new Set(due.map((phrase) => phrase.id))
  const rest = pool.filter((phrase) => !dueIds.has(phrase.id))

  // 错词优先：还没到复习时间、但被判定为错词的顶上，占每日目标的三成为上限。
  // 指定集合是一次明确的选择，不插入额外条目。
  const mistakeCap = Math.max(1, Math.round(settings.dailyGoal * MISTAKE_SHARE))
  const mistakes = picked
    ? []
    : pickMistakes(rest, progress, mistakeCap).map((entry) => entry.phrase)
  const mistakeIds = new Set(mistakes.map((phrase) => phrase.id))
  // 余下名额随机补：未学新词与本次没被选中的未到期词一视同仁
  const upcoming = shuffle(rest.filter((phrase) => !mistakeIds.has(phrase.id)))

  // 指定集合是一次明确的选择，按集合大小练完，不受每日目标截断
  const limit = picked ? pool.length : settings.dailyGoal

  return [...due, ...mistakes, ...upcoming]
    .slice(0, limit)
    .map((phrase, index) => ({ phraseId: phrase.id, mode: resolveMode(mode, index) }))
}
