import type { Phrase } from '@/types/phrase'

export interface TagCount {
  tag: string
  count: number
}

/**
 * 汇总短语上的主题标签（口语、职场、影视…）。
 * 条数降序，同条数按名称排序，保证同一份数据每次得到相同顺序。
 */
export function collectTags(phrases: Phrase[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const phrase of phrases) {
    for (const tag of phrase.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'))
}

/** 取出带某个主题标签的短语；空标签等于不过滤 */
export function pickByTag(phrases: Phrase[], tag: string): Phrase[] {
  if (!tag) return phrases
  return phrases.filter((phrase) => phrase.tags.includes(tag))
}

/**
 * 主题入口的展示顺序：优先给「跨分类」的标签（习语、动词短语这些本身就是分类，分类卡片已给过入口），
 * 列表里不存在的标签自动跳过，剩余名额按条数补齐。
 */
export function pickFeaturedTags(list: TagCount[], featured: string[], limit = 8): TagCount[] {
  const order = new Map(featured.map((tag, index) => [tag, index]))
  const picked = list
    .filter((item) => order.has(item.tag))
    .sort((a, b) => order.get(a.tag)! - order.get(b.tag)!)
  const rest = list.filter((item) => !order.has(item.tag))
  return [...picked, ...rest].slice(0, Math.max(0, limit))
}
