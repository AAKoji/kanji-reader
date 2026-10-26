import { useState, useEffect, useRef } from 'react'
import {
  BOARD_SIZE, TAP_SECONDS, ANSWER_SECONDS,
  buildPool, drawBoard, judgeAnswer, pointsFor, isCorrect,
} from '../readingChallenge'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const RESULT_LABELS = { kana: '正解', kanji: '漢字（半分）', wrong: '不正解' }

function formatPoints(points) {
  return points > 0 ? `+${points}` : String(points)
}

// Ticks a few times per second while a deadline is set, so the timer bar moves smoothly
// and the timeout check runs with fresh state on every render.
function useNow(deadline) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [deadline])
  return now
}

function TimerBar({ deadline, now, seconds }) {
  const remaining = Math.max(0, deadline - now)
  return (
    <div className="rc-timer">
      <div className="rc-timer-fill" style={{ width: `${(remaining / (seconds * 1000)) * 100}%` }} />
      <span className="rc-timer-label">{Math.ceil(remaining / 1000)}</span>
    </div>
  )
}

export default function ReadingChallenge({ savedWords, userLevel, onRoundFinished }) {
  // 'start' → 'tap' → 'answer' → 'result'
  const [phase, setPhase] = useState('start')
  const [level, setLevel] = useState(userLevel || 'N5')
  const [board, setBoard] = useState([])
  const [tapped, setTapped] = useState([])
  const [answerIndex, setAnswerIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [results, setResults] = useState([])
  const [deadline, setDeadline] = useState(null)
  const now = useNow(deadline)
  const inputRef = useRef(null)

  const pool = buildPool(savedWords, level)
  const isPoolTooSmall = pool.length < BOARD_SIZE

  function startRound() {
    setBoard(drawBoard(pool))
    setTapped([])
    setResults([])
    setAnswerIndex(0)
    setAnswer('')
    setPhase('tap')
    setDeadline(Date.now() + TAP_SECONDS * 1000)
  }

  function toggleTap(word) {
    setTapped(prev => prev.some(w => w.text === word.text)
      ? prev.filter(w => w.text !== word.text)
      : [...prev, word])
  }

  function finishTapPhase() {
    if (tapped.length === 0) {
      setDeadline(null)
      setPhase('result')
      return
    }
    setPhase('answer')
    setDeadline(Date.now() + ANSWER_SECONDS * 1000)
  }

  function submitAnswer(rawAnswer) {
    const word = tapped[answerIndex]
    const result = judgeAnswer(rawAnswer, word)
    const nextResults = [...results, { word, answer: rawAnswer.trim(), result, points: pointsFor(result, word.jlpt) }]
    setResults(nextResults)
    setAnswer('')

    if (answerIndex + 1 < tapped.length) {
      setAnswerIndex(answerIndex + 1)
      setDeadline(Date.now() + ANSWER_SECONDS * 1000)
      return
    }
    setDeadline(null)
    setPhase('result')
    onRoundFinished(level, nextResults)
  }

  // Timeouts: the tap phase ends on its own; an unanswered word counts as wrong even if
  // something was half-typed, since the spec treats a timeout as a wrong answer.
  useEffect(() => {
    if (deadline === null || now < deadline) return
    if (phase === 'tap') finishTapPhase()
    else if (phase === 'answer') submitAnswer('')
  })

  useEffect(() => {
    if (phase === 'answer') inputRef.current?.focus()
  }, [phase, answerIndex])

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    // An Enter that confirms a keyboard conversion must not submit. Safari fires
    // compositionend before this keydown, so isComposing alone misses it; keyCode 229 catches it.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    submitAnswer(answer)
  }

  if (phase === 'start') {
    return (
      <div className="rc">
        <p className="rc-intro">
          {TAP_SECONDS}秒で読める単語をタップして、そのあと1語{ANSWER_SECONDS}秒で読み方を入力します。
        </p>
        <div className="jlpt-filter-row">
          {LEVELS.map(l => (
            <button key={l} className={`jlpt-chip ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
              {l}
            </button>
          ))}
        </div>
        {isPoolTooSmall ? (
          <div className="empty-state">
            {level}以下で使える単語は{pool.length}語だけです。<br />
            {BOARD_SIZE}語以上必要です。単語リストに単語を追加してください。
          </div>
        ) : (
          <button className="popup-btn primary rc-start" onClick={startRound}>
            スタート（{level}以下 {pool.length}語）
          </button>
        )}
      </div>
    )
  }

  if (phase === 'tap') {
    return (
      <div className="rc">
        <TimerBar deadline={deadline} now={now} seconds={TAP_SECONDS} />
        <div className="rc-board">
          {board.map(word => {
            const isTapped = tapped.some(w => w.text === word.text)
            return (
              <button
                key={word.text}
                className={`rc-tile ${isTapped ? 'tapped' : ''}`}
                onClick={() => toggleTap(word)}
                aria-pressed={isTapped}
              >
                {word.text}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (phase === 'answer') {
    const word = tapped[answerIndex]
    return (
      <div className="rc">
        <TimerBar deadline={deadline} now={now} seconds={ANSWER_SECONDS} />
        <div className="rc-progress">{answerIndex + 1} / {tapped.length}</div>
        <div className="rc-word">{word.text}</div>
        <div className="rc-answer-row">
          <input
            ref={inputRef}
            className="rc-input"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={e => e.preventDefault()}
            onDrop={e => e.preventDefault()}
            lang="ja"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="よみかた"
          />
          <button className="popup-btn primary" onClick={() => submitAnswer(answer)}>回答</button>
        </div>
      </div>
    )
  }

  const total = results.reduce((sum, r) => sum + r.points, 0)
  return (
    <div className="rc">
      {results.length === 0 ? (
        <div className="empty-state">何もタップしませんでした。0点（記録されません）</div>
      ) : (
        <>
          <div className="rc-total">{formatPoints(total)}点</div>
          <div className="vocab-list">
            {results.map(({ word, answer: given, result, points }) => (
              <div key={word.text} className="vocab-item">
                <div className="vocab-kanji">{word.text}</div>
                <div className="vocab-info">
                  <div className="vocab-reading">{word.reading}</div>
                  <div className="vocab-meaning">
                    {RESULT_LABELS[result]}{given && !isCorrect(result) ? `：${given}` : ''}
                  </div>
                </div>
                <div className="vocab-badges">
                  <span className="jlpt-level-tag">{word.jlpt}</span>
                  <span className={`rc-points ${points > 0 ? 'plus' : 'minus'}`}>{formatPoints(points)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <button className="popup-btn primary rc-start" onClick={() => setPhase('start')}>もう一度</button>
    </div>
  )
}
