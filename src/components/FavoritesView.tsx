'use client'

import type { Property } from '@/lib/types'
import PropertyCard from './PropertyCard'

type FavoritesViewProps = {
  favorites: Property[]
  isFavorite: (id: number) => boolean
  onToggleFavorite: (property: Property) => void
}

const FavoritesView = ({
  favorites,
  isFavorite,
  onToggleFavorite,
}: FavoritesViewProps) => {
  if (favorites.length === 0) {
    return (
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
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <h3 className="mb-1 text-base font-semibold text-[var(--color-text)]">
          No favorites yet
        </h3>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          Tap the heart icon on any listing to save it here for easy access
          later.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {favorites.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          isFavorite={isFavorite(property.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  )
}

export default FavoritesView
