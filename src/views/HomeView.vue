<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { categories } from '@/data/categories'
import { phraseById, phraseCountByCategory, phrases, tagCounts } from '@/data/phrases'
import { dailyPhrases } from '@/data/phrases/daily'
// 只引日常口语的例句：首页不该为 819 条例句买单，其余分类留给学习/词库/分类页
import { dailyDetails } from '@/data/phrases/details/daily'
import type { PhraseDetail } from '@/types/phrase'
import { pickDaily } from '@/lib/daily'
import { dayKey } from '@/lib/date'
import { shuffle } from '@/lib/session'
import { speakEn } from '@/lib/speech'
import { pickByTag, pickFeaturedTags } from '@/lib/tags'
import {
  computeStreak,
  DECAY,
  GROWTH,
  isMastered,
  MASTERED_STABILITY,
  TARGET_RETENTION,
} from '@/lib/srs'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import type { ModeSetting } from '@/types/phrase'

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

/** 遗忘曲线示意图：每次复习把保留率拉回 100%，之后按 0.9^(天/稳定度) 衰减 */
const memoryCurve = (() => {
  const left = 20
  const pxPerDay = 8
  const top = 44
  const bottom = 100
  // 纵轴只标 100% / 90%：中间的刻度按幂次拉开，让衰减在 10% 的窄带里也能看出弧度
  const yOf = (retention: number) => {
    const normalized = (retention - TARGET_RETENTION) / (1 - TARGET_RETENTION)
    return bottom - Math.pow(Math.min(Math.max(normalized, 0), 1), 0.55) * (bottom - top)
  }
  const intervals = [2, 4, 8, 16, 16]
  const points: { x: number; y: number }[] = [{ x: left, y: top }]
  const marks: { x: number; y: number }[] = []
  let x = left

  intervals.forEach((span, index) => {
    for (let step = 1; step <= 12; step++) {
      const day = (span * step) / 12
      const retention = Math.pow(TARGET_RETENTION, day / span)
      points.push({ x: x + day * pxPerDay, y: yOf(retention) })
    }
    x += span * pxPerDay
    if (index < intervals.length - 1) {
      // 复习是一次「拉满」：把跳变展开成 20px 宽的 S 形波浪，不做竖直尖刺
      points.push({ x: x + 7, y: bottom - 14 })
      points.push({ x: x + 14, y: top + 14 })
      points.push({ x: x + 20, y: top })
      marks.push({ x: x + 20, y: top })
      x += 20
    }
  })

  // Catmull-Rom 转三次贝塞尔：整条线连续光滑；控制点夹在 100%–90% 之间，避免过冲出界
  const clampY = (value: number) => Math.min(Math.max(value, top), bottom)
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1)
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6).toFixed(1)
    const c2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1)
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6).toFixed(1)
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  return {
    path,
    marks,
    goalY: bottom,
    endX: Number(x.toFixed(1)),
    totalDays: intervals.reduce((sum, span) => sum + span, 0),
  }
})()

const retentionPercent = `${Math.round(TARGET_RETENTION * 100)}%`
const decayPercent = `×${Number(DECAY.toFixed(2))}`
const growthText = `×${GROWTH.toFixed(1)}`
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

/** 到期复习：只算学过的短语，一次最多推到每日目标的题量 */
const reviewBatch = computed(() => Math.max(5, settingsStore.settings.dailyGoal))
const dueIds = computed(() =>
  Object.entries(progressStore.progress)
    .filter(([, item]) => item.nextReview <= Date.now())
    .sort(([, a], [, b]) => a.nextReview - b.nextReview)
    .map(([id]) => id)
    .filter((id) => phraseById.has(id)),
)
const dueCount = computed(() => dueIds.value.length)

function startDue(): void {
  sessionStore.startWith(dueIds.value.slice(0, reviewBatch.value), '到期复习')
  void router.push('/study')
}

