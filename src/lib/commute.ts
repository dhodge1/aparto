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

  // Use next weekday at 8:00 AM JST so transit is always available
  // (avoids "no route" errors during off-hours/weekends)
  const departureTime = getNextWeekdayMorning()

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
    departureTime,
  }

  console.log(`[commute] Request body: ${JSON.stringify(body)}`)

  // DEBUG: No field mask to see full response structure
  const response = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': '*',
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

  const rawJson = JSON.stringify(data)
  console.log(
    `[commute] API response for ${lat},${lng}: departureTime=${departureTime}, routes=${data.routes?.length ?? 0}, responseLength=${rawJson.length}, raw=${rawJson.substring(0, 2000)}`
  )

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

  // DEBUG: limit to first property only to conserve quota while debugging
  const debugLimit = 1
  const limited = properties.slice(0, debugLimit)

  for (let i = 0; i < limited.length; i++) {
    const property = limited[i]

    try {
      const commute = await computeCommute(property)
      commutes.push(commute)
    } catch (error) {
      console.error(
        `[commute] Failed for property ${property.id}:`,
        error
      )
      // Cache the failure with a short TTL to prevent quota burn on retries
      const errorPlaceholder: CommuteInfo = {
        propertyId: property.id,
        durationMinutes: 0,
        durationText: '',
        transferCount: 0,
        computedAt: new Date().toISOString(),
      }
      await setCachedCommute(errorPlaceholder)
      commutes.push(errorPlaceholder)
    }

    // Rate limit delay between API calls
    if (i < limited.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    }
  }

  return commutes
}

/**
 * Returns an ISO 8601 timestamp for the next weekday at 8:00 AM JST.
 * This ensures the Google Routes API always has transit service available
 * when computing routes, regardless of when the request is made.
 */
const getNextWeekdayMorning = (): string => {
  const now = new Date()

  // Convert to JST (UTC+9)
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(now.getTime() + jstOffset)

  // Start from tomorrow JST
  const target = new Date(jstNow)
  target.setUTCDate(target.getUTCDate() + 1)
  target.setUTCHours(8 - 9, 0, 0, 0) // 8 AM JST = 23:00 UTC previous day

  // Advance to next weekday if needed (0=Sun, 6=Sat)
  const day = target.getUTCDay()
  if (day === 0) target.setUTCDate(target.getUTCDate() + 1) // Sun -> Mon
  if (day === 6) target.setUTCDate(target.getUTCDate() + 2) // Sat -> Mon

  // If the target is in the past (shouldn't happen, but safety), add a week
  if (target.getTime() < now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 7)
  }

  return target.toISOString()
}
