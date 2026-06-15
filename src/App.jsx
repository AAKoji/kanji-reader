import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { ARTICLE } from './article'
import WordPopup from './components/WordPopup'
import VocabList from './components/VocabList'

const TODAY = new Date().toLocaleDateString('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
})

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

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const userName = params.get('user')?.toLowerCase().trim()
  const userLevel = params.get('level')?.toUpperCase().trim() || null

  const [tab, setTab] = useState('read')
  const [savedWords, setSavedWords] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeWord, setActiveWord] = useState(null)
  const toast = useToast()

  // Load this user's saved words on mount
  useEffect(() => {
    if (!userName) { setLoading(false); return }

    async function loadWords() {
      const { data, error } = await supabase
        .from('user_words')
        .select('word_text, save_type, words(reading, meaning)')
        .eq('user_name', userName)

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const map = {}
      data.forEach(row => {
        map[row.word_text] = {
          save_type: row.save_type,
          reading: row.words?.reading,
          meaning: row.words?.meaning,
        }
      })
      setSavedWords(map)
      setLoading(false)
    }

    loadWords()
  }, [userName])

  async function handleSave(word, saveType) {
    setActiveWord(null)

    // Upsert into words table first (ignore if exists)
    await supabase.from('words').upsert({
      text: word.text,
      reading: word.reading,
      meaning: word.meaning,
      jlpt_level: word.jlpt || null,
    }, { onConflict: 'text', ignoreDuplicates: true })

    // Upsert user_word
    const { error } = await supabase.from('user_words').upsert({
      user_name: userName,
      word_text: word.text,
      save_type: saveType,
    }, { onConflict: 'user_name,word_text' })

    if (error) {
      toast.show('エラーが発生しました')
      return
    }

    setSavedWords(prev => ({
      ...prev,
      [word.text]: { save_type: saveType, reading: word.reading, meaning: word.meaning }
    }))
    toast.show(saveType === 'vocab' ? `「${word.text}」を語彙として保存しました` : `「${word.text}」の読み方を保存しました`)
  }

  async function handleDelete(wordText) {
    setActiveWord(null)

    const { error } = await supabase
      .from('user_words')
      .delete()
      .eq('user_name', userName)
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

  if (!userName) {
    return (
      <div className="no-user">
        <h1>リンクにユーザー名が必要です</h1>
        <p>
          URLに <code>?user=あなたの名前</code> を追加してください。<br />
          例: <code>yourapp.vercel.app/?user=alex</code>
        </p>
      </div>
    )
  }

  const vocabCount = Object.keys(savedWords).length

  return (
    <>
      <div className="header">
        <div className="header-left">
          <span className="user-badge">👤 {userName}</span>
          {userLevel && <span className="jlpt-badge">{userLevel}</span>}
        </div>
        <span className="date-label">{TODAY}</span>
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
                  return <span key={i} className="word-above-level">{seg.reading}</span>
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

      <div className={`toast ${toast.visible ? 'show' : ''}`}>{toast.msg}</div>
    </>
  )
}
