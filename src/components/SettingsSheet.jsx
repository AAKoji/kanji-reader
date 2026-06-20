import { useEffect } from 'react'

const THEMES = [
  { id: 'paper', label: 'ペーパー', color: '#fafaf9' },
  { id: 'white', label: 'ホワイト', color: '#ffffff' },
  { id: 'sage',  label: 'セージ',  color: '#f1f4ee' },
  { id: 'sky',   label: 'スカイ',  color: '#eef3fb' },
]

const FONT_SIZES = [
  { id: 'sm', label: '小' },
  { id: 'md', label: '中' },
  { id: 'lg', label: '大' },
  { id: 'xl', label: '特大' },
]

export default function SettingsSheet({ settings, onChange, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="設定">
        <div className="sheet-handle" />
        <div className="sheet-title">設定</div>

        <div className="sheet-section">
          <div className="sheet-label">テーマ</div>
          <div className="theme-swatches">
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`theme-swatch ${settings.theme === t.id ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, theme: t.id })}
              >
                <span className="swatch-dot" style={{ background: t.color }} />
                <span className="swatch-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-section">
          <div className="sheet-label">文字サイズ</div>
          <div className="size-chips">
            {FONT_SIZES.map(s => (
              <button
                key={s.id}
                className={`size-chip ${settings.fontSize === s.id ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, fontSize: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-section sheet-row">
          <span className="sheet-label">ダークモード</span>
          <button
            className={`dark-toggle ${settings.darkMode ? 'on' : ''}`}
            onClick={() => onChange({ ...settings, darkMode: !settings.darkMode })}
            aria-label="ダークモード切り替え"
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>
    </>
  )
}
