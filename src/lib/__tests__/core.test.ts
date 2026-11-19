import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { phrases, phraseById } from '@/data/phrases'
import {
  feedbackEncouragement,
  feedbackHeadline,
  feedbackSubline,
  verdictLabel,
} from '@/lib/feedback'
import { dayKey } from '@/lib/date'
import { gradeAnswer } from '@/lib/grade'
import { levenshtein, normalizeChinese, normalizeEnglish } from '@/lib/normalize'
import { computeStreak, applyReview, createProgress, isDue, isMastered } from '@/lib/srs'
import { buildQueue } from '@/lib/session'
import {
  exportData,
  importData,
  loadSessionDraft,
  saveSessionDraft,
} from '@/lib/storage'
import { useSessionStore } from '@/stores/session'
import type { CategoryId } from '@/types/phrase'
import type { DayStats, SessionDraft } from '@/types/progress'

const lookForward = phraseById.get('phrasal-003')!

describe('normalize', () => {
  it('统一英文大小写、标点和空格', () => {
    expect(normalizeEnglish('  Look  Forward-To,  ')).toBe('look forward to')
    expect(normalizeEnglish('It’s')).toBe("it's")
  })

  it('统一中文标点与省略号', () => {
    expect(normalizeChinese('与……叙旧；赶上')).toBe('与叙旧赶上')
  })

  it('计算编辑距离', () => {
    expect(levenshtein('expect', 'expect')).toBe(0)
    expect(levenshtein('expect', 'expext')).toBe(1)
  })
})

describe('gradeAnswer', () => {
  it('英文精确匹配算对', () => {
    expect(gradeAnswer(lookForward, 'look forward to', 'zh-en', 'strict').verdict).toBe('correct')
  })

  it('英文大小写和标点不影响判定', () => {
    expect(gradeAnswer(lookForward, 'LOOK  FORWARD—TO', 'zh-en', 'strict').verdict).toBe('correct')
  })

  it('接近拼写按严格度给出提示或放过', () => {
    expect(gradeAnswer(lookForward, 'look forward too', 'zh-en', 'strict').verdict).toBe('wrong')
    expect(gradeAnswer(lookForward, 'look forward too', 'zh-en', 'normal').verdict).toBe('near')
    expect(gradeAnswer(lookForward, 'look forward too', 'zh-en', 'lenient').verdict).toBe('correct')
  })

  it('中文按别名关键词命中', () => {
    expect(gradeAnswer(lookForward, '我很期待', 'en-zh', 'strict').verdict).toBe('correct')
    expect(gradeAnswer(lookForward, '盼望', 'en-zh', 'strict').verdict).toBe('correct')
    expect(gradeAnswer(lookForward, '讨厌', 'en-zh', 'strict').verdict).toBe('wrong')
  })

  it('填空按英文判定', () => {
    expect(gradeAnswer(lookForward, 'look forward to', 'cloze', 'normal').verdict).toBe('correct')
  })
})

describe('反馈文案', () => {
  it('明确标记正确、接近与错误', () => {
    expect(verdictLabel('correct')).toBe('回答正确')
    expect(verdictLabel('near')).toBe('接近答案')
    expect(verdictLabel('wrong')).toBe('回答错误')
  })

  it('连对越多，标题越有气势', () => {
    expect(feedbackHeadline('correct', 1, 0)).toBe('漂亮，拿下！')
    expect(feedbackHeadline('correct', 3, 0)).toContain('稳稳的')
    expect(feedbackHeadline('correct', 6, 0)).toContain('手感来了')
    expect(feedbackHeadline('correct', 10, 0)).toContain('势不可挡')
  })

  it('接近和答错都不打击用户', () => {
    expect(feedbackHeadline('near', 0, 1)).toContain('就差一点点')
    expect(feedbackSubline('wrong', '明天')).toContain('大脑在标记重点')
    expect(feedbackEncouragement('wrong', 0)).toContain('很正常')
    expect(feedbackEncouragement('wrong', 3)).toContain('优先复习')
  })
})

describe('srs', () => {
  it('答对升级、答错降级，且到期时间后退', () => {
    const now = Date.UTC(2026, 0, 1)
    const first = applyReview(undefined, true, now)
    expect(first.box).toBe(1)
    expect(isDue(first, now)).toBe(false)

    const second = applyReview(first, true, now)
    expect(second.box).toBe(2)
    expect(second.nextReview).toBeGreaterThan(first.nextReview)

    const back = applyReview(second, false, now)
    expect(back.box).toBe(0)
    expect(back.wrong).toBe(1)
  })

  it('box 上限为 5 且 4 以上算已掌握', () => {
    let progress = createProgress(0)
    for (let i = 0; i < 8; i++) progress = applyReview(progress, true, 0)
    expect(progress.box).toBe(5)
    expect(isMastered(progress)).toBe(true)
  })

  it('从今天或昨天开始计算连续天数', () => {
    const now = new Date(2026, 0, 10, 12).getTime()
    const stats: DayStats = {
      '2026-01-10': { reviewed: 5, correct: 4, learned: 1 },
      '2026-01-09': { reviewed: 3, correct: 2, learned: 0 },
      '2026-01-08': { reviewed: 2, correct: 2, learned: 0 },
      '2026-01-06': { reviewed: 9, correct: 9, learned: 0 },
    }
    expect(computeStreak(stats, now)).toBe(3)
  })
})

