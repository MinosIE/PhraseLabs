import type { CategoryId, ModeSetting, StudyMode } from './phrase'

export interface PhraseProgress {
  /** 记忆稳定度（天）：复习后经过这么多天，回忆概率衰减到 90% */
  stability: number
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

/** 历史最高连对，跨会话累计，只增不减 */
export interface BestComboRecord {
  combo: number
  /** 创下记录当天（YYYY-MM-DD）；空串表示还没有记录 */
  day: string
}

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
  /** 可选：旧备份没有这一项，导入时回退为 0 */
  bestCombo?: BestComboRecord
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
  /** 本轮开始前已掌握的短语数，用于结算时算「本轮新掌握」 */
  masteredAtStart: number
  /** 本轮来源标签，如「词库筛选 · 12 条」「分类：职场沟通」 */
  scopeLabel: string
}
