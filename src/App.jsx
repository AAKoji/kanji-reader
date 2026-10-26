import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { useSession, emailToUsername } from './auth'
import ARTICLE from './article.json'
import WordPopup from './components/WordPopup'
import VocabList from './components/VocabList'
import SegmentText from './components/SegmentText'
import NovelReader from './components/NovelReader'
import ReadingChallenge from './components/ReadingChallenge'
import { getPagesReadToday } from './novelProgress'
import SettingsSheet from './components/SettingsSheet'
import LoginScreen from './components/LoginScreen'
import { resyncPushSubscription, unsubscribeFromPush } from './push'
import { isCorrect, nextReadingLevel } from './readingChallenge'

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
  const defaults = { theme: 'paper', fontSize: 'md', darkMode: false, boundaryColor: 'blue', novelEnabled: false }
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
    if (!next.novelEnabled && tab === 'novel') setTab('read')
    localStorage.setItem('kanji-reader-settings', JSON.stringify(next))
  }

  // RLS already limits user_words to the signed-in user; the filter just makes that explicit.
  const loadWords = useCallback(async () => {
    if (!userId) return {}
    const { data, error } = await supabase
      .from('user_words')
      .select('word_text, save_type, reading_level, mastered, words(reading, meaning, jlpt_level)')
      .eq('user_id', userId)

    if (error) {
      showToast('単語リストを読み込めませんでした')
      return {}
    }

    const map = {}
    data.forEach(row => {
      map[row.word_text] = {
        save_type: row.save_type,
        reading: row.words?.reading,
        meaning: row.words?.meaning,
        jlpt: row.words?.jlpt_level,
        reading_level: row.reading_level,
        mastered: row.mastered,
      }
    })
    setSavedWords(map)
    return map
  }, [userId, showToast])

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

    loadProfile()
    loadWords().then(() => { if (isActive) setLoading(false) })
    resyncPushSubscription(userId)
    return () => { isActive = false }
  }, [userId, userEmail, loadWords])

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
    // While still signed in: RLS only lets the owner delete the row, and the next user on
    // this device shouldn't receive the previous user's reminders.
    try {
      await unsubscribeFromPush()
    } catch {
      // Never block signing out on a push cleanup failure.
    }
    await supabase.auth.signOut()
  }

  async function handleSave(word, saveType) {
    setActiveWord(null)

    const key = word.base || word.text
    const keyReading = word.base ? (word.baseReading || word.reading) : word.reading

    await supabase.from('words').upsert({
      text: key,
      reading: keyReading,
      meaning: word.meaning,
      jlpt_level: word.jlpt || null,
    }, { onConflict: 'text', ignoreDuplicates: true })

    const { error } = await supabase.from('user_words').upsert({
      user_id: userId,
      word_text: key,
      save_type: saveType,
    }, { onConflict: 'user_id,word_text' })

    if (error) {
      toast.show('エラーが発生しました')
      return
    }

    setSavedWords(prev => ({
      ...prev,
      // Re-saving an existing word keeps its reading level; the upsert above doesn't touch it either
      [key]: {
        reading_level: 0,
        mastered: false,
        ...prev[key],
        save_type: saveType,
        reading: keyReading,
        meaning: word.meaning,
        jlpt: word.jlpt,
      },
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

  // The result screen is already showing; this only persists. Local levels are updated only
  // for writes that succeeded, so the next round never starts from a level the database lacks.
  async function handleRoundFinished(jlptLevel, results) {
    const levelUpdates = results.map(({ word, result }) => ({
      wordText: word.text,
      ...nextReadingLevel(word.readingLevel, result),
    }))

    const [roundWrite, ...levelWrites] = await Promise.all([
      supabase.from('reading_challenge_rounds').insert({
        user_id: userId,
        jlpt_level: jlptLevel,
        score: results.reduce((sum, r) => sum + r.points, 0),
        tapped_count: results.length,
        correct_count: results.filter(r => isCorrect(r.result)).length,
      }),
      ...levelUpdates.map(({ wordText, reading_level, mastered }) => supabase
        .from('user_words')
        .update({ reading_level, mastered })
        .eq('user_id', userId)
        .eq('word_text', wordText)),
    ])

    const savedUpdates = levelUpdates.filter((_, i) => !levelWrites[i].error)
    setSavedWords(prev => {
      const next = { ...prev }
      savedUpdates.forEach(({ wordText, reading_level, mastered }) => {
        if (next[wordText]) next[wordText] = { ...next[wordText], reading_level, mastered }
      })
      return next
    })

    if (roundWrite.error || savedUpdates.length < levelUpdates.length) {
      toast.show('結果を保存できませんでした')
      return
    }
    const newlyMastered = savedUpdates.filter(u => u.mastered).map(u => `「${u.wordText}」`)
    if (newlyMastered.length > 0) toast.show(`${newlyMastered.join('')}を習得しました！`)
  }

  // Manual cleanup for words saved before the base-form fix, or left inconsistent by it
  // (e.g. two valid base-form spellings for the same word). Re-queries after writing since
  // the true merged reading/meaning/jlpt can only be known from the row that won the upsert.
  //
  // The corrected reading only actually takes effect when `newText` doesn't already exist as
  // a words row: there's no UPDATE policy on `words` (only insert + select), so `ignoreDuplicates`
  // silently keeps whatever an existing row already has. We re-check after reloading rather than
  // assume success, so the toast never claims a reading change that didn't really happen.
  async function handleRename(oldText, rawNewText, rawNewReading) {
    const old = savedWords[oldText]
    if (!old) return
    const newText = rawNewText?.trim() || oldText
    const newReading = rawNewReading?.trim() || old.reading
    if (newText === oldText && newReading === old.reading) return

    const { error: upsertError } = await supabase.from('words').upsert({
      text: newText,
      reading: newReading,
      meaning: old.meaning,
      jlpt_level: old.jlpt || null,
    }, { onConflict: 'text', ignoreDuplicates: true })
    if (upsertError) {
      toast.show('エラーが発生しました')
      return
    }

    if (newText !== oldText) {
      const mergeInto = savedWords[newText]
      const { error } = mergeInto
        ? await supabase.from('user_words').delete().eq('user_id', userId).eq('word_text', oldText)
        : await supabase.from('user_words').update({ word_text: newText }).eq('user_id', userId).eq('word_text', oldText)
      if (error) {
        toast.show('エラーが発生しました')
        return
      }
    }

    const map = await loadWords()
    const readingApplied = map[newText]?.reading === newReading
    if (newText !== oldText) {
      // readingApplied tells us whether our reading was actually stored, or an existing entry
      // (possibly with a stale/wrong reading of its own) was adopted instead — worth surfacing,
      // since the latter can silently keep bad data around.
      toast.show(readingApplied
        ? `「${oldText}」を「${newText}」に変更しました`
        : `「${oldText}」を「${newText}」に変更しました（既存の登録内容が使われました）`)
    } else {
      toast.show(readingApplied
        ? `「${newText}」の読み方を修正しました`
        : `すでに登録済みのため読み方は変更できませんでした`)
    }
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
        <button className={`nav-tab ${tab === 'challenge' ? 'active' : ''}`} onClick={() => setTab('challenge')}>
          読みチャレンジ
        </button>
      </div>

      {tab === 'read' && (
        loading ? <div className="loading">読み込み中…</div> : (
          <>
            {settings.novelEnabled && (
              <button className="novel-entry" onClick={() => setTab('novel')}>
                📖 銀河鉄道の夜を読む
                {/* Read on each render: coming back from the reader re-renders this tab */}
                <span className="novel-entry-today">今日 {getPagesReadToday(userId)}ページ</span>
              </button>
            )}
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

            <SegmentText
              segments={ARTICLE.segments}
              userLevel={userLevel}
              boundaryColor={settings.boundaryColor}
              savedWords={savedWords}
              onWordClick={setActiveWord}
            />
          </>
        )
      )}

      {tab === 'novel' && (
        loading ? <div className="loading">読み込み中…</div> : (
          <NovelReader
            userId={userId}
            userLevel={userLevel}
            boundaryColor={settings.boundaryColor}
            savedWords={savedWords}
            onWordClick={setActiveWord}
            onBack={() => setTab('read')}
          />
        )
      )}

      {tab === 'vocab' && (
        loading ? <div className="loading">読み込み中…</div> : (
          <VocabList savedWords={savedWords} onDelete={handleDelete} onRename={handleRename} />
        )
      )}

      {tab === 'challenge' && (
        loading ? <div className="loading">読み込み中…</div> : (
          <ReadingChallenge
            savedWords={savedWords}
            userLevel={userLevel}
            onRoundFinished={handleRoundFinished}
          />
        )
      )}

      {activeWord && (
        <WordPopup
          word={activeWord}
          isSaved={savedWords[activeWord.base || activeWord.text]?.save_type}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setActiveWord(null)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          userId={userId}
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
