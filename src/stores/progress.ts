import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { BestComboRecord, DayStats, PhraseProgress } from '@/types/progress'
import { dayKey } from '@/lib/date'
import { applyReview, masterProgress } from '@/lib/srs'
import {
  loadBestCombo,
  loadProgress,
  loadStats,
  saveBestCombo,
  saveProgress,
  saveStats,
} from '@/lib/storage'

export const useProgressStore = defineStore('progress', () => {
  const progress = ref<Record<string, PhraseProgress>>(loadProgress())
  const stats = ref<DayStats>(loadStats())
  const bestCombo = ref<BestComboRecord>(loadBestCombo())

  watch(progress, (value) => saveProgress(value), { deep: true })
  watch(stats, (value) => saveStats(value), { deep: true })
  watch(bestCombo, (value) => saveBestCombo(value), { deep: true })

  function recordAnswer(phraseId: string, correct: boolean): void {
    const wasNew = !progress.value[phraseId]
    progress.value = {
      ...progress.value,
      [phraseId]: applyReview(progress.value[phraseId], correct),
    }

    const key = dayKey()
    const previous = stats.value[key] ?? { reviewed: 0, correct: 0, learned: 0 }
    stats.value = {
      ...stats.value,
      [key]: {
        reviewed: previous.reviewed + 1,
        correct: previous.correct + (correct ? 1 : 0),
        learned: previous.learned + (wasNew ? 1 : 0),
      },
    }
  }

  /** 用户声明这条短语已掌握：只调整记忆稳定度与排期，不动当日统计与对错计数 */
  function markMastered(phraseId: string): void {
    progress.value = {
      ...progress.value,
      [phraseId]: masterProgress(progress.value[phraseId]),
    }
  }

  /** 刷新历史最高连对；返回是否真的破了纪录 */
  function noteCombo(combo: number, day: string = dayKey()): boolean {
    if (combo <= bestCombo.value.combo) return false
    bestCombo.value = { combo, day }
    return true
  }

  function replace(
    nextProgress: Record<string, PhraseProgress>,
    nextStats: DayStats,
    nextBestCombo?: BestComboRecord,
  ): void {
    progress.value = { ...nextProgress }
    stats.value = { ...nextStats }
    if (nextBestCombo) bestCombo.value = { ...nextBestCombo }
  }

  function reset(): void {
    progress.value = {}
    stats.value = {}
    bestCombo.value = { combo: 0, day: '' }
  }

  return { progress, stats, bestCombo, recordAnswer, markMastered, noteCombo, replace, reset }
})
