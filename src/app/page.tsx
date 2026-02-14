'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Property,
  AppNotification,
  FilterSettings,
  LivabilityScore,
} from '@/lib/types'
import { useFavorites } from '@/hooks/useFavorites'
import PropertyCard from '@/components/PropertyCard'
import FavoritesView from '@/components/FavoritesView'
import NotificationBanner from '@/components/NotificationBanner'
import SubscribeButton from '@/components/SubscribeButton'
import InstallPrompt from '@/components/InstallPrompt'
import SettingsPanel from '@/components/SettingsPanel'

type Tab = 'listings' | 'favorites'

type ListingsData = {
  listings: Property[]
  lastPoll: string | null
  notifications: AppNotification[]
  count: number
  searchUrl?: string
}

const HomePage = () => {
  const [tab, setTab] = useState<Tab>('listings')
  const [data, setData] = useState<ListingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scores, setScores] = useState<Record<string, LivabilityScore>>({})
  const [scoresLoading, setScoresLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showUpdateToast, setShowUpdateToast] = useState(false)

  const {
    favorites,
    isLoaded: favoritesLoaded,
    isFavorite,
    toggleFavorite,
    count: favoritesCount,
  } = useFavorites()

  const fetchScores = useCallback(async (listings: Property[]) => {
    if (listings.length === 0) return

    setScoresLoading(true)
    try {
      // Build property descriptors: id:lat:lng:walkMin
      const descriptors = listings.map((p) => {
        const nearestStation = p.trainStations.reduce(
          (nearest, station) => {
            if (
              !nearest ||
              station.meta_data.pivot_walking_distance_minutes <
                nearest.meta_data.pivot_walking_distance_minutes
            ) {
              return station
            }
            return nearest
          },
          null as (typeof p.trainStations)[0] | null
        )
        const walkMin =
          nearestStation?.meta_data.pivot_walking_distance_minutes ?? 15
        return `${p.id}:${p.latitude}:${p.longitude}:${walkMin}`
      })

      const response = await fetch(
        `/api/scores?properties=${descriptors.join(',')}`
      )
      if (!response.ok) throw new Error('Failed to fetch scores')
      const json = await response.json()
      setScores(json.scores ?? {})
    } catch (err) {
      console.error('Score fetch error:', err)
    } finally {
      setScoresLoading(false)
    }
  }, [])

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/listings')
      if (!response.ok) throw new Error('Failed to fetch listings')
      const json = (await response.json()) as ListingsData
      setData(json)
      // Fetch scores asynchronously after listings load
      fetchScores(json.listings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [fetchScores])

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      const response = await fetch('/api/refresh', { method: 'POST' })
      if (!response.ok) throw new Error('Refresh failed')
      const json = (await response.json()) as ListingsData
      setData(json)
      fetchScores(json.listings)

      // Update the SW listings cache so next app open shows fresh data
      fetch('/api/listings').catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }, [fetchScores])

  const handleApplyFilters = useCallback(
    async (filters: FilterSettings) => {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })

      if (!response.ok) throw new Error('Failed to save settings')

      const json = await response.json()
      setData((prev) => ({
        ...prev,
        listings: json.listings,
        count: json.count,
        lastPoll: new Date().toISOString(),
        notifications: prev?.notifications ?? [],
        searchUrl: undefined, // Will be refreshed on next listings fetch
      }))

      // Refresh to get the updated search URL
      await fetchListings()
    },
    [fetchListings]
  )

  // Swipe-to-open settings from left edge
  const edgeSwipeStartX = useRef(0)
  const edgeSwipeActive = useRef(false)

  useEffect(() => {
    const handleEdgeTouchStart = (e: TouchEvent) => {
      if (settingsOpen) return
      const x = e.touches[0].clientX
      // Only trigger if starting from the left 20px edge
      if (x < 20) {
        edgeSwipeStartX.current = x
        edgeSwipeActive.current = true
      }
    }

    const handleEdgeTouchMove = (e: TouchEvent) => {
      if (!edgeSwipeActive.current) return
      const x = e.touches[0].clientX
      const delta = x - edgeSwipeStartX.current
      if (delta > 80) {
        edgeSwipeActive.current = false
        setSettingsOpen(true)
      }
    }

    const handleEdgeTouchEnd = () => {
      edgeSwipeActive.current = false
    }

    document.addEventListener('touchstart', handleEdgeTouchStart, {
      passive: true,
    })
    document.addEventListener('touchmove', handleEdgeTouchMove, {
      passive: true,
    })
    document.addEventListener('touchend', handleEdgeTouchEnd, {
      passive: true,
    })

    return () => {
      document.removeEventListener('touchstart', handleEdgeTouchStart)
      document.removeEventListener('touchmove', handleEdgeTouchMove)
      document.removeEventListener('touchend', handleEdgeTouchEnd)
    }
  }, [settingsOpen])

  useEffect(() => {
    fetchListings()

    // Register service worker and listen for update messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW registered:', reg.scope))
        .catch((err) => console.error('SW registration failed:', err))

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NEW_DATA_AVAILABLE') {
          setShowUpdateToast(true)
        }
      })
    }
  }, [fetchListings])

  const lastPollFormatted = data?.lastPoll
    ? formatLastPoll(data.lastPoll)
    : null

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Hamburger menu */}
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Open search filters"
              tabIndex={0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              Aparto
            </h1>
          </div>
          <SubscribeButton />
        </div>

        {/* Tabs */}
        <div className="flex border-t border-[var(--color-border)]">
          <TabButton
            active={tab === 'listings'}
            onClick={() => setTab('listings')}
            label="Listings"
            count={data?.count ?? 0}
          />
          <TabButton
            active={tab === 'favorites'}
            onClick={() => setTab('favorites')}
            label="Favorites"
            count={favoritesCount}
          />
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Stats bar */}
        <div className="mb-4 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <span>
              {loading
                ? 'Loading...'
                : error
                  ? 'Error loading data'
                  : tab === 'listings'
                    ? `${data?.count ?? 0} listings`
                    : `${favoritesCount} saved`}
            </span>
            {/* View on e-housing link */}
            {tab === 'listings' && data?.searchUrl && (
              <a
                href={data.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                aria-label="View search on e-housing.jp"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                e-housing
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastPollFormatted && <span>Checked {lastPollFormatted}</span>}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh listings"
              tabIndex={0}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] disabled:opacity-40"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={refreshing ? 'animate-spin' : ''}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={fetchListings}
              className="mt-2 text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && !data && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
              >
                <div className="aspect-[16/10] bg-[var(--color-surface-hover)] rounded-t-xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-[var(--color-surface-hover)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--color-surface-hover)]" />
                  <div className="h-6 w-1/3 rounded bg-[var(--color-surface-hover)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Listings tab */}
        {tab === 'listings' && data && (
          <div className="space-y-6">
            {/* Notification history */}
            {data.notifications.length > 0 && (
              <NotificationBanner notifications={data.notifications} />
            )}

            {/* Property cards - sorted newest first */}
            {data.listings.length > 0 ? (
              <div className="space-y-4">
                {[...data.listings]
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                  .map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    isFavorite={favoritesLoaded && isFavorite(property.id)}
                    onToggleFavorite={toggleFavorite}
                    score={scores[String(property.id)]}
                    scoreLoading={scoresLoading}
                  />
                ))}
              </div>
            ) : (
              !loading && (
                <EmptyState message="No listings found. Try adjusting your filters or wait for the next poll." />
              )
            )}
          </div>
        )}

        {/* Favorites tab */}
        {tab === 'favorites' && favoritesLoaded && (
          <FavoritesView
            favorites={favorites}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </main>

      {/* Update toast */}
      <UpdateToast
        visible={showUpdateToast}
        onRefresh={() => {
          setShowUpdateToast(false)
          fetchListings()
        }}
        onDismiss={() => setShowUpdateToast(false)}
      />

      {/* Install prompt */}
      <InstallPrompt />

      {/* Settings panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApply={handleApplyFilters}
      />
    </div>
  )
}

// --- Sub-components ---

const TabButton = ({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) => (
  <button
    onClick={onClick}
    role="tab"
    aria-selected={active}
    tabIndex={0}
    className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
    }`}
  >
    {label}
    {count > 0 && (
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs ${
          active
            ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
        }`}
      >
        {count}
      </span>
    )}
  </button>
)

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface)]">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </div>
    <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
      {message}
    </p>
  </div>
)

const UpdateToast = ({
  visible,
  onRefresh,
  onDismiss,
}: {
  visible: boolean
  onRefresh: () => void
  onDismiss: () => void
}) => {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onDismiss, 15000)
    return () => clearTimeout(timer)
  }, [visible, onDismiss])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 shadow-lg">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/20">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <span className="text-sm text-[var(--color-text)]">
          Listings updated
        </span>
        <button
          onClick={onRefresh}
          className="rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white"
          tabIndex={0}
        >
          Refresh
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          tabIndex={0}
          className="p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const formatLastPoll = (timestamp: string): string => {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return new Date(timestamp).toLocaleDateString()
}

export default HomePage
