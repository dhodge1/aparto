/// <reference lib="webworker" />

// Service Worker for Aparto PWA
// Handles push notifications, offline caching, and stale-while-revalidate

const SHELL_CACHE = 'aparto-shell-v3'
const DATA_CACHE = 'aparto-data-v1'
const STATIC_CACHE = 'aparto-static-v1'

// App shell files to pre-cache
const SHELL_FILES = ['/', '/manifest.json']

// API routes that should NEVER be cached (mutations, compute)
const NETWORK_ONLY_ROUTES = [
  '/api/refresh',
  '/api/settings',
  '/api/scores',
  '/api/subscribe',
  '/api/poll',
  '/api/commute',
]

// --- Install ---

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  )
  self.skipWaiting()
})

// --- Activate: clean old caches ---

self.addEventListener('activate', (event) => {
  const validCaches = [SHELL_CACHE, DATA_CACHE, STATIC_CACHE]
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// --- Fetch ---

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Network-only routes (mutations, compute)
  if (NETWORK_ONLY_ROUTES.some((route) => url.pathname.startsWith(route))) {
    return
  }

  // Listings API: stale-while-revalidate with change detection
  if (url.pathname === '/api/listings') {
    event.respondWith(handleListingsRequest(event.request))
    return
  }

  // Static assets (Next.js content-hashed): cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStaticAsset(event.request))
    return
  }

  // Navigation (app shell): cache-first, update in background
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request))
    return
  }
})

// --- Listings API: stale-while-revalidate + change detection ---

async function handleListingsRequest(request) {
  const cache = await caches.open(DATA_CACHE)
  const cachedResponse = await cache.match(request)

  // Start background fetch regardless
  const fetchPromise = fetch(request)
    .then(async (freshResponse) => {
      if (!freshResponse.ok) return freshResponse

      // Clone responses so we can read the bodies
      const freshClone = freshResponse.clone()

      // Compare with cached data
      if (cachedResponse) {
        try {
          const cachedData = await cachedResponse.clone().json()
          const freshData = await freshClone.json()

          const cachedHash = getListingsHash(cachedData)
          const freshHash = getListingsHash(freshData)

          if (cachedHash !== freshHash && cachedHash !== '') {
            // Listings changed - notify all clients
            const clients = await self.clients.matchAll()
            clients.forEach((client) => {
              client.postMessage({
                type: 'NEW_DATA_AVAILABLE',
                oldCount: cachedData.listings?.length ?? 0,
                newCount: freshData.listings?.length ?? 0,
              })
            })
          }
        } catch (e) {
          // JSON parse failed, just update cache silently
        }
      }

      // Always update cache with fresh response
      await cache.put(request, freshResponse)
      return null
    })
    .catch(() => null)

  if (cachedResponse) {
    // Serve cached immediately, update in background
    fetchPromise // fire and forget
    return cachedResponse
  }

  // No cache - wait for network
  const networkResponse = await fetch(request)
  if (networkResponse.ok) {
    await cache.put(request, networkResponse.clone())
  }
  return networkResponse
}

// --- Navigation: cache-first, update in background ---

async function handleNavigationRequest(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cachedResponse = await cache.match('/')

  if (cachedResponse) {
    // Serve cached, update in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put('/', response)
        }
      })
      .catch(() => {})
    return cachedResponse
  }

  // No cache - go to network
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put('/', response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

// --- Static assets: cache-first (immutable, content-hashed) ---

async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 408 })
  }
}

// --- Listings hash: sorted IDs joined as a string ---

function getListingsHash(data) {
  if (!data?.listings || !Array.isArray(data.listings)) return ''
  return data.listings
    .map((l) => l.id)
    .sort((a, b) => a - b)
    .join(',')
}

// --- Push notification received ---

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || 'New apartment listing found!',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    tag: 'aparto-new-listing',
    renotify: true,
    data: {
      url: data.url || '/',
      propertyCount: data.propertyCount || 1,
    },
    actions: [
      { action: 'view', title: 'View Listing' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Aparto - New Listing',
      options
    )
  )
})

// --- Notification click handler ---

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  if (event.action === 'dismiss') return

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(
            url.startsWith('http') ? url : self.location.origin + url
          )
          return client.focus()
        }
      }
      return self.clients.openWindow(
        url.startsWith('http') ? url : self.location.origin + url
      )
    })
  )
})
