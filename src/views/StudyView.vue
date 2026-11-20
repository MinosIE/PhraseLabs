<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AnswerInput from '@/components/AnswerInput.vue'
import AnswerFeedback from '@/components/AnswerFeedback.vue'
import { categories } from '@/data/categories'
import { phraseById, phrases } from '@/data/phrases'
import { DAY_MS, dayKey, formatDate } from '@/lib/date'
import { gradeAnswer, type GradeResult } from '@/lib/grade'
import { shuffle } from '@/lib/session'
import { countDueBefore, isMastered } from '@/lib/srs'
import { speakEn } from '@/lib/speech'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore, type StartOptions } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import type { StudyMode } from '@/types/phrase'

const progressStore = useProgressStore()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()

const revealed = ref(false)
const result = ref<GradeResult | null>(null)
const inputKey = ref('0')
const hintOpen = ref(false)
const shake = ref(false)
const goalReached = ref(false)
const modalRef = ref<HTMLElement | null>(null)
const summaryAction = ref<HTMLButtonElement | null>(null)
const submitting = ref(false)
const speaking = ref(false)
// 本题用户实际输入的内容：结果弹框里并排给出「你的答案」，方便自查错在哪
const submitted = ref('')
// 本题被用户标记为「我会了」，只影响重练与排期，不影响正确率
const mastered = ref(false)

const modeLabel: Record<StudyMode, string> = {
  'zh-en': '中 → 英',
  'en-zh': '英 → 中',
  cloze: '例句填空',
}

const current = computed(() => sessionStore.current)
const isFavorite = computed(() =>
  current.value ? settingsStore.settings.favorites.includes(current.value.phrase.id) : false,
)
const dayReviewed = computed(() => progressStore.stats[dayKey()]?.reviewed ?? 0)
const wrongCount = computed(
  () => progressStore.progress[current.value?.phrase.id ?? '']?.wrong ?? 0,
)
const nextReviewText = computed(() => {
  const next = progressStore.progress[current.value?.phrase.id ?? '']?.nextReview
  if (!next) return '很快'
  const days = Math.max(0, Math.ceil((next - Date.now()) / DAY_MS))
  if (days <= 0) return '今天'
  return days === 1 ? '明天' : `${days} 天后`
})

/* ---------- 本轮结算：只用已经发生的数据，不编造「新学」口径 ---------- */

/** 本轮新掌握：当前已掌握数减去开局快照，负数按 0 处理（答错会降盒） */
const masteredGained = computed(() => {
  const now = Object.values(progressStore.progress).filter(isMastered).length
  return Math.max(0, now - sessionStore.masteredAtStart)
})

/** 明天结束前需要复习的短语数（含已逾期的） */
const dueTomorrow = computed(() => {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return countDueBefore(progressStore.progress, end.getTime() + DAY_MS)
})

/** 历史最高连对的日期，没记录时不显示括号 */
const bestComboDay = computed(() =>
  progressStore.bestCombo.day ? formatDate(progressStore.bestCombo.day) : '',
)

const summaryLine = computed(() => {
  if (sessionStore.answeredCount === 0) return '这一轮没有作答，随时可以重新开始。'
  if (singlePhrase.value) return '这一条已经过了一遍，同类里还有别的可以顺手带走。'
  if (sessionStore.accuracy >= 90) return '这一轮很稳，明天到期的那几条过一遍就够了。'
  if (sessionStore.accuracy >= 70) return '大部分已经拿住，没答对的那几条已经排到下一轮前面。'
  return '错得多不是退步：它们已经被标记出来，下一轮会优先再问你一次。'
})

const questionPercent = computed(() => {
  // 分母固定为本轮初始题数，答错追加的重练不会让进度条倒退
  const total = sessionStore.plannedTotal
  if (!total) return 0
  return Math.min(
    100,
    Math.round(((sessionStore.index + (revealed.value ? 1 : 0)) / total) * 100),
  )
})

