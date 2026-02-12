import { Redis } from '@upstash/redis'
import type {
  Property,
  PushSubscriptionRecord,
  AppNotification,
  FilterSettings,
  LivabilityScore,
} from './types'
import { DEFAULT_FILTERS } from './types'

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

// --- Filter Settings ---

const FILTERS_KEY = 'settings:filters'

export const getFilterSettings = async (): Promise<FilterSettings> => {
  const data = await redis.get<FilterSettings>(FILTERS_KEY)
  return data ?? DEFAULT_FILTERS
}

export const setFilterSettings = async (
  filters: FilterSettings
): Promise<void> => {
  await redis.set(FILTERS_KEY, filters)
}

// --- Livability Scores ---

const SCORE_KEY_PREFIX = 'score:'
const SCORE_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

export const getCachedScore = async (
  propertyId: number
): Promise<LivabilityScore | null> => {
  return redis.get<LivabilityScore>(`${SCORE_KEY_PREFIX}${propertyId}`)
}

export const getCachedScores = async (
  propertyIds: number[]
): Promise<Map<number, LivabilityScore>> => {
  if (propertyIds.length === 0) return new Map()

  const pipeline = redis.pipeline()
  for (const id of propertyIds) {
    pipeline.get(`${SCORE_KEY_PREFIX}${id}`)
  }

  const results = await pipeline.exec()
  const scoreMap = new Map<number, LivabilityScore>()

  for (let i = 0; i < propertyIds.length; i++) {
    const score = results[i] as LivabilityScore | null
    if (score) {
      scoreMap.set(propertyIds[i], score)
    }
  }

  return scoreMap
}

export const setCachedScore = async (
  score: LivabilityScore
): Promise<void> => {
  await redis.set(
    `${SCORE_KEY_PREFIX}${score.propertyId}`,
    score,
    { ex: SCORE_TTL_SECONDS }
  )
}

export default redis
