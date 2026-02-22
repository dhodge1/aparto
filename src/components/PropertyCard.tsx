'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import type { Property, LivabilityScore } from '@/lib/types'
import { buildPropertyUrl } from '@/lib/ehousing'

const EHOUSING_CDN_PREFIX =
  'https://cdn.shortpixel.ai/client/to_webp,w_1500,q_lossless,ret_wait/https://s3.ap-northeast-1.amazonaws.com/ehousing-dev/'

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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
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

  // Build floor plan full URLs from raw paths
  const floorPlanUrls = property.floor_plan_images
    .map((path) => `${EHOUSING_CDN_PREFIX}${path}`)
    .filter(Boolean)

  // Order: featured, floor plans, then rest of photos
  const carouselImages = [
    property.featured_image_url,
    ...floorPlanUrls,
    ...property.images_url,
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

        {/* Fullscreen button */}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setLightboxIndex(0)
            setLightboxOpen(true)
          }}
          tabIndex={0}
          aria-label="View images fullscreen"
          className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>

        {/* Badges */}
        <div className="absolute left-14 top-3 z-10 flex flex-wrap gap-1.5">
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

        {/* Nearest station */}
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

        {/* Commute + Livability row */}
        <div className="mt-2 flex items-center justify-between gap-3">
          {/* Commute to Nishimachi */}
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${property.latitude},${property.longitude}&destination=Nishimachi+International+School+Tokyo&travelmode=transit`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="View transit commute to Nishimachi International School"
            tabIndex={0}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <path d="M12 2C8 2 4 2.5 4 6v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
            <span className="underline decoration-dotted underline-offset-2">
              Commute to Nishimachi
            </span>
          </a>

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

      {/* Fullscreen Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={carouselImages}
          initialIndex={lightboxIndex}
          alt={property.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </article>
  )
}

// --- Fullscreen Lightbox ---

const Lightbox = ({
  images,
  initialIndex,
  alt,
  onClose,
}: {
  images: string[]
  initialIndex: number
  alt: string
  onClose: () => void
}) => {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef(0)

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handlePrev = useCallback(() => {
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1))
  }, [images.length])

  const handleNext = useCallback(() => {
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1))
  }, [images.length])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const delta = touchStartX.current - e.changedTouches[0].clientX
      if (Math.abs(delta) > 50) {
        if (delta > 0) handleNext()
        else handlePrev()
      }
    },
    [handleNext, handlePrev]
  )

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, handlePrev, handleNext])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-white/70">
          {index + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Close fullscreen"
          tabIndex={0}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white"
        >
          <svg
            width="24"
            height="24"
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

      {/* Image */}
      <div className="relative flex flex-1 items-center justify-center px-2">
        <Image
          src={images[index]}
          alt={`${alt} - ${index + 1}`}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center py-3">
        {images.length <= 15 ? (
          <div className="flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                tabIndex={0}
                aria-label={`Go to image ${i + 1}`}
                className={`h-1.5 rounded-full transition-colors ${
                  i === index ? 'w-3 bg-white' : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        ) : (
          <span className="text-xs text-white/50">
            Swipe to navigate
          </span>
        )}
      </div>
    </div>
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
  const isScrolling = useRef(false)

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center bg-[var(--color-surface-hover)]">
        <span className="text-[var(--color-text-secondary)]">No image</span>
      </div>
    )
  }

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return
    const width = scrollRef.current.clientWidth
    isScrolling.current = true
    scrollRef.current.scrollTo({ left: width * index, behavior: 'smooth' })
    setActiveIndex(index)
    setTimeout(() => { isScrolling.current = false }, 350)
  }

  const handleScroll = () => {
    if (!scrollRef.current || isScrolling.current) return
    const scrollLeft = scrollRef.current.scrollLeft
    const width = scrollRef.current.clientWidth
    const index = Math.round(scrollLeft / width)
    setActiveIndex(index)
  }

  const handleScrollEnd = () => {
    if (!scrollRef.current || isScrolling.current) return
    if (images.length <= 1) return

    const scrollLeft = scrollRef.current.scrollLeft
    const width = scrollRef.current.clientWidth
    const maxScroll = scrollRef.current.scrollWidth - width

    // Loop: if at the end, snap to first
    if (scrollLeft >= maxScroll - 2) {
      setTimeout(() => scrollToIndex(0), 200)
    }
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchEnd={handleScrollEnd}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {images.map((src, i) => (
          <a
            key={`${src}-${i}`}
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
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </a>
        ))}
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1">
          {images.length <= 12 ? (
            images.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-colors ${
                  i === activeIndex
                    ? 'w-3 bg-white'
                    : 'w-1.5 bg-white/40'
                }`}
              />
            ))
          ) : (
            <span className="text-[10px] text-white/80 bg-black/30 px-1.5 py-0.5 rounded-full">
              {activeIndex + 1} / {images.length}
            </span>
          )}
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
