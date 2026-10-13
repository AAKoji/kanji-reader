import { useState } from 'react'
import { supabase } from '../supabase'
import { usernameToEmail, USERNAME_PATTERN } from '../auth'

// Invite-only: there is no sign-up here. Accounts are created in the Supabase dashboard.
export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [errorText, setErrorText] = useState('')

  async function handleSignIn(e) {
    e.preventDefault()
    setIsBusy(true)
    setErrorText('')
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    setIsBusy(false)
    // On success onAuthStateChange swaps this screen out, so only errors need handling.
    if (error) {
      setErrorText(error.status === 400
        ? 'ユーザー名またはパスワードが違います。'
        : 'ログインできませんでした。通信状況を確認してください。')
    }
  }

  return (
    <div className="login">
      <h1>今日の記事</h1>
      <p className="login-text">ユーザー名とパスワードでログインしてください。</p>
      <form className="login-form" onSubmit={handleSignIn}>
        <input
          className="login-input"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          pattern={USERNAME_PATTERN}
          title="半角英小文字・数字・_ - の3〜20文字"
          placeholder="ユーザー名"
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase())}
          required
        />
        <input
          className="login-input"
          type="password"
          autoComplete="current-password"
          placeholder="パスワード"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button className="popup-btn primary login-submit" type="submit" disabled={isBusy}>
          {isBusy ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
      {errorText && <p className="login-error">{errorText}</p>}
      <p className="login-note">アカウントは招待制です。管理者にお問い合わせください。</p>
    </div>
  )
}
