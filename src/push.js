import { supabase } from './supabase'

// Web Push helpers. The browser holds the subscription; Supabase holds a copy per device
// (push_subscriptions) so scripts/send_push.py knows where to send the daily reminder.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function isIos() {
  // iPadOS reports itself as a Mac, so also check for a touch screen.
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

// 'unsupported' | 'ios-needs-install' | 'denied' | 'available'
export function getPushSupport() {
  // iOS only exposes the Push API inside a Home Screen app, so check this before feature detection.
  if (isIos() && !isStandalone()) return 'ios-needs-install'
  const hasPushApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!hasPushApi || !VAPID_PUBLIC_KEY) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'available'
}

// The Push API wants the VAPID key as raw bytes; it is distributed as base64url text.
function base64UrlToBytes(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

// getRegistration() instead of serviceWorker.ready: ready never resolves if registration failed.
async function getCurrentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, { onConflict: 'endpoint' })
  return !error
}

export async function isPushSubscribed() {
  if (getPushSupport() !== 'available') return false
  return (await getCurrentSubscription()) !== null
}

// Must be called from a tap: iOS rejects permission requests that aren't user-initiated.
export async function subscribeToPush(userId) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
  })
  return saveSubscription(userId, subscription)
}

// Removes this device only; the user's other devices keep their subscriptions.
export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return true
  const subscription = await getCurrentSubscription()
  if (!subscription) return true

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
  return !error
}

// Re-saves the row if the browser is still subscribed, e.g. after the sender pruned it
// or the browser rotated the endpoint. Safe to call on every login. Best effort: never throws.
export async function resyncPushSubscription(userId) {
  if (getPushSupport() !== 'available') return
  try {
    const subscription = await getCurrentSubscription()
    if (subscription) await saveSubscription(userId, subscription)
  } catch {
    // The next login tries again; the toggle still reflects the browser's real state.
  }
}
