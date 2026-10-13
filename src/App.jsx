import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { useSession, emailToUsername } from './auth'
import ARTICLE from './article.json'
import WordPopup from './components/WordPopup'
import VocabList from './components/VocabList'
import SettingsSheet from './components/SettingsSheet'
import LoginScreen from './components/LoginScreen'

const TODAY = new Date().toLocaleDateString('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
})

function SlidersIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="2" y1="4.5" x2="15" y2="4.5" />
      <line x1="2" y1="8.5" x2="15" y2="8.5" />
      <line x1="2" y1="12.5" x2="15" y2="12.5" />
      <circle cx="6"  cy="4.5"  r="1.6" fill="var(--bg-page)" />
      <circle cx="11" cy="8.5"  r="1.6" fill="var(--bg-page)" />
      <circle cx="6"  cy="12.5" r="1.6" fill="var(--bg-page)" />
    </svg>
  )
}

function useToast() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)

  const show = useCallback((text) => {
    setMsg(text)
    setVisible(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 2000)
  }, [])

  return { msg, visible, show }
}

function loadSettings() {
  const defaults = { theme: 'paper', fontSize: 'md', darkMode: false, boundaryColor: 'blue' }
  try {
    const saved = localStorage.getItem('kanji-reader-settings')
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
  } catch {
    return defaults
  }
}

