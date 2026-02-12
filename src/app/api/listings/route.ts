import { NextResponse } from 'next/server'
import {
  getCachedListings,
  getLastPollTimestamp,
  getNotificationHistory,
  getFilterSettings,
} from '@/lib/redis'
import { buildSearchUrl } from '@/lib/ehousing'

export const GET = async (): Promise<NextResponse> => {
  try {
    const [listings, lastPoll, notifications, filters] = await Promise.all([
      getCachedListings(),
      getLastPollTimestamp(),
      getNotificationHistory(),
      getFilterSettings(),
    ])

    const searchUrl = buildSearchUrl(filters)

    return NextResponse.json({
      listings,
      lastPoll,
      notifications,
      count: listings.length,
      searchUrl,
    })
  } catch (error) {
    console.error('Listings fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    )
  }
}
