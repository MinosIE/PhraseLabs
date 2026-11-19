/** 英文归一化：大小写、弯引号、中文标点、连字符、多余空格统一 */
export function normalizeEnglish(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[，。！？；：、（）“”]/g, ' ')
    .replace(/[^a-z0-9'\- ]/g, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 中文归一化：去掉标点和空白，用于关键词命中 */
export function normalizeChinese(input: string): string {
  return input
    .replace(/[，。！？；：、,.!?;:()（）…\s]/g, '')
    .trim()
}

/** 编辑距离，用于英文拼写提示 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]
}
