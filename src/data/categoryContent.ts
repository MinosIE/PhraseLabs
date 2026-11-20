import type { CategoryId } from '@/types/phrase'

export interface CategoryFaq {
  q: string
  a: string
}

export interface CategoryContent {
  /** 分类落地页首段：这类表达是什么、什么场景用、学的难点在哪（100–200 字） */
  intro: string
  /** 典型使用场景（一句话，分类专属） */
  scenario: string
  /** 三条可执行的练习建议 */
  tips: string[]
  /** FAQ：页面展示 + FAQPage 结构化数据，答案控制在 40–80 字 */
  faq: CategoryFaq[]
}

/**
 * 每个分类唯一的介绍文案，供分类落地页与 FAQPage 结构化数据共用。
 * 写作约束：举例必须来自本类真实条目；不写数量（条数由页面按数据实时渲染，避免过期）。
 */
export const categoryContent: Record<CategoryId, CategoryContent> = {
  daily: {
    intro:
      '日常口语是聊天里真正高频的一层：打招呼、约时间、吐槽、客套、道歉与道谢。它们通常只有三五个词，省略主语和冠词，语气随意，字面意思常常靠不住——catch up with 不是「抓住」，no big deal 也不是「没有大交易」。这一类要按场景整块记：先知道什么场合说，再追求说得完整。',
    scenario: '当天就能用上：跟同事打招呼、约朋友吃饭、道歉、结束对话。',
    tips: [
      '先记「什么时候说」，再记「怎么说」：给每条短语配一个自己的场景（下班、点单、道歉）。',
      '一次只练 5 条，当天找机会说出其中一条，比背十条更有效。',
      '允许不完整：口语本身有省略，不要为了语法完整硬加主语和冠词。',
    ],
    faq: [
      {
        q: '日常口语和课本英语差别在哪？',
        a: '课本偏向完整句和书面搭配，日常口语更多省略与固定块；把 no big deal 说成 it is not a big deal，反而生硬。',
      },
      {
        q: '这一类大概什么水平能开始？',
        a: '能读懂初中英语对话就能开始，难度集中在 1–2 级；生词少，真正的难点是字面意思和真实意思不一致。',
      },
      {
        q: '只会看不会说怎么办？',
        a: '用中译英题型练「看到中文立刻敲出英文」，再配合朗读跟读；说出口一次，比看十次更容易记住。',
      },
    ],
  },
  work: {
    intro:
      '职场沟通的短语负责两件事：把事说清楚，把话说得体。开会同步（touch base with、loop in）、推进任务（follow up on、in the pipeline）、推倒重来（back to square one）都属于这一类。中文靠语气词完成的委婉，英文往往靠固定句式，学的时候要把「对谁说的」一起记下来。',
    scenario: '开会同步进度、私聊请人帮忙、复盘时说清问题卡在哪。',
    tips: [
      '按场景分组练：开会、邮件、一对一，各挑 3 条。',
      '催办类表达单独抄一份，注意 just、kindly 这类缓和词。',
      '把 loop in 与 keep someone in the loop 当作同一组记，区别在主动与被动。',
    ],
    faq: [
      {
        q: '这些表达在真实会议里常用吗？',
        a: 'touch base、follow up on、loop in 都是会议与邮件里的常客；正式场合用它们比用口语动词更稳。',
      },
      {
        q: '怎么把话说得不那么直接？',
        a: '先陈述事实，再提请求，并用 just、at your convenience 降低压力；拒绝时先给理由，再给替代方案。',
      },
      {
        q: '和商务邮件分类怎么分工？',
        a: '这一类的重点是口头与日常协作，商务邮件那一类偏书面格式与开场收尾套语，可以配合着练。',
      },
    ],
  },
  phrasal: {
    intro:
      '动词短语由一个动词加副词或介词构成，意思常常不能从字面推：put up with 是忍受，put off 是推迟，turn down 既可以是调小也可以是拒绝。难点不在记，而在「一个动词多个义项」和「宾语放在哪」。按动词归类记，比按中文意思归类更容易连成网。',
    scenario: '口头表达里替掉书面动词，让句子短下来、轻下来。',
    tips: [
      '同一个动词的义项一起记：put off / put up with / put on。',
      '注意宾语位置：代词常放中间，如 turn it down。',
      '先绑定一个最典型场景，再扩展到其他义项。',
    ],
    faq: [
      {
        q: '动词短语和单个动词怎么选？',
        a: '口语里动词短语更自然，书面语可以用单个动词提升密度；同一个意思两种都会，才算真的掌握。',
      },
      {
        q: '宾语位置有规律吗？',
        a: '名词可前可后，代词必须放中间；拿不准时用代词检验一遍，就知道它是不是可分短语。',
      },
      {
        q: '背过为什么还是不会用？',
        a: '多半只记了中文意思，没记搭配和宾语类型；用一句自己的话把它说出来，才会进入主动词汇。',
      },
    ],
  },
  prep: {
    intro:
      '形容词、名词、动词后面接哪个介词，是中文母语者最容易出错的地方：be responsible for、be interested in、be capable of、be accustomed to。中文说「对……感兴趣」，介词没有对应物，只能把搭配作为一个整体记住。这一类条目短、结构固定，适合用填空加朗读把语感直接练出来。',
    scenario: '写作和面试里最容易暴露细节的地方，也是改稿时最值得检查的项。',
    tips: [
      '把搭配当一个词记，不要拆成「形容词 + 介词」。',
      '同根词对比记：be interested in 与 take an interest in。',
      '用例句记搭配，比只记中文解释更牢。',
    ],
    faq: [
      {
        q: '介词搭配有规律可循吗？',
        a: '有部分语义规律（如 in 常表范围、to 常表方向），但多数是约定俗成，整体记忆比推导更省时间。',
      },
      {
        q: '介词说错了会影响理解吗？',
        a: '日常交流大多能听懂，但写作和面试里会显得不精确；固定搭配用错，是最容易被注意到的差距。',
      },
      {
        q: 'be interested in 和 be interested to 有区别吗？',
        a: 'in 接名词或动名词，表示对某事感兴趣；to 多接 hear、know 这类动词，表示想得知某事，用法窄得多。',
      },
    ],
  },
  business: {
    intro:
      '商务邮件短语的价值是「一句话顶一段话」：开头说明来意（reach out to）、提示附件（please find attached）、催进度（following up on）、收尾（I look forward to hearing from you）。语气比语法更重要——同一个请求，加上 at your earliest convenience 就从催促变成了体谅。',
    scenario: '写邮件的第一句和最后一句，决定对方觉得你专业还是含糊。',
    tips: [
      '按邮件结构记：开场、请求、催办、收尾，各准备两句。',
      '准备好缓和词（kindly、at your earliest convenience）随时取用。',
      '把 per our conversation、as discussed 当作回指工具，减少重复解释。',
    ],
    faq: [
      {
        q: '这些句子会不会太正式？',
        a: '对客户与跨部门沟通合适；对内即时消息可以换成更短的动词短语，不必整封都端着。',
      },
      {
        q: '催进度怎么不显得冒犯？',
        a: '先确认对方是否需要补充信息，再给出时间点；following up on 加一句 just 就能明显降低压力。',
      },
      {
        q: '和职场沟通分类有什么区别？',
        a: '这一类是写进邮件的完整句式与套语，职场沟通那一类偏会议里的口头协作表达。',
      },
    ],
  },
  academic: {
    intro:
      '学术表达的核心是「限定」与「衔接」：in light of、with respect to、the extent to which、be consistent with。它们让论断保持可辩护，也让段落之间有清晰的逻辑关系。这类短语在摘要、文献综述和课堂讨论里反复出现，读的时候能认出来，写的时候才用得上。',
    scenario: '写摘要、文献综述与讨论部分时，用来限定结论强度。',
    tips: [
      '按功能记：限定、让步、引用、总结，各留两三个。',
      '一段里只用一个连接框架，避免堆砌。',
      '读文献时把整句抄下来，注意它后面接名词还是从句。',
    ],
    faq: [
      {
        q: '学术写作能用口语短语吗？',
        a: '正式论文里尽量避免口语块；课堂展示或讨论可以适度放松，但核心术语仍要用规范表达。',
      },
      {
        q: '这些表达会不会显得空洞？',
        a: '连接框架本身不提供信息，用多了确实空；判断标准是删掉之后逻辑是否还成立，成立就删。',
      },
      {
        q: '读论文时怎么积累？',
        a: '每读一篇只挑三个反复出现的表达，连原句一起记；比一次性抄二十个更可能在写作时调用。',
      },
    ],
  },
  travel: {
    intro:
      '旅行短语是最「说完就能用」的一类：check in、book in advance、ask for directions、change trains、carry-on luggage。难点不在说，而在听懂回应——对方可能补一句登机口、楼层或押金。练习时把「怎么问」和「可能被问什么」一起准备，现场就不容易卡住。',
    scenario: '值机、入住、换乘、问路、临时改签这些必须当场说清的场合。',
    tips: [
      '每个场景准备一句提问加一句确认（Could you say that again?）。',
      '先记高频名词：gate、platform、deposit、boarding pass。',
      '紧急表达单独背熟，如 I need help、miss the flight。',
    ],
    faq: [
      {
        q: '只会这些短语够旅行吗？',
        a: '覆盖值机、入住、问路与点单的高频场景已经够用；真正决定体验的是能否听懂对方的简短回应。',
      },
      {
        q: '英式美式说法不同怎么办？',
        a: '多数场景互通，遇到差异记两种即可，比如 luggage 与 baggage；不必为个别用词纠结。',
      },
      {
        q: '听不懂对方回答怎么接？',
        a: '直接用 Could you say that again? 或 Could you write it down?，比沉默或点头更有效。',
      },
    ],
  },
  idioms: {
    intro:
      '习语是字面意思和真实意思分家的那一层：under the weather 是不舒服，bite the bullet 是硬着头皮上，once in a blue moon 是极少发生。影视剧里出现频率极高，也是听力里最容易「每个词都认识但整句不懂」的地方。学习语不要硬猜，直接记它出现的场景和情绪。',
    scenario: '看剧、听播客、和母语者闲聊时，决定你能不能接住笑点。',
    tips: [
      '一条习语配一个具体场景，最好来自看过的剧。',
      '分清褒贬与语域：有些习语只适合玩笑，不适合正式场合。',
      '先做到听懂，再追求敢用；用错场合比不会更尴尬。',
    ],
    faq: [
      {
        q: '习语需要主动使用吗？',
        a: '先求听懂，再挑三五个最顺口的用起来；全部主动使用既不现实，也容易不自然。',
      },
      {
        q: '为什么同一句在不同剧里意思不同？',
        a: '多数是语境与语气差异，也可能你记成了另一个习语；遇到疑问就查整句，而不是逐词翻译。',
      },
      {
        q: '和日常口语分类怎么区分？',
        a: '日常口语多是功能性的固定块，习语更依赖比喻和画面感，理解成本更高，常带情绪色彩。',
      },
    ],
  },
  emotions: {
    intro:
      '情绪表达决定你说的英语有没有层次：fed up with 是受够了，be overwhelmed by 是被压得喘不过气，be relieved to 是松了一口气，be content with 是知足。中文常用程度副词，英文更依赖换词。这一类按「强度」排序记，比按中文一一对应更有效。',
    scenario: '描述状态、解释情绪来源、向同事说明「我今天不太在状态」。',
    tips: [
      '每个中文情绪挑两到三个强度不同的说法。',
      '顺带记搭配介词：about、with、for、to，各归各的。',
      '把人称换掉再练一遍：I’m fed up with it / They were thrilled about it。',
    ],
    faq: [
      {
        q: '只会说 happy 和 sad 怎么办？',
        a: '先用 be thrilled about、be content with 替换正面情绪，用 be fed up with、be upset about 替换负面情绪，立刻有层次。',
      },
      {
        q: '这些表达在职场能用吗？',
        a: '多数可以，但要注意强度；be fed up with 偏发泄，正式场合换成 I have some concerns about 更稳。',
      },
      {
        q: '怎么表达「说不上来的烦」？',
        a: '可以说 I can’t put my finger on it, but I’m not in the mood，既保留模糊，也说清了状态。',
      },
    ],
  },
  connectors: {
    intro:
      '连接过渡词决定一段话是列举还是论证：on the other hand 转折对比，be that as it may 让步后再转，in other words 换种说法，what’s more 递进。它们不增加信息，却决定听者能否跟上逻辑。写作与即兴发言都吃这一类，尤其是需要争取思考时间的时候。',
    scenario: '即兴发言时争取思考时间，同时让听者知道你要转折还是总结。',
    tips: [
      '按逻辑关系记：转折、递进、举例、总结，各两三个。',
      '口语只用三到四个最顺手的，多了反而像背模板。',
      '同一段里不要重复同一个连接词，换个说法更自然。',
    ],
    faq: [
      {
        q: '口语里用 on the other hand 会不会太书面？',
        a: '不算生硬，但口语更常用 that said、then again；正式讨论和写作里 on the other hand 更清楚。',
      },
      {
        q: '连接词越多越好吗？',
        a: '不是。连接词过密会让论述显得空，判断标准是删掉之后逻辑是否还成立。',
      },
      {
        q: '怎么让发言听起来有条理？',
        a: '先给结论，再用一个连接词分层（first of all、what’s more），最后用 in other words 复述关键点。',
      },
    ],
  },
  polysemy: {
    intro:
      '一词多义分类不背单词，而是背「搭配决定意思」：book a table 是订位，read a book 是读书；a bank account 是银行账户，the river bank 是河岸；turn left 是左转，left the office 是离开办公室。中文学习者常把一个词固定在一个意思上，结果造出错搭配。这里用成对短语把义项分开摆。',
    scenario: '避免中式搭配，同一个词在工作和生活场景里各说对一次。',
    tips: [
      '同一个词的两个搭配一起记，不单独背词。',
      '注意词性与宾语类型：turn 接方向是动词，a light bag 里的 light 是形容词。',
      '遇到新义项先记搭配，再回头补中文解释。',
    ],
    faq: [
      {
        q: '这和背单词有什么区别？',
        a: '背单词记的是中文对应，这里记的是「这个词和谁搭配时是什么意思」，直接对应可用的表达。',
      },
      {
        q: '一个词到底有多少义项？',
        a: '高频词往往十几个，但日常够用的通常三到五个；先把最常用的几组搭配练熟，比追全部义项划算。',
      },
      {
        q: '为什么我的搭配总是不地道？',
        a: '多半是按中文逐字翻译。解决方法是整块记真实例句里的搭配，并用填空题反复确认。',
      },
    ],
  },
}

export function contentOf(id: string): CategoryContent | undefined {
  return categoryContent[id as CategoryId]
}