/** 答错重练时 index 会超过计划数，题号封顶，避免出现 21 / 20 */
const questionNumber = computed(() =>
  Math.min(sessionStore.index + 1, Math.max(1, sessionStore.plannedTotal)),
)

/** 逐题对错：超过 12 题后折叠为合计，避免把顶部布局撑开 */
const recordChips = computed(() => {
  const list = sessionStore.answers
  if (list.length <= 12) {
    return list.map((answer, index) => ({
      key: `answer-${index}`,
      label: answer.correct ? '✓' : '✗',
      cls: answer.correct ? 'dot-correct' : 'dot-wrong',
      title: `第 ${index + 1} 题：${answer.correct ? '答对' : '答错'}`,
    }))
  }
  const correct = list.filter((answer) => answer.correct).length
  return [
    {
      key: 'sum-correct',
      label: `✓${correct}`,
      cls: 'dot-correct dot-wide',
      title: `本轮已答对 ${correct} 题`,
    },
    {
      key: 'sum-wrong',
      label: `✗${list.length - correct}`,
      cls: 'dot-wrong dot-wide',
      title: `本轮已答错 ${list.length - correct} 题`,
    },
  ]
})

/** 答错后追加到队尾的重练题：index 越过开局的计划总数 */
const isRepeat = computed(
  () => sessionStore.plannedTotal > 0 && sessionStore.index >= sessionStore.plannedTotal,
)

/** 单条训练（首页今日一句、词库只练 1 条）：答完就给同类推荐，而不是原地重复 */
const singlePhrase = computed(() => {
  const ids = sessionStore.lastOptions.phraseIds
  if (!ids || ids.length !== 1) return null
  return phraseById.get(ids[0]) ?? null
})

const singleCategoryName = computed(() => {
  const id = singlePhrase.value?.category
  return categories.find((item) => item.id === id)?.name ?? ''
})

/** 本轮最后一题：弹框按钮改叫「看本轮结果」，不再误导成还有下一题 */
const isLastQuestion = computed(
  () => sessionStore.queue.length > 0 && sessionStore.index >= sessionStore.queue.length - 1,
)

const hintText = computed(() => {
  const item = current.value
  if (!item) return ''
  if (item.mode === 'en-zh') {
    const length = item.phrase.zh.replace(/[；;，,]/g, '').length
    return `首字「${item.phrase.zh[0]}」· 共 ${length} 字`
  }
  const words = item.phrase.en.split(' ')
  const preview = words
    .map((word) => word[0] + '·'.repeat(Math.min(6, Math.max(0, word.length - 1))))
    .join(' ')
  return `${preview} · 共 ${words.length} 段`
})

/** 把短语转成挖空用的正则：省略号代表可插入内容，其余字符转义 */
function clozePattern(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped.replace(/…/g, '.{0,60}?'), 'i')
}

const clozeSentence = computed(() => {
  const phrase = current.value?.phrase
  if (!phrase) return ''
  // 含 one's / someone / your 的短语在例句里只会出现具体形式，用 enAliases 兜底
  const forms = [phrase.en, ...(phrase.enAliases ?? [])]
  for (const form of forms) {
    const pattern = clozePattern(form)
    if (pattern.test(phrase.exampleEn)) return phrase.exampleEn.replace(pattern, '______')
  }
  return phrase.exampleEn
})

/**
 * 答题前只有「英 → 中」可以朗读：中→英与例句填空的答案就是这句英文，
 * 提前朗读等于免费提示。结果弹框打开后随时可听。
 */
const canSpeakNow = computed(() => {
  if (!settingsStore.voiceAvailable || !current.value) return false
  return revealed.value || current.value.mode === 'en-zh'
})

const showPromptSpeak = computed(
  () => settingsStore.voiceAvailable && current.value?.mode === 'en-zh',
)

