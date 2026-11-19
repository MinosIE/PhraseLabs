import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { DayStats, PhraseProgress } from '@/types/progress'
import { dayKey } from '@/lib/date'
import { applyReview } from '@/lib/srs'
import { loadProgress, loadStats, saveProgress, saveStats } from '@/lib/storage'

export const useProgressStore = defineStore('progress', () => {
  const progress = ref<Record<string, PhraseProgress>>(loadProgress())
  const stats = ref<DayStats>(loadStats())

  watch(progress, (value) => saveProgress(value), { deep: true })
  watch(stats, (value) => saveStats(value), { deep: true })

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

  function markCorrect(phraseId: string): void {
    progress.value = {
      ...progress.value,
      [phraseId]: applyReview(progress.value[phraseId], true),
    }
    const key = dayKey()
    const previous = stats.value[key] ?? { reviewed: 0, correct: 0, learned: 0 }
    stats.value = {
      ...stats.value,
      [key]: { ...previous, correct: previous.correct + 1 },
    }
  }

  function replace(nextProgress: Record<string, PhraseProgress>, nextStats: DayStats): void {
    progress.value = { ...nextProgress }
    stats.value = { ...nextStats }
  }

  function reset(): void {
    progress.value = {}
    stats.value = {}
  }

  return { progress, stats, recordAnswer, markCorrect, replace, reset }
})
