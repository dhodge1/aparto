'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import type { Property, LivabilityScore } from '@/lib/types'
import { buildPropertyUrl } from '@/lib/ehousing'

type PropertyCardProps = {
  property: Property
  isFavorite: boolean
  onToggleFavorite: (property: Property) => void
  score?: LivabilityScore | null
  scoreLoading?: boolean
}

const PropertyCard = ({
  property,
  isFavorite,
  onToggleFavorite,
  score,
  scoreLoading,
}: PropertyCardProps) => {
  const [showBreakdown, setShowBreakdown] = useState(false)
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

  // Build carousel images: featured + first 2 from images array
  const carouselImages = [
    property.featured_image_url,
    ...property.images_url.slice(0, 4),
  ].filter(Boolean) as string[]

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

  const googleMapsUrl = `https://www.google.com/maps?q=${property.latitude},${property.longitude}`

  return (
    <article className="relative overflow-hidden rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors hover:border-[var(--color-accent)]/30">
      {/* Image Carousel */}
      <div className="relative">
        <ImageCarousel
          images={carouselImages}
          alt={property.name}
          href={propertyUrl}
        />

        {/* Badges */}
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
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

        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label={
            isFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
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
      </div>

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
          <span className="text-sm text-[var(--color-text-secondary)]">
            /mo
          </span>
        </div>

        {/* Details grid */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-secondary)]">
          <span>{property.bed_rooms} bed</span>
          <span>{property.size_sqm} m²</span>
          <span>{property.layout}</span>
        </div>

        {/* Station + Score row */}
        <div className="flex items-center justify-between gap-3">
          {/* Nearest station - links to Google Maps at property location */}
          {nearestStation && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
              aria-label={`View ${property.name} location on Google Maps`}
              tabIndex={0}
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
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="underline decoration-dotted underline-offset-2">
                {nearestStation.name} -{' '}
                {nearestStation.meta_data.pivot_walking_distance_minutes} min walk
              </span>
            </a>
          )}

          {/* Livability score badge */}
          <ScoreBadge
            score={score}
            loading={scoreLoading}
            showBreakdown={showBreakdown}
            onToggleBreakdown={() => setShowBreakdown((prev) => !prev)}
          />
        </div>

        {/* Score breakdown (expandable) */}
        {showBreakdown && score && score.overall > 0 && (
          <ScoreBreakdown
            score={score}
            lat={property.latitude}
            lng={property.longitude}
          />
        )}
      </div>
    </article>
  )
}

// --- Image Carousel ---

const ImageCarousel = ({
  images,
  alt,
  href,
}: {
  images: string[]
  alt: string
  href: string
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center bg-[var(--color-surface-hover)]">
        <span className="text-[var(--color-text-secondary)]">No image</span>
      </div>
    )
  }

  const handleScroll = () => {
    if (!scrollRef.current) return
    const scrollLeft = scrollRef.current.scrollLeft
    const width = scrollRef.current.clientWidth
    const index = Math.round(scrollLeft / width)
    setActiveIndex(index)
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {images.map((src, i) => (
          <a
            key={src}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="relative aspect-[16/10] w-full shrink-0 snap-center"
            aria-label={`${alt} - image ${i + 1} of ${images.length}`}
          >
            <Image
              src={src}
              alt={`${alt} - ${i + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority={i === 0}
            />
          </a>
        ))}
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === activeIndex
                  ? 'bg-white'
                  : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Score Badge ---

const getScoreColor = (score: number): string => {
  if (score >= 8) return 'bg-[var(--color-success)]'
  if (score >= 5) return 'bg-[var(--color-warning)]'
  return 'bg-red-500'
}

const getScoreTextColor = (score: number): string => {
  if (score >= 8) return 'text-[var(--color-success)]'
  if (score >= 5) return 'text-[var(--color-warning)]'
  return 'text-red-500'
}

const ScoreBadge = ({
  score,
  loading,
  showBreakdown,
  onToggleBreakdown,
}: {
  score?: LivabilityScore | null
  loading?: boolean
  showBreakdown: boolean
  onToggleBreakdown: () => void
}) => {
  if (loading) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-spin"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    )
  }

  if (!score || score.overall === 0) return null

  return (
    <button
      onClick={onToggleBreakdown}
      aria-expanded={showBreakdown}
      aria-label={`Livability score: ${score.overall} out of 10. Tap for breakdown.`}
      tabIndex={0}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 transition-colors ${
        showBreakdown
          ? 'bg-[var(--color-surface-hover)]'
          : 'hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      <div
        className={`h-2.5 w-2.5 rounded-full ${getScoreColor(score.overall)}`}
      />
      <span
        className={`text-sm font-bold ${getScoreTextColor(score.overall)}`}
      >
        {score.overall.toFixed(1)}
      </span>
    </button>
  )
}

// --- Score Breakdown ---

const ScoreBreakdown = ({
  score,
  lat,
  lng,
}: {
  score: LivabilityScore
  lat: number
  lng: number
}) => {
  const items = [
    {
      label: 'Station',
      value: score.station,
      detail: `${score.counts.nearestStationMinutes} min walk`,
    },
    {
      label: 'Grocery',
      value: score.supermarkets,
      detail: `${score.counts.supermarkets} within 500m`,
    },
    {
      label: 'Dining',
      value: score.restaurants,
      detail: `${score.counts.restaurants} within 500m`,
    },
    {
      label: 'Konbini',
      value: score.convenience,
      detail: `${score.counts.convenience} within 300m`,
    },
    {
      label: 'Parks',
      value: score.parks,
      detail: `${score.counts.parks} within 500m`,
    },
  ]

  const overpassQuery = `[out:json][timeout:15];(node[shop=supermarket](around:500,${lat},${lng});node[amenity=restaurant](around:500,${lat},${lng});node[shop=convenience](around:300,${lat},${lng});way[leisure=park](around:500,${lat},${lng});node[leisure=park](around:500,${lat},${lng}););out geom;`
  const overpassUrl = `https://overpass-turbo.eu/?Q=${encodeURIComponent(overpassQuery)}&R`

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Livability Breakdown
        </span>
        <a
          href={overpassUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline"
          aria-label="View amenities on map"
          tabIndex={0}
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
          View on map
        </a>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-[var(--color-text-secondary)]">
              {item.label}
            </span>
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                <div
                  className={`h-full rounded-full transition-all ${getScoreColor(item.value)}`}
                  style={{ width: `${item.value * 10}%` }}
                />
              </div>
            </div>
            <span
              className={`w-6 shrink-0 text-right text-xs font-semibold ${getScoreTextColor(item.value)}`}
            >
              {item.value}
            </span>
            <span className="w-20 shrink-0 text-right text-[10px] text-[var(--color-text-secondary)]">
              {item.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PropertyCard
