import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import type { ViteSSGOptions } from 'vite-ssg'

// GitHub Pages 部署时在 workflow 里设置 VITE_BASE_PATH=/<repo>/
// 本地开发默认 '/'，避免路径错乱
const base = process.env.VITE_BASE_PATH || '/'

// 预渲染集合：只出内容页（首页、词库、分类落地页）。
// 答题/统计/设置依赖 localStorage，预渲染只会得到空壳，交给客户端与 404.html 兜底。
// 分类 id 直接从数据源正则读取，避免在 vite 配置里走 @ 别名解析。
const categoriesSource = readFileSync(new URL('./src/data/categories.ts', import.meta.url), 'utf8')
const contentRoutes = [
  '/',
  '/library',
  ...[...categoriesSource.matchAll(/id: '([a-z-]+)'/g)].map((matched) => `/phrases/${matched[1]}`),
]

const ssgOptions: ViteSSGOptions = {
  // flat：/phrases/daily → dist/phrases/daily.html，GitHub Pages 直接支持无扩展名访问
  dirStyle: 'flat',
  includedRoutes: () => contentRoutes,
}

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ssgOptions,
})
