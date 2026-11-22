import { onUnmounted, ref, type Ref } from 'vue'
import type { Router } from 'vue-router'

/**
 * 路由切换进度条：导航超过 delay 毫秒还没落地才显示，命中缓存的切换不会闪一下。
 * 只在客户端注册；SSG 预渲染时没有 window，直接返回一个恒为 false 的状态。
 */
export function useRouteProgress(router: Router, delay = 120): { pending: Ref<boolean> } {
  const pending = ref(false)
  let timer = 0

  function stop(): void {
    window.clearTimeout(timer)
    timer = 0
    pending.value = false
  }

  function start(): void {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      pending.value = true
    }, delay)
  }

  if (typeof window === 'undefined') return { pending }

  router.beforeEach(() => {
    start()
  })
  // afterEach 在导航成功、被拦截或取消时都会调用，统一在这里收尾
  router.afterEach(() => {
    stop()
  })
  router.onError(() => {
    stop()
  })
  onUnmounted(stop)

  return { pending }
}
