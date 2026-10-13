// Service worker: only handles Web Push. No offline caching on purpose, so a new deploy
// is always picked up on the next page load.

self.addEventListener('push', event => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || '今日の記事'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      // Same tag replaces yesterday's notification if it is still in the tray.
      tag: 'daily-article',
      data: { url: payload.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href

  async function focusOrOpen() {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windowClients.find(client => client.url.startsWith(self.location.origin))
    if (existing) {
      await existing.focus()
      return
    }
    await self.clients.openWindow(targetUrl)
  }

  event.waitUntil(focusOrOpen())
})
