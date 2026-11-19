import type { AppData, DayStats, PhraseProgress, SessionDraft, Settings } from '@/types/progress'
import { dayKey } from './date'

const PREFIX = 'phraselabs:v1:'
const KEYS = {
  progress: `${PREFIX}progress`,
  settings: `${PREFIX}settings`,
  stats: `${PREFIX}stats`,
  session: `${PREFIX}session`,
}

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 20,
  mode: 'mixed',
  categories: [],
  strictness: 'normal',
  theme: 'system',
  voiceURI: '',
  favorites: [],
}

/** 兼容旧数据：跟写、听写模式已移除，回退为默认模式 */
function normalizeSettings(raw: Partial<Settings>): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...raw }
  const mode = settings.mode as string
  if (mode === 'shadow' || mode === 'dictation') settings.mode = DEFAULT_SETTINGS.mode
  return settings
}

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 隐私模式或容量不足时静默降级为内存态
  }
}

export function loadProgress(): Record<string, PhraseProgress> {
  return read(KEYS.progress, {} as Record<string, PhraseProgress>)
}

export function saveProgress(progress: Record<string, PhraseProgress>): void {
  write(KEYS.progress, progress)
}

export function loadSettings(): Settings {
  return normalizeSettings(read<Partial<Settings>>(KEYS.settings, {}))
}

export function saveSettings(settings: Settings): void {
  write(KEYS.settings, settings)
}

export function loadStats(): DayStats {
  return read(KEYS.stats, {} as DayStats)
}

export function saveStats(stats: DayStats): void {
  write(KEYS.stats, stats)
}

/** 本轮训练草稿存 sessionStorage：刷新可见，关掉标签页自动失效，不占长期容量 */
export function loadSessionDraft(): SessionDraft | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEYS.session)
    if (!raw) return null
    const draft = JSON.parse(raw) as Partial<SessionDraft>
    // 跨天、结构不完整或没有队列时视为无效，避免恢复出空会话
    if (draft.day !== dayKey()) return null
    if (!Array.isArray(draft.queue) || draft.queue.length === 0) return null
    if (!Array.isArray(draft.answers)) return null
    const index = typeof draft.index === 'number' ? draft.index : 0
    if (index < 0 || index >= draft.queue.length) return null
    return {
      day: draft.day,
      queue: draft.queue,
      index,
      finished: Boolean(draft.finished),
      correctCount: draft.correctCount ?? 0,
      answeredCount: draft.answeredCount ?? 0,
      combo: draft.combo ?? 0,
      bestCombo: draft.bestCombo ?? 0,
      hintsUsed: draft.hintsUsed ?? 0,
      answers: draft.answers,
      plannedTotal: draft.plannedTotal ?? draft.queue.length,
      scopeLabel: draft.scopeLabel ?? '',
    }
  } catch {
    return null
  }
}

export function saveSessionDraft(draft: SessionDraft): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(KEYS.session, JSON.stringify(draft))
  } catch {
    // 隐私模式或容量不足时跳过，不影响当次训练
  }
}

export function clearSessionDraft(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(KEYS.session)
  } catch {
    // 忽略清理失败
  }
}

export function exportData(progress: Record<string, PhraseProgress>, settings: Settings, stats: DayStats): string {
  const payload: AppData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress,
    settings,
    stats,
  }
  return JSON.stringify(payload, null, 2)
}

export function importData(raw: string): AppData {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('文件内容不是有效的 JSON 对象')

  const data = parsed as Partial<AppData>
  if (data.version !== 1) throw new Error('不支持的数据版本，仅支持 v1')
  if (typeof data.progress !== 'object' || data.progress === null) throw new Error('缺少进度数据')
  if (typeof data.stats !== 'object' || data.stats === null) throw new Error('缺少统计数据')

  return {
    version: 1,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    progress: data.progress as Record<string, PhraseProgress>,
    settings: normalizeSettings(data.settings ?? {}),
    stats: data.stats as DayStats,
  }
}
