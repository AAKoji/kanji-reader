import { useState } from 'react'

const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5']

export default function VocabList({ savedWords, onDelete, onRename }) {
  const [filters, setFilters] = useState(new Set())
  const [isMasteredOnly, setIsMasteredOnly] = useState(false)
  const entries = Object.entries(savedWords)

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📚</div>
        まだ単語がありません。<br />
        記事の単語をクリックして追加してください。
      </div>
    )
  }

  // Level chips combine with OR among themselves; the mastered chip narrows the result further.
  const hasFilters = filters.size > 0 || isMasteredOnly
  const filtered = entries
    .filter(([, e]) => filters.size === 0 || (e.jlpt && filters.has(e.jlpt)))
    .filter(([, e]) => !isMasteredOnly || e.mastered)

  const toggleFilter = (level) => {
    setFilters(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  return (
    <div>
      <div className="jlpt-filter-row">
        {LEVELS.map(level => (
          <button
            key={level}
            className={`jlpt-chip ${filters.has(level) ? 'active' : ''}`}
            onClick={() => toggleFilter(level)}
          >
            {level}
          </button>
        ))}
        <button
          className={`jlpt-chip ${isMasteredOnly ? 'active' : ''}`}
          onClick={() => setIsMasteredOnly(prev => !prev)}
        >
          習得済み
        </button>
        {hasFilters && (
          <button
            className="jlpt-clear"
            onClick={() => {
              setFilters(new Set())
              setIsMasteredOnly(false)
            }}
          >
            クリア
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          {isMasteredOnly ? '条件に合う習得済みの単語はありません。' : '選択したレベルの単語はありません。'}
        </div>
      ) : (
        <div className="vocab-list">
          {filtered.map(([text, entry]) => (
            <div key={text} className="vocab-item">
              <div className="vocab-kanji">{text}</div>
              <div className="vocab-info">
                <div className="vocab-reading">{entry.reading || ''}</div>
                <div className="vocab-meaning">
                  {entry.save_type === 'vocab' ? (entry.meaning || '') : '読み方のみ'}
                </div>
              </div>
              <div className="vocab-badges">
                {entry.jlpt && <span className="jlpt-level-tag">{entry.jlpt}</span>}
                {entry.mastered && <span className="vocab-type-badge type-mastered">習得済み</span>}
                <span className={`vocab-type-badge ${entry.save_type === 'vocab' ? 'type-vocab' : 'type-reading'}`}>
                  {entry.save_type === 'vocab' ? '語彙' : '読み方'}
                </span>
              </div>
              <button
                className="vocab-rename"
                onClick={() => {
                  const nextText = window.prompt('正しい辞書形を入力してください', text)
                  if (nextText === null) return
                  const nextReading = window.prompt('正しい読み方を入力してください', entry.reading || '')
                  if (nextReading === null) return
                  onRename(text, nextText, nextReading)
                }}
                aria-label={`${text}の表記・読み方を修正`}
              >
                ✏️
              </button>
              <button
                className="vocab-delete"
                onClick={() => onDelete(text)}
                aria-label={`${text}を削除`}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
