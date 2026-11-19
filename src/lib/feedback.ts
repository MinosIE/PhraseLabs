import type { Verdict } from './grade'

export function verdictLabel(verdict: Verdict): string {
  if (verdict === 'correct') return '回答正确'
  if (verdict === 'near') return '接近答案'
  return '回答错误'
}

/** 按判定结果和连对状态生成有情绪层次的标题 */
export function feedbackHeadline(verdict: Verdict, combo: number, distance: number): string {
  if (verdict === 'near') return `就差一点点，只隔 ${distance} 个字符`
  if (verdict === 'wrong') return '这个短语，我们记下了'
  if (combo >= 10) return `势不可挡，${combo} 连对！`
  if (combo >= 5) return `手感来了，${combo} 连对！`
  if (combo >= 3) return `稳稳的，${combo} 连对。`
  return '漂亮，拿下！'
}

export function feedbackSubline(verdict: Verdict, nextReviewText: string): string {
  if (verdict === 'near') return '已经很接近了。答案就在下面，再见一面就熟了。'
  if (verdict === 'wrong') {
    return `答错不是失败，是大脑在标记重点。这道题已排到本轮末尾，${nextReviewText}还会再见。`
  }
  return `答对了，熟练度升了一格，${nextReviewText}再见面。`
}

export function feedbackEncouragement(verdict: Verdict, wrongCount: number): string {
  if (verdict === 'correct') return '你刚才的选择，是在给记忆加一层。'
  if (wrongCount === 0) return '第一次遇到，答错很正常。'
  if (wrongCount === 1) return '第二次了，马上就熟了。'
  return '这个短语有点顽固，已经把它排进优先复习。'
}
