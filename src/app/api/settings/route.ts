import { NextResponse } from 'next/server'
import {
  getFilterSettings,
  setFilterSettings,
  syncKnownPropertyIds,
  setCachedListings,
  setLastPollTimestamp,
} from '@/lib/redis'
import { fetchProperties } from '@/lib/ehousing'
import type { FilterSettings } from '@/lib/types'

export const GET = async (): Promise<NextResponse> => {
  try {
    const filters = await getFilterSettings()
    return NextResponse.json(filters)
  } catch (error) {
    console.error('Settings fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export const POST = async (request: Request): Promise<NextResponse> => {
  try {
    const filters = (await request.json()) as FilterSettings

    // Validate required fields
    if (!filters.wards || filters.wards.length === 0) {
      return NextResponse.json(
        { error: 'At least one ward must be selected' },
        { status: 400 }
      )
    }

    // Save new filter settings
    await setFilterSettings(filters)

    // Clear known property IDs since the search changed
    // This prevents a flood of notifications on the next poll
    await syncKnownPropertyIds([])

    // Run an immediate fresh poll with the new filters
    const { properties } = await fetchProperties()

    // Seed the known IDs with current results (no notifications)
    const currentIds = properties.map((p) => p.id)
    await syncKnownPropertyIds(currentIds)
    await setCachedListings(properties)
    await setLastPollTimestamp(new Date().toISOString())

    return NextResponse.json({
      success: true,
      filters,
      listings: properties,
      count: properties.length,
    })
  } catch (error) {
    console.error('Settings save error:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
