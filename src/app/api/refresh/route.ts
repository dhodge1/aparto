import { NextResponse } from 'next/server'
import { fetchProperties } from '@/lib/ehousing'
import {
  syncKnownPropertyIds,
  setCachedListings,
  setLastPollTimestamp,
  getNotificationHistory,
} from '@/lib/redis'

/**
 * Manual refresh endpoint - triggered by pull-to-refresh.
 * Fetches fresh data from e-housing and updates Redis cache,
 * but does NOT send push notifications (those only come from
 * the scheduled QStash poll to avoid duplicate alerts).
 */
export const POST = async (): Promise<NextResponse> => {
  const timestamp = new Date().toISOString()

  try {
    const { properties } = await fetchProperties()

    // Update Redis cache
    const currentIds = properties.map((p) => p.id)
    await syncKnownPropertyIds(currentIds)
    await setCachedListings(properties)
    await setLastPollTimestamp(timestamp)

    // Return fresh data including notification history
    const notifications = await getNotificationHistory()

    return NextResponse.json({
      listings: properties,
      lastPoll: timestamp,
      notifications,
      count: properties.length,
    })
  } catch (error) {
    console.error('[refresh] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 500 }
    )
  }
}
