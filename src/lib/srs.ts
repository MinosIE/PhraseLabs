import type { DayStats, PhraseProgress } from '@/types/progress'
import { DAY_MS, dayKey } from './date'

/**
 * 记忆模型：艾宾浩斯式指数衰减 + 稳定度排期。
 *
 * - `stability` 是记忆稳定度（天）：复习完经过这么多天，回忆概率衰减到 `TARGET_RETENTION`。
 * - 保留率 R(Δt) = TARGET_RETENTION ^ (Δt / stability)，R 跌破目标即为到期。
 * - 答对按倍数拉长稳定度（越熟间隔越长）；答错压到 40%，半天后再见。
 */
export const TARGET_RETENTION = 0.9
/** 稳定度下限：答错后最快半天再见，避免「刚练完又立刻到期」 */
const MIN_STABILITY = 0.5
/** 上限半年，防止高频复习把间隔推到没有意义的长度 */
const MAX_STABILITY = 180
/** 稳定度达到这个值算已掌握（约 15 天后再见） */
export const MASTERED_STABILITY = 15
/** 首次接触按 1 天基准起算 */
const SEED_STABILITY = 1
/** 正常复习时的稳定度增长倍数（首页宣传文案直接引用，改进算法时不会说法脱节） */
export const GROWTH = 1.9
const GROWTH_FADED = 1.35
/** 逾期比例超过它，说明这次是「快忘了才回来」的复习 */
const FADED_RATIO = 1.5
/** 答错时稳定度缩水比例 */
export const DECAY = 0.4
/** 错得多的词答对时增长打折，避免难词被推得太远 */
const HARD_WRONG_RATE = 0.4
const HARD_GROWTH_FACTOR = 0.85

function clampStability(value: number): number {
  return Math.min(Math.max(value, MIN_STABILITY), MAX_STABILITY)
}

export function createProgress(now: number = Date.now()): PhraseProgress {
  return { stability: 0, correct: 0, wrong: 0, lastReviewed: 0, nextReview: now }
}

/** 当前稳定度：没学过或数据异常时退回基准值 */
export function stabilityOf(progress: PhraseProgress | undefined): number {
  if (!progress) return SEED_STABILITY
  return clampStability(progress.stability > 0 ? progress.stability : SEED_STABILITY)
}

/** 此刻的回忆概率：0 = 完全忘了，1 = 刚复习完 */
export function retrievability(
  progress: PhraseProgress | undefined,
  now: number = Date.now(),
): number {
  if (!progress || !progress.lastReviewed) return 0
  const elapsedDays = Math.max(0, now - progress.lastReviewed) / DAY_MS
  return Math.pow(TARGET_RETENTION, elapsedDays / stabilityOf(progress))
}

/** 答对拉长稳定度，答错压短；下次到期时间由新的稳定度换算 */
export function applyReview(
  progress: PhraseProgress | undefined,
  correct: boolean,
  now: number = Date.now(),
): PhraseProgress {
  const current = progress ?? createProgress(now)
  const base = stabilityOf(current)
  const elapsedDays = current.lastReviewed ? Math.max(0, now - current.lastReviewed) / DAY_MS : base
  const ratio = current.lastReviewed ? elapsedDays / base : 1

  let stability: number
  if (correct) {
    const growth = ratio >= FADED_RATIO ? GROWTH_FADED : GROWTH
    const seen = current.correct + current.wrong
    const hard = seen >= 2 && current.wrong / seen > HARD_WRONG_RATE
    stability = base * growth * (hard ? HARD_GROWTH_FACTOR : 1)
  } else {
    stability = base * DECAY
  }
  const next = clampStability(stability)

  return {
    stability: next,
    correct: current.correct + (correct ? 1 : 0),
    wrong: current.wrong + (correct ? 0 : 1),
    lastReviewed: now,
    nextReview: now + next * DAY_MS,
  }
}

/**
 * 用户声明「这条我会了」：把稳定度抬到已掌握并推后排期，
 * 不改正确/错误计数——答错了就是答错了，只是不必再练。
 */
export function masterProgress(
  progress: PhraseProgress | undefined,
  now: number = Date.now(),
): PhraseProgress {
  const current = progress ?? createProgress(now)
  const stability = Math.max(stabilityOf(current), MASTERED_STABILITY)

  return {
    ...current,
    stability,
    lastReviewed: now,
    nextReview: now + stability * DAY_MS,
  }
}

export function isDue(progress: PhraseProgress | undefined, now: number = Date.now()): boolean {
  return !progress || progress.nextReview <= now
}

export function isMastered(progress: PhraseProgress | undefined): boolean {
  return !!progress && stabilityOf(progress) >= MASTERED_STABILITY
}

/** 到指定时刻之前需要复习的短语数（只统计已学过的，新词不算到期） */
export function countDueBefore(
  progress: Record<string, PhraseProgress>,
  timestamp: number,
): number {
  return Object.values(progress).filter((item) => item.nextReview <= timestamp).length
}

export function computeStreak(stats: DayStats, now: number = Date.now()): number {
  const studied = Object.entries(stats)
    .filter(([, stat]) => stat.reviewed > 0)
    .map(([key]) => key)

  let cursor = dayKey(now)
  if (!studied.includes(cursor)) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    cursor = dayKey(yesterday.getTime())
  }

  let streak = 0
  while (studied.includes(cursor)) {
    streak++
    const date = new Date(`${cursor}T12:00:00`)
    date.setDate(date.getDate() - 1)
    cursor = dayKey(date.getTime())
  }
  return streak
}
