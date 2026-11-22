import type { Difficulty } from '@/types/progress'

export interface DifficultyMeta {
  label: string
  /** 设置页展示的一句话说明 */
  summary: string
  /** 一轮里最多追加多少条重练，超出部分交给下一轮 */
  repeatCap: number
  /** 连错两题后是否自动展开提示 */
  autoHint: boolean
}

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'challenge']

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  easy: {
    label: '轻松',
    summary: '英→中占四成；答错最多回炉 3 条；连错两题自动展开提示，答对一题后收起。',
    repeatCap: 3,
    autoHint: true,
  },
  normal: {
    label: '标准',
    summary: '英→中占三成；答错最多回炉 6 条，不给自动提示。',
    repeatCap: 6,
    autoHint: false,
  },
  challenge: {
    label: '挑战',
    summary: '英→中占两成；答错最多回炉 9 条，不给自动提示。',
    repeatCap: 9,
    autoHint: false,
  },
}

/**
 * 混合训练里英→中出现的槽位（每 10 题一轮）。
 * 用固定槽位而不是随机，保证同一队列的题型分布稳定、可测试。
 */
const EN_ZH_SLOTS: Record<Difficulty, number[]> = {
  easy: [1, 3, 6, 8],
  normal: [2, 6, 9],
  challenge: [4, 9],
}

export function isEnZhSlot(index: number, difficulty: Difficulty = 'normal'): boolean {
  return EN_ZH_SLOTS[difficulty].includes(index % 10)
}

export function repeatCapOf(difficulty: Difficulty = 'normal'): number {
  return DIFFICULTY_META[difficulty].repeatCap
}

export function autoHintOf(difficulty: Difficulty = 'normal'): boolean {
  return DIFFICULTY_META[difficulty].autoHint
}
