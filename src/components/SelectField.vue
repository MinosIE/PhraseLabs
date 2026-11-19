<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

interface Option {
  value: string | number
  label: string
}

const props = defineProps<{
  label: string
  modelValue: string | number
  options: Option[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)
const open = ref(false)
const active = ref(0)

const selected = computed(
  () => props.options.find((option) => option.value === props.modelValue) ?? props.options[0],
)

function focusOption(index: number): void {
  active.value = (index + props.options.length) % props.options.length
  nextTick(() => {
    list.value?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)?.focus()
  })
}

function show(): void {
  if (open.value) return
  open.value = true
  const index = props.options.findIndex((option) => option.value === props.modelValue)
  focusOption(index < 0 ? 0 : index)
}

function close(restoreFocus = false): void {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}

function toggle(): void {
  open.value ? close() : show()
}

function select(index: number): void {
  const option = props.options[index]
  if (!option) return
  emit('update:modelValue', option.value)
  close(true)
}

function onTriggerKey(event: KeyboardEvent): void {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    show()
  }
}

function onListKey(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusOption(active.value + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusOption(active.value - 1)
      break
    case 'Home':
      event.preventDefault()
      focusOption(0)
      break
    case 'End':
      event.preventDefault()
      focusOption(props.options.length - 1)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      select(active.value)
      break
    case 'Escape':
      event.preventDefault()
      close(true)
      break
    case 'Tab':
      close()
      break
  }
}

function onPointerDown(event: PointerEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="select-field">
    <span class="select-label">{{ label }}</span>
    <button
      ref="trigger"
      class="select-trigger"
      type="button"
      :aria-expanded="open"
      :aria-haspopup="'listbox'"
      :aria-label="`${label}：${selected?.label ?? ''}`"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <span class="select-value">{{ selected?.label ?? '' }}</span>
      <svg class="select-chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 4.5 6 8.5 10 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div
      v-if="open"
      ref="list"
      class="select-panel"
      role="listbox"
      :aria-label="label"
      @keydown="onListKey"
    >
      <button
        v-for="(option, index) in options"
        :key="option.value"
        class="select-option"
        :class="{ active: index === active }"
        type="button"
        role="option"
        :aria-selected="option.value === modelValue"
        :data-index="index"
        @mouseenter="active = index"
        @click="select(index)"
      >
        <span>{{ option.label }}</span>
        <span v-if="option.value === modelValue" class="select-check" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>
