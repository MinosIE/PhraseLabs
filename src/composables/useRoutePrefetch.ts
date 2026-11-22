import { onUnmounted } from 'vue'
import type { Router } from 'vue-router'

interface NetworkInformation {
  saveData?: boolean
  effectiveType?: string
}

/** 已触发过预取的路径：同一个目标只下载一次 */
const prefetched = new Set<string>()

/** 慢网或省流量模式不主动预取；悬停/聚焦这类明确意图不受限 */
function allowsIdlePrefetch(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (!connection) return true
  if (connection.saveData) return false
  return !['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? '')
}

/** GitHub Pages 部署时 href 带 /<repo>/ 前缀，路由表里是不带的 */
function stripBase(path: string): string {
  const base = import.meta.env.BASE_URL
  if (base !== '/' && path.startsWith(base)) return `/${path.slice(base.length)}`
  return path
}

/**
 * 直接调用路由记录里的懒加载函数，把目标页 chunk 提前下载进模块缓存。
 * 真正导航时同一个 import 会命中缓存，只需要切换组件。
 */
export function prefetchRoute(router: Router, path: string): void {
  if (typeof window === 'undefined') return
  const [clean] = path.split(/[?#]/)
  if (!clean.startsWith('/')) return

  const target = stripBase(clean)
  if (!target.startsWith('/') || prefetched.has(target)) return

  const matched = router.resolve(target).matched
  const loader = matched[matched.length - 1]?.components?.default
  if (typeof loader !== 'function') return

  prefetched.add(target)
  void (loader as () => Promise<unknown>)().catch(() => {
    // 下载失败就删掉标记，下次悬停/进入页面时还能重试
    prefetched.delete(target)
  })
}

/**
 * 页面切换的预取：悬停、按下、键盘聚焦内部链接时下载目标页；
 * 空闲时再预热训练页（站内最常用的动作），慢网与省流量模式跳过。
 */
export function useRoutePrefetch(router: Router): void {
  if (typeof window === 'undefined') return

  function onIntent(event: Event): void {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest('a[href]')
    const href = link?.getAttribute('href') ?? ''
    if (!href.startsWith('/')) return
    prefetchRoute(router, href)
  }

  document.addEventListener('pointerover', onIntent, { passive: true })
  document.addEventListener('pointerdown', onIntent, { passive: true })
  document.addEventListener('focusin', onIntent)

  const warmStudy = () => {
    if (allowsIdlePrefetch()) prefetchRoute(router, '/study')
  }
  const idle = window.setTimeout(warmStudy, 1500)

  onUnmounted(() => {
    document.removeEventListener('pointerover', onIntent)
    document.removeEventListener('pointerdown', onIntent)
    document.removeEventListener('focusin', onIntent)
    window.clearTimeout(idle)
  })
}