describe('session', () => {
  it('到期短语优先且不超过每日目标', () => {
    const now = Date.UTC(2026, 0, 1)
    const progress = {
      'daily-001': { ...createProgress(now), nextReview: now - 1000 },
    }
    const queue = buildQueue(
      phrases,
      progress,
      { categories: [], dailyGoal: 3, mode: 'zh-en' },
      now,
    )
    expect(queue).toHaveLength(3)
    expect(queue[0].phraseId).toBe('daily-001')
    expect(queue[0].mode).toBe('zh-en')
  })

  it('混合模式包含中英两种题型', () => {
    const queue = buildQueue(
      phrases,
      {},
      { categories: ['daily'], dailyGoal: 20, mode: 'mixed' },
    )
    expect(new Set(queue.map((item) => item.mode)).size).toBe(2)
  })

  it('连对统计与稍后再练正常工作', () => {
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.start()
    session.record(true)
    session.record(true)
    session.record(false)

    expect(session.combo).toBe(0)
    expect(session.bestCombo).toBe(2)
    expect(session.accuracy).toBe(67)
    expect(session.answers).toHaveLength(3)
    expect(session.answers.map((answer) => answer.correct)).toEqual([true, true, false])

    const before = session.total
    session.requeueCurrent()
    expect(session.total).toBe(before + 1)
  })

  it('指定短语集合时忽略分类并练完整个集合', () => {
    const ids = phrases.slice(0, 6).map((phrase) => phrase.id)
    const queue = buildQueue(
      phrases,
      {},
      { categories: ['daily'], dailyGoal: 3, mode: 'en-zh' },
      Date.now(),
      { phraseIds: ids },
    )
    expect(queue).toHaveLength(ids.length)
    expect(new Set(queue.map((item) => item.phraseId))).toEqual(new Set(ids))
    expect(queue.every((item) => item.mode === 'en-zh')).toBe(true)
  })

  it('临时分类只影响本轮队列，不会写回设置', () => {
    const settings: { categories: CategoryId[]; dailyGoal: number; mode: 'zh-en' } = {
      categories: [],
      dailyGoal: 5,
      mode: 'zh-en',
    }
    const queue = buildQueue(phrases, {}, settings, Date.now(), { categories: ['travel'] })
    expect(queue).toHaveLength(5)
    for (const item of queue) {
      expect(phraseById.get(item.phraseId)?.category).toBe('travel')
    }
    expect(settings.categories).toEqual([])
  })

  it('手动纠错会同步本轮答案、正确率并撤回重练', () => {
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.start()
    session.record(true)
    session.record(false)
    session.requeueCurrent()

    const totalWithRepeat = session.total
    expect(session.accuracy).toBe(50)
    expect(session.pendingRepeats).toBe(1)

    session.amend()
    expect(session.answers.map((answer) => answer.correct)).toEqual([true, true])
    expect(session.accuracy).toBe(100)
    // 连对按「打断前的连对数 + 本题」续上
    expect(session.combo).toBe(2)
    expect(session.total).toBe(totalWithRepeat - 1)
    expect(session.pendingRepeats).toBe(0)

    // 重复纠错不会重复加分
    session.amend()
    expect(session.accuracy).toBe(100)
  })
})

describe('session 草稿', () => {
  function draftWith(day: string): SessionDraft {
    return {
      day,
      queue: [{ phraseId: 'daily-001', mode: 'zh-en' }],
      index: 0,
      finished: false,
      correctCount: 0,
      answeredCount: 0,
      combo: 0,
      bestCombo: 0,
      hintsUsed: 0,
      answers: [],
      plannedTotal: 1,
      scopeLabel: '',
    }
  }

  it('当天的草稿可以恢复，跨天的草稿自动作废', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    })
    try {
      saveSessionDraft(draftWith(dayKey()))
      expect(loadSessionDraft()?.queue).toHaveLength(1)

      saveSessionDraft(draftWith('2000-01-01'))
      expect(loadSessionDraft()).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('内容数据', () => {
  it('ID 唯一且中文别名可用', () => {
    const ids = phrases.map((phrase) => phrase.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const phrase of phrases) {
      expect(phrase.aliases.length).toBeGreaterThan(0)
      for (const alias of phrase.aliases) {
        expect(normalizeChinese(alias).length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('覆盖 11 个分类、至少 500 条短语', () => {
    expect(new Set(phrases.map((phrase) => phrase.category)).size).toBe(11)
    expect(phrases.length).toBeGreaterThanOrEqual(500)
  })
})

describe('storage', () => {
  it('导出后可原样导入', () => {
    const progress = { 'daily-001': createProgress(1000) }
    const stats: DayStats = { '2026-01-01': { reviewed: 1, correct: 1, learned: 1 } }
    const settings = importData(exportData(progress, settingsDefault(), stats))
    expect(settings.progress).toEqual(progress)
    expect(settings.stats).toEqual(stats)
  })

  it('拒绝未知版本', () => {
    expect(() => importData('{"version":99}')).toThrow('不支持的数据版本')
  })

  it('旧数据中的跟写、听写模式回退为默认模式', () => {
    for (const legacy of ['shadow', 'dictation']) {
      const imported = importData(
        exportData(
          {},
          { ...settingsDefault(), mode: legacy as ReturnType<typeof settingsDefault>['mode'] },
          {},
        ),
      )
      expect(imported.settings.mode).toBe('mixed')
    }
  })
})

function settingsDefault() {
  return {
    dailyGoal: 20,
    mode: 'mixed' as const,
    categories: [],
    strictness: 'normal' as const,
    theme: 'system' as const,
    voiceURI: '',
    favorites: [],
  }
}