/** 5 条快练：随机抽 5 条，30 秒内能走完一轮 */
function startQuick(): void {
  sessionStore.startWith(
    shuffle(phrases).slice(0, 5).map((phrase) => phrase.id),
    '5 条快练',
  )
  void router.push('/study')
}

/**
 * 首页主题优先展示「跨分类」的标签：习语、动词短语、介词搭配这类本身就是分类，
 * 分类卡片已经给过入口，再占首页名额会把职场 / 邮件 / 影视挤没。
 */
const FEATURED_TAGS = ['口语', '高频', '职场', '邮件', '影视', '正式', '基础', '重复']
const practiceTags = pickFeaturedTags(tagCounts, FEATURED_TAGS)
const TAG_BATCH = 20

/** 按主题开练：从该标签下随机抽 20 条，短时练完；想要全部就去词库筛选 */
function startTag(tag: string): void {
  const sample = shuffle(pickByTag(phrases, tag)).slice(0, TAG_BATCH)
  if (!sample.length) return
  sessionStore.startWith(
    sample.map((phrase) => phrase.id),
    `主题 · ${tag} · ${sample.length} 条`,
  )
  void router.push('/study')
}

/** 今日一句：只从日常口语池取（同一天内稳定，跨天自动换）；池子限于 daily 是为了不把全量例句拉进首屏 */
const daily = computed(() => pickDaily(dailyPhrases, dayKey()))
const speaking = ref(false)

const NO_DETAIL: PhraseDetail = { exampleEn: '', exampleZh: '' }
const dailyDetail = computed(() =>
  daily.value ? (dailyDetails[daily.value.id] ?? NO_DETAIL) : NO_DETAIL,
)

function practiseDaily(): void {
  if (!daily.value) return
  sessionStore.startWith([daily.value.id], '今日一句')
  void router.push('/study')
}

function speakDaily(): void {
  if (!daily.value || speaking.value) return
  speaking.value = true
  void speakEn(daily.value.en, settingsStore.settings.voiceURI)
    .catch(() => undefined)
    .finally(() => {
      speaking.value = false
    })
}

/** 视差背景与短语带都取自真实语料；内容变动时自动降级，不写死装饰文案 */
const ambientSource = ['good morning', 'no problem', 'be careful']
const ambientPhrases = computed(() => {
  const matched = phrases.filter((phrase) => ambientSource.includes(phrase.en))
  return matched.length >= 2 ? matched.slice(0, 3) : phrases.slice(0, 3)
})
const ribbonText = computed(() =>
  phrases
    .filter((phrase) =>
      ['book a table', 'in the long run', 'on the other hand', 'no problem'].includes(phrase.en),
    )
    .slice(0, 4)
    .map((phrase) => phrase.en),
)

/** 演示区用真实短语与例句，展示「看提示 → 写出 → 判定」的完整闭环 */
const demoPhrase = computed(
  () => dailyPhrases.find((phrase) => phrase.en === 'a little bit') ?? dailyPhrases[0],
)
const demoDetail = computed(() => dailyDetails[demoPhrase.value.id] ?? NO_DETAIL)

const root = ref<HTMLElement | null>(null)
/** 只用到 revert；这里不写 gsap 的类型，否则类型引用会把 gsap 拉回静态依赖图 */
let mm: { revert: () => void } | undefined
let disposed = false

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
}

onMounted(() => {
  const el = root.value
  if (!el) return
  // 动画只是增强：关掉动效的用户一个字节都不下 gsap
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // gsap + ScrollTrigger 共约 44 KB(gzip)，等首帧画完再拉，别和首屏内容抢带宽。
  // Safari 没有 requestIdleCallback，退化成 200ms 后加载。
  const idle = (window as IdleWindow).requestIdleCallback
  if (idle) idle(() => void setupMotion(el), { timeout: 1500 })
  else window.setTimeout(() => void setupMotion(el), 200)
})

