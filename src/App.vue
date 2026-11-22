<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { categories } from '@/data/categories'
import { contentOf } from '@/data/categoryContent'
import { phraseCountByCategory, phrases } from '@/data/phrases'
import {
  applyPwaUpdate,
  dismissUpdate,
  updateDismissed,
  updateReady,
} from '@/composables/usePwaUpdate'
import { OG_IMAGE, SITE_NAME, canonicalUrl } from '@/lib/seo'
import { useSettingsStore } from '@/stores/settings'
import type { Theme } from '@/types/progress'

const route = useRoute()
const settingsStore = useSettingsStore()
const theme = computed(() => settingsStore.settings.theme)

const DESCRIPTIONS: Record<string, string> = {
  home: `${phrases.length} 条英语短语、${categories.length} 个分类，中译英 / 英译中 / 例句填空即时判定，按艾宾浩斯遗忘曲线安排复习，无需注册，进度只存在本机。`,
  library: `按分类、难度与掌握度筛选 ${phrases.length} 条英语短语，查看中英释义与双语例句，可直接把筛选结果变成一轮训练。`,
  study: '短语答题界面：键盘输入、即时判定，答错自动排到本轮队尾重练。',
  stats: '本机学习统计：连续天数、正确率、每周趋势与分类掌握度。',
  settings: '每日目标、题型、分类、判定严格度、主题与朗读音色设置。',
}

const seo = computed(() => {
  if (route.name === 'category') {
    const category = categories.find((item) => item.id === route.params.category)
    if (!category) {
      return {
        title: '分类不存在',
        description: '这个分类不存在，回到首页挑选要练的短语分类。',
        robots: 'noindex, follow',
      }
    }
    const count = phraseCountByCategory[category.id] ?? 0
    const sample = phrases
      .filter((phrase) => phrase.category === category.id)
      .slice(0, 3)
      .map((phrase) => phrase.en)
      .join('、')
    return {
      title: `${category.name}英语短语 · ${count} 条`,
      description: `${category.name}共 ${count} 条英语短语，如 ${sample}。可做中译英、英译中与例句填空练习，答错自动重练。`,
      robots: route.meta.robots ?? 'index, follow',
    }
  }

  return {
    title: route.meta.title ?? '英语短语键盘训练',
    description: DESCRIPTIONS[String(route.name)] ?? '免费、纯前端的英语短语键盘训练站。',
    robots: route.meta.robots ?? 'index, follow',
  }
})

useHead(() => {
  const title = `${seo.value.title} · ${SITE_NAME}`
  const url = canonicalUrl(route.path)
  return {
    title,
    htmlAttrs: { lang: 'zh-CN' },
    meta: [
      { name: 'description', content: seo.value.description },
      { name: 'robots', content: seo.value.robots },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: title },
      { property: 'og:description', content: seo.value.description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:locale', content: 'zh_CN' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: seo.value.description },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    link: [{ rel: 'canonical', href: url }],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': buildStructuredData(),
        }),
      },
    ],
  }
})

/** 首页输出站点级实体；分类页额外输出面包屑、词条集合与 FAQ */
function buildStructuredData(): Record<string, unknown>[] {
  const graph: Record<string, unknown>[] = [
    { '@type': 'WebSite', name: SITE_NAME, url: canonicalUrl('/'), inLanguage: 'zh-CN' },
    { '@type': 'Organization', name: SITE_NAME, url: canonicalUrl('/') },
    {
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: canonicalUrl('/'),
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      inLanguage: 'zh-CN',
      description: seo.value.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
    },
  ]

  if (route.name !== 'category') return graph
  const category = categories.find((item) => item.id === route.params.category)
  const content = category ? contentOf(category.id) : undefined
  if (!category || !content) return graph

  const pageUrl = canonicalUrl(`/phrases/${category.id}`)
  const items = phrases.filter((phrase) => phrase.category === category.id)

  graph.push(
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: canonicalUrl('/') },
        { '@type': 'ListItem', position: 2, name: '词库', item: canonicalUrl('/library') },
        {
          '@type': 'ListItem',
          position: 3,
          name: `${category.name}英语短语`,
          item: pageUrl,
        },
      ],
    },
    {
      '@type': 'CollectionPage',
      name: `${category.name}英语短语`,
      url: pageUrl,
      inLanguage: 'zh-CN',
      description: content.intro,
      numberOfItems: items.length,
      mainEntity: {
        '@type': 'DefinedTermSet',
        name: `${category.name}英语短语`,
        hasDefinedTerm: items.slice(0, 12).map((phrase) => ({
          '@type': 'DefinedTerm',
          name: phrase.en,
          description: phrase.zh,
          inDefinedTermSet: pageUrl,
        })),
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: content.faq.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a },
      })),
    },
  )

  return graph
}

const THEME_ORDER: Theme[] = ['system', 'light', 'dark']
const THEME_LABEL: Record<Theme, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}
const THEME_ICON: Record<Theme, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
}

function cycleTheme(): void {
  const index = THEME_ORDER.indexOf(theme.value)
  settingsStore.setTheme(THEME_ORDER[(index + 1) % THEME_ORDER.length])
}

let media: MediaQueryList | null = null

/** 主题属性挂在 <html> 上，构建期没有 document，交由 index.html 的内联脚本兜底 */
function applyTheme(): void {
  if (typeof document === 'undefined') return
  const dark = theme.value === 'dark' || (theme.value === 'system' && (media?.matches ?? false))
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

watch(theme, applyTheme)

onMounted(() => {
  media = window.matchMedia('(prefers-color-scheme: dark)')
  applyTheme()
  media.addEventListener('change', applyTheme)
  // 提前探测音色，避免用户第一次点朗读时才开始等待语音列表
  void settingsStore.detectVoices()
})
onUnmounted(() => media?.removeEventListener('change', applyTheme))
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <div v-if="updateReady && !updateDismissed" class="update-bar" role="status">
      <span>新版本已就绪</span>
      <button class="btn btn-sm btn-primary" type="button" @click="applyPwaUpdate">刷新启用</button>
      <button class="icon-btn" type="button" aria-label="稍后再说" @click="dismissUpdate">✕</button>
    </div>
    <header class="site-header">
      <div class="header-inner">
        <RouterLink to="/" class="brand">
          <span class="brand-mark">PL</span>
          <span>PhraseLabs</span>
        </RouterLink>
        <nav class="nav">
          <RouterLink to="/">首页</RouterLink>
          <RouterLink to="/study">学习</RouterLink>
          <RouterLink to="/library">词库</RouterLink>
          <RouterLink to="/stats">统计</RouterLink>
          <RouterLink to="/settings">设置</RouterLink>
        </nav>
        <button
          class="theme-toggle"
          type="button"
          :aria-label="`主题：${THEME_LABEL[theme]}，点击切换`"
          :title="`主题：${THEME_LABEL[theme]}`"
          @click="cycleTheme"
        >
          {{ THEME_ICON[theme] }}
        </button>
      </div>
    </header>

    <main id="main-content" class="main">
      <RouterView />
    </main>

    <footer class="site-footer">
      数据仅保存在你的浏览器本地 · 无需注册 · 免费使用
    </footer>
  </div>
</template>
