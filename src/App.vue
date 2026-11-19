<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import type { Theme } from '@/types/progress'

const settingsStore = useSettingsStore()
const theme = computed(() => settingsStore.settings.theme)

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

function applyTheme(): void {
  const dark =
    theme.value === 'dark' ||
    (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

watch(theme, applyTheme, { immediate: true })

const media = window.matchMedia('(prefers-color-scheme: dark)')
onMounted(() => {
  media.addEventListener('change', applyTheme)
  // 提前探测音色，避免用户第一次点朗读时才开始等待语音列表
  void settingsStore.detectVoices()
})
onUnmounted(() => media.removeEventListener('change', applyTheme))
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
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
