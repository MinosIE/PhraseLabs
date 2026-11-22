import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

/**
 * 新版本就绪标记：Service Worker 拉到新缓存后置真，由 App.vue 顶部条提示刷新。
 * 只提示不自动刷新——训练中途被强刷会把这一轮打断。
 */
export const updateReady = ref(false)

/** 本次页面会话内是否已经忽略过提示（忽略后不再重复弹出，刷新才再出现） */
export const updateDismissed = ref(false)

let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined

/** 在客户端入口调用一次；构建期（SSG 预渲染）没有 window，直接跳过 */
export function setupPwa(): void {
  if (typeof window === 'undefined') return
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady.value = true
    },
  })
}

/** 用户确认后激活新版本并重载页面 */
export function applyPwaUpdate(): void {
  void applyUpdate?.(true)
}

export function dismissUpdate(): void {
  updateDismissed.value = true
}
