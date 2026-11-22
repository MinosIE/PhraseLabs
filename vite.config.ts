import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    vue(),
    // 离线 + 主屏安装。只用 precache：不缓第三方域名，也不做运行时接口缓存。
    VitePWA({
      // 由 src/lib/pwa.ts 手动注册，才能拿到「有新版本」回调
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'PhraseLabs · 英语短语键盘训练',
        short_name: '短语实验室',
        description: '看提示敲出完整英文短语，按遗忘曲线安排复习；进度只存本机。',
        lang: 'zh-CN',
        theme_color: '#b8481f',
        background_color: '#f4f1ea',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
        ],
      },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        // html 一并预缓存：13 个预渲染页断网也能开，找不到就回落首页壳交给路由
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\.(xml|txt)$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ssgOptions,
})
