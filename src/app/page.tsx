'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Property, AppNotification, FilterSettings } from '@/lib/types'
import { useFavorites } from '@/hooks/useFavorites'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
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

  const {
    favorites,
    isLoaded: favoritesLoaded,
    isFavorite,
    toggleFavorite,
    count: favoritesCount,
  } = useFavorites()

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/listings')
      if (!response.ok) throw new Error('Failed to fetch listings')
      const json = (await response.json()) as ListingsData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/refresh', { method: 'POST' })
      if (!response.ok) throw new Error('Refresh failed')
      const json = (await response.json()) as ListingsData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    }
  }, [])

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

  const { pulling, refreshing, pullDistance, isReady } = usePullToRefresh({
    onRefresh: handleRefresh,
  })

  useEffect(() => {
    fetchListings()

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW registered:', reg.scope))
        .catch((err) => console.error('SW registration failed:', err))
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

      {/* Pull-to-refresh indicator */}
      {(pulling || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: pullDistance }}
        >
          <div
            className={`flex items-center gap-2 text-sm ${isReady || refreshing ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? 'animate-spin' : ''}
              style={{
                transform: refreshing
                  ? undefined
                  : `rotate(${Math.min(pullDistance * 3, 360)}deg)`,
              }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {refreshing
              ? 'Refreshing...'
              : isReady
                ? 'Release to refresh'
                : 'Pull to refresh'}
          </div>
        </div>
      )}

      <main className="px-4 py-4">
        {/* Stats bar */}
        <div className="mb-4 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <span>
              {refreshing
                ? 'Refreshing...'
                : loading
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
          {lastPollFormatted && <span>Checked {lastPollFormatted}</span>}
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

            {/* Property cards */}
            {data.listings.length > 0 ? (
              <div className="space-y-4">
                {data.listings.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    isFavorite={favoritesLoaded && isFavorite(property.id)}
                    onToggleFavorite={toggleFavorite}
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
