import { NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { fetchProperties } from '@/lib/ehousing'
import {
  getKnownPropertyIds,
  syncKnownPropertyIds,
  setCachedListings,
  setLastPollTimestamp,
} from '@/lib/redis'
import { notifyNewProperties } from '@/lib/push'
import type { PollResult } from '@/lib/types'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
})

export const POST = async (request: Request): Promise<NextResponse> => {
  // Verify the request came from QStash (skip in development)
  if (process.env.NODE_ENV === 'production') {
    try {
      const signature = request.headers.get('upstash-signature')
      if (!signature) {
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 401 }
        )
      }

      const body = await request.text()
      const isValid = await receiver.verify({
        signature,
        body,
      })

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      )
    }
  }

  const timestamp = new Date().toISOString()

  try {
    // 1. Fetch current listings from e-housing.jp
    console.log(`[poll] Starting poll at ${timestamp}`)
    const { properties, meta } = await fetchProperties()
    console.log(
      `[poll] Fetched ${properties.length} properties (total: ${meta?.total ?? 'unknown'})`
    )

    // 2. Get known property IDs from Redis
    const knownIds = await getKnownPropertyIds()
    console.log(`[poll] Known IDs in Redis: ${knownIds.size}`)

    // 3. Find new properties
    const newProperties = properties.filter((p) => !knownIds.has(p.id))
    console.log(`[poll] New properties found: ${newProperties.length}`)

    // 4. Send push notifications for new properties
    if (newProperties.length > 0 && knownIds.size > 0) {
      // Only notify if we had previous data (skip first poll)
      const notifications = await notifyNewProperties(newProperties)
      console.log(`[poll] Sent ${notifications.length} notifications`)
    } else if (knownIds.size === 0) {
      console.log('[poll] First poll - seeding known IDs without notifications')
    }

    // 5. Update Redis with current state
    const currentIds = properties.map((p) => p.id)
    await syncKnownPropertyIds(currentIds)
    await setCachedListings(properties)
    await setLastPollTimestamp(timestamp)

    const result: PollResult = {
      success: true,
      timestamp,
      totalListings: properties.length,
      newListings: newProperties.length,
      newProperties: newProperties,
    }

    console.log(`[poll] Completed successfully`)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[poll] Error:', error)

    const result: PollResult = {
      success: false,
      timestamp,
      totalListings: 0,
      newListings: 0,
      newProperties: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }

    return NextResponse.json(result, { status: 500 })
  }
}
