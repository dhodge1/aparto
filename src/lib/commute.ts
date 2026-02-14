import type { CommuteInfo } from './types'
import { getCachedCommute, setCachedCommute } from './redis'

const ROUTES_API_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes'

// Nishimachi International School
// 2 Chome-14-7 Motoazabu, Minato City, Tokyo 106-0046
const DESTINATION = {
  latitude: 35.6528,
  longitude: 139.7286,
}

const RATE_LIMIT_DELAY_MS = 200

type PropertyInput = {
  id: number
  latitude: number
  longitude: number
}

type RoutesApiResponse = {
  routes?: Array<{
    duration?: string // e.g. "1920s" (seconds)
    legs?: Array<{
      steps?: Array<{
        transitDetails?: {
          stopDetails?: {
            departureStop?: { name?: string }
            arrivalStop?: { name?: string }
          }
          transitLine?: {
            name?: string
          }
        }
      }>
    }>
  }>
}

/**
 * Calls the Google Routes API to compute a transit route
 * from the property to Nishimachi International School.
 */
const fetchCommuteFromGoogle = async (
  lat: number,
  lng: number
): Promise<{ durationMinutes: number; transferCount: number }> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured')
  }

  const body = {
    origin: {
      location: {
        latLng: { latitude: lat, longitude: lng },
      },
    },
    destination: {
      location: {
        latLng: DESTINATION,
      },
    },
    travelMode: 'TRANSIT',
    computeAlternativeRoutes: false,
  }

  const response = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'routes.duration,routes.legs.steps.transitDetails',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Google Routes API error ${response.status}: ${errorText.substring(0, 200)}`
    )
  }

  const data = (await response.json()) as RoutesApiResponse

  const route = data.routes?.[0]
  if (!route) {
    throw new Error('No route found')
  }

  // Parse duration - comes as "1920s" (seconds string)
  const durationStr = route.duration ?? '0s'
  const durationSeconds = parseInt(durationStr.replace('s', '')) || 0
  const durationMinutes = Math.round(durationSeconds / 60)

  // Count transfers: each step with transitDetails is a transit leg.
  // Number of transfers = number of transit legs - 1 (first leg isn't a transfer).
  const steps = route.legs?.[0]?.steps ?? []
  const transitLegs = steps.filter((step) => step.transitDetails)
  const transferCount = Math.max(0, transitLegs.length - 1)

  return { durationMinutes, transferCount }
}

/**
 * Computes commute info for a single property.
 * Checks Redis cache first; if not cached, queries Google Routes API.
 */
export const computeCommute = async (
  property: PropertyInput
): Promise<CommuteInfo> => {
  // Check cache first
  const cached = await getCachedCommute(property.id)
  if (cached) return cached

  const { durationMinutes, transferCount } = await fetchCommuteFromGoogle(
    property.latitude,
    property.longitude
  )

  const commute: CommuteInfo = {
    propertyId: property.id,
    durationMinutes,
    durationText: `${durationMinutes} min`,
    transferCount,
    computedAt: new Date().toISOString(),
  }

  await setCachedCommute(commute)
  return commute
}

/**
 * Computes commute info for multiple properties.
 * Processes sequentially with rate limiting.
 * Returns cached results immediately, only queries Google for uncached ones.
 */
export const computeCommutes = async (
  properties: PropertyInput[]
): Promise<CommuteInfo[]> => {
  const commutes: CommuteInfo[] = []

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i]

    try {
      const commute = await computeCommute(property)
      commutes.push(commute)
    } catch (error) {
      console.error(
        `[commute] Failed for property ${property.id}:`,
        error
      )
      // Return a placeholder on error so the UI can still render
      commutes.push({
        propertyId: property.id,
        durationMinutes: 0,
        durationText: '',
        transferCount: 0,
        computedAt: new Date().toISOString(),
      })
    }

    // Rate limit delay between API calls
    if (i < properties.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    }
  }

  return commutes
}
