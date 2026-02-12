'use client'

import { WARDS } from '@/lib/station-data'

type WardSelectorProps = {
  selectedWards: number[]
  onToggleWard: (wardId: number) => void
}

const WardSelector = ({ selectedWards, onToggleWard }: WardSelectorProps) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Wards
        {selectedWards.length > 0 && (
          <span className="ml-2 text-[var(--color-accent)]">
            ({selectedWards.length})
          </span>
        )}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {WARDS.map((ward) => {
          const isSelected = selectedWards.includes(ward.id)
          return (
            <button
              key={ward.id}
              onClick={() => onToggleWard(ward.id)}
              aria-pressed={isSelected}
              tabIndex={0}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/40'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)]'
              }`}
            >
              {ward.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default WardSelector
