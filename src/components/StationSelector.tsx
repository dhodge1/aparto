'use client'

import { useState } from 'react'
import { TRAIN_LINES } from '@/lib/station-data'

type StationSelectorProps = {
  selectedStations: number[]
  onToggleStation: (stationId: number) => void
}

const StationSelector = ({
  selectedStations,
  onToggleStation,
}: StationSelectorProps) => {
  const [expandedLine, setExpandedLine] = useState<string | null>(null)

  const handleToggleLine = (lineName: string) => {
    setExpandedLine((prev) => (prev === lineName ? null : lineName))
  }

  // Count selected stations per line
  const getLineSelectedCount = (lineIndex: number): number => {
    const line = TRAIN_LINES[lineIndex]
    return line.stations.filter((s) => selectedStations.includes(s.id)).length
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Train Stations
        {selectedStations.length > 0 && (
          <span className="ml-2 text-[var(--color-accent)]">
            ({selectedStations.length})
          </span>
        )}
      </h3>
      <div className="space-y-1">
        {TRAIN_LINES.map((line, lineIndex) => {
          const isExpanded = expandedLine === `${line.name}-${lineIndex}`
          const selectedCount = getLineSelectedCount(lineIndex)
          const lineKey = `${line.name}-${lineIndex}`

          return (
            <div
              key={lineKey}
              className="overflow-hidden rounded-lg border border-[var(--color-border)]"
            >
              {/* Line header */}
              <button
                onClick={() => handleToggleLine(lineKey)}
                aria-expanded={isExpanded}
                tabIndex={0}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {line.name}
                  </span>
                  {selectedCount > 0 && (
                    <span className="rounded-full bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                      {selectedCount}
                    </span>
                  )}
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-text-secondary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Stations */}
              {isExpanded && (
                <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {line.stations.map((station) => {
                      const isSelected = selectedStations.includes(station.id)
                      return (
                        <button
                          key={`${lineKey}-${station.id}`}
                          onClick={() => onToggleStation(station.id)}
                          aria-pressed={isSelected}
                          tabIndex={0}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                          }`}
                        >
                          {station.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StationSelector
