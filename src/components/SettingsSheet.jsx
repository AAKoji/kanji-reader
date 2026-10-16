import { useEffect, useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '../auth'
import NotificationToggle from './NotificationToggle'

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

// null = no level set: every word shows in kanji
const JLPT_LEVELS = [
  { id: null, label: 'なし' },
  { id: 'N5', label: 'N5' },
  { id: 'N4', label: 'N4' },
  { id: 'N3', label: 'N3' },
  { id: 'N2', label: 'N2' },
  { id: 'N1', label: 'N1' },
]

const BOUNDARY_COLORS = [
  { id: 'off',   label: 'オフ',     color: null },
  { id: 'grey',  label: 'グレー',   color: '#6b6b68' },
  { id: 'blue',  label: 'ブルー',   color: '#4d6da8' },
  { id: 'brown', label: 'ブラウン', color: '#8a5a3f' },
  { id: 'red',   label: 'レッド',   color: '#a8524a' },
]

function PasswordForm({ onPasswordChange }) {
  const [password, setPassword] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [errorText, setErrorText] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setIsBusy(true)
    setErrorText('')
    const isChanged = await onPasswordChange(password)
    setIsBusy(false)
    if (isChanged) {
      setPassword('')
    } else {
      setErrorText('変更できませんでした。別のパスワードをお試しください。')
    }
  }

  return (
    <form className="password-form" onSubmit={handleSubmit}>
      <p className="password-hint">
        {MIN_PASSWORD_LENGTH}文字以上で、<strong>動物の名前</strong>を1つ含めてください（例: neko, penguin）。
      </p>
      <input
        className="login-input"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        placeholder="新しいパスワード"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button className="popup-btn login-submit" type="submit" disabled={isBusy}>
        {isBusy ? '変更中…' : 'パスワードを変更'}
      </button>
      {errorText && <p className="login-error">{errorText}</p>}
    </form>
  )
}

export default function SettingsSheet({
  userId, settings, onChange, jlptLevel, onLevelChange, onPasswordChange, onSignOut, onClose,
}) {
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
          <div className="sheet-label">JLPTレベル</div>
          <div className="size-chips">
            {JLPT_LEVELS.map(l => (
              <button
                key={l.label}
                className={`size-chip ${jlptLevel === l.id ? 'active' : ''}`}
                onClick={() => onLevelChange(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

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

        <div className="sheet-section">
          <div className="sheet-label">ひらがな置換語の色</div>
          <div className="theme-swatches">
            {BOUNDARY_COLORS.map(c => (
              <button
                key={c.id}
                className={`theme-swatch ${settings.boundaryColor === c.id ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, boundaryColor: c.id })}
              >
                <span
                  className="swatch-dot"
                  style={c.color
                    ? { background: c.color }
                    : { background: 'transparent', border: '1px dashed var(--border-2)' }}
                />
                <span className="swatch-label">{c.label}</span>
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

        <NotificationToggle userId={userId} />

        <div className="sheet-section">
          <div className="sheet-label">パスワード</div>
          <PasswordForm onPasswordChange={onPasswordChange} />
        </div>

        <div className="sheet-section">
          <button className="popup-btn danger sheet-signout" onClick={onSignOut}>
            ログアウト
          </button>
        </div>
      </div>
    </>
  )
}