/** vite-ssg 在构建期也会执行 setup，所以 gsap 只在挂载后的浏览器侧加载 */
async function setupMotion(el: HTMLElement): Promise<void> {
  const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ])
  if (disposed) return
  gsap.registerPlugin(ScrollTrigger)
  const media = gsap.matchMedia()
  mm = media
  media.add(
    {
      isDesktop: '(min-width: 861px)',
      reduceMotion: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const conditions = context.conditions
      if (!conditions || conditions.reduceMotion) return
      const isDesktop = conditions.isDesktop

      const q = gsap.utils.selector(el)
      // 只做位移，不设 autoAlpha：SSG 首屏必须始终可见，动画失败也不会藏住内容
      gsap.from(q('.hero > *'), {
        y: 12,
        duration: 0.4,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'transform',
      })

      const hero = q('.landing-hero')[0]
      const heroScroll = () => ({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      })

      if (isDesktop) {
        q('.ambient-phrase').forEach((node, index) => {
          gsap.to(node, {
            y: -46 - index * 20,
            x: index % 2 === 0 ? -28 : 28,
            ease: 'none',
            scrollTrigger: heroScroll(),
          })
        })
        gsap.to(q('.today-card'), { y: -26, ease: 'none', scrollTrigger: heroScroll() })
        gsap.to(q('.ribbon-track'), { xPercent: -12, ease: 'none', scrollTrigger: heroScroll() })
      }

      q('.reveal-item').forEach((node) => {
        gsap.from(node, {
          y: 14,
          duration: 0.4,
          ease: 'power2.out',
          clearProps: 'transform',
          scrollTrigger: { trigger: node, start: 'top 88%', once: true },
        })
      })
    },
    el,
  )
}

onUnmounted(() => {
  disposed = true
  mm?.revert()
})
</script>

