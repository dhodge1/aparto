'use client'

import { useState, useEffect, useCallback } from 'react'

type SubscriptionState = 'unsupported' | 'prompt' | 'subscribed' | 'denied'

const SubscribeButton = () => {
  const [state, setState] = useState<SubscriptionState>('prompt')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setState(subscription ? 'subscribed' : 'prompt')
      } catch {
        setState('prompt')
      }
    }

    checkSubscription()
  }, [])

  const handleSubscribe = useCallback(async () => {
    if (state === 'unsupported' || state === 'denied') return

    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        setState('denied')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) {
        console.error('VAPID public key not configured')
        return
      }

      if (state === 'subscribed') {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: subscription.toJSON(),
              action: 'unsubscribe',
            }),
          })
          await subscription.unsubscribe()
        }
        setState('prompt')
      } else {
        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            action: 'subscribe',
          }),
        })

        setState('subscribed')
      }
    } catch (error) {
      console.error('Subscription error:', error)
    } finally {
      setLoading(false)
    }
  }, [state])

  if (state === 'unsupported') {
    return (
      <div className="text-xs text-[var(--color-text-secondary)]">
        Push notifications not supported
      </div>
    )
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading || state === 'denied'}
      aria-label={
        state === 'subscribed'
          ? 'Disable push notifications'
          : 'Enable push notifications'
      }
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        state === 'subscribed'
          ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30'
          : state === 'denied'
            ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
            : 'bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:bg-[var(--color-accent)]/20 hover:text-[var(--color-accent)]'
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={state === 'subscribed' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {loading
        ? 'Loading...'
        : state === 'subscribed'
          ? 'Notifications On'
          : state === 'denied'
            ? 'Notifications Blocked'
            : 'Enable Notifications'}
    </button>
  )
}

/**
 * Converts a VAPID public key from URL-safe base64 to Uint8Array
 * (required by the Push API)
 */
const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

export default SubscribeButton
