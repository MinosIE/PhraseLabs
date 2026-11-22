import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { CategoryId, ModeSetting } from '@/types/phrase'
import type { Settings, Difficulty, Strictness, Theme } from '@/types/progress'
import { loadSettings, saveSettings } from '@/lib/storage'
import { ensureVoices, getVoices, hasEnglishVoice } from '@/lib/speech'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(loadSettings())
  // 朗读能力由设备决定：没有英文音色时全局隐藏朗读入口
  const voiceAvailable = ref(false)

  watch(settings, (value) => saveSettings(value), { deep: true })

  async function detectVoices(): Promise<void> {
    try {
      const voices = await ensureVoices()
      voiceAvailable.value = hasEnglishVoice(voices)
      // 首次探测可能早于浏览器补齐音色，补挂一次监听，就绪后自动放出朗读入口
      if (!voiceAvailable.value && typeof speechSynthesis !== 'undefined') {
        speechSynthesis.addEventListener(
          'voiceschanged',
          () => {
            if (hasEnglishVoice(getVoices())) voiceAvailable.value = true
          },
          { once: true },
        )
      }
    } catch {
      // 探测失败按不可用处理，朗读入口保持隐藏
      voiceAvailable.value = false
    }
  }

  function setGoal(goal: number): void {
    settings.value.dailyGoal = Math.max(5, Math.min(200, Math.round(goal)))
  }

  function setMode(mode: ModeSetting): void {
    settings.value.mode = mode
  }

  function toggleCategory(id: CategoryId): void {
    const list = settings.value.categories
    settings.value.categories = list.includes(id)
      ? list.filter((item) => item !== id)
      : [...list, id]
  }

  function setStrictness(value: Strictness): void {
    settings.value.strictness = value
  }

  function setDifficulty(value: Difficulty): void {
    settings.value.difficulty = value
  }

  function setTheme(value: Theme): void {
    settings.value.theme = value
  }

  function setVoice(uri: string): void {
    settings.value.voiceURI = uri
  }

  function toggleFavorite(id: string): void {
    const list = settings.value.favorites
    settings.value.favorites = list.includes(id)
      ? list.filter((item) => item !== id)
      : [...list, id]
  }

  function replace(next: Settings): void {
    settings.value = { ...next }
  }

  return {
    settings,
    voiceAvailable,
    detectVoices,
    setGoal,
    setMode,
    toggleCategory,
    setStrictness,
    setDifficulty,
    setTheme,
    setVoice,
    toggleFavorite,
    replace,
  }
})
