<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SelectField from '@/components/SelectField.vue'
import { categories } from '@/data/categories'
import { phraseCountByCategory, phrases } from '@/data/phrases'
import { dayKey } from '@/lib/date'
import { ensureVoices, hasEnglishVoice } from '@/lib/speech'
import { exportData, importData } from '@/lib/storage'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import type { ModeSetting } from '@/types/phrase'
import type { Strictness, Theme } from '@/types/progress'

const settingsStore = useSettingsStore()
const progressStore = useProgressStore()
const message = ref('')
const voices = ref<SpeechSynthesisVoice[]>([])
const voiceLoading = ref(true)
const importing = ref(false)

const voiceOptions = computed(() => {
  if (voiceLoading.value) return [{ value: '', label: '正在检测音色…' }]
  const english = voices.value.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  if (!english.length) return [{ value: '', label: '当前设备无可用英文音色' }]
  return [
    { value: '', label: '自动选择（推荐）' },
    ...english.map((voice) => ({ value: voice.voiceURI, label: voice.name })),
  ]
})

onMounted(async () => {
  try {
    voices.value = await ensureVoices()
  } catch {
    voices.value = []
  } finally {
    voiceLoading.value = false
  }
  if (!hasEnglishVoice(voices.value)) {
    message.value = '当前设备没有可用的英文音色，朗读按钮已隐藏；安装系统英文语音后可自动恢复。'
  }
})

const modes: { value: ModeSetting; label: string }[] = [
  { value: 'mixed', label: '混合训练' },
  { value: 'zh-en', label: '中 → 英' },
  { value: 'en-zh', label: '英 → 中' },
  { value: 'cloze', label: '例句填空' },
]

const strictnessOptions: { value: Strictness; label: string }[] = [
  { value: 'strict', label: '严格：只接受完全正确' },
  { value: 'normal', label: '标准：接近时给出提示' },
  { value: 'lenient', label: '宽松：小拼写错误也算对' },
]

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

function onGoal(event: Event): void {
  settingsStore.setGoal(Number((event.target as HTMLInputElement).value))
}

function onMode(value: string | number): void {
  settingsStore.setMode(value as ModeSetting)
}

function onStrictness(value: string | number): void {
  settingsStore.setStrictness(value as Strictness)
}

function onTheme(value: string | number): void {
  settingsStore.setTheme(value as Theme)
}

function onVoice(value: string | number): void {
  settingsStore.setVoice(String(value))
}

function onExport(): void {
  const content = exportData(
    progressStore.progress,
    settingsStore.settings,
    progressStore.stats,
    progressStore.bestCombo,
  )
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `phraselabs-${dayKey()}.json`
  link.click()
  URL.revokeObjectURL(url)
  message.value = '已导出 JSON 备份文件。'
}

async function onImport(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || importing.value) return
  // 导入会整体覆盖本机数据，先明确确认再动手
  if (!window.confirm('导入会覆盖这台设备现有的进度、统计与设置，确定继续吗？')) {
    input.value = ''
    return
  }
  importing.value = true
  try {
    const data = importData(await file.text())
    progressStore.replace(data.progress, data.stats, data.bestCombo)
    settingsStore.replace(data.settings)
    message.value = '导入成功，进度已恢复。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导入失败，请检查文件内容。'
  } finally {
    input.value = ''
    importing.value = false
  }
}

function onReset(): void {
  if (!window.confirm('确定清空所有学习进度和统计吗？此操作不可撤销。')) return
  progressStore.reset()
  message.value = '学习进度已清空。'
}
</script>

<template>
  <div class="page page-narrow">
    <div class="eyebrow">Preferences / Local storage</div>
    <h1 style="font-size: 36px; margin-top: 10px">设置</h1>
    <p class="muted small" style="margin-top: 6px">设置与进度都保存在当前浏览器，不会上传。</p>

    <section class="card section">
      <h2>学习偏好</h2>
      <div class="form-grid" style="margin-top: 20px">
        <div class="field">
          <label for="goal">每日目标：{{ settingsStore.settings.dailyGoal }} 题</label>
          <input id="goal" type="range" min="5" max="100" step="5"
            role="slider" aria-valuemin="5" aria-valuemax="100"
            :aria-valuenow="settingsStore.settings.dailyGoal"
            :aria-valuetext="`${settingsStore.settings.dailyGoal} 题`"
            :value="settingsStore.settings.dailyGoal" @input="onGoal" />
        </div>
        <SelectField label="默认训练模式" :model-value="settingsStore.settings.mode" :options="modes" @update:model-value="onMode" />
        <SelectField label="拼写判定严格度" :model-value="settingsStore.settings.strictness" :options="strictnessOptions" @update:model-value="onStrictness" />
        <SelectField label="主题" :model-value="settingsStore.settings.theme" :options="themeOptions" @update:model-value="onTheme" />
        <SelectField label="发音音色" :model-value="settingsStore.settings.voiceURI" :options="voiceOptions" @update:model-value="onVoice" />
      </div>
    </section>

    <section class="card section">
      <h2>参与训练的分类</h2>
      <p class="muted small" style="margin-top: 6px">不选则默认包含全部分类。</p>
      <div class="chip-row" style="margin-top: 16px">
        <button
          v-for="category in categories"
          :key="category.id"
          class="chip"
          :class="{ active: settingsStore.settings.categories.includes(category.id) }"
          type="button"
          @click="settingsStore.toggleCategory(category.id)"
        >
          {{ category.icon }} {{ category.name }} · {{ phraseCountByCategory[category.id] ?? 0 }}
        </button>
      </div>
      <p class="muted small" style="margin-top: 12px">全部 {{ phrases.length }} 条短语，不选分类时都会参与训练。</p>
    </section>

    <section class="card section">
      <h2>数据备份</h2>
      <p class="muted small" style="margin-top: 6px">
        换设备或清理浏览器前，导出 JSON 保存；在另一台设备导入即可继续学习。
      </p>
      <div class="hero-actions" style="margin-top: 18px">
        <button class="btn btn-primary" type="button" @click="onExport">导出进度</button>
        <label class="btn" :class="{ 'is-busy': importing }" :aria-disabled="importing">
          <span v-if="importing" class="spinner" aria-hidden="true"></span>
          {{ importing ? '导入中…' : '导入进度' }}
          <input
            type="file"
            accept="application/json,.json"
            style="display: none"
            :disabled="importing"
            @change="onImport"
          />
        </label>
      </div>
      <p v-if="message" class="small" style="margin-top: 14px; color: var(--accent)" role="status" aria-live="polite">{{ message }}</p>
    </section>

    <section class="card section">
      <h2>危险操作</h2>
      <p class="muted small" style="margin-top: 6px">清空后无法恢复，请先导出备份。</p>
      <button class="btn btn-danger" style="margin-top: 16px" type="button" @click="onReset">清空全部进度</button>
    </section>
  </div>
</template>
