'use client'

import Image from 'next/image'
import type { Property } from '@/lib/types'
import { buildPropertyUrl } from '@/lib/ehousing'

type PropertyCardProps = {
  property: Property
  isFavorite: boolean
  onToggleFavorite: (property: Property) => void
}

const PropertyCard = ({
  property,
  isFavorite,
  onToggleFavorite,
}: PropertyCardProps) => {
  const nearestStation = property.trainStations.reduce(
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
    null as (typeof property.trainStations)[0] | null
  )

  const propertyUrl = buildPropertyUrl(
    property.prefecture.slug,
    property.ward.slug,
    property.slug,
    property.room_number
  )

  const handleFavoriteClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleFavorite(property)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleFavoriteClick(e)
    }
  }

  return (
    <article className="relative overflow-hidden rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors hover:border-[var(--color-accent)]/30">
      {/* Image */}
      <a
        href={propertyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[16/10] overflow-hidden"
        aria-label={`View ${property.name} on e-housing.jp`}
      >
        {property.featured_image_url ? (
          <Image
            src={property.featured_image_url}
            alt={property.name}
            fill
            className="object-cover transition-transform hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[var(--color-surface-hover)]">
            <span className="text-[var(--color-text-secondary)]">
              No image
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {property.key_money === 0 && (
            <span className="rounded-full bg-[var(--color-success)]/90 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              No Key Money
            </span>
          )}
          {property.security_deposit === 0 && (
            <span className="rounded-full bg-[var(--color-accent)]/90 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              No Deposit
            </span>
          )}
        </div>
      </a>

      {/* Favorite Button */}
      <button
        onClick={handleFavoriteClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={isFavorite ? 'var(--color-heart)' : 'none'}
          stroke={isFavorite ? 'var(--color-heart)' : 'white'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* Content */}
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-tight text-[var(--color-text)]">
            <a
              href={propertyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-accent)] transition-colors"
            >
              {property.name}
            </a>
          </h3>
        </div>

        <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
          {property.obscured_address}
        </p>

        {/* Price */}
        <div className="mb-3 flex items-baseline gap-1">
          <span className="text-xl font-bold text-[var(--color-accent)]">
            ¥{property.rent_amount.toLocaleString()}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)]">/mo</span>
        </div>

        {/* Details grid */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-secondary)]">
          <span>{property.bed_rooms} bed</span>
          <span>{property.size_sqm} m²</span>
          <span>{property.layout}</span>
        </div>

        {/* Nearest station */}
        {nearestStation && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
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
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
              <path d="M12 3v8" />
              <circle cx="12" cy="14" r="2" />
            </svg>
            <span>
              {nearestStation.name} -{' '}
              {nearestStation.meta_data.pivot_walking_distance_minutes} min walk
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

export default PropertyCard