function speakCurrent(): void {
  if (!canSpeakNow.value || speaking.value) return
  const phrase = current.value?.phrase
  if (!phrase) return
  speaking.value = true
  void speakEn(phrase.en, settingsStore.settings.voiceURI)
    .catch(() => undefined)
    .finally(() => {
      speaking.value = false
    })
}

watch(
  () => current.value?.phrase.id,
  () => {
    hintOpen.value = false
    mastered.value = false
  },
  { immediate: true },
)

/** 弹框打开时把背景设为 inert，焦点和读屏都不会跑到后面的页面 */
function setBackgroundInert(value: boolean): void {
  document.querySelectorAll<HTMLElement>('.site-header, #main-content').forEach((el) => {
    if (value) el.setAttribute('inert', '')
    else el.removeAttribute('inert')
  })
}

watch(revealed, async (value) => {
  setBackgroundInert(value)
  if (!value) return
  await nextTick()
  modalRef.value?.querySelector<HTMLButtonElement>('.btn-primary')?.focus()
})

function toggleHint(): void {
  if (revealed.value || hintOpen.value || !current.value) return
  hintOpen.value = true
  sessionStore.noteHint()
}

function toggleFavorite(): void {
  if (current.value) settingsStore.toggleFavorite(current.value.phrase.id)
}

let pendingTimer = 0

function submit(value: string): void {
  if (revealed.value || submitting.value || !current.value) return
  const answer = value.trim()
  // 空答案不进入判定：避免误按 Enter 直接降盒、计入错误并排入复习
  if (!answer) return
  const { phrase, mode } = current.value
  submitting.value = true
  submitted.value = answer
  // 先让「判定中」可见，再给出结果，避免点击后看起来没反应
  window.clearTimeout(pendingTimer)
  pendingTimer = window.setTimeout(() => {
    const grade = gradeAnswer(phrase, answer, mode, settingsStore.settings.strictness)
    const correct = grade.verdict === 'correct'
    const before = progressStore.stats[dayKey()]?.reviewed ?? 0
    progressStore.recordAnswer(phrase.id, correct)
    sessionStore.record(correct)
    // TypeWords 式错词循环：答错/接近的题自动排到本轮末尾再练。
    // 本轮只有 1 条时不追加——紧接着重刷同一条几乎不涨记忆，交给遗忘曲线排期
    if (!correct && sessionStore.plannedTotal > 1) sessionStore.requeueCurrent()
    const after = progressStore.stats[dayKey()]?.reviewed ?? 0
    if (before < settingsStore.settings.dailyGoal && after >= settingsStore.settings.dailyGoal) {
      goalReached.value = true
    }
    result.value = grade
    revealed.value = true
    submitting.value = false

    if (!correct) {
      shake.value = false
      requestAnimationFrame(() => {
        shake.value = true
        window.setTimeout(() => (shake.value = false), 340)
      })
    }
  }, 150)
}

function goNext(): void {
  if (!revealed.value) return
  submitting.value = false
  revealed.value = false
  result.value = null
  submitted.value = ''
  hintOpen.value = false
  goalReached.value = false
  mastered.value = false
  sessionStore.next()
  inputKey.value = `${sessionStore.index}-${Date.now()}`
}

function skip(): void {
  // 判定中的 150ms 内不允许跳过，否则本次作答会被直接丢弃
  if (submitting.value) return
  revealed.value = false
  result.value = null
  submitted.value = ''
  hintOpen.value = false
  goalReached.value = false
  mastered.value = false
  sessionStore.skip()
  inputKey.value = `${sessionStore.index}-${Date.now()}`
}

/**
 * 用户声明这条短语已经掌握：只把它提到「已掌握」并撤掉本轮重练，
 * 不修改答案、正确率、连对与当日统计——答错了就是答错了。
 */
function markMastered(): void {
  if (!current.value || !result.value || result.value.verdict === 'correct') return
  progressStore.markMastered(current.value.phrase.id)
  sessionStore.dropRepeat()
  mastered.value = true
}

