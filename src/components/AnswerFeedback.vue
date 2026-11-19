<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import gsap from 'gsap'
import {
  feedbackEncouragement,
  feedbackHeadline,
  feedbackSubline,
  verdictLabel,
} from '@/lib/feedback'
import type { GradeResult } from '@/lib/grade'
import type { Phrase } from '@/types/phrase'

const props = defineProps<{
  result: GradeResult
  phrase: Phrase
  combo: number
  dayReviewed: number
  dailyGoal: number
  nextReviewText: string
  wrongCount: number
  goalReached: boolean
  speaking?: boolean
  canSpeak?: boolean
  mastered?: boolean
}>()

const emit = defineEmits<{
  next: []
  speak: []
  'mark-mastered': []
}>()

const root = ref<HTMLElement | null>(null)
const iconEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)
const milestoneEl = ref<HTMLElement | null>(null)

const tone = computed(() => props.result.verdict)
const iconText = computed(() =>
  tone.value === 'correct' ? '✓' : tone.value === 'near' ? '≈' : '↺',
)

const headline = computed(() =>
  feedbackHeadline(tone.value, props.combo, props.result.distance),
)
const subline = computed(() => feedbackSubline(tone.value, props.nextReviewText))
const encouragement = computed(() =>
  feedbackEncouragement(tone.value, Math.max(0, props.wrongCount - 1)),
)

const goalPercent = computed(() =>
  Math.min(100, Math.round((props.dayReviewed / props.dailyGoal) * 100)),
)
const revealLabel = computed(() => (tone.value === 'correct' ? '刚刚写出' : '正确答案'))

let ctx: ReturnType<typeof gsap.context> | undefined

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  ctx = gsap.context(() => {
    gsap.from(iconEl.value, {
      scale: 0.95,
      autoAlpha: 0,
      rotation: -12,
      duration: 0.24,
      ease: 'power2.out',
    })
    gsap.from(titleEl.value, {
      y: 8,
      autoAlpha: 0,
      duration: 0.24,
      delay: 0.04,
      ease: 'power2.out',
    })

    if (tone.value === 'correct') {
      // 一次性装饰性庆祝：craft-floor §5 允许回弹，但仍压到 600ms 内
      gsap.fromTo(
        '.confetti-piece',
        { x: 0, y: 0, scale: 1, autoAlpha: 1 },
        {
          x: () => gsap.utils.random(-110, 110),
          y: () => gsap.utils.random(-90, 35),
          rotation: () => gsap.utils.random(-220, 220),
          scale: 0.6,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.02,
          ease: 'power2.out',
        },
      )
    }

    if (milestoneEl.value) {
      gsap.from(milestoneEl.value, {
        scale: 0.95,
        autoAlpha: 0,
        duration: 0.26,
        delay: 0.1,
        ease: 'power2.out',
      })
    }
  }, root.value ?? undefined)
})

onUnmounted(() => ctx?.revert())
</script>

<template>
  <div ref="root" class="feedback" :class="tone" role="status" aria-live="polite">
    <div v-if="tone === 'correct'" class="feedback-celebrate" aria-hidden="true">
      <span v-for="i in 18" :key="i" class="confetti-piece"></span>
    </div>

    <div class="verdict-hero">
      <span ref="iconEl" class="verdict-icon" aria-hidden="true">{{ iconText }}</span>
      <div class="verdict-copy">
        <span class="verdict-label" :class="tone">{{ verdictLabel(tone) }}</span>
        <div ref="titleEl" class="feedback-title">{{ headline }}</div>
        <p class="feedback-sub">{{ subline }}</p>
      </div>
      <span v-if="tone === 'correct' && combo >= 3" ref="milestoneEl" class="milestone">
        {{ combo }} 连对
      </span>
    </div>

    <div class="answer-card">
      <div class="answer-card-head">
        <span class="reveal-label">{{ revealLabel }}</span>
        <button
          v-if="canSpeak"
          class="icon-btn"
          type="button"
          :disabled="speaking"
          :aria-label="`朗读 ${phrase.en}`"
          @click="emit('speak')"
        >
          <span v-if="speaking" class="spinner" aria-hidden="true"></span>
          <span v-else aria-hidden="true">🔊</span>
        </button>
      </div>
      <div class="answer-en">{{ phrase.en }}</div>
      <div class="answer-zh">{{ phrase.zh }}</div>
      <p class="feedback-example">{{ phrase.exampleEn }}</p>
    </div>

    <div class="feedback-meta">
      <div class="meta-item">
        <span>记忆状态</span>
        <strong>{{ tone === 'correct' ? '熟练度 +1' : '已排入复习' }}</strong>
      </div>
      <div class="meta-item">
        <span>下次见面</span>
        <strong>{{ nextReviewText }}</strong>
      </div>
      <div class="meta-item">
        <span>今日进度</span>
        <strong>{{ dayReviewed }} / {{ dailyGoal }}</strong>
      </div>
    </div>
    <div class="progress-track mini">
      <div class="progress-fill" :style="{ transform: `scaleX(${goalPercent / 100})` }"></div>
    </div>

    <div v-if="goalReached" class="goal-banner">今日目标达成，收工值得庆祝。</div>

    <p class="feedback-encourage">{{ encouragement }}</p>
    <p v-if="phrase.tip" class="tip-line">记法：{{ phrase.tip }}</p>

    <div class="feedback-actions">
      <button class="btn btn-primary" type="button" @click="emit('next')">下一题 ↵</button>
      <button
        v-if="tone !== 'correct' && !mastered"
        class="btn"
        type="button"
        @click="emit('mark-mastered')"
      >
        这条我会了
      </button>
      <span v-else-if="mastered" class="muted small">已标记为掌握，不计入正确率</span>
    </div>
  </div>
</template>
