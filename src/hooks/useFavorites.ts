'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Property } from '@/lib/types'

const STORAGE_KEY = 'aparto_favorites'

const readFavorites = (): Property[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Property[]) : []
  } catch {
    return []
  }
}

const writeFavorites = (favorites: Property[]): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  } catch (e) {
    console.error('Failed to write favorites to localStorage:', e)
  }
}

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<Property[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setFavorites(readFavorites())
    setIsLoaded(true)
  }, [])

  const isFavorite = useCallback(
    (propertyId: number): boolean => {
      return favorites.some((f) => f.id === propertyId)
    },
    [favorites]
  )

  const toggleFavorite = useCallback(
    (property: Property) => {
      setFavorites((prev) => {
        const exists = prev.some((f) => f.id === property.id)
        const next = exists
          ? prev.filter((f) => f.id !== property.id)
          : [...prev, property]
        writeFavorites(next)
        return next
      })
    },
    []
  )

  const removeFavorite = useCallback((propertyId: number) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== propertyId)
      writeFavorites(next)
      return next
    })
  }, [])

  return {
    favorites,
    isLoaded,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    count: favorites.length,
  }
}
