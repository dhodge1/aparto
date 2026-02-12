'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type UsePullToRefreshOptions = {
  onRefresh: () => Promise<void>
  threshold?: number
  disabled?: boolean
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) => {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)

  const startY = useRef(0)
  const currentY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      // Don't trigger when disabled (e.g., settings panel open)
      if (disabled || window.scrollY > 0 || refreshing) return
      startY.current = e.touches[0].clientY
      isPulling.current = true
    },
    [disabled, refreshing]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current || disabled || refreshing) return

      currentY.current = e.touches[0].clientY
      const distance = Math.max(0, currentY.current - startY.current)

      if (distance > 0 && window.scrollY === 0) {
        // Apply diminishing returns for a natural feel
        const dampened = Math.min(distance * 0.5, threshold * 1.5)
        setPullDistance(dampened)
        setPulling(dampened > 0)

        if (distance > 10) {
          e.preventDefault()
        }
      }
    },
    [refreshing, threshold]
  )

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true)
      setPullDistance(threshold * 0.5)

      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
        setPulling(false)
      }
    } else {
      setPullDistance(0)
      setPulling(false)
    }
  }, [pullDistance, threshold, refreshing, onRefresh])

  useEffect(() => {
    const options: AddEventListenerOptions = { passive: false }
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, options)
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const isReady = pullDistance >= threshold

  return { pulling, refreshing, pullDistance, isReady }
}
