import type { Category } from '@/types/phrase'

export const categories: Category[] = [
  { id: 'daily', name: '日常口语', description: '聊天里天天用到的表达', icon: '💬' },
  { id: 'work', name: '职场沟通', description: '开会、协作与汇报', icon: '🧑‍💼' },
  { id: 'phrasal', name: '动词短语', description: '高频 phrasal verbs', icon: '🔧' },
  { id: 'prep', name: '介词搭配', description: '形容词/名词 + 介词', icon: '🔗' },
  { id: 'business', name: '商务邮件', description: '写得体又高效的邮件句式', icon: '✉️' },
  { id: 'academic', name: '学术写作', description: '论文与阅读中的常用表达', icon: '📚' },
  { id: 'travel', name: '旅行出行', description: '问路、入住、突发状况', icon: '✈️' },
  { id: 'idioms', name: '习语俗语', description: '地道但容易误解的说法', icon: '🎯' },
  { id: 'emotions', name: '情绪表达', description: '准确描述感受', icon: '💡' },
  { id: 'connectors', name: '连接过渡', description: '让句子衔接自然', icon: '🧩' },
  { id: 'polysemy', name: '一词多义', description: '同一个词，不同语境不同意思', icon: '🔁' },
]

export const categoryName = (id: string): string =>
  categories.find((category) => category.id === id)?.name ?? '未分类'
