import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { phrases, phraseById, phraseCountByCategory, tagCounts } from '@/data/phrases'
import { detailOf, phraseDetails } from '@/data/phrases/details'
import {
  AMBIENT_PHRASES,
  CATEGORY_COUNTS,
  CATEGORY_SAMPLES,
  FEATURED_TAG_COUNTS,
  PHRASE_TOTAL,
  RIBBON_PHRASES,
} from '@/data/phrases/summary'
import { categories } from '@/data/categories'
import { categoryContent, contentOf } from '@/data/categoryContent'
import { hashDay, pickDaily } from '@/lib/daily'
import { canonicalUrl, legacyHashTarget, OG_IMAGE, SITE_URL } from '@/lib/seo'
import { routes } from '@/router'
import {
  feedbackEncouragement,
  feedbackHeadline,
  feedbackSubline,
  verdictLabel,
} from '@/lib/feedback'
import { dayKey, DAY_MS } from '@/lib/date'
import { DIFFICULTY_ORDER, repeatCapOf } from '@/lib/difficulty'
import { errorRateOf, isMistake, pickMistakes } from '@/lib/mistakes'
import { gradeAnswer } from '@/lib/grade'
import { levenshtein, normalizeChinese, normalizeEnglish } from '@/lib/normalize'
import {
  computeStreak,
  applyReview,
  countDueBefore,
  createProgress,
  isDue,
  isMastered,
  masterProgress,
  MASTERED_STABILITY,
  retrievability,
  TARGET_RETENTION,
} from '@/lib/srs'
import { buildQueue } from '@/lib/session'
import { collectTags, pickByTag, pickFeaturedTags } from '@/lib/tags'
import {
  exportData,
  importData,
  loadSessionDraft,
  normalizeBestCombo,
  normalizeProgress,
  saveSessionDraft,
} from '@/lib/storage'
import { useSessionStore } from '@/stores/session'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import type { CategoryId, Phrase } from '@/types/phrase'
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
    // 达到回炉上限时不再声称「已排到本轮末尾」
    expect(feedbackSubline('wrong', '明天', false)).toContain('重练已满')
    expect(feedbackSubline('near', '明天', false)).not.toContain('本轮末尾')
    expect(feedbackEncouragement('wrong', 0)).toContain('很正常')
    expect(feedbackEncouragement('wrong', 3)).toContain('优先复习')
  })
})

