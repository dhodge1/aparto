'use client'

import { useRef, useState } from 'react'
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

  // Build carousel images: featured + first 2 from images array
  const carouselImages = [
    property.featured_image_url,
    ...property.images_url.slice(0, 2),
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

  const googleMapsUrl = nearestStation
    ? `https://www.google.com/maps/search/${encodeURIComponent(nearestStation.name + ' Station Tokyo')}`
    : undefined

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

        {/* Nearest station - links to Google Maps */}
        {nearestStation && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
            aria-label={`View ${nearestStation.name} Station on Google Maps`}
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
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
              <path d="M12 3v8" />
              <circle cx="12" cy="14" r="2" />
            </svg>
            <span className="underline decoration-dotted underline-offset-2">
              {nearestStation.name} -{' '}
              {nearestStation.meta_data.pivot_walking_distance_minutes} min walk
            </span>
          </a>
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

export default PropertyCard
