import { onUnmounted, ref, watch, type Ref } from 'vue'

/** 把频繁变化的输入延迟同步到派生值，用于搜索框筛选 */
export function useDebounce<T>(source: Ref<T>, delay = 220): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: number | undefined

  watch(source, (value) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      debounced.value = value
    }, delay)
  })

  onUnmounted(() => window.clearTimeout(timer))
  return debounced
}
