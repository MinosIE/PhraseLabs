<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { contentOf } from '@/data/categoryContent'
import { categories } from '@/data/categories'
import { phraseCountByCategory, phrases } from '@/data/phrases'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const category = computed(() => categories.find((item) => item.id === route.params.category))
const items = computed(() =>
  category.value ? phrases.filter((phrase) => phrase.category === category.value?.id) : [],
)
const sample = computed(() =>
  items.value
    .slice(0, 3)
    .map((phrase) => phrase.en)
    .join('、'),
)
const levelRange = computed(() => {
  const levels = items.value.map((phrase) => phrase.level)
  if (!levels.length) return '1–5'
  const min = Math.min(...levels)
  const max = Math.max(...levels)
  return min === max ? `${min}` : `${min}–${max}`
})

function startCategory(): void {
  if (!category.value) return
  sessionStore.start({
    categories: [category.value.id],
    label: `分类 · ${category.value.name}`,
  })
  void router.push('/study')
}

const content = computed(() => (category.value ? contentOf(category.value.id) : undefined))

/** 5 条快练：给刚从搜索结果进来的访客一个 30 秒就能完成的入口 */
function startQuick(): void {
  if (!category.value) return
  const ids = items.value.slice(0, 5).map((phrase) => phrase.id)
  if (!ids.length) return
  sessionStore.startWith(ids, `快练 · ${category.value.name}`)
  void router.push('/study')
}
</script>

<template>
  <div v-if="!category" class="page">
    <div class="eyebrow">Collection / 404</div>
    <h1 style="margin-top: 12px">分类不存在</h1>
    <p class="muted">没有找到这个分类，回到首页或词库重新选择。</p>
    <div class="hero-actions" style="margin-top: 20px">
      <RouterLink class="btn btn-primary" to="/">回到首页</RouterLink>
      <RouterLink class="btn" to="/library">浏览词库</RouterLink>
    </div>
  </div>

  <div v-else class="page">
    <nav class="small muted" aria-label="面包屑">
      <RouterLink to="/">首页</RouterLink>
      <span aria-hidden="true"> / </span>
      <RouterLink to="/library">词库</RouterLink>
      <span aria-hidden="true"> / </span>
      <span>{{ category.name }}</span>
    </nav>

    <header class="section-head" style="margin-top: 16px">
      <div>
        <div class="eyebrow">Collection / {{ items.length }} phrases</div>
        <h1 style="font-size: 36px; margin-top: 10px">
          {{ category.icon }} {{ category.name }}英语短语
        </h1>
      </div>
      <button class="btn btn-primary" type="button" @click="startQuick">
        5 条快练 · 30 秒
      </button>
    </header>

    <p class="muted" style="max-width: 72ch; margin-top: 4px">
      {{ content?.intro }}
    </p>
    <p class="small muted" style="max-width: 72ch">
      本类共 {{ items.length }} 条，难度 {{ levelRange }}，例如
      <strong>{{ sample }}</strong>
      等；每条都有中文释义与双语例句，可做中译英、英译中与例句填空。
    </p>

    <div v-if="content" class="grid grid-2" style="margin-top: 18px">
      <div class="card category-note">
        <div class="eyebrow">How to practise</div>
        <h2 class="category-note-title">这一类怎么练</h2>
        <ol class="category-tips">
          <li v-for="tip in content.tips" :key="tip">{{ tip }}</li>
        </ol>
      </div>
      <div class="card category-note">
        <div class="eyebrow">When to use</div>
        <h2 class="category-note-title">什么时候会用到</h2>
        <p class="small muted" style="margin: 0">{{ content.scenario }}</p>
      </div>
    </div>

    <div class="chip-row" style="margin: 22px 0 18px">
      <RouterLink
        v-for="item in categories"
        :key="item.id"
        class="chip"
        :class="{ active: item.id === category.id }"
        :to="`/phrases/${item.id}`"
      >
        {{ item.name }} · {{ phraseCountByCategory[item.id] ?? 0 }}
      </RouterLink>
    </div>

    <div class="card" style="padding: 0; overflow: hidden">
      <article v-for="phrase in items" :key="phrase.id" class="phrase-item">
        <div class="phrase-main">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            <span class="phrase-en">{{ phrase.en }}</span>
            <span v-if="phrase.enAliases?.length" class="badge">变体：{{ phrase.enAliases.join(' / ') }}</span>
          </div>
          <div class="phrase-zh">{{ phrase.zh }}</div>
          <div class="phrase-example">{{ phrase.exampleEn }} — {{ phrase.exampleZh }}</div>
          <div style="margin-top: 9px; display: flex; gap: 6px; flex-wrap: wrap">
            <span class="badge">难度 {{ phrase.level }}</span>
            <span v-for="tag in phrase.tags" :key="tag" class="badge">{{ tag }}</span>
          </div>
        </div>
      </article>
    </div>

    <section v-if="content" class="section" style="margin-top: 26px" aria-labelledby="faq-title">
      <div class="section-head">
        <h2 id="faq-title">常见问题</h2>
      </div>
      <div class="faq-list">
        <details v-for="entry in content.faq" :key="entry.q" class="faq-item">
          <summary>{{ entry.q }}</summary>
          <p>{{ entry.a }}</p>
        </details>
      </div>
    </section>

    <div class="hero-actions" style="margin-top: 26px">
      <button class="btn btn-primary" type="button" @click="startQuick">
        先练 5 条
      </button>
      <button class="btn" type="button" @click="startCategory">
        练这一类 · {{ items.length }} 条
      </button>
      <RouterLink class="btn" to="/library">在词库中筛选</RouterLink>
    </div>
  </div>
</template>