function restart(options?: StartOptions): void {
  window.clearTimeout(pendingTimer)
  submitting.value = false
  revealed.value = false
  result.value = null
  submitted.value = ''
  hintOpen.value = false
  goalReached.value = false
  mastered.value = false
  // 默认沿用上一轮的范围；单条训练会显式传入新的同类/随机范围
  sessionStore.start(options ?? sessionStore.lastOptions)
  inputKey.value = `0-${Date.now()}`
}

/** 单条练完后的主出口：同分类再推 5 条，比把同一条再刷一遍有用 */
function startSimilar(): void {
  const phrase = singlePhrase.value
  if (!phrase) {
    restart()
    return
  }
  const ids = shuffle(
    phrases.filter((item) => item.category === phrase.category && item.id !== phrase.id),
  )
    .slice(0, 5)
    .map((item) => item.id)
  if (!ids.length) {
    restart()
    return
  }
  const label = singleCategoryName.value ? `同类 5 条 · ${singleCategoryName.value}` : '同类 5 条'
  restart({ phraseIds: ids, label })
}

/** 跳出当前分类：随机抽 5 条，给一个完全不同的起点 */
function startRandom(): void {
  restart({
    phraseIds: shuffle(phrases)
      .slice(0, 5)
      .map((item) => item.id),
    label: '随机 5 条',
  })
}

function onGlobalKey(event: KeyboardEvent): void {
  if (event.ctrlKey && event.code === 'KeyP') {
    // 不可朗读时不要把浏览器的打印快捷键吞掉
    if (!canSpeakNow.value) return
    event.preventDefault()
    speakCurrent()
    return
  }

  if (event.altKey) {
    // 收藏与朗读在结果弹框里也可用：那正是最想收藏、最想听读音的时刻
    if (event.code === 'KeyF') {
      event.preventDefault()
      toggleFavorite()
    } else if (event.code === 'KeyR') {
      if (!canSpeakNow.value) return
      event.preventDefault()
      speakCurrent()
    } else if (event.code === 'KeyH' && !revealed.value) {
      event.preventDefault()
      toggleHint()
    }
    return
  }

  if (!revealed.value) return

  if (event.key === 'Tab' && modalRef.value) {
    const focusables = Array.from(
      modalRef.value.querySelectorAll<HTMLElement>('button:not([disabled])'),
    )
    if (!focusables.length) return
    event.preventDefault()
    const index = focusables.indexOf(document.activeElement as HTMLElement)
    const next = event.shiftKey
      ? index <= 0
        ? focusables.length - 1
        : index - 1
      : index === focusables.length - 1
        ? 0
        : index + 1
    focusables[next].focus()
    return
  }

  if (event.key === 'Enter') {
    // 焦点在弹框按钮上时交给按钮原生 click，避免连续推进两题
    if ((event.target as HTMLElement).closest('.modal-card button')) return
    event.preventDefault()
    goNext()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    goNext()
  }
}

onMounted(() => {
  if (!sessionStore.current && !sessionStore.finished) {
    // 先尝试恢复当天的本轮草稿，刷新页面不会丢掉这一轮进度
    if (!sessionStore.restore()) sessionStore.start()
  }
  window.addEventListener('keydown', onGlobalKey)
  // 恢复的草稿可能已经结完一轮：补写最高连对，并把焦点放到「再来一轮」
  if (sessionStore.finished) {
    sessionStore.syncBestCombo()
    void nextTick(() => summaryAction.value?.focus())
  }
})

// 最后一题答完弹框关闭后，焦点落在「再来一轮」，键盘用户不会掉出页面
watch(
  () => sessionStore.finished,
  async (finished) => {
    if (!finished) return
    sessionStore.syncBestCombo()
    await nextTick()
    summaryAction.value?.focus()
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKey)
  window.clearTimeout(pendingTimer)
  setBackgroundInert(false)
})
</script>

