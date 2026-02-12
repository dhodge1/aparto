import * as cheerio from 'cheerio'
import type { Property, PropertiesMeta, FilterSettings } from './types'
import { DEFAULT_FILTERS } from './types'
import { getFilterSettings } from './redis'

// Bounding box for the Tokyo metro area
const LOCATION_POINTS = [
  '139.43616821481683,35.482771620001955',
  '139.43616821481683,35.80585431502774',
  '140.01432367508613,35.80585431502774',
  '140.01432367508613,35.482771620001955',
]

/**
 * Builds the e-housing.jp search URL from filter settings.
 */
export const buildSearchUrl = (filters: FilterSettings): string => {
  const params = new URLSearchParams()

  params.set('wards', filters.wards.join(','))
  params.set('price_from', String(filters.priceFrom))
  params.set('price_to', String(filters.priceTo))
  params.set('wname', filters.wardNames.join(','))

  if (filters.features.length > 0) {
    params.set('features', filters.features.join(','))
  }

  params.set('area_from', String(filters.areaFrom))
  params.set('area_to', String(filters.areaTo))
  params.set('walking_distance_to', String(filters.walkingDistanceTo))

  if (filters.bedRooms !== undefined) {
    params.set('bed_rooms', String(filters.bedRooms))
  }

  if (filters.stations.length > 0) {
    params.set('station', filters.stations.join(','))
    params.set('sname', filters.stationNames.join(','))
  }

  for (const point of LOCATION_POINTS) {
    params.append('location_point', point)
  }

  return `https://e-housing.jp/rent?${params.toString()}`
}

export type EHousingResult = {
  properties: Property[]
  meta: PropertiesMeta | null
}

/**
 * Fetches the e-housing.jp search page and extracts property data
 * from the Next.js RSC flight payload embedded in the HTML.
 * Reads filter settings from Redis to build the search URL dynamically.
 */
export const fetchProperties = async (): Promise<EHousingResult> => {
  let filters: FilterSettings
  try {
    filters = await getFilterSettings()
  } catch {
    filters = DEFAULT_FILTERS
  }

  const searchUrl = buildSearchUrl(filters)
  console.log(`[ehousing] Fetching: ${searchUrl.substring(0, 100)}...`)

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch e-housing: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()
  return parseRscPayload(html)
}

/**
 * Parses the RSC flight data from the HTML to extract the properties array
 * and pagination metadata.
 *
 * e-housing.jp is a Next.js App Router site. The property data is embedded
 * in `self.__next_f.push()` script calls within the HTML. We concatenate
 * all the payloads, then find the JSON for "properties" and "propertiesMeta".
 */
const parseRscPayload = (html: string): EHousingResult => {
  const $ = cheerio.load(html)
  const rscChunks: string[] = []

  $('script').each((_, el) => {
    const text = $(el).text()
    if (text.includes('self.__next_f')) {
      rscChunks.push(text)
    }
  })

  if (rscChunks.length === 0) {
    throw new Error('No RSC flight data found in HTML')
  }

  // Concatenate all RSC chunks into one string
  const combined = rscChunks.join('')

  // Extract properties array
  const properties = extractProperties(combined)
  const meta = extractMeta(combined)

  return { properties, meta }
}

/**
 * Extracts the properties array from the RSC payload string.
 * The data is deeply escaped in the RSC format, so we look for the
 * "properties" key and parse the JSON array that follows.
 */
