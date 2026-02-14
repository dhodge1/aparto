import { NextRequest, NextResponse } from 'next/server'
import { computeCommutes } from '@/lib/commute'
import { getCachedCommutes } from '@/lib/redis'

/**
 * GET /api/commute?properties=id:lat:lng,id:lat:lng,...
 *
 * Returns commute info (duration + transfers) for each property.
 * Cached results are returned immediately; only uncached properties
 * trigger Google Routes API calls.
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const propertiesParam = request.nextUrl.searchParams.get('properties')
    if (!propertiesParam) {
      return NextResponse.json(
        { error: 'Missing properties parameter' },
        { status: 400 }
      )
    }

    // Parse property descriptors
    const propertyInputs = propertiesParam.split(',').map((entry) => {
      const [id, lat, lng] = entry.split(':')
      return {
        id: parseInt(id),
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      }
    })

    if (propertyInputs.some((p) => isNaN(p.id) || isNaN(p.latitude))) {
      return NextResponse.json(
        { error: 'Invalid property format' },
        { status: 400 }
      )
    }

    // Check which commutes are already cached
    const propertyIds = propertyInputs.map((p) => p.id)
    const cachedCommutes = await getCachedCommutes(propertyIds)

    // Find uncached properties
    const uncachedInputs = propertyInputs.filter(
      (p) => !cachedCommutes.has(p.id)
    )

    console.log(
      `[commute] ${cachedCommutes.size} cached, ${uncachedInputs.length} to compute`
    )

    // Compute missing commutes
    const newCommutes =
      uncachedInputs.length > 0 ? await computeCommutes(uncachedInputs) : []

    // Merge cached and new
    const allCommutes = Object.fromEntries([
      ...Array.from(cachedCommutes.entries()).map(([id, commute]) => [
        String(id),
        commute,
      ]),
      ...newCommutes.map((commute) => [String(commute.propertyId), commute]),
    ])

    return NextResponse.json({
      commutes: allCommutes,
      cached: cachedCommutes.size,
      computed: newCommutes.length,
    })
  } catch (error) {
    console.error('[commute] Error:', error)
    return NextResponse.json(
      { error: 'Failed to compute commutes' },
      { status: 500 }
    )
  }
}
