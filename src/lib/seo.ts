/**
 * 站点级 SEO 常量与纯函数。
 * 绑定自定义域名时只改 SITE_URL，构建脚本会从本文件读取它生成 sitemap 与 llms.txt。
 */
export const SITE_NAME = 'PhraseLabs'
export const SITE_URL = 'https://minosie.github.io/PhraseLabs'
export const OG_IMAGE = `${SITE_URL}/og.png`

/** 旧 hash 链接（#/library?x=1）映射为 history 路径；不是旧链接时返回 null */
export function legacyHashTarget(href: string): string | null {
  const index = href.indexOf('#/')
  if (index === -1) return null
  const origin = href.slice(0, index).replace(/\/+$/, '')
  const rest = href.slice(index + 1)
  return `${origin}${rest.startsWith('/') ? rest : `/${rest}`}`
}

/** 页面路径 → 绝对 canonical 地址 */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path === '/' ? '/' : path.replace(/\/+$/, '')}`
}
