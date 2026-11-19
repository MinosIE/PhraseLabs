const PREFERRED_NAMES = [
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Guy Online (Natural) - English (United States)',
  'Samantha',
  'Alex',
  'Daniel',
]

let cached: SpeechSynthesisVoice[] = []
let initPromise: Promise<SpeechSynthesisVoice[]> | null = null
let voicesBound = false

/** 读取当前可用的语音列表；浏览器补齐后写入缓存 */
export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return []
  try {
    const voices = speechSynthesis.getVoices()
    if (voices.length) cached = voices
  } catch {
    // 个别环境调用会抛错，按不可用处理
  }
  return cached
}

/** 浏览器稍后补齐音色时更新缓存，只绑定一次 */
function bindVoicesChanged(): void {
  if (voicesBound || typeof speechSynthesis === 'undefined') return
  voicesBound = true
  try {
    speechSynthesis.addEventListener('voiceschanged', () => {
      const voices = getVoices()
      if (voices.length) initPromise = Promise.resolve(voices)
    })
  } catch {
    // 极少数环境没有事件接口，退化为一次性读取
  }
}

/**
 * 音色只探测一次并缓存（包括拿到空结果的情况），避免每次朗读都等待；
 * 之后浏览器补齐音色由 voiceschanged 更新缓存。
 */
export function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve([])
  if (initPromise) return initPromise

  bindVoicesChanged()

  const current = getVoices()
  if (current.length) {
    initPromise = Promise.resolve(current)
    return initPromise
  }

  initPromise = new Promise((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      try {
        speechSynthesis.removeEventListener('voiceschanged', finish)
      } catch {
        // 忽略：不支持事件接口时无需解绑
      }
      resolve(getVoices())
    }
    try {
      speechSynthesis.addEventListener('voiceschanged', finish)
    } catch {
      finish()
      return
    }
    // 语音列表可能一直不触发事件，给一个短超时避免无限等待
    window.setTimeout(finish, 600)
  })
  return initPromise
}

/** 至少有一个英文音色才算朗读能力可用 */
export function hasEnglishVoice(voices: SpeechSynthesisVoice[] = getVoices()): boolean {
  return voices.some((voice) => voice.lang.toLowerCase().startsWith('en'))
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI: string,
): SpeechSynthesisVoice | null {
  if (preferredURI) {
    const chosen = voices.find((voice) => voice.voiceURI === preferredURI)
    if (chosen) return chosen
  }

  for (const name of PREFERRED_NAMES) {
    const chosen = voices.find((voice) => voice.name.includes(name))
    if (chosen) return chosen
  }

  return (
    voices.find((voice) => voice.lang === 'en-US' && voice.localService) ??
    voices.find((voice) => voice.lang === 'en-US') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ??
    null
  )
}

/**
 * 朗读英文。Promise 在真正开始发声（onstart）时就完成，
 * 让调用方的 loading 只覆盖「点击到出声」，而不是整句播放时长。
 */
export async function speakEn(text: string, preferredURI = ''): Promise<void> {
  if (typeof speechSynthesis === 'undefined' || !text.trim()) return

  await ensureVoices()
  speechSynthesis.cancel()
  // Chrome 在 cancel 之后立即 speak 偶尔不发声，留一小段间隔
  await new Promise<void>((resolve) => window.setTimeout(resolve, 60))

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 1

  const voice = pickVoice(getVoices(), preferredURI)
  if (voice) utterance.voice = voice

  await new Promise<void>((resolve) => {
    let settled = false
    let timer = 0
    const finish = (): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      utterance.onstart = null
      utterance.onerror = null
      resolve()
    }
    // onstart 在个别浏览器可能不触发，1.2s 后同样释放按钮
    timer = window.setTimeout(finish, 1200)
    utterance.onstart = finish
    utterance.onerror = finish
    speechSynthesis.speak(utterance)
  })
}
