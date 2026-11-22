<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SelectField from '@/components/SelectField.vue'
import { categories, categoryName } from '@/data/categories'
import { phraseCountByCategory, phrases, tagCounts } from '@/data/phrases'
import { detailOf } from '@/data/phrases/details'
import { useDebounce } from '@/composables/useDebounce'
import { isMistake } from '@/lib/mistakes'
import { isDue, isMastered } from '@/lib/srs'
import { speakEn } from '@/lib/speech'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import type { CategoryId, Level } from '@/types/phrase'

const router = useRouter()
const progressStore = useProgressStore()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()

/** 789 条一次全渲染会让首屏和滚动都变慢，按批加载 */
const PAGE_SIZE = 60

const query = ref('')
const debouncedQuery = useDebounce(query)
const activeCategory = ref<CategoryId | ''>('')
const activeTag = ref('')
const activeLevel = ref<Level | ''>('')
const sort = ref<'default' | 'level' | 'mastery'>('default')
const status = ref<'all' | 'due' | 'mastered' | 'favorite' | 'mistake'>('all')
const visibleCount = ref(PAGE_SIZE)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const favoriteSet = computed(() => new Set(settingsStore.settings.favorites))

const filtered = computed(() => {
  const keyword = debouncedQuery.value.trim().toLowerCase()
  const result = phrases.filter((phrase) => {
    if (keyword) {
      // 别名也参与搜索，搜「预订」能命中 book a table
      const haystack =
        `${phrase.en} ${phrase.zh} ${phrase.aliases.join(' ')} ${phrase.tags.join(' ')}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (activeCategory.value && phrase.category !== activeCategory.value) return false
    if (activeTag.value && !phrase.tags.includes(activeTag.value)) return false
    if (activeLevel.value && phrase.level !== activeLevel.value) return false

    const progress = progressStore.progress[phrase.id]
    if (status.value === 'due' && !isDue(progress)) return false
    if (status.value === 'mastered' && !isMastered(progress)) return false
    if (status.value === 'mistake' && !isMistake(progress)) return false
    if (status.value === 'favorite' && !favoriteSet.value.has(phrase.id)) return false
    return true
  })

  if (sort.value === 'level') return result.sort((a, b) => a.level - b.level)
  if (sort.value === 'mastery') {
    return result.sort(
      (a, b) =>
        (progressStore.progress[b.id]?.stability ?? 0) -
        (progressStore.progress[a.id]?.stability ?? 0),
    )
  }
  return result
})

const visible = computed(() => filtered.value.slice(0, visibleCount.value))
const canLoadMore = computed(() => visibleCount.value < filtered.value.length)

// 只在这几个筛选条件变化时回到第一批，收藏或进度变化不打断浏览位置
watch([debouncedQuery, activeCategory, activeTag, activeLevel, sort, status], () => {
  visibleCount.value = PAGE_SIZE
})

function loadMore(): void {
  if (!canLoadMore.value) return
  visibleCount.value = Math.min(filtered.value.length, visibleCount.value + PAGE_SIZE)
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    },
    { rootMargin: '600px 0px' },
  )
  watch(
    sentinel,
    (el) => {
      observer?.disconnect()
      if (el) observer?.observe(el)
    },
    { immediate: true },
  )
})

onUnmounted(() => observer?.disconnect())

/** 把当前筛选结果直接变成一轮训练 */
function practiceFiltered(): void {
  if (!filtered.value.length) return
  sessionStore.startWith(
    filtered.value.map((phrase) => phrase.id),
    `词库筛选 · ${filtered.value.length} 条`,
  )
  void router.push('/study')
}

const hasFilter = computed(
  () =>
    !!query.value ||
    !!activeCategory.value ||
    !!activeTag.value ||
    !!activeLevel.value ||
    status.value !== 'all' ||
    sort.value !== 'default',
)

const searchInput = ref<HTMLInputElement | null>(null)

/** 只清搜索词；分类/难度/状态/排序各自都有「全部」选项，不必再放一个页面级清空 */
function clearQuery(): void {
  query.value = ''
  searchInput.value?.focus()
}

/** 无结果时的兼底：一键把搜索与筛选全部退回默认 */
function resetFilters(): void {
  query.value = ''
  activeCategory.value = ''
  activeTag.value = ''
  activeLevel.value = ''
  status.value = 'all'
  sort.value = 'default'
}

const speakingId = ref('')

function speak(id: string, text: string): void {
  if (speakingId.value) return
  speakingId.value = id
  void speakEn(text, settingsStore.settings.voiceURI)
    .catch(() => undefined)
    .finally(() => {
      speakingId.value = ''
    })
}

const levelOptions = [
  { value: '', label: '全部难度' },
  ...Array.from({ length: 5 }, (_, index) => ({
    value: index + 1,
    label: `难度 ${index + 1}`,
  })),
]

const sortOptions = [
  { value: 'default', label: '默认顺序' },
  { value: 'level', label: '难度从低到高' },
  { value: 'mastery', label: '掌握度从高到低' },
]

const statuses = [
  { value: 'all', label: '全部' },
  { value: 'due', label: '待复习' },
  { value: 'mistake', label: '错词' },
  { value: 'mastered', label: '已掌握' },
  { value: 'favorite', label: '已收藏' },
] as const

function onLevel(value: string | number): void {
  activeLevel.value = value === '' ? '' : (Number(value) as Level)
}

function onSort(value: string | number): void {
  sort.value = value as 'default' | 'level' | 'mastery'
}
</script>

<template>
  <div class="page">
    <div class="section-head">
      <div>
        <div class="eyebrow">Collection / {{ phrases.length }} phrases</div>
        <h1 style="font-size: 36px; margin-top: 10px">词库</h1>
      </div>
      <div class="library-head-actions">
        <span class="small muted" role="status" aria-live="polite">{{ filtered.length }} 条结果</span>
        <button
          v-if="hasFilter"
          class="btn btn-sm btn-primary"
          type="button"
          :disabled="!filtered.length"
          @click="practiceFiltered"
        >
          练这 {{ filtered.length }} 条
        </button>
      </div>
    </div>

    <div class="toolbar">
      <label class="field search-field">
        搜索
        <span class="search-box">
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="英文、中文或标签…"
            enterkeyhint="search"
            autocomplete="off"
            spellcheck="false"
            @keydown.esc="clearQuery"
          />
          <button
            v-if="query"
            class="search-clear"
            type="button"
            aria-label="清空搜索"
            title="清空搜索（Esc）"
            @click="clearQuery"
          >
            ✕
          </button>
        </span>
      </label>
      <SelectField label="难度" :model-value="activeLevel" :options="levelOptions" @update:model-value="onLevel" />
      <SelectField label="排序" :model-value="sort" :options="sortOptions" @update:model-value="onSort" />
    </div>

    <div class="chip-row">
      <button class="chip" :class="{ active: activeCategory === '' }" type="button" @click="activeCategory = ''">
        全部分类 · {{ phrases.length }}
      </button>
      <button
        v-for="category in categories"
        :key="category.id"
        class="chip"
        :class="{ active: activeCategory === category.id }"
        type="button"
        @click="activeCategory = category.id"
      >
        {{ category.name }} · {{ phraseCountByCategory[category.id] ?? 0 }}
      </button>
    </div>

    <div class="chip-row" style="margin-top: 8px">
      <button class="chip" :class="{ active: activeTag === '' }" type="button" @click="activeTag = ''">
        全部主题
      </button>
      <button
        v-for="item in tagCounts"
        :key="item.tag"
        class="chip"
        :class="{ active: activeTag === item.tag }"
        type="button"
        @click="activeTag = item.tag"
      >
        {{ item.tag }} · {{ item.count }}
      </button>
    </div>

    <div class="chip-row" style="margin-top: 8px">
      <button
        v-for="item in statuses"
        :key="item.value"
        class="chip"
        :class="{ active: status === item.value }"
        type="button"
        @click="status = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="card" style="margin-top: 24px; padding: 0; overflow: hidden">
      <div v-if="filtered.length === 0" class="empty-state">
        没有符合条件的短语。<button class="hint-link" type="button" @click="resetFilters">清空筛选</button>
      </div>
      <div v-for="phrase in visible" :key="phrase.id" class="phrase-item">
        <div class="phrase-main">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            <span class="phrase-en">{{ phrase.en }}</span>
            <span v-if="isMastered(progressStore.progress[phrase.id])" class="badge mastered">已掌握</span>
            <span v-else-if="isDue(progressStore.progress[phrase.id])" class="badge due">待复习</span>
          </div>
          <div class="phrase-zh">{{ phrase.zh }}</div>
          <div class="phrase-example">
            {{ detailOf(phrase.id).exampleEn }} — {{ detailOf(phrase.id).exampleZh }}
          </div>
          <div style="margin-top: 9px; display: flex; gap: 6px; flex-wrap: wrap">
            <span class="badge">{{ categoryName(phrase.category) }}</span>
            <span class="badge">难度 {{ phrase.level }}</span>
            <span v-for="tag in phrase.tags" :key="tag" class="badge">{{ tag }}</span>
          </div>
        </div>
        <div class="phrase-actions">
          <button
            v-if="settingsStore.voiceAvailable"
            class="icon-btn"
            type="button"
            :disabled="speakingId === phrase.id"
            :aria-label="`朗读 ${phrase.en}`"
            @click="speak(phrase.id, phrase.en)"
          >
            <span v-if="speakingId === phrase.id" class="spinner" aria-hidden="true"></span>
            <span v-else aria-hidden="true">🔊</span>
          </button>
          <button
            class="icon-btn"
            :class="{ active: favoriteSet.has(phrase.id) }"
            type="button"
            :aria-label="favoriteSet.has(phrase.id) ? '取消收藏' : '收藏'"
            :aria-pressed="favoriteSet.has(phrase.id)"
            @click="settingsStore.toggleFavorite(phrase.id)"
          >
            {{ favoriteSet.has(phrase.id) ? '★' : '☆' }}
          </button>
        </div>
      </div>

      <div v-if="canLoadMore" ref="sentinel" class="load-more">
        <span class="small muted">已显示 {{ visible.length }} / {{ filtered.length }} 条</span>
        <button class="btn btn-sm" type="button" @click="loadMore">加载更多</button>
      </div>
    </div>
  </div>
</template>
