<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { categories, categoryName } from '@/data/categories'
import { phraseCountByCategory, phrases } from '@/data/phrases'
import { dayKey } from '@/lib/date'
import { computeStreak, isMastered } from '@/lib/srs'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import type { CategoryId, ModeSetting } from '@/types/phrase'

const router = useRouter()
const progressStore = useProgressStore()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()

const today = computed(
  () => progressStore.stats[dayKey()] ?? { reviewed: 0, correct: 0, learned: 0 },
)
const streak = computed(() => computeStreak(progressStore.stats))
const mastered = computed(
  () => phrases.filter((phrase) => isMastered(progressStore.progress[phrase.id])).length,
)
const totalReviews = computed(() =>
  Object.values(progressStore.stats).reduce((sum, day) => sum + day.reviewed, 0),
)
const goalPercent = computed(() =>
  Math.min(100, Math.round((today.value.reviewed / settingsStore.settings.dailyGoal) * 100)),
)
const resumable = computed(() => sessionStore.queue.length > 0 && !sessionStore.finished)
const remaining = computed(() =>
  Math.max(0, settingsStore.settings.dailyGoal - today.value.reviewed),
)
const startLabel = computed(() => {
  if (remaining.value <= 0) return '今日已完成 · 再练一轮'
  if (today.value.reviewed === 0) return '开始今日训练'
  return `继续今日训练 · 还剩 ${remaining.value} 题`
})

const modes: { value: ModeSetting; label: string; description: string }[] = [
  { value: 'mixed', label: '混合训练', description: '推荐：七成中译英，三成英译中' },
  { value: 'zh-en', label: '中 → 英', description: '看中文提示，键盘写出英文短语' },
  { value: 'en-zh', label: '英 → 中', description: '看英文短语，输入对应中文意思' },
  { value: 'cloze', label: '例句填空', description: '在真实例句里补全缺失的短语' },
]

function start(mode?: ModeSetting): void {
  if (mode) settingsStore.setMode(mode)
  sessionStore.start()
  void router.push('/study')
}

function resume(): void {
  void router.push('/study')
}

/** 分类入口只影响本轮，不写入设置里的长期分类 */
function startCategory(id: CategoryId): void {
  sessionStore.start({ categories: [id], label: `分类 · ${categoryName(id)}` })
  void router.push('/study')
}

function startAll(): void {
  sessionStore.start()
  void router.push('/study')
}
</script>

<template>
  <div class="page">
    <section class="hero-grid">
      <div class="hero">
        <div class="eyebrow">Phrase Labs / Daily Drill</div>
        <h1 style="margin-top: 18px">看一眼，<span>敲出来</span>，<br />真正记住。</h1>
        <p class="hero-copy">
          用输入代替被动刷词。中英双向与例句填空题型，配合按记忆状态安排的复习节奏。
          无需注册，进度只留在这台设备上。
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" type="button" @click="start()">
            {{ startLabel }} <span aria-hidden="true">↗</span>
          </button>
          <button v-if="resumable" class="btn btn-lg" type="button" @click="resume">
            继续上一轮
          </button>
          <RouterLink v-else class="btn btn-lg" to="/library">浏览词库</RouterLink>
        </div>
      </div>

      <aside class="today-card" aria-label="今日进度">
        <div class="eyebrow">Today / {{ settingsStore.settings.dailyGoal }} 题目标</div>
        <div class="today-number">
          {{ String(today.reviewed).padStart(2, '0') }}<small> / {{ settingsStore.settings.dailyGoal }}</small>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ transform: `scaleX(${goalPercent / 100})` }"></div>
        </div>
        <p class="small" style="margin-top: 16px; color: var(--on-ink-muted)">
          今日新学 {{ today.learned }} 条 · 答对 {{ today.correct }} 题
        </p>
      </aside>
    </section>

    <section class="stat-strip" aria-label="学习概览">
      <div class="stat-item">
        <div class="stat-value">{{ streak }}</div>
        <div class="stat-label">连续学习天数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ mastered }}</div>
        <div class="stat-label">已掌握 / 共 {{ phrases.length }} 条</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ totalReviews }}</div>
        <div class="stat-label">累计作答次数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ categories.length }}</div>
        <div class="stat-label">内容分类</div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>选择训练模式</h2>
        <RouterLink class="small muted" to="/settings">调整每日目标 ↗</RouterLink>
      </div>
      <div class="grid grid-3">
        <button
          v-for="(mode, index) in modes"
          :key="mode.value"
          type="button"
          class="option-card"
          :class="{ active: settingsStore.settings.mode === mode.value }"
          @click="start(mode.value)"
        >
          <span class="mode-num">{{ String(index + 1).padStart(2, '0') }}</span>
          <strong>{{ mode.label }}<span class="mode-arrow">↗</span></strong>
          <span>{{ mode.description }}</span>
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>按分类开练</h2>
        <RouterLink class="small muted" to="/settings">长期分类设置 ↗</RouterLink>
      </div>
      <p class="small muted" style="margin-bottom: 14px">
        点击分类只会按该分类开始这一轮，不会改动设置里的长期分类。
      </p>
      <div class="chip-row" style="margin-bottom: 18px">
        <button class="chip" type="button" @click="startAll">
          全部分类 · {{ phrases.length }} 条
        </button>
      </div>
      <div class="grid grid-2">
        <button
          v-for="category in categories"
          :key="category.id"
          type="button"
          class="option-card"
          @click="startCategory(category.id)"
        >
          <strong>{{ category.icon }} {{ category.name }}<span class="mode-arrow">↗</span></strong>
          <span>{{ category.description }}</span>
          <span class="category-count">{{ phraseCountByCategory[category.id] ?? 0 }} 条短语</span>
        </button>
      </div>
    </section>
  </div>
</template>
