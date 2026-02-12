import type { LivabilityScore } from './types'
import { getCachedScore, setCachedScore } from './redis'

// Primary and fallback Overpass API instances
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const RATE_LIMIT_DELAY_MS = 2000
const MAX_RETRIES = 3

// --- Scoring weights ---

const WEIGHTS = {
  station: 0.25,
  supermarkets: 0.25,
  restaurants: 0.2,
  convenience: 0.15,
  parks: 0.15,
}

// --- Scoring scales ---

const scoreStation = (walkingMinutes: number): number => {
  if (walkingMinutes <= 3) return 10
  if (walkingMinutes <= 5) return 8
  if (walkingMinutes <= 8) return 6
  if (walkingMinutes <= 12) return 4
  if (walkingMinutes <= 15) return 2
  return 1
}

const scoreSupermarkets = (count: number): number => {
  if (count === 0) return 0
  if (count === 1) return 4
  if (count === 2) return 6
  if (count === 3) return 8
  return 10
}

const scoreRestaurants = (count: number): number => {
  if (count === 0) return 0
  if (count <= 5) return 3
  if (count <= 15) return 5
  if (count <= 30) return 7
  if (count <= 50) return 8
  return 10
}

const scoreConvenience = (count: number): number => {
  if (count === 0) return 0
  if (count === 1) return 4
  if (count === 2) return 7
  return 10
}

const scoreParks = (count: number): number => {
  if (count === 0) return 0
  if (count === 1) return 5
  if (count === 2) return 7
  return 10
}

// --- Overpass API ---

type AmenityCounts = {
  supermarkets: number
  restaurants: number
  convenience: number
  parks: number
}

/**
 * Queries the Overpass API for all amenity types around a point in a single request.
 * Returns counts per type.
 */
const fetchAmenityCounts = async (
  lat: number,
  lng: number
): Promise<AmenityCounts> => {
  const query = `[out:json][timeout:15];
(
  node[shop=supermarket](around:500,${lat},${lng});
  node[amenity=restaurant](around:500,${lat},${lng});
  node[shop=convenience](around:300,${lat},${lng});
  way[leisure=park](around:500,${lat},${lng});
  node[leisure=park](around:500,${lat},${lng});
);
out tags;`

  let lastError: Error | null = null

  // Try each server, with retries on the primary
  for (const serverUrl of OVERPASS_SERVERS) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = 3000 * Math.pow(2, attempt - 1)
        console.log(
          `[livability] Retry ${attempt}/${MAX_RETRIES} on ${serverUrl.split('/')[2]} after ${backoff}ms`
        )
        await new Promise((r) => setTimeout(r, backoff))
      }

      try {
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        })

        if (response.status === 429) {
          lastError = new Error(`Rate limited (429) on ${serverUrl.split('/')[2]}`)
          if (attempt === MAX_RETRIES - 1) break // Try next server
          continue
        }

        if (!response.ok) {
          lastError = new Error(`Overpass error ${response.status} on ${serverUrl.split('/')[2]}`)
          break // Try next server
        }

        const data = await response.json()
        const elements = data.elements as Array<{
          type: string
          tags?: Record<string, string>
        }>

        const counts: AmenityCounts = {
          supermarkets: 0,
          restaurants: 0,
          convenience: 0,
          parks: 0,
        }

        for (const el of elements) {
          const tags = el.tags ?? {}
          if (tags.shop === 'supermarket') counts.supermarkets++
          else if (tags.amenity === 'restaurant') counts.restaurants++
          else if (tags.shop === 'convenience') counts.convenience++
          else if (tags.leisure === 'park') counts.parks++
        }

        return counts
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        break // Network error, try next server
      }
    }

    console.log(`[livability] Falling back from ${serverUrl.split('/')[2]}`)
  }

  throw lastError ?? new Error('All Overpass servers failed')
}

// --- Score computation ---

type PropertyInput = {
  id: number
  latitude: number
  longitude: number
  nearestStationMinutes: number
}

/**
 * Computes the livability score for a single property.
 * Checks Redis cache first; if not cached, queries Overpass and caches the result.
 */
export const computeScore = async (
  property: PropertyInput
): Promise<LivabilityScore> => {
  // Check cache first
  const cached = await getCachedScore(property.id)
  if (cached) return cached

  // Fetch amenity counts from Overpass
  const counts = await fetchAmenityCounts(
    property.latitude,
    property.longitude
  )

  // Calculate component scores
  const stationScore = scoreStation(property.nearestStationMinutes)
  const supermarketsScore = scoreSupermarkets(counts.supermarkets)
  const restaurantsScore = scoreRestaurants(counts.restaurants)
  const convenienceScore = scoreConvenience(counts.convenience)
  const parksScore = scoreParks(counts.parks)

  // Weighted average
  const overall = Number(
    (
      stationScore * WEIGHTS.station +
      supermarketsScore * WEIGHTS.supermarkets +
      restaurantsScore * WEIGHTS.restaurants +
      convenienceScore * WEIGHTS.convenience +
      parksScore * WEIGHTS.parks
    ).toFixed(1)
  )

  const score: LivabilityScore = {
    propertyId: property.id,
    overall,
    station: stationScore,
    supermarkets: supermarketsScore,
    restaurants: restaurantsScore,
    convenience: convenienceScore,
    parks: parksScore,
    counts: {
      supermarkets: counts.supermarkets,
      restaurants: counts.restaurants,
      convenience: counts.convenience,
      parks: counts.parks,
      nearestStationMinutes: property.nearestStationMinutes,
    },
    computedAt: new Date().toISOString(),
  }

  // Cache the result
  await setCachedScore(score)

  return score
}

/**
 * Computes livability scores for multiple properties.
 * Processes sequentially with a rate limit delay to respect Overpass API limits.
 * Returns cached scores immediately, only queries Overpass for uncached ones.
 */
export const computeScores = async (
  properties: PropertyInput[]
): Promise<LivabilityScore[]> => {
  const scores: LivabilityScore[] = []

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i]

    try {
      const score = await computeScore(property)
      scores.push(score)
    } catch (error) {
      console.error(
        `[livability] Failed to compute score for property ${property.id}:`,
        error
      )
      // Return a zero score on error so the UI can still render
      scores.push({
        propertyId: property.id,
        overall: 0,
        station: 0,
        supermarkets: 0,
        restaurants: 0,
        convenience: 0,
        parks: 0,
        counts: {
          supermarkets: 0,
          restaurants: 0,
          convenience: 0,
          parks: 0,
          nearestStationMinutes: property.nearestStationMinutes,
        },
        computedAt: new Date().toISOString(),
      })
    }

    // Rate limit delay between Overpass API calls (skip for cached results)
    if (i < properties.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    }
  }

  return scores
}
