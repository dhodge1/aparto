import { NextResponse } from 'next/server'
import {
  getCachedListings,
  getLastPollTimestamp,
  getNotificationHistory,
} from '@/lib/redis'

export const GET = async (): Promise<NextResponse> => {
  try {
    const [listings, lastPoll, notifications] = await Promise.all([
      getCachedListings(),
      getLastPollTimestamp(),
      getNotificationHistory(),
    ])

    return NextResponse.json({
      listings,
      lastPoll,
      notifications,
      count: listings.length,
    })
  } catch (error) {
    console.error('Listings fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    )
  }
}