describe('srs', () => {
  it('答对拉长稳定度、答错压到四成，到期时间跟着变', () => {
    const now = Date.UTC(2026, 0, 1)
    const first = applyReview(undefined, true, now)
    // 新词按 1 天基准起算，答对后是 1.9 天
    expect(first.stability).toBeCloseTo(1.9, 6)
    expect(isDue(first, now)).toBe(false)
    expect(isDue(first, now + 2 * DAY_MS)).toBe(true)

    const second = applyReview(first, true, first.nextReview)
    expect(second.stability).toBeCloseTo(first.stability * 1.9, 6)
    expect(second.nextReview).toBeGreaterThan(first.nextReview)

    const back = applyReview(second, false, second.nextReview)
    expect(back.stability).toBeCloseTo(second.stability * 0.4, 6)
    // 间隔按新的稳定度重算：比答对时短得多
    expect(back.nextReview - back.lastReviewed).toBeLessThan(
      second.nextReview - second.lastReviewed,
    )
    expect(back.wrong).toBe(1)
  })

  it('回忆概率按指数衰减，到稳定度那天降到目标保留率', () => {
    const now = Date.UTC(2026, 0, 1)
    const progress = applyReview(undefined, true, now)
    expect(retrievability(progress, now)).toBeCloseTo(1, 6)
    expect(retrievability(progress, progress.nextReview)).toBeCloseTo(TARGET_RETENTION, 6)
    expect(retrievability(progress, now + 15 * DAY_MS)).toBeLessThan(0.5)
    expect(retrievability(undefined, now)).toBe(0)
  })

  it('拖到记忆明显衰减才复习，增长打折扣；稳定度有上下限', () => {
    const now = Date.UTC(2026, 0, 1)
    const fresh = applyReview(undefined, true, now)
    const onTime = applyReview(fresh, true, fresh.nextReview)
    const late = applyReview(fresh, true, now + 10 * DAY_MS)
    expect(late.stability).toBeLessThan(onTime.stability)

    let hot = createProgress(now)
    for (let i = 0; i < 12; i++) hot = applyReview(hot, true, hot.nextReview)
    expect(hot.stability).toBeLessThanOrEqual(180)
    expect(isMastered(hot)).toBe(true)

    // 答错再狠也不会跌到半个天以下，避免刚练完又立刻到期
    const cold = applyReview(undefined, false, now)
    expect(cold.stability).toBe(0.5)
  })

  it('错得多的词答对时增长打折', () => {
    const now = Date.UTC(2026, 0, 1)
    let shaky = applyReview(undefined, true, now)
    shaky = applyReview(shaky, false, now)
    shaky = applyReview(shaky, false, now)
    const clean = applyReview(undefined, true, now)
    const shakyNext = applyReview(shaky, true, now)
    const cleanNext = applyReview(clean, true, now)
    expect(shakyNext.stability).toBeLessThan(cleanNext.stability)
  })

  it('「我会了」把稳定度抬到已掌握并推后排期，不改对错计数', () => {
    const now = new Date(2026, 0, 10, 12).getTime()
    const wrong = applyReview(applyReview(undefined, true, now), false, now)
    expect(wrong.stability).toBeCloseTo(0.76, 6)
    expect(isMastered(wrong)).toBe(false)

    const mastered = masterProgress(wrong, now)
    expect(mastered.stability).toBe(MASTERED_STABILITY)
    expect(isMastered(mastered)).toBe(true)
    expect(mastered.nextReview).toBe(now + MASTERED_STABILITY * DAY_MS)
    // 答错了就是答错了：错误次数与正确次数都不被改写
    expect(mastered.wrong).toBe(wrong.wrong)
    expect(mastered.correct).toBe(wrong.correct)
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

describe('错词本', () => {
  const now = Date.UTC(2026, 0, 1)
  const record = (correct: number, wrong: number, stability = 2) => ({
    stability,
    correct,
    wrong,
    lastReviewed: now,
    nextReview: now + stability * DAY_MS,
  })

  it('一次失误不算错词，错两次或错误率过半才算', () => {
    expect(isMistake(record(0, 1))).toBe(false)
    expect(isMistake(record(1, 2))).toBe(true)
    expect(isMistake(record(1, 1))).toBe(true) // 错误率 50%
    expect(isMistake(record(9, 1))).toBe(false) // 错一次但对了九次
    expect(isMistake(undefined)).toBe(false)
  })

  it('稳定度到掌握线后自动淡出', () => {
    expect(isMistake(record(1, 5, MASTERED_STABILITY))).toBe(false)
    expect(isMistake(record(1, 5, MASTERED_STABILITY - 0.01))).toBe(true)
  })

  it('errorRateOf 容忍零作答', () => {
    expect(errorRateOf(record(0, 0))).toBe(0)
    expect(errorRateOf(record(1, 3))).toBe(0.75)
  })

  it('按错次排序、只取命中项并截断', () => {
    const entries = pickMistakes(
      phrases,
      {
        'daily-001': record(0, 2),
        'daily-002': record(1, 3),
        'daily-003': record(9, 1),
        'daily-004': record(0, 1),
        'gone-999': record(0, 9),
      },
      2,
    )
    // 错 1 次不算、已删除的 id 不参与；错 3 次的排第一
    expect(entries.map((entry) => entry.phrase.id)).toEqual(['daily-002', 'daily-001'])
    expect(entries[0].errorRate).toBe(0.75)
  })
})

describe('主题标签', () => {
  const fake = (id: string, tags: string[]): Phrase => ({
    id,
    en: 'in the end',
    zh: '最后',
    aliases: ['最后'],
    category: 'connectors',
    tags,
    level: 1,
  })

  it('按条数降序、同条数按名称排，并跳过无标签条目', () => {
    const list = collectTags([
      fake('a', ['口语', '高频']),
      fake('b', ['口语']),
      fake('c', ['影视']),
      fake('d', []),
    ])
    expect(list).toEqual([
      { tag: '口语', count: 2 },
      { tag: '高频', count: 1 },
      { tag: '影视', count: 1 },
    ])
  })

  it('按标签取短语，空标签等于不过滤，未知标签返回空', () => {
    const list = [fake('a', ['口语']), fake('b', ['职场'])]
    expect(pickByTag(list, '口语').map((phrase) => phrase.id)).toEqual(['a'])
    expect(pickByTag(list, '')).toHaveLength(2)
    expect(pickByTag(list, '学术')).toEqual([])
  })

  it('全库标签计数与每条 tags 总数一致', () => {
    const total = tagCounts.reduce((sum, item) => sum + item.count, 0)
    expect(total).toBe(phrases.reduce((sum, phrase) => sum + phrase.tags.length, 0))
    expect(tagCounts.length).toBeGreaterThanOrEqual(10)
  })

  it('首页主题按指定顺序优先，缺失的跳过，剩余按条数补齐', () => {
    const list = [
      { tag: '习语', count: 202 },
      { tag: '口语', count: 214 },
      { tag: '职场', count: 71 },
      { tag: '影视', count: 40 },
      { tag: '叠词', count: 24 },
    ]
    expect(pickFeaturedTags(list, ['口语', '职场', '影视']).map((item) => item.tag)).toEqual([
      '口语',
      '职场',
      '影视',
      '习语',
      '叠词',
    ])
    // limit 先截 prioritized 之后再补齐；列表里没有的标签自动跳过
    expect(pickFeaturedTags(list, ['口语', '邮件', '职场'], 2).map((item) => item.tag)).toEqual([
      '口语',
      '职场',
    ])
  })
})

describe('session', () => {
  /** 错 3 次、稳定度 2 天、还没到期：典型「错了但今天不到复习日」的词 */
  const shakyRecord = (now: number) => ({
    ...createProgress(now),
    stability: 2,
    correct: 0,
    wrong: 3,
    lastReviewed: now,
    nextReview: now + 2 * DAY_MS,
  })
  const dailyIds = phrases.filter((phrase) => phrase.category === 'daily').map((phrase) => phrase.id)

  it('没到期但属于错词的会优先入队', () => {
    const now = Date.UTC(2026, 0, 20)
    const mistakes = dailyIds.slice(0, 2)
    const progress = Object.fromEntries(mistakes.map((id) => [id, shakyRecord(now)]))
    const queue = buildQueue(
      phrases,
      progress,
      { categories: ['daily'], dailyGoal: 5, mode: 'zh-en' },
      now,
    )
    // 全是没学过的新词时，错词也要挤进队首（上限要求至少 1 个）
    expect(queue.map((item) => item.phraseId).slice(0, 2).sort()).toEqual([...mistakes].sort())
    expect(queue).toHaveLength(5)
  })

  it('错词最多占每日目标三成，真到期项一个不少', () => {
    const now = Date.UTC(2026, 0, 20)
    const mistakeIds = dailyIds.slice(0, 4)
    const dueIds = dailyIds.slice(10, 14)
    const due = { ...createProgress(now), nextReview: now - DAY_MS }
    const progress: Record<string, ReturnType<typeof shakyRecord>> = {}
    for (const id of mistakeIds) progress[id] = shakyRecord(now)
    for (const id of dueIds) progress[id] = due

    // 每日目标 10 → 错词上限 3：4 个错词只进 3 个，但 4 个到期项必须全在队首
    const queue = buildQueue(
      phrases,
      progress,
      { categories: ['daily'], dailyGoal: 10, mode: 'zh-en' },
      now,
    )
    const ids = queue.map((item) => item.phraseId)
    expect(ids.slice(0, 4).sort()).toEqual([...dueIds].sort())
    expect(ids.filter((id) => mistakeIds.includes(id))).toHaveLength(3)
    expect(ids).not.toContain(mistakeIds[3])
  })

  it('指定短语集合时不插入错词', () => {
    const now = Date.UTC(2026, 0, 20)
    const [first, second] = dailyIds.slice(20, 22)
    const queue = buildQueue(
      phrases,
      { [dailyIds[0]]: shakyRecord(now) },
      { categories: [], dailyGoal: 10, mode: 'zh-en' },
      now,
      { phraseIds: [first, second] },
    )
    expect(queue.map((item) => item.phraseId).sort()).toEqual([first, second].sort())
  })

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

  it('到期项按记忆保留率排序，快忘的排在前面', () => {
    const now = Date.UTC(2026, 0, 20)
    // 保留率低 = 距离上次复习的时间已经远超稳定度
    const slow = {
      ...createProgress(now),
      stability: 6,
      lastReviewed: now - 6 * DAY_MS,
      nextReview: now - DAY_MS,
    }
    const fast = {
      ...createProgress(now),
      stability: 1,
      lastReviewed: now - 3 * DAY_MS,
      nextReview: now - DAY_MS,
    }
    const queue = buildQueue(
      phrases,
      { 'daily-001': slow, 'daily-002': fast },
      { categories: [], dailyGoal: 2, mode: 'zh-en' },
      now,
      { phraseIds: ['daily-001', 'daily-002'] },
    )
    expect(queue.map((item) => item.phraseId)).toEqual(['daily-002', 'daily-001'])
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

  it('再来一轮沿用上一次的临时范围', () => {
    setActivePinia(createPinia())
    const session = useSessionStore()
    const ids = phrases.slice(0, 4).map((phrase) => phrase.id)
    session.startWith(ids, '词库筛选 · 4 条')
    expect(session.lastOptions.phraseIds).toEqual(ids)
    expect(session.lastOptions.label).toBe('词库筛选 · 4 条')

    session.start(session.lastOptions)
    expect(session.total).toBe(4)
    expect(session.scopeLabel).toBe('词库筛选 · 4 条')
  })

  it('标记「我会了」只撤回重练，不改答案与正确率', () => {
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.start()
    session.record(true)
    session.record(false)
    session.requeueCurrent()

    const totalWithRepeat = session.total
    expect(session.accuracy).toBe(50)
    expect(session.pendingRepeats).toBe(1)

    session.dropRepeat()
    // 答错了就是答错了：答案、正确率、连对都保持原样
    expect(session.answers.map((answer) => answer.correct)).toEqual([true, false])
    expect(session.accuracy).toBe(50)
    expect(session.combo).toBe(0)
    expect(session.total).toBe(totalWithRepeat - 1)
    expect(session.pendingRepeats).toBe(0)

    // 重复调用不会再改变队列
    session.dropRepeat()
    expect(session.total).toBe(totalWithRepeat - 1)
  })
})

describe('难度档位', () => {
  it('混合题型里英→中的比例随档位递减', () => {
    const counts = DIFFICULTY_ORDER.map((difficulty) => {
      const queue = buildQueue(
        phrases,
        {},
        { categories: [], dailyGoal: 20, mode: 'mixed', difficulty },
      )
      return queue.filter((item) => item.mode === 'en-zh').length
    })
    expect(counts).toEqual([8, 6, 4])
  })

  it('标准档保持原来的 2 / 6 / 9 槽位', () => {
    const queue = buildQueue(
      phrases,
      {},
      { categories: [], dailyGoal: 10, mode: 'mixed', difficulty: 'normal' },
    )
    const slots = queue.flatMap((item, index) => (item.mode === 'en-zh' ? [index] : []))
    expect(slots).toEqual([2, 6, 9])
  })

  it('回炉上限按轻松、标准、挑战递增', () => {
    const caps = DIFFICULTY_ORDER.map((difficulty) => repeatCapOf(difficulty))
    expect(caps).toEqual([3, 6, 9])
  })

  it('答错回炉达到上限后不再追加', () => {
    setActivePinia(createPinia())
    const settings = useSettingsStore()
    const session = useSessionStore()
    settings.setDifficulty('easy')
    session.startWith(phrases.slice(0, 4).map((phrase) => phrase.id))

    const results = Array.from({ length: 5 }, () => session.requeueCurrent())
    expect(results).toEqual([true, true, true, false, false])
    expect(session.pendingRepeats).toBe(3)
    expect(session.repeatCap).toBe(3)
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
      masteredAtStart: 0,
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

  it('英文短语唯一且不是孤立单词（含空格或叠词连字符）', () => {
    const forms = phrases.map((phrase) => phrase.en.toLowerCase())
    expect(new Set(forms).size).toBe(forms.length)
    for (const phrase of phrases) {
      expect(phrase.en).toMatch(/[ -]/)
    }
  })

  it('每条例句都能挖空（含 en 或 enAliases，省略号按通配处理）', () => {
    const toPattern = (text: string) => {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(escaped.replace(/…/g, '.{0,60}?'), 'i')
    }
    const broken = phrases.filter((phrase) => {
      const forms = [phrase.en, ...(phrase.enAliases ?? [])]
      return !forms.some((form) => toPattern(form).test(detailOf(phrase.id).exampleEn))
    })
    expect(broken.map((phrase) => phrase.id)).toEqual([])
  })

  it('首页摘要与语料一致（首页不读全量，只能靠这份摘要）', () => {
    expect(PHRASE_TOTAL).toBe(phrases.length)
    for (const [id, count] of Object.entries(CATEGORY_COUNTS)) {
      expect(count).toBe(phrases.filter((phrase) => phrase.category === id).length)
      const sample = phrases
        .filter((phrase) => phrase.category === id)
        .slice(0, 3)
        .map((phrase) => phrase.en)
      expect(CATEGORY_SAMPLES[id as CategoryId]).toEqual(sample)
    }
    for (const [tag, count] of Object.entries(FEATURED_TAG_COUNTS)) {
      expect(count).toBe(phrases.filter((phrase) => phrase.tags.includes(tag)).length)
    }
    const ens = new Set(phrases.map((phrase) => phrase.en))
    for (const item of AMBIENT_PHRASES) expect(ens.has(item.en)).toBe(true)
    for (const en of RIBBON_PHRASES) expect(ens.has(en)).toBe(true)
  })

  it('基础语料与例句详情一一对应，没有孤儿详情', () => {
    const baseIds = new Set(phrases.map((phrase) => phrase.id))
    const detailIds = Object.keys(phraseDetails)
    expect(detailIds.length).toBe(baseIds.size)
    const orphan = detailIds.filter((id) => !baseIds.has(id))
    expect(orphan).toEqual([])
    const missing = phrases.filter((phrase) => !detailOf(phrase.id).exampleEn)
    expect(missing.map((phrase) => phrase.id)).toEqual([])
  })
})

describe('seo 与路由', () => {
  it('旧 hash 链接被映射成 history 路径', () => {
    expect(legacyHashTarget('https://example.com/PhraseLabs/#/library?q=a')).toBe(
      'https://example.com/PhraseLabs/library?q=a',
    )
    expect(legacyHashTarget('https://example.com/#/')).toBe('https://example.com/')
    expect(legacyHashTarget('#/phrases/daily')).toBe('/phrases/daily')
  })

  it('不是旧 hash 链接时不做改写', () => {
    expect(legacyHashTarget('https://example.com/PhraseLabs/library')).toBeNull()
    expect(legacyHashTarget('https://example.com/PhraseLabs/#anchors')).toBeNull()
  })

  it('canonical 与分享图都用绝对地址，且不带多余尾斜杠', () => {
    expect(canonicalUrl('/')).toBe(`${SITE_URL}/`)
    expect(canonicalUrl('/library')).toBe(`${SITE_URL}/library`)
    expect(canonicalUrl('/phrases/daily/')).toBe(`${SITE_URL}/phrases/daily`)
    expect(OG_IMAGE).toBe(`${SITE_URL}/og.png`)
  })

  it('一条动态路由承载全部 11 个分类落地页', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    for (const category of categories) {
      const resolved = router.resolve(`/phrases/${category.id}`)
      expect(resolved.name).toBe('category')
      expect(resolved.params.category).toBe(category.id)
    }
    expect(router.resolve('/library').name).toBe('library')
  })

  it('可收录页面放开索引，个人界面禁止索引', () => {
    const robotsOf = (path: string) => routes.find((route) => route.path === path)?.meta?.robots
    expect(robotsOf('/')).toBe('index, follow')
    expect(robotsOf('/library')).toBe('index, follow')
    expect(robotsOf('/phrases/:category')).toBe('index, follow')
    expect(robotsOf('/study')).toBe('noindex, follow')
    expect(robotsOf('/stats')).toBe('noindex, nofollow')
    expect(robotsOf('/settings')).toBe('noindex, nofollow')
  })

  it('未知路径回到首页', () => {
    const fallback = routes.find((route) => route.path === '/:pathMatch(.*)*')
    expect(fallback?.redirect).toBe('/')
  })

  it('分类计数与分类表一一对应，没有空分类和数据孤儿', () => {
    expect(Object.keys(phraseCountByCategory).sort()).toEqual(
      categories.map((category) => category.id).sort(),
    )
    for (const count of Object.values(phraseCountByCategory)) {
      expect(count).toBeGreaterThan(0)
    }
  })
})

describe('分类页内容与今日一句', () => {
  it('11 个分类都有专属文案，且不重复套模板', () => {
    expect(Object.keys(categoryContent).sort()).toEqual(categories.map((item) => item.id).sort())
    const intros = new Set<string>()
    const scenarios = new Set<string>()
    for (const category of categories) {
      const content = categoryContent[category.id]
      expect(content.intro.length).toBeGreaterThanOrEqual(80)
      expect(content.scenario.length).toBeGreaterThanOrEqual(10)
      expect(content.tips).toHaveLength(3)
      intros.add(content.intro)
      scenarios.add(content.scenario)
    }
    expect(intros.size).toBe(11)
    expect(scenarios.size).toBe(11)
  })

  it('每类三条 FAQ，问答都不为空，可直接喂给 FAQPage', () => {
    for (const category of categories) {
      const content = categoryContent[category.id]
      expect(content.faq).toHaveLength(3)
      const questions = new Set<string>()
      for (const entry of content.faq) {
        expect(entry.q.trim().length).toBeGreaterThanOrEqual(6)
        expect(entry.a.trim().length).toBeGreaterThanOrEqual(20)
        questions.add(entry.q)
      }
      expect(questions.size).toBe(3)
    }
  })

  it('contentOf 只认已知分类', () => {
    expect(contentOf('daily')?.intro).toBe(categoryContent.daily.intro)
    expect(contentOf('unknown')).toBeUndefined()
  })

  it('今日一句同日稳定、跨天轮换', () => {
    const day = ['2026-11-20', '2026-11-21', '2026-12-31', '2027-01-01']
    for (const key of day) {
      const first = pickDaily(phrases, key)
      expect(first).toBeDefined()
      expect(pickDaily(phrases, key)).toBe(first)
    }
    // 锁定算法：换实现就不能静默改变历史日期对应的句子
    expect(hashDay('2026-11-20')).toBe(102300637)
    expect(hashDay('2026-11-21')).toBe(85523018)
    const picks = new Set(day.map((key) => pickDaily(phrases, key)?.id))
    expect(picks.size).toBeGreaterThan(1)
    expect(pickDaily([], '2026-11-20')).toBeUndefined()
  })
})

describe('最高连对', () => {
  it('只增不减，并记住破纪录的日期', () => {
    setActivePinia(createPinia())
    const store = useProgressStore()
    expect(store.bestCombo).toEqual({ combo: 0, day: '' })
    expect(store.noteCombo(3, '2026-11-20')).toBe(true)
    expect(store.bestCombo).toEqual({ combo: 3, day: '2026-11-20' })
    expect(store.noteCombo(2, '2026-11-21')).toBe(false)
    expect(store.bestCombo.combo).toBe(3)
    expect(store.noteCombo(4, '2026-11-21')).toBe(true)
    expect(store.bestCombo).toEqual({ combo: 4, day: '2026-11-21' })
  })

  it('只把已学过的到期条数算进明日待复习', () => {
    const now = Date.UTC(2026, 0, 1)
    const progress = {
      a: createProgress(now),
      b: { ...createProgress(now), nextReview: now + 2 * DAY_MS },
      c: { ...createProgress(now), nextReview: now + DAY_MS },
    }
    expect(countDueBefore(progress, now)).toBe(1)
    expect(countDueBefore({}, now)).toBe(0)
    expect(countDueBefore(progress, now + DAY_MS)).toBe(2)
  })

  it('结算时把本轮连对补记进历史最高', () => {
    setActivePinia(createPinia())
    const progress = useProgressStore()
    const session = useSessionStore()
    session.startWith(['daily-001'])
    session.record(true)
    session.record(true)
    expect(progress.bestCombo.combo).toBe(2)

    // 刷新恢复的草稿：结束时不补一次，历史记录就会漏掉这一轮
    session.startWith(['daily-001'])
    expect(progress.bestCombo.combo).toBe(2)
    session.bestCombo = 9
    session.syncBestCombo()
    expect(progress.bestCombo.combo).toBe(9)
    expect(session.recordBeaten).toBe(true)
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

  it('旧备份里的盒子进度能换算成稳定度', () => {
    expect(normalizeProgress({ box: 0 }).stability).toBe(1)
    expect(normalizeProgress({ box: 4 }).stability).toBe(7)
    expect(normalizeProgress({ box: 5 }).stability).toBe(15)
    // 已有稳定度的直接沿用，新词的 0 也保留（不会被当成缺失字段）
    expect(normalizeProgress({ stability: 3.5, box: 1 }).stability).toBe(3.5)
    expect(normalizeProgress({ stability: 0 }).stability).toBe(0)

    const legacy = JSON.stringify({
      version: 1,
      progress: { 'daily-001': { box: 3, correct: 4, wrong: 1, lastReviewed: 1, nextReview: 2 } },
      settings: {},
      stats: {},
    })
    expect(importData(legacy).progress['daily-001'].stability).toBe(4)
  })

  it('拒绝未知版本', () => {
    expect(() => importData('{"version":99}')).toThrow('不支持的数据版本')
  })

  it('最高连对随备份往返，旧备份缺字段时归零', () => {
    const dumped = exportData({}, settingsDefault(), {}, { combo: 12, day: '2026-11-20' })
    expect(importData(dumped).bestCombo).toEqual({ combo: 12, day: '2026-11-20' })

    const legacy = JSON.stringify({ version: 1, progress: {}, stats: {}, settings: {} })
    expect(importData(legacy).bestCombo).toEqual({ combo: 0, day: '' })
  })

  it('手改的最高连对数据被归一到非负整数', () => {
    expect(normalizeBestCombo(null)).toEqual({ combo: 0, day: '' })
    expect(normalizeBestCombo({ combo: -3, day: 5 })).toEqual({ combo: 0, day: '' })
    expect(normalizeBestCombo({ combo: 7.9, day: '2026-11-20' })).toEqual({
      combo: 7,
      day: '2026-11-20',
    })
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

  it('旧设置缺难度档位或档位未知时回退为轻松', () => {
    const legacy = JSON.stringify({ version: 1, progress: {}, stats: {}, settings: {} })
    expect(importData(legacy).settings.difficulty).toBe('easy')

    const unknown = exportData({}, { ...settingsDefault(), difficulty: 'hard' as never }, {})
    expect(importData(unknown).settings.difficulty).toBe('easy')
  })
})

function settingsDefault() {
  return {
    dailyGoal: 20,
    mode: 'mixed' as const,
    categories: [],
    strictness: 'normal' as const,
    difficulty: 'easy' as const,
    theme: 'system' as const,
    voiceURI: '',
    favorites: [],
  }
}
