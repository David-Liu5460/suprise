const CACHE_VERSION = 'v3'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const IMAGE_CACHE = `images-${CACHE_VERSION}`

const STATIC_ASSETS = [
  './',
  './index.html',
  './rose.html',
  './photo.html',
  './style.css',
  './game.js',
  './script.js',
  './assets/13415607759685320.jpeg',
  './assets/13415613477197740.jpeg',
  './mp3/outputs_netease_259066.mp3',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      await cache.addAll(STATIC_ASSETS)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.map((key) => {
          if (key === STATIC_CACHE || key === IMAGE_CACHE) return null
          return caches.delete(key)
        }),
      )
      await self.clients.claim()
    })(),
  )
})

function isImageRequest(request) {
  const accept = request.headers.get('accept') || ''
  return accept.includes('image/')
}

function isNavigationRequest(request) {
  return request.mode === 'navigate'
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request, { ignoreSearch: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request, { ignoreSearch: true })
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    fetchPromise.then(() => {})
    return cached
  }
  const response = await fetchPromise
  if (response) return response
  return new Response('offline', { status: 503, statusText: 'offline' })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (isNavigationRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  if (isImageRequest(request) || request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'audio') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
  }
})

