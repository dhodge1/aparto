import webpush from 'web-push'
import type { Property, PushSubscriptionRecord, AppNotification } from './types'
import { getAllSubscriptions, addNotifications } from './redis'
import { buildPropertyUrl } from './ehousing'

// Configure VAPID keys
const setupVapid = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:admin@aparto.app'

  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured - push notifications disabled')
    return false
  }

  webpush.setVapidDetails(email, publicKey, privateKey)
  return true
}

/**
 * Sends push notifications for new properties to all subscribed devices.
 * Returns the list of notification records that were sent.
 */
export const notifyNewProperties = async (
  properties: Property[]
): Promise<AppNotification[]> => {
  if (properties.length === 0) return []

  const vapidReady = setupVapid()
  if (!vapidReady) return []

  const subscriptions = await getAllSubscriptions()
  if (subscriptions.length === 0) {
    console.log('No push subscriptions registered')
    return []
  }

  const notifications: AppNotification[] = properties.map((prop) => {
    const nearestStation = prop.trainStations.reduce(
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
      null as typeof prop.trainStations[0] | null
    )

    return {
      id: `${prop.id}-${Date.now()}`,
      propertyId: prop.id,
      propertyName: prop.name,
      rentAmount: prop.rent_amount,
      sizeSqm: prop.size_sqm,
      bedRooms: prop.bed_rooms,
      layout: prop.layout,
      nearestStation: nearestStation?.name ?? 'Unknown',
      walkingMinutes:
        nearestStation?.meta_data.pivot_walking_distance_minutes ?? 0,
      slug: prop.slug,
      roomNumber: prop.room_number,
      prefectureSlug: prop.prefecture.slug,
      wardSlug: prop.ward.slug,
      timestamp: new Date().toISOString(),
    }
  })

  // Build notification payload
  const title =
    properties.length === 1
      ? `New listing: ${properties[0].name}`
      : `${properties.length} new listings found`

  const body =
    properties.length === 1
      ? formatPropertySummary(properties[0])
      : properties
          .slice(0, 3)
          .map((p) => `${p.name} - ¥${p.rent_amount.toLocaleString()}`)
          .join('\n')

  const propertyUrl =
    properties.length === 1
      ? buildPropertyUrl(
          properties[0].prefecture.slug,
          properties[0].ward.slug,
          properties[0].slug,
          properties[0].room_number
        )
      : '/'

  const payload = JSON.stringify({
    title,
    body,
    url: propertyUrl,
    propertyCount: properties.length,
  })

  // Send to all subscriptions
  const sendPromises = subscriptions.map((sub) =>
    sendPushNotification(sub, payload)
  )
  await Promise.allSettled(sendPromises)

  // Store notification history
  await addNotifications(notifications)

  return notifications
}

const sendPushNotification = async (
  sub: PushSubscriptionRecord,
  payload: string
): Promise<void> => {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      payload
    )
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or invalid - clean up
      console.log(`Removing expired subscription: ${sub.endpoint.slice(-20)}`)
      const { removeSubscription } = await import('./redis')
      await removeSubscription(sub.endpoint)
    } else {
      console.error('Push notification failed:', error)
    }
  }
}

const formatPropertySummary = (prop: Property): string => {
  const nearestStation = prop.trainStations.reduce(
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
    null as typeof prop.trainStations[0] | null
  )

  const parts = [
    `¥${prop.rent_amount.toLocaleString()}/mo`,
    `${prop.bed_rooms} bed`,
    `${prop.size_sqm}m²`,
    prop.layout,
  ]

  if (nearestStation) {
    parts.push(
      `${nearestStation.name} ${nearestStation.meta_data.pivot_walking_distance_minutes}min`
    )
  }

  if (prop.key_money === 0) parts.push('No key money')
  if (prop.security_deposit === 0) parts.push('No deposit')

  return parts.join(' · ')
}
