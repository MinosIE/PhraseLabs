/**
 * SSG 构建后处理：GitHub Pages 兜底 + sitemap + llms.txt + 产物校验。
 *
 * 数据来源刻意用正则读源文件（本脚本不经过 TS 编译），
 * 因此 src/lib/seo.ts 的 SITE_URL、src/data/categories.ts 的分类表、
 * src/data/phrases/<分类>.ts 的 category 字段是唯一事实来源，改它们即自动生效。
 */
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const failures = []

const read = (relative) => readFile(join(root, relative), 'utf8')

function fail(message) {
  failures.push(message)
}

/** 读 src/lib/seo.ts 的 SITE_URL（不含尾部斜杠） */
async function readSiteUrl() {
  const source = await read('src/lib/seo.ts')
  const matched = source.match(/export const SITE_URL = '([^']+)'/)
  if (!matched) {
    throw new Error('src/lib/seo.ts 里找不到 SITE_URL')
  }
  return matched[1].replace(/\/+$/, '')
}

/** 读 src/data/categories.ts 的分类表 */
async function readCategories() {
  const source = await read('src/data/categories.ts')
  const pattern = /id: '([a-z-]+)',\s*name: '([^']+)',\s*description: '([^']*)'/g
  const list = []
  for (const matched of source.matchAll(pattern)) {
    list.push({ id: matched[1], name: matched[2], description: matched[3] })
  }
  if (!list.length) {
    throw new Error('src/data/categories.ts 里没解析出分类')
  }
  return list
}

/** 数各分类数据文件里的 `category: '<id>'` 出现次数 */
async function countPhrases(categories) {
  const counts = {}
  for (const category of categories) {
    const file = join(root, 'src/data/phrases', `${category.id}.ts`)
    if (!existsSync(file)) {
      fail(`缺少分类数据文件：src/data/phrases/${category.id}.ts`)
      counts[category.id] = 0
      continue
    }
    const source = await readFile(file, 'utf8')
    counts[category.id] = (source.match(new RegExp(`category: '${category.id}'`, 'g')) ?? []).length
  }
  return counts
}

async function writeFallback() {
  const indexHtml = join(dist, 'index.html')
  if (!existsSync(indexHtml)) {
    fail('dist/index.html 不存在，vite-ssg 构建可能失败')
    return
  }
  // GitHub Pages 对未知路径返回 404.html，这里复用预渲染的首页，
  // 页面加载后由路由的通配规则重定向回首页。
  await copyFile(indexHtml, join(dist, '404.html'))
}

async function writeSitemap(siteUrl, categories) {
  const lastmod = new Date().toISOString().slice(0, 10)
  const paths = ['/', '/library', ...categories.map((category) => `/phrases/${category.id}`)]
  const urls = paths
    .map((path) => {
      const loc = `${siteUrl}${path === '/' ? '/' : path}`
      const priority = path === '/' ? '1.0' : path === '/library' ? '0.8' : '0.7'
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
  await writeFile(join(dist, 'sitemap.xml'), xml, 'utf8')
}

async function writeLlmsTxt(siteUrl, categories, counts) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const lines = [
    '# PhraseLabs',
    '',
    `> 纯前端英语短语键盘训练站：${total} 条短语、${categories.length} 个分类，支持中译英、英译中与例句填空即时判定，按 Leitner 盒子安排复习，进度只存在浏览器 localStorage，无需注册、无后端。`,
    '',
    '## 主要页面',
    '',
    `- [首页](${siteUrl}/)：选择练习模式与分类，页面列出全站 ${total} 条短语的分布。`,
    `- [词库](${siteUrl}/library)：按分类、难度、掌握度筛选并搜索全部短语，可查看中英释义与双语例句。`,
    ...categories.map(
      (category) =>
        `- [${category.name}](${siteUrl}/phrases/${category.id})：${category.description}，共 ${counts[category.id]} 条。`,
    ),
    '',
    '## 分类清单',
    '',
    ...categories.map((category) => `- ${category.id}：${category.name}（${counts[category.id]} 条）`),
    '',
    '## 判定与复习规则',
    '',
    '- 判定分三档：正确（含大小写、标点归一化后一致）、接近（编辑距离在容错阈值内）、错误；中文答案需匹配人工维护的同义说法。',
    '- 严格度三档：宽松（小拼写错误也算对）、标准（接近时提示差异）、严格（只接受完全正确），可在设置页切换。',
    '- 复习用 6 格 Leitner 盒子：答对升一盒、答错退两盒（最低回到第一盒），按盒子间隔计算到期日；答错的题还会在本轮队尾重练。',
    '- 训练模式只有三种：中译英、英译中、例句填空，另有混合模式按七三比例分配前两种。',
    '',
    '## 数据与隐私',
    '',
    '- 无账号、无后端；页面访问量用百度统计（匿名 PV），不收集学习内容；进度、统计与设置只存在当前浏览器的 localStorage（前缀 `phraselabs:v1:`）。',
    '- 设置页支持导出 / 导入 JSON 备份；清空浏览器数据会一并丢弃进度。',
    '- 朗读通过浏览器 Web Speech API 完成，不向外部服务发送文本；可用与否取决于浏览器与系统。',
    '',
    '## 说明',
    '',
    '- 每个分类页列出该分类全部短语的英文原文、中文释义、双语例句与难度标签。',
    '- `/study`、`/stats`、`/settings` 是个人练习与本地数据界面，不需要被索引。',
    '- 语料不包含孤立单词，所有条目都是完整短语，可安全用作英语学习素材。',
    '',
  ]
  await writeFile(join(dist, 'llms.txt'), lines.join('\n'), 'utf8')
}

async function checkPages(categories) {
  const routes = ['/', '/library', ...categories.map((category) => `/phrases/${category.id}`)]
  for (const route of routes) {
    // vite-ssg 用 flat 目录风格：/phrases/daily → dist/phrases/daily.html
    const relative = route === '/' ? 'index.html' : `${route.slice(1)}.html`
    const file = join(dist, relative)
    if (!existsSync(file)) {
      fail(`预渲染产物缺失：dist/${relative}`)
      continue
    }
    const html = await readFile(file, 'utf8')
    if (html.length < 2000) {
      fail(`预渲染页面内容过少（${html.length} 字节）：${route}`)
    }
  }
  if (!existsSync(join(dist, '404.html'))) {
    fail('dist/404.html 没有生成')
  }
  if (!existsSync(join(dist, 'robots.txt'))) {
    fail('dist/robots.txt 不存在，检查 public/robots.txt')
  }
  if (!existsSync(join(dist, 'llms.txt'))) {
    fail('dist/llms.txt 没有生成')
  }
  const distEntries = existsSync(dist) ? await readdir(dist) : []
  if (!distEntries.includes('sitemap.xml')) {
    fail('dist/sitemap.xml 没有生成')
  }
}

try {
  if (!existsSync(dist) || !(await stat(dist)).isDirectory()) {
    throw new Error('dist 目录不存在，请先运行 vite-ssg build')
  }
  const siteUrl = await readSiteUrl()
  const categories = await readCategories()
  const counts = await countPhrases(categories)

  await mkdir(dist, { recursive: true })
  await writeFallback()
  await writeSitemap(siteUrl, categories)
  await writeLlmsTxt(siteUrl, categories, counts)
  await checkPages(categories)

  if (failures.length) {
    console.error('[postbuild] 校验未通过：')
    for (const message of failures) console.error(`  - ${message}`)
    process.exit(1)
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  console.log(
    `[postbuild] 完成：${categories.length} 个分类 / ${total} 条短语，已生成 404.html、sitemap.xml、llms.txt。`,
  )
} catch (error) {
  console.error(`[postbuild] 失败：${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
