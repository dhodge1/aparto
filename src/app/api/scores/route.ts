import { NextRequest, NextResponse } from 'next/server'
import { computeScores } from '@/lib/livability'
import { getCachedScores } from '@/lib/redis'

/**
 * GET /api/scores?properties=id:lat:lng:walkMin,id:lat:lng:walkMin,...
 *
 * Accepts a comma-separated list of property descriptors (id:latitude:longitude:nearestStationMinutes).
 * Returns livability scores for each, computing and caching any that are missing.
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
      const [id, lat, lng, walkMin] = entry.split(':')
      return {
        id: parseInt(id),
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        nearestStationMinutes: parseInt(walkMin) || 15,
      }
    })

    if (propertyInputs.some((p) => isNaN(p.id) || isNaN(p.latitude))) {
      return NextResponse.json(
        { error: 'Invalid property format' },
        { status: 400 }
      )
    }

    // Check which scores are already cached
    const propertyIds = propertyInputs.map((p) => p.id)
    const cachedScores = await getCachedScores(propertyIds)

    // Find uncached properties
    const uncachedInputs = propertyInputs.filter(
      (p) => !cachedScores.has(p.id)
    )

    console.log(
      `[scores] ${cachedScores.size} cached, ${uncachedInputs.length} to compute`
    )

    // Compute missing scores
    const newScores =
      uncachedInputs.length > 0 ? await computeScores(uncachedInputs) : []

    // Merge cached and new scores
    const allScores = Object.fromEntries([
      ...Array.from(cachedScores.entries()).map(([id, score]) => [
        String(id),
        score,
      ]),
      ...newScores.map((score) => [String(score.propertyId), score]),
    ])

    return NextResponse.json({
      scores: allScores,
      cached: cachedScores.size,
      computed: newScores.length,
    })
  } catch (error) {
    console.error('[scores] Error:', error)
    return NextResponse.json(
      { error: 'Failed to compute scores' },
      { status: 500 }
    )
  }
}
