import { createPinia } from 'pinia'
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { legacyHashTarget } from './lib/seo'
import { routes } from './router'
import './style.css'

// 旧 hash 链接（#/library）在挂载前换成 history 路径，书签和已收录链接不断链
if (typeof window !== 'undefined') {
  const target = legacyHashTarget(window.location.href)
  if (target) window.history.replaceState(null, '', target)
}

// 预渲染集合在 vite.config.ts 的 ssgOptions.includedRoutes 里统一维护
/** vite-ssg 要求具名导出 createApp：构建期逐路由渲染，运行期接管客户端渲染 */
export const createApp = ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.BASE_URL,
    // history 由 vite-ssg 注入：构建期 memory，运行期 web（真实 URL，可预渲染）
    scrollBehavior: () => ({ top: 0 }),
  },
  ({ app }) => {
    app.use(createPinia())
  },
)
