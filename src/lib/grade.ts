import type { Phrase, StudyMode } from '@/types/phrase'
import type { Strictness } from '@/types/progress'
import { levenshtein, normalizeChinese, normalizeEnglish } from './normalize'

export type Verdict = 'correct' | 'near' | 'wrong'

export interface GradeResult {
  verdict: Verdict
  distance: number
  feedback: string
}

/** strict：只认精确匹配；normal：差 1 个字符给提示；lenient：差 1 个字符也算对 */
const NEAR_LIMIT: Record<Strictness, number> = {
  strict: 0,
  normal: 1,
  lenient: 2,
}

function splitChinese(value: string): string[] {
  return value
    .split(/[；;，,、/]/)
    .map(normalizeChinese)
    .filter((part) => part.length >= 2)
}

function gradeEnglish(
  phrase: Phrase,
  input: string,
  strictness: Strictness,
): GradeResult {
  const actual = normalizeEnglish(input)
  const expected = [phrase.en, ...(phrase.enAliases ?? [])]
    .map(normalizeEnglish)
    .filter(Boolean)

  if (!actual) return { verdict: 'wrong', distance: Infinity, feedback: '还没有输入内容' }
  if (expected.includes(actual)) {
    return { verdict: 'correct', distance: 0, feedback: '完全正确，继续保持！' }
  }

  const distance = Math.min(...expected.map((item) => levenshtein(actual, item)))
  const limit = NEAR_LIMIT[strictness]
  if (distance <= limit) {
    if (strictness === 'lenient' && distance <= 1) {
      return { verdict: 'correct', distance, feedback: '基本正确，已放过小拼写问题。' }
    }
    return { verdict: 'near', distance, feedback: `很接近了，正确写法是：${phrase.en}` }
  }

  return { verdict: 'wrong', distance, feedback: `正确答案是：${phrase.en}` }
}

function gradeChinese(phrase: Phrase, input: string): GradeResult {
  const actual = normalizeChinese(input)
  if (!actual) return { verdict: 'wrong', distance: 0, feedback: '还没有输入内容' }

  const candidates = splitChinese(`${phrase.zh}；${phrase.aliases.join('；')}`)
  const hit = candidates.some(
    (item) => actual.includes(item) || (actual.length >= 2 && item.includes(actual)),
  )

  return hit
    ? { verdict: 'correct', distance: 0, feedback: '意思对了！' }
    : { verdict: 'wrong', distance: 0, feedback: `参考答案：${phrase.zh}` }
}

/** 单题判定入口；mixed 模式已在队列生成时解析为具体模式 */
export function gradeAnswer(
  phrase: Phrase,
  input: string,
  mode: StudyMode,
  strictness: Strictness,
): GradeResult {
  return mode === 'en-zh'
    ? gradeChinese(phrase, input)
    : gradeEnglish(phrase, input, strictness)
}
