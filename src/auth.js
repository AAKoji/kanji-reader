import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Supabase Auth needs an email per account, but we don't want to store real ones.
// Each username maps to an address on the reserved .invalid TLD, which can never
// receive mail. Accounts are created by hand in the Supabase dashboard (invite-only).
const USERNAME_EMAIL_DOMAIN = 'kanji-reader.invalid'

export const USERNAME_PATTERN = '[a-z0-9_\\-]{3,20}'

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`
}

export function emailToUsername(email) {
  return email.split('@')[0]
}

export const MIN_PASSWORD_LENGTH = 8

// Current Supabase Auth session. isLoading stays true until the stored session
// (or the token in a magic-link redirect URL) has been read, so the login screen
// doesn't flash before a signed-in user's data appears.
export function useSession() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    async function loadStoredSession() {
      const { data } = await supabase.auth.getSession()
      if (!isActive) return
      setSession(data.session)
      setIsLoading(false)
    }
    loadStoredSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, isLoading }
}
