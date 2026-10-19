import { useEffect, useState } from 'react'
import SegmentText from './SegmentText'

// Built by scripts/build_novel.py into public/, so pages load on demand instead of
// being bundled into the app.
const NOVEL_URL = '/novels/ginga'

function progressKey(userId) {
  return `novel:ginga:${userId}:page`
}

// Progress is per device for now; localStorage can be unavailable (private mode), so
// failures fall back to page 1 instead of breaking the reader.
function loadFurthestPage(userId) {
  try {
    const page = parseInt(localStorage.getItem(progressKey(userId)), 10)
    return Number.isInteger(page) && page >= 1 ? page : 1
  } catch {
    return 1
  }
}

function saveFurthestPage(userId, page) {
  try {
    localStorage.setItem(progressKey(userId), String(page))
  } catch {
    // Not saving progress is acceptable; reading still works.
  }
}

async function fetchJson(path) {
  const response = await fetch(`${NOVEL_URL}/${path}`)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

function pageFile(pageNumber) {
  return `page-${String(pageNumber).padStart(3, '0')}.json`
}

export default function NovelReader({ userId, userLevel, boundaryColor, savedWords, onWordClick, onBack }) {
  const [index, setIndex] = useState(null)
  const [pageNumber, setPageNumber] = useState(() => loadFurthestPage(userId))
  const [furthestPage, setFurthestPage] = useState(() => loadFurthestPage(userId))
  const [page, setPage] = useState(null)
  const [isError, setIsError] = useState(false)
  // null = showing "p / N"; a string = the page-jump input is open with this draft
  const [jumpDraft, setJumpDraft] = useState(null)

  useEffect(() => {
    let isActive = true
    async function loadIndex() {
      try {
        const data = await fetchJson('index.json')
        if (!isActive) return
        setIndex(data)
        // Guard against progress saved for a longer earlier build of the novel
        setPageNumber(prev => Math.min(prev, data.pageCount))
      } catch {
        if (isActive) setIsError(true)
      }
    }
    loadIndex()
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!index) return
    let isActive = true
    setPage(null)
    async function loadPage() {
      try {
        const data = await fetchJson(pageFile(pageNumber))
        if (!isActive) return
        setPage(data)
        window.scrollTo(0, 0)
      } catch {
        if (isActive) setIsError(true)
      }
    }
    loadPage()
    return () => { isActive = false }
  }, [index, pageNumber])

  function goToPage(nextPage) {
    setPageNumber(nextPage)
    if (nextPage > furthestPage) {
      setFurthestPage(nextPage)
      saveFurthestPage(userId, nextPage)
    }
  }

  function handleJumpSubmit(e) {
    e.preventDefault()
    const target = parseInt(jumpDraft, 10)
    setJumpDraft(null)
    // Out-of-range or empty input just closes the field instead of showing an error
    if (Number.isInteger(target) && target >= 1 && target <= index.pageCount && target !== pageNumber) {
      goToPage(target)
    }
  }

  function handleReset() {
    if (!window.confirm('最初のページから読み直しますか？')) return
    setFurthestPage(1)
    saveFurthestPage(userId, 1)
    setPageNumber(1)
  }

  const header = (
    <div className="novel-header">
      <button className="novel-link" onClick={onBack}>← 今日の記事</button>
      {index && <button className="novel-link" onClick={handleReset}>最初から</button>}
    </div>
  )

  if (isError) {
    return (
      <>
        {header}
        <div className="error-state">小説を読み込めませんでした</div>
      </>
    )
  }
  if (!index || !page) {
    return (
      <>
        {header}
        <div className="loading">読み込み中…</div>
      </>
    )
  }

  const isLastPage = pageNumber === index.pageCount

  return (
    <>
      {header}
      <div className="article-title">{index.title}</div>
      <div className="article-sub">{index.author} · {page.chapter}</div>

      <SegmentText
        segments={page.segments}
        userLevel={userLevel}
        boundaryColor={boundaryColor}
        savedWords={savedWords}
        onWordClick={onWordClick}
      />

      <div className="novel-nav">
        <button className="popup-btn" onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber === 1}>
          ← 前へ
        </button>
        {jumpDraft === null ? (
          <button
            className="novel-page-count"
            onClick={() => setJumpDraft(String(pageNumber))}
            aria-label="ページを指定して移動"
          >
            {pageNumber} / {index.pageCount}
          </button>
        ) : (
          <form className="novel-jump" onSubmit={handleJumpSubmit}>
            <input
              className="novel-jump-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={index.pageCount}
              value={jumpDraft}
              onChange={e => setJumpDraft(e.target.value)}
              onBlur={() => setJumpDraft(null)}
              onKeyDown={e => { if (e.key === 'Escape') setJumpDraft(null) }}
              onFocus={e => e.target.select()}
              autoFocus
            />
            <span className="novel-page-count">/ {index.pageCount}</span>
          </form>
        )}
        <button className="popup-btn" onClick={() => goToPage(pageNumber + 1)} disabled={isLastPage}>
          次へ →
        </button>
      </div>

      {isLastPage && (
        <div className="novel-credit">
          {index.credit.map((line, i) => <div key={i}>{line}</div>)}
          {index.changesNote && <div className="novel-credit-note">{index.changesNote}</div>}
        </div>
      )}
    </>
  )
}