<template>
  <div class="page study-wrap">
    <template v-if="current && !sessionStore.finished">
      <div class="study-top">
        <div style="min-width: 240px; flex: 1; max-width: 420px">
          <div class="eyebrow">
            Session · {{ String(questionNumber).padStart(2, '0') }} / {{ String(sessionStore.plannedTotal).padStart(2, '0') }}
            <span v-if="sessionStore.scopeLabel" class="scope-tag">{{ sessionStore.scopeLabel }}</span>
            <span v-if="result" class="last-verdict" :class="result.verdict">
              {{ result.verdict === 'correct' ? '刚刚答对' : result.verdict === 'near' ? '非常接近' : '刚刚答错' }}
            </span>
          </div>
          <div class="progress-track" style="margin-top: 10px">
            <div class="progress-fill" :style="{ transform: `scaleX(${questionPercent / 100})` }"></div>
          </div>
          <div class="answer-record" aria-label="本轮逐题结果">
            <span
              v-for="chip in recordChips"
              :key="chip.key"
              class="answer-dot"
              :class="chip.cls"
              :title="chip.title"
            >
              {{ chip.label }}
            </span>
          </div>
        </div>
        <button
          class="btn btn-sm"
          type="button"
          :aria-pressed="isFavorite"
          @click="toggleFavorite"
        >
          {{ isFavorite ? '★ 已收藏' : '☆ 收藏' }}
          <kbd>⌥F</kbd>
        </button>
      </div>

      <div class="study-layout" style="margin-top: 18px">
        <aside class="study-rail" aria-hidden="true">
          <span class="rail-index">{{ String(sessionStore.index + 1).padStart(2, '0') }}</span>
          <span class="rail-line"></span>
          <span v-if="sessionStore.combo > 0" class="combo">连对 {{ sessionStore.combo }}</span>
          <span v-else class="combo muted">保持节奏</span>
        </aside>

        <div class="card study-card" :class="{ shake }">
          <div class="study-card-head">
            <div class="mode-tags">
              <span class="mode-tag">{{ modeLabel[current.mode] }}</span>
              <span v-if="isRepeat" class="mode-tag repeat-tag">重练</span>
            </div>
            <button
              v-if="showPromptSpeak"
              class="icon-btn"
              type="button"
              :disabled="speaking"
              aria-label="朗读当前英文短语，快捷键 Alt+R"
              @click="speakCurrent"
            >
              <span v-if="speaking" class="spinner" aria-hidden="true"></span>
              <span v-else aria-hidden="true">🔊</span>
            </button>
          </div>

          <div class="prompt-block">
            <template v-if="current.mode === 'zh-en'">
              <p class="prompt">{{ current.phrase.zh }}</p>
              <p class="prompt-context">{{ current.phrase.exampleZh }}</p>
            </template>

            <template v-else-if="current.mode === 'en-zh'">
              <p class="prompt">{{ current.phrase.en }}</p>
              <p class="prompt-context">{{ current.phrase.exampleEn }}</p>
            </template>

            <template v-else>
              <p class="prompt small-prompt">{{ clozeSentence }}</p>
              <p class="prompt-context">{{ current.phrase.exampleZh }}</p>
            </template>
          </div>

          <div v-if="hintOpen && !revealed" class="hint-box" role="status">
            {{ hintText }}
          </div>

          <div class="answer-section">
            <div class="answer-label">输入你的答案</div>
            <AnswerInput
              :key="inputKey"
              :mode="current.mode"
              :question-key="inputKey"
              :disabled="revealed"
              :loading="submitting"
              :hint-active="hintOpen"
              @submit="submit"
              @skip="skip"
              @hint="toggleHint"
            />
          </div>

          <div class="study-card-foot">
            <span>
              本轮正确率 {{ sessionStore.accuracy }}% · 提示 {{ sessionStore.hintsUsed }} 次
              <template v-if="sessionStore.pendingRepeats">
                · 待重练 {{ sessionStore.pendingRepeats }} 题
              </template>
            </span>
            <button v-if="!result" class="btn btn-sm" type="button" :disabled="submitting" @click="skip">
              跳过 <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="card summary-card" style="margin-top: 40px">
      <div class="eyebrow">Session complete · {{ sessionStore.scopeLabel || '本轮训练' }}</div>
      <h1 style="font-size: 40px; margin: 16px 0 10px">这一轮，收工。</h1>
      <p class="muted" style="line-height: 1.8">{{ summaryLine }}</p>

      <div class="summary-grid">
        <div class="summary-metric">
          <div class="summary-value">{{ sessionStore.answeredCount }}</div>
          <div class="small muted">作答题数</div>
        </div>
        <div class="summary-metric">
          <div class="summary-value">{{ sessionStore.accuracy }}%</div>
          <div class="small muted">正确率</div>
        </div>
        <div class="summary-metric">
          <div class="summary-value">
            {{ sessionStore.bestCombo }}
            <span v-if="sessionStore.recordBeaten" class="badge due">新纪录</span>
          </div>
          <div class="small muted">本轮最高连对</div>
        </div>
        <div class="summary-metric">
          <div class="summary-value">{{ dueTomorrow }}</div>
          <div class="small muted">明天到期</div>
        </div>
      </div>

      <p class="small muted summary-foot">
        <span>本轮新掌握 {{ masteredGained }} 条</span>
        <span>提示 {{ sessionStore.hintsUsed }} 次</span>
        <span>
          历史最高连对 {{ progressStore.bestCombo.combo }}
          <template v-if="bestComboDay">（{{ bestComboDay }}）</template>
        </span>
      </p>

      <div class="hero-actions" style="margin-top: 22px">
        <template v-if="singlePhrase">
          <button ref="summaryAction" class="btn btn-primary btn-lg" type="button" @click="startSimilar">
            再练 5 条同类
          </button>
          <button class="btn btn-lg" type="button" @click="startRandom">随机 5 条</button>
          <RouterLink class="btn btn-lg" to="/stats">看统计</RouterLink>
          <RouterLink class="btn btn-lg" to="/" @click="sessionStore.reset()">回到首页</RouterLink>
        </template>
        <template v-else>
          <button ref="summaryAction" class="btn btn-primary btn-lg" type="button" @click="restart()">
            再来一轮
          </button>
          <RouterLink class="btn btn-lg" to="/stats">看统计</RouterLink>
          <RouterLink class="btn btn-lg" to="/" @click="sessionStore.reset()">回到首页</RouterLink>
        </template>
      </div>

      <p v-if="singlePhrase" class="small muted" style="margin-top: 14px">
        刚练的是「{{ singlePhrase.en }}」{{ singleCategoryName ? `（${singleCategoryName}）` : '' }}；
        换成同类或随机范围，不必再把同一条刷一遍。
      </p>
    </div>

    <Teleport to="body">
      <div v-if="result && current" class="modal-backdrop">
        <div
          ref="modalRef"
          class="modal-card"
          :class="result?.verdict"
          role="dialog"
          aria-modal="true"
          aria-label="答题结果"
        >
          <AnswerFeedback
            :result="result"
            :phrase="current.phrase"
            :combo="sessionStore.combo"
            :day-reviewed="dayReviewed"
            :daily-goal="settingsStore.settings.dailyGoal"
            :next-review-text="nextReviewText"
            :your-answer="submitted"
            :is-last="isLastQuestion"
            :wrong-count="wrongCount"
            :goal-reached="goalReached"
            :speaking="speaking"
            :can-speak="settingsStore.voiceAvailable"
            :mastered="mastered"
            @next="goNext"
            @speak="speakCurrent"
            @mark-mastered="markMastered"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
