import { Redis } from '@upstash/redis'
import type {
  Property,
  PushSubscriptionRecord,
  AppNotification,
} from './types'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// --- Known Property IDs ---

const KNOWN_IDS_KEY = 'properties:known'

export const getKnownPropertyIds = async (): Promise<Set<number>> => {
  const ids = await redis.smembers(KNOWN_IDS_KEY)
  return new Set(ids.map(Number))
}

export const addKnownPropertyIds = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return
  await redis.sadd(KNOWN_IDS_KEY, ...ids as [number, ...number[]])
}

export const syncKnownPropertyIds = async (
  currentIds: number[]
): Promise<void> => {
  // Replace the full set with current IDs to remove stale ones
  const pipeline = redis.pipeline()
  pipeline.del(KNOWN_IDS_KEY)
  if (currentIds.length > 0) {
    pipeline.sadd(KNOWN_IDS_KEY, ...currentIds as [number, ...number[]])
  }
  await pipeline.exec()
}

// --- Cached Listings ---

const LISTINGS_KEY = 'properties:latest'
const POLL_TIMESTAMP_KEY = 'poll:last_timestamp'

export const getCachedListings = async (): Promise<Property[]> => {
  const data = await redis.get<Property[]>(LISTINGS_KEY)
  return data ?? []
}

export const setCachedListings = async (
  properties: Property[]
): Promise<void> => {
  await redis.set(LISTINGS_KEY, properties)
}

export const getLastPollTimestamp = async (): Promise<string | null> => {
  return redis.get<string>(POLL_TIMESTAMP_KEY)
}

export const setLastPollTimestamp = async (
  timestamp: string
): Promise<void> => {
  await redis.set(POLL_TIMESTAMP_KEY, timestamp)
}

// --- Push Subscriptions ---

const SUBSCRIPTIONS_KEY = 'push:subscriptions'

export const getAllSubscriptions = async (): Promise<
  PushSubscriptionRecord[]
> => {
  const data = await redis.hgetall(SUBSCRIPTIONS_KEY)
  if (!data) return []
  return Object.values(data) as PushSubscriptionRecord[]
}

export const addSubscription = async (
  sub: PushSubscriptionRecord
): Promise<void> => {
  // Use a hash of the endpoint as the key to prevent duplicates
  const key = hashEndpoint(sub.endpoint)
  await redis.hset(SUBSCRIPTIONS_KEY, { [key]: sub })
}

export const removeSubscription = async (endpoint: string): Promise<void> => {
  const key = hashEndpoint(endpoint)
  await redis.hdel(SUBSCRIPTIONS_KEY, key)
}

const hashEndpoint = (endpoint: string): string => {
  // Simple hash for deduplication - use last 32 chars of endpoint
  // (endpoints are long unique URLs)
  return endpoint.slice(-64).replace(/[^a-zA-Z0-9]/g, '_')
}

// --- Notification History ---

const NOTIFICATIONS_KEY = 'notifications:history'
const MAX_NOTIFICATIONS = 50

export const getNotificationHistory = async (): Promise<AppNotification[]> => {
  const data = await redis.lrange(NOTIFICATIONS_KEY, 0, MAX_NOTIFICATIONS - 1)
  return (data ?? []) as unknown as AppNotification[]
}

export const addNotifications = async (
  notifications: AppNotification[]
): Promise<void> => {
  if (notifications.length === 0) return
  const pipeline = redis.pipeline()
  // Push newest first
  for (const notif of notifications) {
    pipeline.lpush(NOTIFICATIONS_KEY, notif)
  }
  // Trim to keep only the latest N
  pipeline.ltrim(NOTIFICATIONS_KEY, 0, MAX_NOTIFICATIONS - 1)
  await pipeline.exec()
}

export default redis
