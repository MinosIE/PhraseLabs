<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { categories } from '@/data/categories'
import { phrases } from '@/data/phrases'
import { DAY_MS, dayKey, formatDate } from '@/lib/date'
import { computeStreak, isMastered } from '@/lib/srs'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const progressStore = useProgressStore()
const sessionStore = useSessionStore()

const reviewedTotal = computed(() =>
  Object.values(progressStore.stats).reduce((sum, day) => sum + day.reviewed, 0),
)
const correctTotal = computed(() =>
  Object.values(progressStore.stats).reduce((sum, day) => sum + day.correct, 0),
)
const accuracy = computed(() =>
  reviewedTotal.value === 0 ? 0 : Math.round((correctTotal.value / reviewedTotal.value) * 100),
)
const mastered = computed(
  () => phrases.filter((phrase) => isMastered(progressStore.progress[phrase.id])).length,
)

const recent = computed(() =>
  Array.from({ length: 14 }, (_, index) => {
    const key = dayKey(Date.now() - (13 - index) * DAY_MS)
    const stat = progressStore.stats[key] ?? { reviewed: 0, correct: 0, learned: 0 }
    return { key, stat }
  }),
)
const maxReviewed = computed(() => Math.max(1, ...recent.value.map((day) => day.stat.reviewed)))

const thisWeek = computed(() =>
  recent.value.slice(7).reduce((sum, day) => sum + day.stat.reviewed, 0),
)
const lastWeek = computed(() =>
  recent.value.slice(0, 7).reduce((sum, day) => sum + day.stat.reviewed, 0),
)
const weekDelta = computed(() =>
  lastWeek.value === 0 ? 0 : Math.round(((thisWeek.value - lastWeek.value) / lastWeek.value) * 100),
)
const weekDeltaText = computed(() =>
  lastWeek.value === 0 ? '—' : `${weekDelta.value >= 0 ? '+' : ''}${weekDelta.value}%`,
)

/** 盒子最低、错得最多的短语：比再加一张图表更能指导下一步 */
const focusList = computed(() =>
  phrases
    .filter((phrase) => progressStore.progress[phrase.id])
    .sort((a, b) => {
      const pa = progressStore.progress[a.id]!
      const pb = progressStore.progress[b.id]!
      return pa.box - pb.box || pb.wrong - pa.wrong
    })
    .slice(0, 5),
)

function practiceFocus(): void {
  if (!focusList.value.length) return
  sessionStore.startWith(
    focusList.value.map((phrase) => phrase.id),
    `薄弱短语 · ${focusList.value.length} 条`,
  )
  void router.push('/study')
}

const heat = computed(() =>
  Array.from({ length: 28 }, (_, index) => {
    const key = dayKey(Date.now() - (27 - index) * DAY_MS)
    const reviewed = progressStore.stats[key]?.reviewed ?? 0
    const level = reviewed === 0 ? 0 : reviewed < 5 ? 1 : reviewed < 15 ? 2 : reviewed < 30 ? 3 : 4
    return { key, reviewed, level }
  }),
)

const categoryStats = computed(() =>
  categories.map((category) => {
    const items = phrases.filter((phrase) => phrase.category === category.id)
    const done = items.filter((phrase) => isMastered(progressStore.progress[phrase.id])).length
    return {
      ...category,
      done,
      total: items.length,
      percent: items.length ? Math.round((done / items.length) * 100) : 0,
    }
  }),
)
</script>

<template>
  <div class="page">
    <div class="eyebrow">Progress / Local only</div>
    <h1 style="font-size: 36px; margin-top: 10px">学习统计</h1>
    <p class="muted small" style="margin-top: 6px">所有数据来自本地学习记录，不会上传。</p>

    <section class="stat-strip" aria-label="学习总览">
      <div class="stat-item"><div class="stat-value">{{ reviewedTotal }}</div><div class="stat-label">累计作答</div></div>
      <div class="stat-item"><div class="stat-value">{{ accuracy }}%</div><div class="stat-label">总正确率</div></div>
      <div class="stat-item"><div class="stat-value">{{ mastered }}</div><div class="stat-label">已掌握短语</div></div>
      <div class="stat-item"><div class="stat-value">{{ computeStreak(progressStore.stats) }}</div><div class="stat-label">连续天数</div></div>
    </section>

    <section class="section card">
      <div class="section-head">
        <h2>近 14 天作答量</h2>
        <span class="week-delta">本周 {{ weekDeltaText }} vs 上周</span>
      </div>
      <div class="bars">
        <div v-for="day in recent" :key="day.key" class="bar-col">
          <div
            class="bar-track"
            :class="{ empty: day.stat.reviewed === 0 }"
            :style="{
              '--bar-height': `${Math.max(4, (day.stat.reviewed / maxReviewed) * 130)}px`,
              '--correct-height': `${day.stat.reviewed ? (day.stat.correct / day.stat.reviewed) * 100 : 0}%`,
            }"
            :title="`${formatDate(day.key)}：${day.stat.reviewed} 题，答对 ${day.stat.correct} 题`"
          >
            <div class="bar-correct"></div>
          </div>
          <div class="bar-label">{{ day.key.slice(8) }}</div>
        </div>
      </div>
      <p class="small muted" style="margin-top: 10px">深色部分为当天答对量。</p>
    </section>

    <section class="section card">
      <div class="section-head">
        <h2>最该复习的 5 条</h2>
        <button
          class="btn btn-sm btn-primary"
          type="button"
          :disabled="!focusList.length"
          @click="practiceFocus"
        >
          练这几条
        </button>
      </div>
      <div v-if="!focusList.length" class="empty-state">还没有学习记录，先完成一轮训练。</div>
      <div v-else class="focus-list">
        <div v-for="phrase in focusList" :key="phrase.id" class="focus-item">
          <div class="focus-main">
            <div class="phrase-en">{{ phrase.en }}</div>
            <div class="phrase-zh">{{ phrase.zh }}</div>
          </div>
          <div class="focus-meta">
            <span class="badge">熟练度 {{ progressStore.progress[phrase.id]?.box ?? 0 }} / 5</span>
            <span v-if="progressStore.progress[phrase.id]?.wrong" class="badge due">
              错 {{ progressStore.progress[phrase.id]?.wrong }} 次
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="section card">
      <div class="section-head"><h2>近 28 天热力图</h2><span class="small muted">颜色越深，练得越多</span></div>
      <div class="heatmap">
        <div
          v-for="day in heat"
          :key="day.key"
          class="heat-cell"
          :class="`level-${day.level}`"
          :title="`${formatDate(day.key)}：${day.reviewed} 题`"
        ></div>
      </div>
    </section>

    <section class="section card">
      <div class="section-head"><h2>各分类掌握度</h2></div>
      <div v-for="item in categoryStats" :key="item.id" style="margin-bottom: 16px">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px">
          <span>{{ item.name }}</span>
          <span class="muted">{{ item.done }} / {{ item.total }}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ transform: `scaleX(${item.percent / 100})` }"></div>
        </div>
      </div>
    </section>
  </div>
</template>
