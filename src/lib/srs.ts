import type { DayStats, PhraseProgress } from '@/types/progress'
import { addDays, dayKey } from './date'

const INTERVALS = [1, 2, 4, 7, 15, 30]

export function createProgress(now: number = Date.now()): PhraseProgress {
  return { box: 0, correct: 0, wrong: 0, lastReviewed: 0, nextReview: now }
}

/** 答对升一级，答错降两级；最低回到 0，最高停在 5 */
export function applyReview(
  progress: PhraseProgress | undefined,
  correct: boolean,
  now: number = Date.now(),
): PhraseProgress {
  const current = progress ?? createProgress(now)
  const box = correct
    ? Math.min(current.box + 1, INTERVALS.length - 1)
    : Math.max(current.box - 2, 0)

  return {
    box,
    correct: current.correct + (correct ? 1 : 0),
    wrong: current.wrong + (correct ? 0 : 1),
    lastReviewed: now,
    nextReview: addDays(now, INTERVALS[box - 1] ?? 1),
  }
}

export function isDue(progress: PhraseProgress | undefined, now: number = Date.now()): boolean {
  return !progress || progress.nextReview <= now
}

export function isMastered(progress: PhraseProgress | undefined): boolean {
  return !!progress && progress.box >= 4
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
