export type CategoryId =
  | 'daily'
  | 'work'
  | 'phrasal'
  | 'prep'
  | 'business'
  | 'academic'
  | 'travel'
  | 'idioms'
  | 'emotions'
  | 'connectors'
  | 'polysemy'

export type Level = 1 | 2 | 3 | 4 | 5

/** 具体的题目类型；mixed 只在队列生成时解析，不会出现在单题上 */
export type StudyMode = 'zh-en' | 'en-zh' | 'cloze'
export type ModeSetting = StudyMode | 'mixed'

export interface Category {
  id: CategoryId
  name: string
  description: string
  icon: string
}

export interface Phrase {
  id: string
  en: string
  zh: string
  /** 中文输入判定用的可接受表达，至少包含 1 个 */
  aliases: string[]
  /** 英文变体（时态/单复数等），可选 */
  enAliases?: string[]
  category: CategoryId
  tags: string[]
  level: Level
}

/**
 * 例句与记忆提示单独成块：它们占语料体积的一半，只有真正要展示的页面才加载。
 * 放在 Phrase 里会让首页也背上全量详情，见 docs/ROADMAP.md E1。
 */
export interface PhraseDetail {
  exampleEn: string
  exampleZh: string
  tip?: string
}