<template>
  <div ref="root" class="page landing">
    <section class="landing-hero" aria-labelledby="hero-heading">
      <div class="hero-ambient" aria-hidden="true">
        <span
          v-for="(phrase, index) in ambientPhrases"
          :key="phrase.id"
          class="ambient-phrase"
          :class="`ambient-${index + 1}`"
        >{{ phrase.en }}</span>
      </div>

      <div class="hero-grid">
        <div class="hero">
          <div class="eyebrow">Phrase Labs / Daily Drill</div>
          <h1 id="hero-heading" style="margin-top: 18px">看一眼，<span>敲出来</span>，<br />真正记住。</h1>
          <p class="hero-copy">
            一个免费的英语短语键盘训练站：看中文写英文、看英文写中文，或在真实例句里补全短语。
            答错与接近的题当轮回炉，其余按艾宾浩斯遗忘曲线安排下次见面。无需注册，进度只留在这台设备上。
          </p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" type="button" @click="start()">
              {{ startLabel }} <span aria-hidden="true">↗</span>
            </button>
            <button v-if="resumable" class="btn btn-lg" type="button" @click="resume">
              继续上一轮
            </button>
            <button v-else class="btn btn-lg" type="button" @click="startQuick">
              5 条快练 · 30 秒
            </button>
            <RouterLink class="btn btn-lg" to="/library">浏览词库</RouterLink>
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
          <div class="today-facts">
            <div><span>连续</span><strong>{{ streak }} 天</strong></div>
            <div><span>已掌握</span><strong>{{ mastered }} 条</strong></div>
            <div><span>累计作答</span><strong>{{ totalReviews }} 题</strong></div>
          </div>
          <button v-if="dueCount" class="today-link" type="button" @click="startDue">
            待复习 {{ dueCount }} 条，先过一遍 ↗
          </button>
          <p v-else class="today-note">今天没有到期的短语，明天再来。</p>
        </aside>
      </div>

      <div class="hero-ribbon" aria-hidden="true">
        <div class="ribbon-track">
          <template v-for="(text, index) in ribbonText" :key="text">
            <span>{{ text }}</span>
            <i v-if="index < ribbonText.length - 1"></i>
          </template>
        </div>
      </div>
    </section>

    <section v-if="daily" class="section daily-section" aria-labelledby="daily-heading">
      <div class="section-head reveal-item">
        <div>
          <div class="eyebrow">Today / 今日一句</div>
          <h2 id="daily-heading" style="margin-top: 8px">今天带走一句，晚上就能用</h2>
        </div>
        <RouterLink class="small muted" :to="`/phrases/${daily.category}`">
          看它属于哪一类 ↗
        </RouterLink>
      </div>
      <article class="card daily-card">
        <div class="phrase-main daily-text">
          <span class="phrase-en">{{ daily.en }}</span>
          <div class="phrase-zh">{{ daily.zh }}</div>
          <div class="phrase-example">{{ dailyDetail.exampleEn }} — {{ dailyDetail.exampleZh }}</div>
        </div>
        <div class="daily-actions">
          <button class="btn btn-primary" type="button" @click="practiseDaily">
            练这一条
          </button>
          <button
            v-if="settingsStore.voiceAvailable"
            class="btn"
            type="button"
            :disabled="speaking"
            @click="speakDaily"
          >
            <span v-if="speaking" class="spinner" aria-hidden="true"></span>
            {{ speaking ? '朗读中…' : '听一遍' }}
          </button>
        </div>
      </article>
    </section>

    <section class="stat-strip" aria-label="站点概览">
      <div class="stat-item">
        <div class="stat-value">{{ phrases.length }}</div>
        <div class="stat-label">条精选短语</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ categories.length }}</div>
        <div class="stat-label">个使用场景分类</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">4</div>
        <div class="stat-label">种训练题型</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">0</div>
        <div class="stat-label">次注册，进度只存本机</div>
      </div>
    </section>

    <section class="demo-section" aria-labelledby="demo-heading">
      <div class="demo-copy">
        <div class="eyebrow">See it / 三步就记住</div>
        <h2 id="demo-heading">看提示，敲出来，<br />当场就知道对不对。</h2>
        <p class="hero-copy">
          不用背规则，也不用猜判定。输入期间不打断你，提交后立刻给出正确答案、例句，以及按遗忘曲线算出的下次复习时间。
        </p>
        <div class="demo-points">
          <div><strong>01</strong><span>输入时不判定、不上色</span></div>
          <div><strong>02</strong><span>答错当轮排到队尾重练</span></div>
          <div><strong>03</strong><span>遗忘曲线管下次什么时候再见</span></div>
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" type="button" @click="startQuick">
            先试 5 条 · 30 秒 <span aria-hidden="true">↗</span>
          </button>
          <RouterLink class="btn btn-lg" to="/study">直接进入训练</RouterLink>
        </div>
      </div>

      <div class="demo-stage" aria-label="答题流程示意">
        <div class="demo-stage-top">
          <span class="mode-tag">中 → 英</span>
          <span class="demo-counter">01 / 05</span>
        </div>
        <div class="demo-prompt-label">请写出英文短语</div>
        <div class="demo-prompt">{{ demoPhrase.zh }}</div>
        <div class="demo-input-line">
          <span class="input-prefix">›</span>
          <span class="demo-typed">{{ demoPhrase.en }}</span>
          <span class="demo-caret" aria-hidden="true"></span>
        </div>
        <div class="demo-feedback">
          <span class="demo-check" aria-hidden="true">✓</span>
          <div>
            <strong>答对了</strong>
            <p>{{ demoDetail.exampleEn }}</p>
          </div>
        </div>
        <div class="demo-stage-foot">
          <span>记忆稳定 · 4 天</span>
          <span>下次见面 · 4 天后</span>
        </div>
      </div>
    </section>

    <section class="section loop-section" aria-labelledby="loop-heading">
      <div class="section-head reveal-item">
        <div>
          <div class="eyebrow">How it works</div>
          <h2 id="loop-heading" style="margin-top: 8px">看、敲、再见 —— 记住就这三步</h2>
        </div>
        <span class="small muted">一轮通常 5–10 分钟</span>
      </div>
      <div class="loop-grid">
        <article class="loop-step">
          <span class="loop-index">01</span>
          <h3>看一句提示</h3>
          <p>中文、英文或例句填空，三种角度轮换；不靠选择题蒙混过关。</p>
        </article>
        <article class="loop-step">
          <span class="loop-index">02</span>
          <h3>键盘敲出来</h3>
          <p>Enter 提交、Esc 跳过。输入期间不判定、不上色，不打断手速。</p>
        </article>
        <article class="loop-step">
          <span class="loop-index">03</span>
          <h3>隔天再见一次</h3>
          <p>答错当轮回炉；其余按艾宾浩斯式遗忘曲线排期，答得越稳、间隔拉得越长。</p>
        </article>
      </div>
    </section>

    <section class="section" aria-labelledby="memory-heading">
      <div class="section-head reveal-item">
        <div>
          <div class="eyebrow">Memory model / 遗忘曲线</div>
          <h2 id="memory-heading" style="margin-top: 8px">下次什么时候再见，是算出来的</h2>
        </div>
        <span class="small muted">不是固定的 1 / 2 / 4 / 7 天</span>
      </div>
      <div class="memory-grid">
        <div class="card memory-card reveal-item">
          <p class="memory-lead">
            每条短语只记一个数字：<strong>记忆稳定度</strong>（天）。保留率按指数衰减，跌到
            {{ retentionPercent }} 才回到队列；答对把它拉长，答错把它压缩——间隔跟着你的记忆走，而不是跟日历走。
          </p>
          <svg
            class="memory-chart"
            viewBox="0 0 490 128"
            role="img"
            aria-label="记忆保留率随时间衰减、每次复习回到满值的示意图"
          >
            <line
              class="memory-goal-line"
              x1="20"
              :y1="memoryCurve.goalY"
              :x2="memoryCurve.endX"
              :y2="memoryCurve.goalY"
            />
            <path class="memory-curve" :d="memoryCurve.path" />
            <circle
              v-for="(mark, index) in memoryCurve.marks"
              :key="index"
              class="memory-mark"
              :cx="mark.x"
              :cy="mark.y"
              r="3.6"
            />
            <text class="memory-axis" x="2" y="48">100%</text>
            <text class="memory-axis" x="2" y="104">90%</text>
            <text class="memory-axis" x="20" y="118">第 0 天</text>
            <text class="memory-axis" :x="memoryCurve.endX" y="118" text-anchor="end">
              第 {{ memoryCurve.totalDays }} 天
            </text>
          </svg>
          <p class="memory-legend">
            <span>━ 记忆保留率</span>
            <span>┈ {{ retentionPercent }} 复习线</span>
            <span>● 复习日：2 → 4 → 8 → 16 天，越熟隔越久</span>
          </p>
        </div>
        <ul class="memory-facts reveal-item">
          <li>
            <strong>{{ retentionPercent }}</strong>
            <span>目标保留率，跌到这条线才安排复习</span>
          </li>
          <li>
            <strong>{{ growthText }}</strong>
            <span>每次答对，稳定度拉长近一倍</span>
          </li>
          <li>
            <strong>{{ MASTERED_STABILITY }} 天</strong>
            <span>稳定度到这里算「已掌握」，之后隔很久才回头</span>
          </li>
          <li>
            <strong>{{ decayPercent }}</strong>
            <span>答错缩到四成，半天后再见一次</span>
          </li>
        </ul>
      </div>
    </section>

    <section class="section" aria-labelledby="modes-heading">
      <div class="section-head reveal-item">
        <div>
          <div class="eyebrow">Modes</div>
          <h2 id="modes-heading" style="margin-top: 8px">按题型开练</h2>
        </div>
        <RouterLink class="small muted" to="/settings">调整每日目标 ↗</RouterLink>
      </div>
      <p class="small muted" style="margin-bottom: 14px">
        点一下就用该题型开始，并记为默认题型；点错可在设置里改回来。
      </p>
      <div class="grid grid-4">
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

    <section class="section" aria-labelledby="why-heading">
      <div class="section-head reveal-item">
        <div>
          <div class="eyebrow">Why phrases</div>
          <h2 id="why-heading" style="margin-top: 8px">为什么是「短语 + 键盘」</h2>
        </div>
        <RouterLink class="small muted" to="/phrases/daily">看日常口语示例 ↗</RouterLink>
      </div>
      <div class="grid grid-4 feature-grid">
        <article class="feature">
          <span class="feature-num">01</span>
          <h3>键盘流，不碰鼠标</h3>
          <p>Enter 提交、Esc 跳过、⌥H 提示、⌥F 收藏；输入期间不实时判定、不上色，不打乱手速。</p>
        </article>
        <article class="feature">
          <span class="feature-num">02</span>
          <h3>练的是完整短语</h3>
          <p>{{ phrases.length }} 条短语，含动词短语、介词搭配与习语；每条配双语例句与用法提示。</p>
        </article>
        <article class="feature">
          <span class="feature-num">03</span>
          <h3>错题当轮回炉</h3>
          <p>答错与接近的题自动排到本轮队尾重练；每条短语记着「记忆稳定多少天」，答对拉长、答错缩水，下次何时复习由遗忘曲线算。</p>
        </article>
        <article class="feature">
          <span class="feature-num">04</span>
          <h3>没有账号，也没有服务器</h3>
          <p>进度、统计与设置只存浏览器，可导出 JSON 备份；清理浏览器数据前记得先导出。</p>
        </article>
      </div>
    </section>

    <section class="section" aria-labelledby="cats-heading">
      <div class="section-head reveal-item">
        <div>
          <div class="eyebrow">Browse</div>
          <h2 id="cats-heading" style="margin-top: 8px">按场景找短语</h2>
        </div>
        <RouterLink class="small muted" to="/library">全部 {{ phrases.length }} 条 · 词库 ↗</RouterLink>
      </div>
      <div class="category-grid">
        <RouterLink
          v-for="category in categories"
          :key="category.id"
          class="category-link"
          :to="`/phrases/${category.id}`"
        >
          <span class="category-icon" aria-hidden="true">{{ category.icon }}</span>
          <span class="category-name">{{ category.name }}</span>
          <span class="category-count">{{ phraseCountByCategory[category.id] ?? 0 }} 条</span>
        </RouterLink>
      </div>
      <p class="small muted" style="margin-top: 14px">
        每个分类页有这类表达的介绍、练习建议与全部词条；也可以在词库按状态、难度筛选后直接开练。
      </p>
    </section>

    <section class="section" aria-labelledby="tags-heading">
      <div class="section-head reveal-item">
        <div>
          <div class="eyebrow">Topics</div>
          <h2 id="tags-heading" style="margin-top: 8px">按主题练一轮</h2>
        </div>
        <RouterLink class="small muted" to="/library">按主题筛选词库 ↗</RouterLink>
      </div>
      <p class="small muted" style="margin-bottom: 14px">
        每个主题随机抽 20 条，练完就停；想练全量就去词库叠上筛选条件。
      </p>
      <div class="chip-row">
        <button
          v-for="item in practiceTags"
          :key="item.tag"
          class="chip"
          type="button"
          @click="startTag(item.tag)"
        >
          {{ item.tag }} · {{ item.count }}
        </button>
      </div>
    </section>

    <section class="landing-cta reveal-item" aria-labelledby="cta-heading">
      <div class="eyebrow">Ready / 现在就开始</div>
      <h2 id="cta-heading">今天记住一句，明天就能用上。</h2>
      <p class="small muted">无需注册，进度只存这台设备。</p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" type="button" @click="start()">
          {{ startLabel }} <span aria-hidden="true">↗</span>
        </button>
        <button v-if="resumable" class="btn btn-lg" type="button" @click="resume">继续上一轮</button>
        <button v-else class="btn btn-lg" type="button" @click="startQuick">5 条快练 · 30 秒</button>
        <RouterLink class="btn btn-lg" to="/library">浏览词库</RouterLink>
      </div>
    </section>
  </div>
</template>
