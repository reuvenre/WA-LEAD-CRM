import { CLIENT_PROFILES } from './projects'
import type { ClientProfile } from './types'

// ---------------------------------------------------------------------------
// Secondary-market (resale) apartment listings — for small brokerage offices.
// Pulled in production from Yad2 / Madlan (NOT the nadlan new-construction
// skill, which is for projects only). Ships as a seed dataset so the module is
// fully usable offline. This makes the suite fit BOTH developers (Projects /
// new construction) and brokerages (Listings / resale).
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
  size_sqm: number
  price: number
  parking: boolean
  elevator: boolean
  balcony: boolean
  renovated: boolean
  entry: string            // "מיידי" / date
  status: ListingStatus
  agent: string
  source: 'Yad2' | 'Madlan' | 'CRM (ידני)'
}

export const LISTINGS: Listing[] = [
  { id: 'l1', title: 'דירת 4 חד׳ משופצת', type: 'דירה', city: 'תל אביב', neighborhood: 'הצפון הישן', street: 'ז׳בוטינסקי 24', rooms: 4, floor: 3, size_sqm: 98, price: 4350000, parking: true, elevator: true, balcony: true, renovated: true, entry: 'מיידי', status: 'פעיל', agent: 'שרה לוי', source: 'Yad2' },
  { id: 'l2', title: 'דירת גן עם חצר', type: 'דירת גן', city: 'רמת גן', neighborhood: 'מרום נווה', street: 'הרא״ה 12', rooms: 5, floor: 0, size_sqm: 130, price: 5200000, parking: true, elevator: false, balcony: false, renovated: false, entry: '01/09/2026', status: 'פעיל', agent: 'דוד ביטון', source: 'Madlan' },
  { id: 'l3', title: 'פנטהאוז עם נוף לים', type: 'פנטהאוז', city: 'נתניה', neighborhood: 'עיר ימים', street: 'דרך הים 8', rooms: 5, floor: 18, size_sqm: 160, price: 6800000, parking: true, elevator: true, balcony: true, renovated: true, entry: 'מיידי', status: 'פעיל', agent: 'שרה לוי', source: 'Yad2' },
  { id: 'l4', title: 'דירת 3 חד׳ למשקיעים', type: 'דירה', city: 'באר שבע', neighborhood: 'רמות', street: 'רינגלבלום 40', rooms: 3, floor: 2, size_sqm: 72, price: 1280000, parking: false, elevator: true, balcony: true, renovated: false, entry: 'מיידי', status: 'פעיל', agent: 'מירי אזולאי', source: 'Yad2' },
  { id: 'l5', title: 'דופלקס 5 חד׳', type: 'דופלקס', city: 'הרצליה', neighborhood: 'הרצליה פיתוח', street: 'הנדיב 30', rooms: 5, floor: 4, size_sqm: 175, price: 7900000, parking: true, elevator: true, balcony: true, renovated: true, entry: '15/10/2026', status: 'בהמתנה', agent: 'דוד ביטון', source: 'Madlan' },
  { id: 'l6', title: 'דירת 4 חד׳ קומה גבוהה', type: 'דירה', city: 'פתח תקווה', neighborhood: 'כפר גנים', street: 'איינשטיין 5', rooms: 4, floor: 9, size_sqm: 105, price: 2750000, parking: true, elevator: true, balcony: true, renovated: false, entry: 'מיידי', status: 'פעיל', agent: 'אבי פרץ', source: 'Yad2' },
  { id: 'l7', title: 'בית פרטי 6 חד׳', type: 'בית פרטי', city: 'ראשון לציון', neighborhood: 'נחלת יהודה', street: 'הרצל 102', rooms: 6, floor: 0, size_sqm: 220, price: 6400000, parking: true, elevator: false, balcony: false, renovated: true, entry: 'מיידי', status: 'פעיל', agent: 'דוד ביטון', source: 'Madlan' },
  { id: 'l8', title: 'מיני פנטהאוז מרכז העיר', type: 'מיני פנטהאוז', city: 'תל אביב', neighborhood: 'לב תל אביב', street: 'בוגרשוב 14', rooms: 4, floor: 6, size_sqm: 115, price: 5950000, parking: false, elevator: true, balcony: true, renovated: true, entry: 'מיידי', status: 'פעיל', agent: 'שרה לוי', source: 'Yad2' },
  { id: 'l9', title: 'דירת 3 חד׳ משופצת', type: 'דירה', city: 'ירושלים', neighborhood: 'הר חומה', street: 'הרב עוזיאל 22', rooms: 3, floor: 1, size_sqm: 78, price: 2150000, parking: true, elevator: true, balcony: true, renovated: true, entry: 'מיידי', status: 'נמכר', agent: 'מירי אזולאי', source: 'Yad2' },
  { id: 'l10', title: 'דירת 5 חד׳ עם מרפסת ענקית', type: 'דירה', city: 'רעננה', neighborhood: 'מרכז', street: 'אחוזה 80', rooms: 5, floor: 5, size_sqm: 135, price: 4900000, parking: true, elevator: true, balcony: true, renovated: false, entry: '01/12/2026', status: 'פעיל', agent: 'אבי פרץ', source: 'Madlan' },
  { id: 'l11', title: 'דירת גג 4 חד׳', type: 'דירת גג', city: 'חיפה', neighborhood: 'כרמל', street: 'מוריה 55', rooms: 4, floor: 7, size_sqm: 120, price: 2980000, parking: true, elevator: true, balcony: true, renovated: true, entry: 'מיידי', status: 'פעיל', agent: 'מירי אזולאי', source: 'Yad2' },
  { id: 'l12', title: 'דירת 4 חד׳ חדשה', type: 'דירה', city: 'כפר סבא', neighborhood: 'הדרים', street: 'ויצמן 18', rooms: 4, floor: 3, size_sqm: 100, price: 3450000, parking: true, elevator: true, balcony: true, renovated: true, entry: 'מיידי', status: 'פעיל', agent: 'דוד ביטון', source: 'Yad2' },
  { id: 'l13', title: 'דירת 2 חד׳ להשקעה', type: 'דירה', city: 'באר שבע', neighborhood: 'העיר העתיקה', street: 'הרצל 8', rooms: 2, floor: 1, size_sqm: 48, price: 720000, parking: false, elevator: false, balcony: false, renovated: false, entry: 'מיידי', status: 'פעיל', agent: 'מירי אזולאי', source: 'Madlan' },
  { id: 'l14', title: 'דירת גן 4 חד׳', type: 'דירת גן', city: 'נתניה', neighborhood: 'אגמים', street: 'ניצן 6', rooms: 4, floor: 0, size_sqm: 110, price: 3650000, parking: true, elevator: true, balcony: false, renovated: true, entry: 'מיידי', status: 'בהמתנה', agent: 'שרה לוי', source: 'Yad2' },
  { id: 'l15', title: 'פנטהאוז יוקרה', type: 'פנטהאוז', city: 'תל אביב', neighborhood: 'נווה צדק', street: 'שבזי 4', rooms: 5, floor: 8, size_sqm: 200, price: 14800000, parking: true, elevator: true, balcony: true, renovated: true, entry: 'מיידי', status: 'פעיל', agent: 'שרה לוי', source: 'Madlan' },
  { id: 'l16', title: 'דירת 4 חד׳ מרווחת', type: 'דירה', city: 'חולון', neighborhood: 'ק. שרת', street: 'קדמן 9', rooms: 4, floor: 4, size_sqm: 95, price: 2580000, parking: true, elevator: true, balcony: true, renovated: false, entry: 'מיידי', status: 'פעיל', agent: 'אבי פרץ', source: 'Yad2' },
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function fetchListings(filters: { city?: string; rooms?: number | null; type?: string; maxPrice?: number | null }): Promise<Listing[]> {
  await sleep(1300)
  return LISTINGS.filter(l => {
    if (filters.city && filters.city !== 'הכל' && l.city !== filters.city) return false
    if (filters.rooms && l.rooms !== filters.rooms) return false
    if (filters.type && filters.type !== 'הכל' && l.type !== filters.type) return false
    if (filters.maxPrice && l.price > filters.maxPrice) return false
    return true
  })
}

let seq = LISTINGS.length
export function addListing(l: Omit<Listing, 'id'>): Listing {
  const rec: Listing = { id: 'l' + (++seq) + '_' + Math.round(performance.now()), ...l }
  LISTINGS.unshift(rec)
  return rec
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
