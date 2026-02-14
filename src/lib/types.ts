export type TrainLine = {
  id: number
  name: string
  name_langs: Record<string, string>
  image: string
  image_url: string
}

export type TrainStation = {
  id: number
  name: string
  name_langs: Record<string, string>
  trainLines: TrainLine[]
  meta_data: {
    pivot_rent_property_id: number
    pivot_train_station_id: number
    pivot_walking_distance_minutes: number
  }
}

export type Ward = {
  id: number
  slug: string
  featured_image_url: string | null
  images_url: string[]
  rent_property_counts: number
}

export type Prefecture = {
  id: number
  slug: string
}

export type Property = {
  id: number
  name: string
  name_langs: Record<string, string>
  address: string
  address_langs: Record<string, string>
  obscured_address: string
  obscured_address_langs: Record<string, string>
  blurred_feature_image: string | null
  floor_plan_images: string[]
  featured_image: string
  images: string[]
  bed_rooms: number
  size_sqm: number
  layout: string
  status: number
  latitude: number
  longitude: number
  key_money: number
  security_deposit: number
  rent_amount: number
  slug: string
  room_number: string
  watermark_status: number
  ward_id: number
  prefecture_id: number
  property_tag_id: number | null
  created_at: string
  ward: Ward
  prefecture: Prefecture
  propertyTag: unknown
  trainStations: TrainStation[]
  is_favorite: boolean
  is_selected: boolean
  featured_image_url: string
  blurred_feature_image_url: string | null
  images_url: string[]
}

export type PropertiesMeta = {
  total: number
  per_page: number
  current_page: number
  last_page: number
  first_page: number
  first_page_url: string
  last_page_url: string
  next_page_url: string | null
  previous_page_url: string | null
}

export type PollResult = {
  success: boolean
  timestamp: string
  totalListings: number
  newListings: number
  newProperties: Property[]
  error?: string
}

export type AppNotification = {
  id: string
  propertyId: number
  propertyName: string
  rentAmount: number
  sizeSqm: number
  bedRooms: number
  layout: string
  nearestStation: string
  walkingMinutes: number
  slug: string
  roomNumber: string
  prefectureSlug: string
  wardSlug: string
  timestamp: string
}

export type PushSubscriptionRecord = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  createdAt: string
}

export type FilterSettings = {
  wards: number[]
  wardNames: string[]
  stations: number[]
  stationNames: string[]
  priceFrom: number
  priceTo: number
  areaFrom: number
  areaTo: string
  walkingDistanceTo: number
  features: number[]
  bedRooms?: number
}

export type LivabilityScore = {
  propertyId: number
  overall: number
  station: number
  supermarkets: number
  restaurants: number
  convenience: number
  parks: number
  counts: {
    supermarkets: number
    restaurants: number
    convenience: number
    parks: number
    nearestStationMinutes: number
  }
  computedAt: string
}

export type CommuteInfo = {
  propertyId: number
  durationMinutes: number
  durationText: string
  transferCount: number
  computedAt: string
}

export const DEFAULT_FILTERS: FilterSettings = {
  wards: [1, 2, 4, 5, 9],
  wardNames: [
    'Minato Ward',
    'Shibuya Ward',
    'Meguro Ward',
    'Setagaya Ward',
    'Shinagawa Ward',
  ],
  stations: [],
  stationNames: [],
  priceFrom: 0,
  priceTo: 260000,
  areaFrom: 45,
  areaTo: '100+',
  walkingDistanceTo: 12,
  features: [18],
}