export default function App() {
  const { session, isLoading: isSessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const userEmail = session?.user.email ?? null

  // undefined = not loaded yet
  const [profile, setProfile] = useState(undefined)
  const [isProfileError, setIsProfileError] = useState(false)
  const [tab, setTab] = useState('read')
  const [savedWords, setSavedWords] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeWord, setActiveWord] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const toast = useToast()
  const showToast = toast.show

  // Apply theme / font-size / dark-mode to <html>
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-theme', settings.theme)
    html.setAttribute('data-fontsize', settings.fontSize)
    html.setAttribute('data-boundary-color', settings.boundaryColor)
    if (settings.darkMode) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [settings])

  function updateSettings(next) {
    setSettings(next)
    localStorage.setItem('kanji-reader-settings', JSON.stringify(next))
  }

  // Reset and reload everything user-specific whenever the signed-in user changes
  useEffect(() => {
    setProfile(undefined)
    setIsProfileError(false)
    setSavedWords({})
    setLoading(true)
    if (!userId) return

    let isActive = true

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, jlpt_level')
        .eq('id', userId)
        .maybeSingle()
      if (!isActive) return
      if (error) {
        setIsProfileError(true)
        return
      }
      if (data) {
        setProfile(data)
        return
      }

      // First sign-in of an account created in the dashboard: start with the username as name
      const created = { display_name: emailToUsername(userEmail), jlpt_level: null }
      const { error: insertError } = await supabase.from('profiles').insert({ id: userId, ...created })
      if (!isActive) return
      if (insertError) {
        setIsProfileError(true)
        return
      }
      setProfile(created)
    }

    // RLS already limits user_words to the signed-in user; the filter just makes that explicit.
    async function loadWords() {
      const { data, error } = await supabase
        .from('user_words')
        .select('word_text, save_type, words(reading, meaning, jlpt_level)')
        .eq('user_id', userId)
      if (!isActive) return

      if (error) {
        showToast('単語リストを読み込めませんでした')
        setLoading(false)
        return
      }

      const map = {}
      data.forEach(row => {
        map[row.word_text] = {
          save_type: row.save_type,
          reading: row.words?.reading,
          meaning: row.words?.meaning,
          jlpt: row.words?.jlpt_level,
        }
      })
      setSavedWords(map)
      setLoading(false)
    }

    loadProfile()
    loadWords()
    return () => { isActive = false }
  }, [userId, userEmail, showToast])

  async function handleLevelChange(jlptLevel) {
    const { error } = await supabase.from('profiles').update({ jlpt_level: jlptLevel }).eq('id', userId)
    if (error) {
      toast.show('エラーが発生しました')
      return
    }
    setProfile(prev => ({ ...prev, jlpt_level: jlptLevel }))
  }

  async function handlePasswordChange(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return false
    toast.show('パスワードを変更しました')
    return true
  }

  async function handleSignOut() {
    setSettingsOpen(false)
    await supabase.auth.signOut()
  }

  async function handleSave(word, saveType) {
    setActiveWord(null)

    await supabase.from('words').upsert({
      text: word.text,
      reading: word.reading,
      meaning: word.meaning,
      jlpt_level: word.jlpt || null,
    }, { onConflict: 'text', ignoreDuplicates: true })

    const { error } = await supabase.from('user_words').upsert({
      user_id: userId,
      word_text: word.text,
      save_type: saveType,
    }, { onConflict: 'user_id,word_text' })

    if (error) {
      toast.show('エラーが発生しました')
      return
    }

    setSavedWords(prev => ({
      ...prev,
      [word.text]: { save_type: saveType, reading: word.reading, meaning: word.meaning, jlpt: word.jlpt },
    }))
    toast.show(saveType === 'vocab' ? `「${word.text}」を語彙として保存しました` : `「${word.text}」の読み方を保存しました`)
  }

  async function handleDelete(wordText) {
    setActiveWord(null)

    const { error } = await supabase
      .from('user_words')
      .delete()
      .eq('user_id', userId)
      .eq('word_text', wordText)

    if (error) {
      toast.show('エラーが発生しました')
      return
    }

    setSavedWords(prev => {
      const next = { ...prev }
      delete next[wordText]
      return next
    })
    toast.show(`「${wordText}」を削除しました`)
  }

  if (isSessionLoading) return <div className="loading">読み込み中…</div>
  if (!session) return <LoginScreen />
  if (isProfileError) {
    return (
      <div className="login">
        <h1>読み込みに失敗しました</h1>
        <p className="login-text">通信状況を確認して、再読み込みしてください。</p>
        <button className="login-link" onClick={handleSignOut}>ログアウト</button>
      </div>
    )
  }
  if (profile === undefined) return <div className="loading">読み込み中…</div>

  const userLevel = profile.jlpt_level
  const vocabCount = Object.keys(savedWords).length

  return (
    <>
      <div className="header">
        <div className="header-left">
          <span className="user-badge">👤 {profile.display_name}</span>
          {userLevel && <span className="jlpt-badge">{userLevel}</span>}
        </div>
        <div className="header-right">
          <span className="date-label">{TODAY}</span>
          <button className="settings-btn" onClick={() => setSettingsOpen(true)} aria-label="設定">
            <SlidersIcon />
          </button>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`nav-tab ${tab === 'read' ? 'active' : ''}`} onClick={() => setTab('read')}>
          今日の記事
        </button>
        <button className={`nav-tab ${tab === 'vocab' ? 'active' : ''}`} onClick={() => setTab('vocab')}>
          単語リスト <span className="tab-count">{vocabCount}</span>
        </button>
      </div>

      {tab === 'read' && (
        loading ? <div className="loading">読み込み中…</div> : (
          <>
            <div className="article-title">{ARTICLE.title}</div>
            <div className="article-sub">{ARTICLE.subtitle}</div>

            <div className="legend">
              <div className="legend-item">
                <div className="legend-line" style={{ borderColor: '#7f77dd' }} />
                語彙として保存
              </div>
              <div className="legend-item">
                <div className="legend-line" style={{ borderColor: '#1d9e75' }} />
                読み方として保存
              </div>
            </div>

            <div className="article-body">
              {ARTICLE.segments.map((seg, i) => {
                if (!seg.reading && !seg.meaning) {
                  return (
                    <span key={i}>
                      {seg.text.includes('\n') ? <><br /><br /></> : seg.text}
                    </span>
                  )
                }
                const aboveLevel = userLevel && seg.jlpt &&
                  parseInt(seg.jlpt[1]) < parseInt(userLevel[1])
                if (aboveLevel) {
                  const boundaryActive =
                    (userLevel === 'N4' || userLevel === 'N5') && settings.boundaryColor !== 'off'
                  const cls = boundaryActive ? 'word-above-level word-boundary' : 'word-above-level'
                  return (
                    <span key={i} className={cls} onClick={() => setActiveWord(seg)}>
                      {seg.reading}
                    </span>
                  )
                }
                const saved = savedWords[seg.text]
                const cls = saved
                  ? saved.save_type === 'vocab' ? 'saved-vocab' : 'saved-reading'
                  : ''
                return (
                  <span
                    key={i}
                    className={`word ${cls}`}
                    onClick={() => setActiveWord(seg)}
                  >
                    {seg.text}
                  </span>
                )
              })}
            </div>
          </>
        )
      )}

      {tab === 'vocab' && (
        loading ? <div className="loading">読み込み中…</div> : (
          <VocabList savedWords={savedWords} onDelete={handleDelete} />
        )
      )}

      {activeWord && (
        <WordPopup
          word={activeWord}
          isSaved={savedWords[activeWord.text]?.save_type}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setActiveWord(null)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onChange={updateSettings}
          jlptLevel={userLevel}
          onLevelChange={handleLevelChange}
          onPasswordChange={handlePasswordChange}
          onSignOut={handleSignOut}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <div className={`toast ${toast.visible ? 'show' : ''}`}>{toast.msg}</div>
    </>
  )
}
