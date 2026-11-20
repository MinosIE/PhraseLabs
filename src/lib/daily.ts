/**
 * 「今日一句」的挑选用纯函数实现：同一天内刷新页面不变，跨天自动换一句。
 * 不用 Math.random，避免每次渲染都跳，也便于单测。
 */
export function hashDay(day: string): number {
  let hash = 2166136261
  for (let index = 0; index < day.length; index++) {
    hash ^= day.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function pickDaily<T>(items: readonly T[], day: string): T | undefined {
  if (!items.length) return undefined
  return items[hashDay(day) % items.length]
}
