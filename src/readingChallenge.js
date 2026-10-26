// Rules for the 1-Minute Reading Challenge, kept free of React and Supabase so they are
// easy to check by hand. See docs/1-Minute Reading Challenge – Spec.md.

export const BOARD_SIZE = 30
export const TAP_SECONDS = 10
export const ANSWER_SECONDS = 10
export const MASTERED_AT = 7

export const LEVEL_POINTS = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }

const KANJI = /[㐀-䶿一-鿿豈-﫿々]/

// Katakana ァ–ヶ sit exactly 0x60 above their hiragana counterparts. ー has no hiragana
// form and stays as is, which matches what a Japanese keyboard produces in hiragana mode.
export function toHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

// "At or below" means easier: N3 allows N3, N4 and N5.
export function buildPool(savedWords, chosenLevel) {
  const maxPoints = LEVEL_POINTS[chosenLevel]
  return Object.entries(savedWords)
    .filter(([text, entry]) =>
      entry.reading &&
      LEVEL_POINTS[entry.jlpt] !== undefined &&
      LEVEL_POINTS[entry.jlpt] <= maxPoints &&
      KANJI.test(text) &&
      !entry.mastered
    )
    .map(([text, entry]) => ({
      text,
      reading: entry.reading,
      jlpt: entry.jlpt,
      readingLevel: entry.reading_level ?? 0,
    }))
}

export function drawBoard(pool, size = BOARD_SIZE) {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, size)
}

// Kana is checked first: a word written entirely in kana can't reach the pool, so an answer
// can never match both the reading and the shown kanji.
export function judgeAnswer(answer, word) {
  const trimmed = answer.trim()
  if (!trimmed) return 'wrong'
  if (toHiragana(trimmed) === toHiragana(word.reading.trim())) return 'kana'
  if (trimmed === word.text) return 'kanji'
  return 'wrong'
}

export function pointsFor(result, jlpt) {
  const points = LEVEL_POINTS[jlpt]
  if (result === 'kana') return points
  if (result === 'kanji') return points / 2
  return -points
}

export function isCorrect(result) {
  return result === 'kana' || result === 'kanji'
}

export function nextReadingLevel(currentLevel, result) {
  if (!isCorrect(result)) return { reading_level: 0, mastered: false }
  const level = currentLevel + 1
  return { reading_level: level, mastered: level >= MASTERED_AT }
}
