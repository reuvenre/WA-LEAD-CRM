import { CLIENT_PROFILES } from './projects'
import type { ClientProfile } from './types'
import { api } from '@/lib/api'
import type { ListingRow } from '@/lib/api'

// ---------------------------------------------------------------------------
// Secondary-market (resale) apartment listings — for brokerage offices.
// Persisted in the CRM backend (tenant-scoped). In production the list can be
// populated from Yad2 / Madlan; each row keeps a sourceUrl back to the
// original ad. The module cache is hydrated via loadListings().
// ---------------------------------------------------------------------------

export type ListingType = 'דירה' | 'דירת גן' | 'פנטהאוז' | 'מיני פנטהאוז' | 'דופלקס' | 'בית פרטי' | 'דירת גג'
export type ListingStatus = 'פעיל' | 'בהמתנה' | 'נמכר'

export interface Listing {
  id: string
  title: string
  type: ListingType
  city: string
  neighborhood: string
  street: string
  rooms: number
  floor: number
  total_floors: number   // total floors in the building ("קומה X מתוך Y")
  size_sqm: number
  price: number
  parking: boolean
  elevator: boolean
  balcony: boolean
  renovated: boolean
  entry: string
  status: ListingStatus
  agent: string
  listed_by: string      // פרטי | בתיווך
  source: 'Yad2' | 'Madlan' | 'CRM (ידני)'
  sourceUrl: string   // direct link to the original ad
}

export const LISTINGS: Listing[] = []

const mapListing = (r: ListingRow): Listing => ({
  id: r.id, title: r.title, type: r.type as ListingType,
  city: r.city || '', neighborhood: r.neighborhood || '', street: r.street || '',
  rooms: r.rooms, floor: r.floor, total_floors: r.totalFloors ?? 0, size_sqm: r.sizeSqm, price: r.price,
  parking: r.parking, elevator: r.elevator, balcony: r.balcony, renovated: r.renovated,
  entry: r.entry, status: r.status as ListingStatus, agent: r.agent || '', listed_by: r.listedBy || '',
  source: r.source as Listing['source'], sourceUrl: (r as any).sourceUrl || '',
})

const toRow = (l: Partial<Listing>) => ({
  title: l.title, type: l.type, city: l.city, neighborhood: l.neighborhood, street: l.street,
  rooms: l.rooms, floor: l.floor, totalFloors: l.total_floors, sizeSqm: l.size_sqm, price: l.price,
  parking: l.parking, elevator: l.elevator, balcony: l.balcony, renovated: l.renovated,
  entry: l.entry, status: l.status, agent: l.agent, listedBy: l.listed_by, source: l.source, sourceUrl: l.sourceUrl,
})

export async function loadListings(): Promise<Listing[]> {
  const rows = await api.realestate.listings.list()
  LISTINGS.length = 0
  LISTINGS.push(...rows.map(mapListing))
  return LISTINGS
}

// Pull matching listings from the sources (Yad2/Madlan) for a specific city,
// persist them, and refresh the cache. Returns the full listing set.
export async function searchListings(filters: { city: string; rooms?: number | null; type?: string | null; maxPrice?: number | null }): Promise<Listing[]> {
  const rows = await api.realestate.listings.search({
    city: filters.city,
    rooms: filters.rooms ?? null,
    type: filters.type && filters.type !== 'הכל' ? filters.type : null,
    maxPrice: filters.maxPrice ?? null,
  })
  LISTINGS.length = 0
  LISTINGS.push(...rows.map(mapListing))
  return LISTINGS
}

export async function fetchListings(filters: { city?: string; rooms?: number | null; type?: string; maxPrice?: number | null }): Promise<Listing[]> {
  await loadListings()
  return LISTINGS.filter(l => {
    if (filters.city && filters.city !== 'הכל' && l.city !== filters.city) return false
    if (filters.rooms && l.rooms !== filters.rooms) return false
    if (filters.type && filters.type !== 'הכל' && l.type !== filters.type) return false
    if (filters.maxPrice && l.price > filters.maxPrice) return false
    return true
  })
}

export async function addListing(l: Omit<Listing, 'id'>): Promise<Listing> {
  const created = await api.realestate.listings.create(toRow(l) as any)
  const mapped = mapListing(created)
  LISTINGS.unshift(mapped)
  return mapped
}

export async function updateListing(id: string, patch: Partial<Listing>): Promise<Listing> {
  const updated = await api.realestate.listings.update(id, toRow(patch) as any)
  const mapped = mapListing(updated)
  const i = LISTINGS.findIndex(x => x.id === id)
  if (i >= 0) LISTINGS[i] = mapped
  return mapped
}

// Match a buyer (client profile) to resale listings: city + rooms + budget.
export interface ListingMatch { listing: Listing; roomsMatch: boolean; budgetMatch: boolean; star: boolean }
export function matchListings(client: ClientProfile): ListingMatch[] {
  return LISTINGS
    .filter(l => l.city === client.city && l.status !== 'נמכר')
    .map(l => {
      const roomsMatch = l.rooms === client.rooms
      const budgetMatch = l.price <= client.budgetMax
      return { listing: l, roomsMatch, budgetMatch, star: roomsMatch && budgetMatch }
    })
    .sort((a, b) => Number(b.star) - Number(a.star))
}

export { CLIENT_PROFILES }
export const LISTING_TYPES: ListingType[] = ['דירה', 'דירת גן', 'פנטהאוז', 'מיני פנטהאוז', 'דופלקס', 'בית פרטי', 'דירת גג']
