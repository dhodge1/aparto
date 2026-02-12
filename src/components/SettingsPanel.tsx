'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { FilterSettings } from '@/lib/types'
import { DEFAULT_FILTERS } from '@/lib/types'
import { WARDS } from '@/lib/station-data'
import WardSelector from './WardSelector'

type SettingsPanelProps = {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterSettings) => Promise<void>
}

const SAVE_TIMEOUT_MS = 10000

const SettingsPanel = ({ isOpen, onClose, onApply }: SettingsPanelProps) => {
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Swipe gesture state
  const panelRef = useRef<HTMLDivElement>(null)
  const swipeStartX = useRef(0)
  const swipeCurrentX = useRef(0)
  const isSwiping = useRef(false)
  const [swipeOffset, setSwipeOffset] = useState(0)

  // Lock body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      setSwipeOffset(0)
      setSaveError(false)
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [isOpen])

  // Load current settings from server when panel opens
  useEffect(() => {
    if (!isOpen) return

    const loadSettings = async () => {
      setLoading(true)
      try {
        const resp = await fetch('/api/settings')
        if (resp.ok) {
          const data = (await resp.json()) as FilterSettings
          setFilters(data)
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [isOpen])

  const handleToggleWard = useCallback((wardId: number) => {
    setFilters((prev) => {
      const ward = WARDS.find((w) => w.id === wardId)
      if (!ward) return prev

      const isSelected = prev.wards.includes(wardId)

      if (isSelected) {
        return {
          ...prev,
          wards: prev.wards.filter((id) => id !== wardId),
          wardNames: prev.wardNames.filter(
            (name) => name !== `${ward.name} Ward`
          ),
        }
      }

      return {
        ...prev,
        wards: [...prev.wards, wardId],
        wardNames: [...prev.wardNames, `${ward.name} Ward`],
      }
    })
  }, [])

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const canClose = !saving

  const handleClose = useCallback(() => {
    if (!canClose) return
    onClose()
  }, [canClose, onClose])

  const handleApply = useCallback(async () => {
    if (filters.wards.length === 0 || saving) return

    setSaving(true)
    setSaveError(false)

    // Safety timeout: allow closing after 10 seconds even if save hangs
    saveTimerRef.current = setTimeout(() => {
      setSaving(false)
      setSaveError(true)
    }, SAVE_TIMEOUT_MS)

    try {
      await onApply(filters)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      setSaving(false)
      onClose()
    } catch (e) {
      console.error('Failed to save settings:', e)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      setSaving(false)
      setSaveError(true)
    }
  }, [filters, saving, onApply, onClose])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // --- Swipe gesture handlers ---

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (saving) return
      swipeStartX.current = e.touches[0].clientX
      isSwiping.current = true
    },
    [saving]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping.current || saving) return
      swipeCurrentX.current = e.touches[0].clientX
      const delta = swipeStartX.current - swipeCurrentX.current

      // Only allow swiping left (to close)
      if (delta > 0) {
        setSwipeOffset(Math.min(delta, 300))
      }
    },
    [saving]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current || saving) return
    isSwiping.current = false

    // Close if swiped more than 100px to the left
    if (swipeOffset > 100) {
      onClose()
    }
    setSwipeOffset(0)
  }, [swipeOffset, saving, onClose])

  // --- Swipe-to-open from left edge (on backdrop/main page) ---
  // This is handled in the parent page component

  if (!isOpen) return null

  const panelTranslate = swipeOffset > 0 ? -swipeOffset : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-hidden="true"
        style={{
          opacity: swipeOffset > 0 ? 1 - swipeOffset / 400 : 1,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm flex-col bg-[var(--color-bg)] shadow-2xl transition-transform"
        style={{
          transform: `translateX(${panelTranslate}px)`,
          transitionDuration: isSwiping.current ? '0ms' : '200ms',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            Search Filters
          </h2>
          <button
            onClick={handleClose}
            disabled={!canClose}
            aria-label="Close settings"
            tabIndex={0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30"
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Loading settings...
              </span>
            </div>
          ) : (
            <WardSelector
              selectedWards={filters.wards}
              onToggleWard={handleToggleWard}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          {saveError && (
            <p className="mb-2 text-center text-xs text-red-400">
              Failed to apply filters. You can try again or close.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] disabled:opacity-30"
              tabIndex={0}
            >
              Reset
            </button>
            <button
              onClick={handleApply}
              disabled={saving || filters.wards.length === 0}
              className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              tabIndex={0}
            >
              {saving ? 'Applying...' : 'Apply Filters'}
            </button>
          </div>
          {filters.wards.length === 0 && (
            <p className="mt-2 text-center text-xs text-red-400">
              Select at least one ward
            </p>
          )}
        </div>
      </div>
    </>
  )
}

export default SettingsPanel
