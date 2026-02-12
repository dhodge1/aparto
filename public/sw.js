/// <reference lib="webworker" />

// Service Worker for Aparto PWA
// Handles push notifications and basic offline caching

const CACHE_NAME = 'aparto-v1'
const STATIC_ASSETS = ['/', '/manifest.json']

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  // Take control of all pages immediately
  self.clients.claim()
})

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  // Only cache GET requests for same-origin navigation
  if (event.request.method !== 'GET') return
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone)
        })
        return response
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/')
        })
      })
  )
})

// Push notification received
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || 'New apartment listing found!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'aparto-new-listing',
    renotify: true,
    data: {
      url: data.url || '/',
      propertyCount: data.propertyCount || 1,
    },
    actions: [
      {
        action: 'view',
        title: 'View Listing',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Aparto - New Listing',
      options
    )
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  if (event.action === 'dismiss') return

  // Open the URL or focus existing window
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url.startsWith('http') ? url : self.location.origin + url)
          return client.focus()
        }
      }
      // Open new window
      return self.clients.openWindow(
        url.startsWith('http') ? url : self.location.origin + url
      )
    })
  )
})
