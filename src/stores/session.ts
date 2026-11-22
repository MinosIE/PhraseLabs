import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { phrases, phraseById } from '@/data/phrases'
import { dayKey } from '@/lib/date'
import { repeatCapOf } from '@/lib/difficulty'
import { buildQueue, type QueueScope } from '@/lib/session'
import { isMastered } from '@/lib/srs'
import { clearSessionDraft, loadSessionDraft, saveSessionDraft } from '@/lib/storage'
import type { Phrase, StudyMode } from '@/types/phrase'
import type { QueueItem } from '@/types/progress'
import { useProgressStore } from './progress'
import { useSettingsStore } from './settings'

export interface StartOptions extends QueueScope {
  /** 本轮来源标签，如「词库筛选 · 12 条」 */
  label?: string
}

export const useSessionStore = defineStore('session', () => {
  const queue = ref<QueueItem[]>([])
  const index = ref(0)
  const finished = ref(false)
  const correctCount = ref(0)
  const answeredCount = ref(0)
  const combo = ref(0)
  const bestCombo = ref(0)
  /** 本轮是否刷新了历史最高连对（结算页显示「新纪录」）；不落草稿，刷新后仅少一个徽标 */
  const recordBeaten = ref(false)
  const hintsUsed = ref(0)
  const answers = ref<{ phraseId: string; correct: boolean }[]>([])
  /** 本轮开始时的题目总数；重练追加不影响它，进度条因此不会倒退 */
  const plannedTotal = ref(0)
  /** 本轮开始时已掌握的短语数，结算时用它算「本轮新掌握」 */
  const masteredAtStart = ref(0)
  const scopeLabel = ref('')
  /** 上一次开练用的临时范围，结算页「再来一轮」沿用它；不落草稿 */
  const lastOptions = ref<StartOptions>({})

  const current = computed<{ phrase: Phrase; mode: StudyMode } | null>(() => {
    const item = queue.value[index.value]
    if (!item) return null
    const phrase = phraseById.get(item.phraseId)
    return phrase ? { phrase, mode: item.mode } : null
  })

  const total = computed(() => queue.value.length)
  const served = computed(() => Math.min(index.value + (finished.value ? 0 : 1), queue.value.length))
  const accuracy = computed(() =>
    answeredCount.value === 0
      ? 0
      : Math.round((correctCount.value / answeredCount.value) * 100),
  )
  /** 答错后追加到队尾的重练题数 */
  const pendingRepeats = computed(() => Math.max(0, queue.value.length - plannedTotal.value))
  /** 本轮最多追加多少条重练，由难度档位决定；超出的错词留给下一轮 */
  const repeatCap = computed(() => repeatCapOf(useSettingsStore().settings.difficulty))

  function persist(): void {
    if (!queue.value.length) return
    saveSessionDraft({
      day: dayKey(),
      queue: queue.value,
      index: index.value,
      finished: finished.value,
      correctCount: correctCount.value,
      answeredCount: answeredCount.value,
      combo: combo.value,
      bestCombo: bestCombo.value,
      hintsUsed: hintsUsed.value,
      answers: answers.value,
      plannedTotal: plannedTotal.value,
      masteredAtStart: masteredAtStart.value,
      scopeLabel: scopeLabel.value,
    })
  }

  watch(
    [queue, index, finished, correctCount, answeredCount, combo, bestCombo, hintsUsed, answers, plannedTotal, masteredAtStart, scopeLabel],
    persist,
    { deep: true },
  )

  function start(options: StartOptions = {}): void {
    const settingsStore = useSettingsStore()
    const progressStore = useProgressStore()
    queue.value = buildQueue(
      phrases,
      progressStore.progress,
      settingsStore.settings,
      Date.now(),
      options,
    )
    index.value = 0
    correctCount.value = 0
    answeredCount.value = 0
    combo.value = 0
    bestCombo.value = 0
    recordBeaten.value = false
    hintsUsed.value = 0
    answers.value = []
    plannedTotal.value = queue.value.length
    masteredAtStart.value = Object.values(progressStore.progress).filter(isMastered).length
    scopeLabel.value = options.label ?? ''
    lastOptions.value = { ...options }
    finished.value = queue.value.length === 0
  }

  /** 只练指定短语集合（词库筛选结果、统计页待复习清单） */
  function startWith(ids: string[], label = ''): void {
    start({ phraseIds: ids, label })
  }

  /** 恢复当天未完成的本轮训练；没有有效草稿时返回 false */
  function restore(): boolean {
    const draft = loadSessionDraft()
    if (!draft) return false
    const restored = draft.queue.filter((item) => phraseById.has(item.phraseId))
    if (!restored.length) {
      clearSessionDraft()
      return false
    }
    queue.value = restored
    index.value = Math.min(draft.index, restored.length - 1)
    finished.value = draft.finished
    correctCount.value = draft.correctCount
    answeredCount.value = draft.answeredCount
    combo.value = draft.combo
    bestCombo.value = draft.bestCombo
    hintsUsed.value = draft.hintsUsed
    answers.value = draft.answers.filter((answer) => phraseById.has(answer.phraseId))
    plannedTotal.value = Math.max(draft.plannedTotal, index.value + 1)
    masteredAtStart.value = draft.masteredAtStart
    scopeLabel.value = draft.scopeLabel
    return true
  }

  function record(correct: boolean): void {
    answeredCount.value++
    const phraseId = current.value?.phrase.id
    if (phraseId) answers.value = [...answers.value, { phraseId, correct }]
    if (correct) {
      correctCount.value++
      combo.value++
      bestCombo.value = Math.max(bestCombo.value, combo.value)
      if (useProgressStore().noteCombo(combo.value)) recordBeaten.value = true
    } else {
      combo.value = 0
    }
  }

  /**
   * 结算前把本轮最高连对写进历史记录。
   * 逐题记录已经写过一次，这里兜底刷新恢复的草稿与中断后重新打开的情况。
   */
  function syncBestCombo(): void {
    if (bestCombo.value <= 0) return
    if (useProgressStore().noteCombo(bestCombo.value)) recordBeaten.value = true
  }

  /**
   * 用户声明「这条我会了」：只撤回队尾那次重练，
   * 答案、正确率与连对保持原样（答错了就是答错了）。
   */
  function dropRepeat(): void {
    const item = queue.value[index.value]
    if (!item) return

    const tail = queue.value.length - 1
    if (tail > index.value && queue.value[tail].phraseId === item.phraseId) {
      queue.value = queue.value.slice(0, tail)
    }
  }

  function noteHint(): void {
    hintsUsed.value++
  }

  function advanceIndex(): void {
    if (index.value < queue.value.length - 1) index.value++
    else finished.value = true
  }

  function next(): void {
    advanceIndex()
  }

  function skip(): void {
    combo.value = 0
    advanceIndex()
  }

  /**
   * 把当前题放到本轮末尾再练一次；达到难度档位的回炉上限后不再追加。
   * 返回是否真的追加，调用方据此选择「本轮重练」或「下一轮再见」的文案。
   */
  function requeueCurrent(): boolean {
    const item = queue.value[index.value]
    if (!item) return false
    if (pendingRepeats.value >= repeatCap.value) return false
    queue.value = [...queue.value, { ...item }]
    return true
  }

  function reset(): void {
    queue.value = []
    index.value = 0
    correctCount.value = 0
    answeredCount.value = 0
    combo.value = 0
    bestCombo.value = 0
    recordBeaten.value = false
    hintsUsed.value = 0
    answers.value = []
    plannedTotal.value = 0
    masteredAtStart.value = 0
    scopeLabel.value = ''
    finished.value = false
    clearSessionDraft()
  }

  // 首次创建 store 时自动接上当天的草稿，刷新页面不会丢掉这一轮
  restore()

  return {
    queue,
    index,
    finished,
    correctCount,
    answeredCount,
    combo,
    bestCombo,
    recordBeaten,
    hintsUsed,
    answers,
    plannedTotal,
    masteredAtStart,
    scopeLabel,
    lastOptions,
    current,
    total,
    served,
    accuracy,
    pendingRepeats,
    repeatCap,
    start,
    startWith,
    restore,
    record,
    syncBestCombo,
    dropRepeat,
    noteHint,
    next,
    skip,
    requeueCurrent,
    reset,
  }
})
