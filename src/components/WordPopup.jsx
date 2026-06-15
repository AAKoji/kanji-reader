export default function WordPopup({ word, isSaved, onSave, onDelete, onClose }) {
  return (
    <div className="popup-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="popup" role="dialog" aria-modal="true">
        <div className="popup-header">
          <div>
            <div className="popup-word">{word.text}</div>
            {word.reading && <div className="popup-reading">{word.reading}</div>}
            {word.meaning && <div className="popup-meaning">{word.meaning}</div>}
          </div>
          <button className="popup-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <hr className="popup-divider" />

        {isSaved ? (
          <>
            <div className="popup-saved-info">
              <span className="check-icon">✓</span>
              {isSaved === 'vocab' ? '語彙として保存済み' : '読み方として保存済み'}
            </div>
            <div className="popup-actions">
              <button className="popup-btn danger" onClick={() => onDelete(word.text)}>
                🗑 リストから削除
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="popup-label">保存する内容を選択</div>
            <div className="popup-actions">
              <button className="popup-btn primary" onClick={() => onSave(word, 'vocab')}>
                📖 語彙として保存（読み方＋意味）
              </button>
              <button className="popup-btn" onClick={() => onSave(word, 'reading')}>
                👁 読み方のみ保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
