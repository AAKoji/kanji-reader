// Novel reading progress, kept per user on this device. localStorage can be unavailable
// (private mode), so every read falls back to "no progress" instead of throwing.

function furthestKey(userId) {
  return `novel:ginga:${userId}:page`
}

function todayKey(userId) {
  return `novel:ginga:${userId}:today`
}

// Local calendar day, so the daily counter resets at the reader's own midnight
function localDateString() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function loadFurthestPage(userId) {
  try {
    const page = parseInt(localStorage.getItem(furthestKey(userId)), 10)
    return Number.isInteger(page) && page >= 1 ? page : 1
  } catch {
    return 1
  }
}

export function saveFurthestPage(userId, page) {
  try {
    localStorage.setItem(furthestKey(userId), String(page))
  } catch {
    // Not saving progress is acceptable; reading still works.
  }
}

// Pages read today, as a list of page numbers. A single key holds only the current day,
// so older days are overwritten instead of piling up.
function loadPagesReadToday(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(todayKey(userId)))
    if (saved?.date === localDateString() && Array.isArray(saved.pages)) return saved.pages
  } catch {
    // Missing or corrupt entry counts as nothing read today
  }
  return []
}

export function getPagesReadToday(userId) {
  return loadPagesReadToday(userId).length
}

// Returns today's count after marking; a page counts at most once per day.
export function markPageRead(userId, page) {
  const pages = loadPagesReadToday(userId)
  if (pages.includes(page)) return pages.length
  const next = [...pages, page]
  try {
    localStorage.setItem(todayKey(userId), JSON.stringify({ date: localDateString(), pages: next }))
  } catch {
    // Counter just won't persist on this device
  }
  return next.length
}
