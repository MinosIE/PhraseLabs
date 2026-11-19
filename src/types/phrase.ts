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
  exampleEn: string
  exampleZh: string
  tip?: string
}
