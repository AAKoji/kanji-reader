export default function VocabList({ savedWords, onDelete }) {
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

  return (
    <div className="vocab-list">
      {entries.map(([text, entry]) => (
        <div key={text} className="vocab-item">
          <div className="vocab-kanji">{text}</div>
          <div className="vocab-info">
            <div className="vocab-reading">{entry.reading || ''}</div>
            <div className="vocab-meaning">
              {entry.save_type === 'vocab' ? (entry.meaning || '') : '読み方のみ'}
            </div>
          </div>
          <span className={`vocab-type-badge ${entry.save_type === 'vocab' ? 'type-vocab' : 'type-reading'}`}>
            {entry.save_type === 'vocab' ? '語彙' : '読み方'}
          </span>
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
  )
}
