<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { StudyMode } from '@/types/phrase'

const props = defineProps<{
  mode: StudyMode
  questionKey: string
  disabled?: boolean
  loading?: boolean
  hintActive?: boolean
}>()

const emit = defineEmits<{
  submit: [value: string]
  skip: []
  hint: []
}>()

const text = ref('')
const input = ref<HTMLInputElement | null>(null)
const composing = ref(false)
const blank = ref(false)

const placeholder = computed(() =>
  props.mode === 'en-zh' ? '输入对应的中文意思…' : '输入对应的英文短语…',
)

function focus(): void {
  input.value?.focus()
}

onMounted(focus)

// 提示保留到用户开始输入，避免一闪而过被错过
watch(text, () => {
  if (blank.value) blank.value = false
})

watch(
  () => props.questionKey,
  async () => {
    text.value = ''
    composing.value = false
    blank.value = false
    await nextTick()
    focus()
  },
)

function submit(fromKeyboard = false): void {
  if (props.disabled || props.loading) return
  // 只有键盘 Enter 需要避开输入法选字；点击提交是明确意图
  if (fromKeyboard && composing.value) return
  composing.value = false
  const value = text.value.trim()
  if (!value) {
    // 空答案不进入判定：避免误按 Enter 直接降盒、计入错误并排入复习
    blank.value = false
    requestAnimationFrame(() => (blank.value = true))
    focus()
    return
  }
  blank.value = false
  emit('submit', value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    submit(true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('skip')
  }
}

defineExpose({ focus })
</script>

<template>
  <div class="answer-box">
    <div class="answer-field" :class="{ 'is-blank': blank }">
      <span class="input-prefix" aria-hidden="true">&gt;</span>
      <input
        ref="input"
        v-model="text"
        class="answer-input"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :lang="mode === 'en-zh' ? 'zh-CN' : 'en'"
        aria-label="答案输入框"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="done"
        @keydown="onKeydown"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      />
      <button
        class="btn btn-primary btn-sm answer-submit"
        type="button"
        :disabled="disabled || loading"
        @click="submit()"
      >
        <span v-if="loading" class="spinner" aria-hidden="true"></span>
        {{ loading ? '判定中…' : '提交 ↵' }}
      </button>
    </div>

    <p v-if="blank" class="answer-blank" role="status">先写下答案再提交，空答案不判分。</p>

    <div class="answer-hint">
      <span class="kbd-tip"><kbd>Enter</kbd> 提交 / 下一题</span>
      <span class="kbd-tip"><kbd>Esc</kbd> 跳过</span>
      <button class="hint-link" type="button" :disabled="disabled || hintActive" @click="emit('hint')">
        <kbd class="kbd-tip">⌥H</kbd> {{ hintActive ? '已显示提示' : '看提示' }}
      </button>
    </div>
  </div>
</template>