const extractProperties = (rscPayload: string): Property[] => {
  // Check for empty properties array first (0 results)
  const emptyMarker = '\\"properties\\":[]'
  if (rscPayload.includes(emptyMarker)) {
    console.log('[ehousing] Properties array is empty (0 results)')
    return []
  }

  // The properties data in RSC is escaped with \" notation
  const marker = '\\"properties\\":[{'

  const startIdx = rscPayload.indexOf(marker)
  if (startIdx === -1) {
    // Could be a different empty format or missing entirely
    console.warn('[ehousing] Could not find properties array in RSC payload')
    return []
  }

  // Find the start of the array (after "properties":)
  const arrayStartIdx = rscPayload.indexOf('[{', startIdx)
  if (arrayStartIdx === -1) {
    throw new Error('Could not find properties array start')
  }

  // We need to find the matching closing bracket for this array.
  // The data is escaped JSON, so we need to track bracket depth.
  const arrayJson = extractBalancedArray(rscPayload, arrayStartIdx)

  // Unescape the RSC string escaping
  const unescaped = arrayJson
    .replace(/\\\\"/g, '__ESCAPED_QUOTE__')
    .replace(/\\"/g, '"')
    .replace(/__ESCAPED_QUOTE__/g, '\\"')
    .replace(/\\\\n/g, '\\n')
    .replace(/\\\\t/g, '\\t')

  try {
    return JSON.parse(unescaped) as Property[]
  } catch (e) {
    // Fallback: try a more aggressive approach
    return extractPropertiesFallback(rscPayload)
  }
}

/**
 * Fallback extraction: find individual property objects by looking for
 * the "id":NUMBER,"name" pattern and extracting each one.
 */
const extractPropertiesFallback = (rscPayload: string): Property[] => {
  const properties: Property[] = []

  // Find the properties section
  const marker = '\\"properties\\":[{'
  const startIdx = rscPayload.indexOf(marker)
  if (startIdx === -1) return []

  // Get a very large chunk starting from properties
  const chunk = rscPayload.substring(startIdx, startIdx + 500000)

  // Unescape the full chunk
  const unescaped = chunk
    .replace(/\\\\"/g, '__ESCAPED_QUOTE__')
    .replace(/\\"/g, '"')
    .replace(/__ESCAPED_QUOTE__/g, '\\"')
    .replace(/\\\\n/g, '\\n')
    .replace(/\\\\t/g, '\\t')

  // Find the array portion
  const arrayStart = unescaped.indexOf('[{')
  if (arrayStart === -1) return []

  const arrayContent = extractBalancedArray(unescaped, arrayStart)

  try {
    return JSON.parse(arrayContent) as Property[]
  } catch {
    console.error('Fallback property parsing also failed')
    return []
  }
}

/**
 * Extracts a balanced JSON array starting at the given index.
 * Tracks bracket depth to find the matching closing bracket.
 */
const extractBalancedArray = (str: string, startIdx: number): string => {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = startIdx; i < str.length; i++) {
    const char = str[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '[') depth++
    if (char === ']') {
      depth--
      if (depth === 0) {
        return str.substring(startIdx, i + 1)
      }
    }
  }

  // If we didn't find matching bracket, return a reasonable chunk
  throw new Error('Could not find matching bracket for properties array')
}

/**
 * Extracts the propertiesMeta pagination object from the RSC payload.
 */
const extractMeta = (rscPayload: string): PropertiesMeta | null => {
  const marker = '\\"propertiesMeta\\":'
  const startIdx = rscPayload.indexOf(marker)
  if (startIdx === -1) return null

  const objStart = rscPayload.indexOf('{', startIdx + marker.length)
  if (objStart === -1) return null

  // Find the matching closing brace
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = objStart; i < rscPayload.length; i++) {
    const char = rscPayload[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) {
        const raw = rscPayload.substring(objStart, i + 1)
        const unescaped = raw
          .replace(/\\\\"/g, '__ESCAPED_QUOTE__')
          .replace(/\\"/g, '"')
          .replace(/__ESCAPED_QUOTE__/g, '\\"')

        try {
          return JSON.parse(unescaped) as PropertiesMeta
        } catch {
          return null
        }
      }
    }
  }

  return null
}

/**
 * Builds the e-housing.jp URL for a specific property listing.
 */
export const buildPropertyUrl = (
  prefectureSlug: string,
  wardSlug: string,
  slug: string,
  roomNumber: string
): string => {
  return `https://e-housing.jp/rent/${prefectureSlug}/${wardSlug}/${slug}/${roomNumber}`
}
