'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FilterSettings } from '@/lib/types'
import { DEFAULT_FILTERS } from '@/lib/types'
import { WARDS, TRAIN_LINES } from '@/lib/station-data'
import WardSelector from './WardSelector'
import StationSelector from './StationSelector'

type SettingsPanelProps = {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterSettings) => Promise<void>
}

const SettingsPanel = ({ isOpen, onClose, onApply }: SettingsPanelProps) => {
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const handleToggleStation = useCallback((stationId: number) => {
    setFilters((prev) => {
      const isSelected = prev.stations.includes(stationId)

      // Find station name from all lines
      let stationName = ''
      for (const line of TRAIN_LINES) {
        const station = line.stations.find((s) => s.id === stationId)
        if (station) {
          stationName = station.name
          break
        }
      }

      if (isSelected) {
        return {
          ...prev,
          stations: prev.stations.filter((id) => id !== stationId),
          stationNames: prev.stationNames.filter(
            (name) => name !== stationName
          ),
        }
      }

      return {
        ...prev,
        stations: [...prev.stations, stationId],
        stationNames: [...prev.stationNames, stationName],
      }
    })
  }, [])

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const handleApply = useCallback(async () => {
    if (filters.wards.length === 0) return

    setSaving(true)
    try {
      await onApply(filters)
      onClose()
    } catch (e) {
      console.error('Failed to save settings:', e)
    } finally {
      setSaving(false)
    }
  }, [filters, onApply, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm flex-col bg-[var(--color-bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            Search Filters
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            tabIndex={0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Loading settings...
              </span>
            </div>
          ) : (
            <div className="space-y-6">
              <WardSelector
                selectedWards={filters.wards}
                onToggleWard={handleToggleWard}
              />
              <StationSelector
                selectedStations={filters.stations}
                onToggleStation={handleToggleStation}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
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
