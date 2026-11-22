import type { PhraseDetail } from '@/types/phrase'
import { dailyDetails } from './daily'
import { workDetails } from './work'
import { phrasalDetails } from './phrasal'
import { prepDetails } from './prep'
import { businessDetails } from './business'
import { academicDetails } from './academic'
import { travelDetails } from './travel'
import { idiomsDetails } from './idioms'
import { emotionsDetails } from './emotions'
import { connectorsDetails } from './connectors'
import { polysemyDetails } from './polysemy'

/**
 * 全量详情（例句 / 记忆提示）。只有学习页、词库、分类页需要。
 * 首页别从这里 import：它会把 819 条例句一起拉进首屏，改用 details/daily。
 */
export const phraseDetails: Record<string, PhraseDetail> = {
  ...dailyDetails,
  ...workDetails,
  ...phrasalDetails,
  ...prepDetails,
  ...businessDetails,
  ...academicDetails,
  ...travelDetails,
  ...idiomsDetails,
  ...emotionsDetails,
  ...connectorsDetails,
  ...polysemyDetails,
}

const EMPTY_DETAIL: PhraseDetail = { exampleEn: '', exampleZh: '' }

/** 详情缺失时降级为不显示例句，不让页面白屏或抛错 */
export function detailOf(id: string): PhraseDetail {
  return phraseDetails[id] ?? EMPTY_DETAIL
}
