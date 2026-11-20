import type { RouteRecordRaw } from 'vue-router'

// 路由实例由 vite-ssg 在 main.ts 里按环境创建：
// 构建期用 memory history（没有 window），运行期用 web history（真实 URL）。
// 所以这里只导出路由表，禁止在本文件 createRouter。
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题（App.vue 里拼成「标题 · PhraseLabs」） */
    title?: string
    /** 是否允许收录：应用界面不参与收录，避免与落地页构成重复内容 */
    robots?: string
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '英语短语键盘训练', robots: 'index, follow' },
  },
  {
    path: '/study',
    name: 'study',
    component: () => import('@/views/StudyView.vue'),
    meta: { title: '学习', robots: 'noindex, follow' },
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('@/views/LibraryView.vue'),
    meta: { title: '词库', robots: 'index, follow' },
  },
  {
    path: '/phrases/:category',
    name: 'category',
    component: () => import('@/views/CategoryView.vue'),
    meta: { robots: 'index, follow' },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { title: '统计', robots: 'noindex, nofollow' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置', robots: 'noindex, nofollow' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
