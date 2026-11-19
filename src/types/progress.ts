import type { CategoryId, ModeSetting, StudyMode } from './phrase'

export interface PhraseProgress {
  /** Leitner 盒子编号，0 = 新词，5 = 已掌握 */
  box: number
  correct: number
  wrong: number
  lastReviewed: number
  nextReview: number
}

export interface DayStat {
  reviewed: number
  correct: number
  learned: number
}

export type DayStats = Record<string, DayStat>

export type Strictness = 'strict' | 'normal' | 'lenient'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  dailyGoal: number
  mode: ModeSetting
  categories: CategoryId[]
  strictness: Strictness
  theme: Theme
  /** 空字符串表示自动挑选最自然的英文音色 */
  voiceURI: string
  favorites: string[]
}

export interface AppData {
  version: 1
  exportedAt: string
  progress: Record<string, PhraseProgress>
  settings: Settings
  stats: DayStats
}

export interface QueueItem {
  phraseId: string
  mode: StudyMode
}

/** 本轮训练的快照，只存 sessionStorage：刷新后能接着练，关掉标签页即丢弃 */
export interface SessionDraft {
  day: string
  queue: QueueItem[]
  index: number
  finished: boolean
  correctCount: number
  answeredCount: number
  combo: number
  bestCombo: number
  hintsUsed: number
  answers: { phraseId: string; correct: boolean }[]
  plannedTotal: number
  /** 本轮来源标签，如「词库筛选 · 12 条」「分类：职场沟通」 */
  scopeLabel: string
}
