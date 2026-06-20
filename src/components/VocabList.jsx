import { useState } from 'react'

const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5']

export default function VocabList({ savedWords, onDelete }) {
  const [filters, setFilters] = useState(new Set())
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

  const hasFilters = filters.size > 0
  const filtered = hasFilters
    ? entries.filter(([, e]) => e.jlpt && filters.has(e.jlpt))
    : entries

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
        {hasFilters && (
          <button className="jlpt-clear" onClick={() => setFilters(new Set())}>クリア</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          選択したレベルの単語はありません。
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
                <span className={`vocab-type-badge ${entry.save_type === 'vocab' ? 'type-vocab' : 'type-reading'}`}>
                  {entry.save_type === 'vocab' ? '語彙' : '読み方'}
                </span>
              </div>
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
