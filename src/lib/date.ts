export const DAY_MS = 24 * 60 * 60 * 1000

/** 用本地时区生成 YYYY-MM-DD，避免 UTC 导致跨日统计错位 */
export function dayKey(timestamp: number = Date.now()): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(timestamp: number, days: number): number {
  return timestamp + days * DAY_MS
}

export function formatDate(key: string): string {
  const [, month, day] = key.split('-')
  return `${Number(month)}月${Number(day)}日`
}
