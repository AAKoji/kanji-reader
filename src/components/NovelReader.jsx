import { useEffect, useState } from 'react'
import SegmentText from './SegmentText'
import { loadFurthestPage, saveFurthestPage, getPagesReadToday, markPageRead } from '../novelProgress'

// Built by scripts/build_novel.py into public/, so pages load on demand instead of
// being bundled into the app.
const NOVEL_URL = '/novels/ginga'

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
  const [pagesReadToday, setPagesReadToday] = useState(() => getPagesReadToday(userId))

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
        // The last page has no 次へ, so reaching it is what counts as reading it
        if (pageNumber === index.pageCount) setPagesReadToday(markPageRead(userId, pageNumber))
      } catch {
        if (isActive) setIsError(true)
      }
    }
    loadPage()
    return () => { isActive = false }
  }, [index, pageNumber, userId])

  function goToPage(nextPage) {
    setPageNumber(nextPage)
    if (nextPage > furthestPage) {
      setFurthestPage(nextPage)
      saveFurthestPage(userId, nextPage)
    }
  }

  // A page counts as read when you finish it with 次へ (jumps don't count skipped pages)
  function handleNext() {
    setPagesReadToday(markPageRead(userId, pageNumber))
    goToPage(pageNumber + 1)
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
      <div className="novel-header-right">
        <span className="novel-today">今日 {pagesReadToday}ページ</span>
        {index && <button className="novel-link" onClick={handleReset}>最初から</button>}
      </div>
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
        <button className="popup-btn" onClick={handleNext} disabled={isLastPage}>
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
