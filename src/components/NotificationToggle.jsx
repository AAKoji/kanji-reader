import { useEffect, useState } from 'react'
import { getPushSupport, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '../push'

// Settings section for the daily reminder. Renders nothing where push can't work at all.
export default function NotificationToggle({ userId }) {
  const [support, setSupport] = useState(getPushSupport)
  // null = still reading the browser's subscription
  const [isOn, setIsOn] = useState(null)
  const [isBusy, setIsBusy] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    let isActive = true
    async function loadState() {
      const isSubscribed = await isPushSubscribed()
      if (isActive) setIsOn(isSubscribed)
    }
    loadState()
    return () => { isActive = false }
  }, [])

  async function handleToggle() {
    setIsBusy(true)
    setErrorText('')
    try {
      const isDone = isOn ? await unsubscribeFromPush() : await subscribeToPush(userId)
      if (!isDone) setErrorText('設定できませんでした。もう一度お試しください。')
    } catch {
      setErrorText('設定できませんでした。もう一度お試しください。')
    }
    // Re-read from the browser rather than trusting the call: permission may now be denied.
    setSupport(getPushSupport())
    setIsOn(await isPushSubscribed())
    setIsBusy(false)
  }

  if (support === 'unsupported') return null

  return (
    <div className="sheet-section">
      <div className="sheet-row">
        <span className="sheet-label">毎日の通知</span>
        {support === 'available' && (
          <button
            className={`dark-toggle ${isOn ? 'on' : ''}`}
            onClick={handleToggle}
            disabled={isBusy || isOn === null}
            aria-label="通知の切り替え"
            aria-pressed={!!isOn}
          >
            <span className="toggle-thumb" />
          </button>
        )}
      </div>
      {support === 'ios-needs-install' && (
        <p className="sheet-hint">
          iPhoneでは、Safariの共有ボタン →「ホーム画面に追加」を選び、ホーム画面のアイコンから開いてください。最初にもう一度ログインが必要です。
        </p>
      )}
      {support === 'denied' && (
        <p className="sheet-hint">
          通知がブロックされています。ブラウザの設定でこのサイトの通知を許可してください。
        </p>
      )}
      {errorText && <p className="login-error">{errorText}</p>}
    </div>
  )
}
