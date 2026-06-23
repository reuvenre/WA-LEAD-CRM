import type { Project, ClientProfile } from './types'
import { ISRAELI_CITIES } from './cities'

// ---------------------------------------------------------------------------
// Embeds the /nadlan-project-data-fetcher capability. In production this list
// is populated live by the skill (web_search/web_fetch over Yad2 / Madlan /
// Nadlan.gov.il / Rami, normalized to the Step-3 schema). Here it ships as a
// schema-faithful dataset so the CRM module is fully demoable offline.
// Prices are gross, incl. VAT 18%. source_tier follows the skill's priority.
// ---------------------------------------------------------------------------

export const PROJECTS: Project[] = [
  { id: 'pr1', project_name: 'מגדלי סביוני האלון', developer: 'אאורה ישראל', city: 'תל אביב', neighborhood: 'הצפון הישן', address: 'אבן גבירול 142', status: 'under_construction', expected_delivery: 'Q3 2027', delivery_earliest: '2027-Q1', delivery_latest: '2027-Q4', total_units: 184, available_units: 47, unit_types: [3, 4, 5], price_min: 3200000, price_max: 6800000, amenities: ['חניה', 'מחסן', 'לובי מפואר', 'חדר כושר', 'בריכה'], urban_renewal: false, sales_office: '03-555-7100', source: 'Madlan', source_tier: 3 },
  { id: 'pr2', project_name: 'פינוי בינוי יד אליהו', developer: 'אזורים', city: 'תל אביב', neighborhood: 'יד אליהו', address: 'לוחמי הגטאות 5', status: 'approved', expected_delivery: 'Q1 2029', delivery_earliest: '2029-Q1', delivery_latest: '2029-Q4', total_units: 420, available_units: 'לא ידוע', unit_types: [3, 4, 5], price_min: 2600000, price_max: 4900000, amenities: ['חניה תת-קרקעית', 'מחסן', 'גינה משותפת', 'מועדון דיירים'], urban_renewal: true, urban_renewal_type: 'פינוי-בינוי', sales_office: '03-621-0044', source: 'Israel Land Authority (Rami)', source_tier: 2 },
  { id: 'pr3', project_name: 'אקו פארק רחובות', developer: 'צמח המרמן', city: 'ראשון לציון', neighborhood: 'נחלת יהודה', address: 'הרצל 88', status: 'under_construction', expected_delivery: 'Q4 2026', delivery_earliest: '2026-Q1', delivery_latest: '2026-Q4', total_units: 96, available_units: 12, unit_types: [3, 4], price_min: 1980000, price_max: 2950000, amenities: ['חניה', 'מחסן', 'מרפסת שמש', 'לובי'], urban_renewal: false, sales_office: '03-948-2200', source: 'Yad2 New Projects', source_tier: 4 },
  { id: 'pr4', project_name: 'מגדלי הים הכחול', developer: 'חברת אלמוג', city: 'חיפה', neighborhood: 'בת גלים', address: 'שדרות הים 30', status: 'under_construction', expected_delivery: 'Q2 2027', delivery_earliest: '2027-Q1', delivery_latest: '2027-Q4', total_units: 240, available_units: 85, unit_types: [3, 4, 5], price_min: 1800000, price_max: 3200000, amenities: ['חניה', 'מחסן', 'לובי', 'גינה משותפת', 'נוף לים'], urban_renewal: false, sales_office: '04-851-9000', source: 'Yad2 New Projects', source_tier: 4 },
  { id: 'pr5', project_name: 'התחדשות הדר הכרמל', developer: 'רוטשטיין נדל"ן', city: 'חיפה', neighborhood: 'הדר', address: 'הרצל 55', status: 'planning', expected_delivery: 'Q3 2030', delivery_earliest: '2030-Q1', delivery_latest: '2030-Q4', total_units: 310, available_units: 'לא ידוע', unit_types: [2, 3, 4], price_min: null, price_max: null, amenities: ['חניה', 'מחסן', 'מעלית'], urban_renewal: true, urban_renewal_type: 'תמ״א 38', sales_office: 'לא ידוע', source: 'Israel Land Authority (Rami)', source_tier: 2 },
  { id: 'pr6', project_name: 'נווה זמר נתניה', developer: 'י.ח דמרי', city: 'נתניה', neighborhood: 'עיר ימים', address: 'ניצן 14', status: 'under_construction', expected_delivery: 'Q1 2027', delivery_earliest: '2027-Q1', delivery_latest: '2027-Q4', total_units: 158, available_units: 33, unit_types: [4, 5], price_min: 2450000, price_max: 4100000, amenities: ['חניה', 'מחסן', 'בריכה', 'חדר כושר', 'לובי', 'נוף לים'], urban_renewal: false, sales_office: '09-885-3300', source: 'Madlan', source_tier: 3 },
  { id: 'pr7', project_name: 'פסגות גנים', developer: 'אפריקה ישראל מגורים', city: 'פתח תקווה', neighborhood: 'כפר גנים ג', address: 'איינשטיין 9', status: 'under_construction', expected_delivery: 'Q4 2026', delivery_earliest: '2026-Q1', delivery_latest: '2026-Q4', total_units: 132, available_units: 8, unit_types: [3, 4, 5], price_min: 2150000, price_max: 3600000, amenities: ['חניה', 'מחסן', 'גינה', 'מועדון דיירים'], urban_renewal: false, sales_office: '03-912-7788', source: 'Yad2 New Projects', source_tier: 4 },
  { id: 'pr8', project_name: 'אורבן רמת הנשיא', developer: 'חנן מור', city: 'באר שבע', neighborhood: 'רמות', address: 'רינגלבלום 21', status: 'approved', expected_delivery: 'Q2 2028', delivery_earliest: '2028-Q1', delivery_latest: '2028-Q4', total_units: 200, available_units: 'לא ידוע', unit_types: [3, 4], price_min: 1280000, price_max: 1950000, amenities: ['חניה', 'מחסן', 'מרפסת'], urban_renewal: false, sales_office: '08-623-4455', source: 'Yad2 New Projects', source_tier: 4 },
  { id: 'pr9', project_name: 'התחדשות שכונה ד', developer: 'שיכון ובינוי', city: 'באר שבע', neighborhood: 'שכונה ד', address: 'הפלמ"ח 40', status: 'planning', expected_delivery: 'Q1 2031', delivery_earliest: '2031-Q1', delivery_latest: '2031-Q4', total_units: 540, available_units: 'לא ידוע', unit_types: [3, 4, 5], price_min: null, price_max: null, amenities: ['חניה', 'מחסן'], urban_renewal: true, urban_renewal_type: 'פינוי-בינוי', sales_office: 'לא ידוע', source: 'Israel Land Authority (Rami)', source_tier: 2 },
  { id: 'pr10', project_name: 'מגדלי הבירה', developer: 'גינדי החזקות', city: 'ירושלים', neighborhood: 'גבעת שאול', address: 'כנפי נשרים 15', status: 'under_construction', expected_delivery: 'Q3 2027', delivery_earliest: '2027-Q1', delivery_latest: '2027-Q4', total_units: 176, available_units: 54, unit_types: [3, 4, 5], price_min: 2350000, price_max: 4500000, amenities: ['חניה', 'מחסן', 'לובי', 'מרחב מוגן', 'מעלית שבת'], urban_renewal: false, sales_office: '02-654-1212', source: 'Madlan', source_tier: 3 },
  { id: 'pr11', project_name: 'נופי המושבה', developer: 'ב.יאיר', city: 'ראשון לציון', neighborhood: 'המערב החדש', address: 'משה דיין 120', status: 'under_construction', expected_delivery: 'Q2 2027', delivery_earliest: '2027-Q1', delivery_latest: '2027-Q4', total_units: 210, available_units: 61, unit_types: [3, 4, 5], price_min: 2280000, price_max: 3850000, amenities: ['חניה', 'מחסן', 'בריכה', 'לובי', 'גינה'], urban_renewal: false, sales_office: '03-941-6600', source: 'Yad2 New Projects', source_tier: 4 },
  { id: 'pr12', project_name: 'גני תקווה Heights', developer: 'אאורה ישראל', city: 'פתח תקווה', neighborhood: 'אם המושבות', address: 'ז׳בוטינסקי 155', status: 'completed', expected_delivery: 'הושלם 2025', delivery_earliest: '2025-Q1', delivery_latest: '2025-Q4', total_units: 144, available_units: 0, unit_types: [4, 5], price_min: 2600000, price_max: 4200000, amenities: ['חניה', 'מחסן', 'חדר כושר', 'לובי'], urban_renewal: false, sales_office: '03-933-1100', source: 'Nadlan.gov.il', source_tier: 1 },
  { id: 'pr13', project_name: 'מרינה ביץ׳ נתניה', developer: 'אזורים', city: 'נתניה', neighborhood: 'אגמים', address: 'דרך הים 5', status: 'approved', expected_delivery: 'Q4 2028', delivery_earliest: '2028-Q1', delivery_latest: '2028-Q4', total_units: 188, available_units: 'לא ידוע', unit_types: [4, 5], price_min: 3100000, price_max: 5400000, amenities: ['חניה', 'מחסן', 'בריכה', 'ספא', 'נוף לים', 'קונסיירז׳'], urban_renewal: false, sales_office: '09-771-2020', source: 'Madlan', source_tier: 3 },
  { id: 'pr14', project_name: 'לב העיר תל אביב', developer: 'רוטשטיין נדל"ן', city: 'תל אביב', neighborhood: 'לב תל אביב', address: 'בוגרשוב 28', status: 'under_construction', expected_delivery: 'Q1 2027', delivery_earliest: '2027-Q1', delivery_latest: '2027-Q4', total_units: 64, available_units: 9, unit_types: [2, 3, 4], price_min: 3800000, price_max: 7200000, amenities: ['חניה', 'מחסן', 'לובי', 'גג משותף'], urban_renewal: true, urban_renewal_type: 'תמ״א 38', sales_office: '03-529-8800', source: 'Yad2 New Projects', source_tier: 4 },
  { id: 'pr15', project_name: 'אופק ירושלים', developer: 'חנן מור', city: 'ירושלים', neighborhood: 'הר חומה', address: 'הרב עוזיאל 70', status: 'under_construction', expected_delivery: 'Q3 2026', delivery_earliest: '2026-Q1', delivery_latest: '2026-Q4', total_units: 220, available_units: 28, unit_types: [3, 4, 5], price_min: 1950000, price_max: 3400000, amenities: ['חניה', 'מחסן', 'מרחב מוגן', 'גינה', 'מעלית שבת'], urban_renewal: false, sales_office: '02-612-3434', source: 'Yad2 New Projects', source_tier: 4 },
  { id: 'pr16', project_name: 'פארק הנגב', developer: 'י.ח דמרי', city: 'באר שבע', neighborhood: 'הכלניות', address: 'שדרות התקווה 3', status: 'under_construction', expected_delivery: 'Q4 2026', delivery_earliest: '2026-Q1', delivery_latest: '2026-Q4', total_units: 168, available_units: 72, unit_types: [4, 5], price_min: 1380000, price_max: 2200000, amenities: ['חניה', 'מחסן', 'מרפסת', 'גינה'], urban_renewal: false, sales_office: '08-655-9090', source: 'Madlan', source_tier: 3 },
]

export const CLIENT_PROFILES: ClientProfile[] = [
  { id: 'c1', name: 'אורי מזרחי', phone: '050-111-2233', city: 'תל אביב', rooms: 4, budgetMax: 5000000, deliveryBy: '2027-Q4' },
  { id: 'c2', name: 'תמר גולן', phone: '054-998-1100', city: 'נתניה', rooms: 4, budgetMax: 3500000, deliveryBy: '2027-Q4' },
  { id: 'c3', name: 'משפחת לוגסי', phone: '052-440-7788', city: 'באר שבע', rooms: 5, budgetMax: 2000000, deliveryBy: '2027-Q1' },
  { id: 'c4', name: 'דנה שטרן', phone: '053-220-9090', city: 'ירושלים', rooms: 3, budgetMax: 3000000, deliveryBy: '2027-Q4' },
]

// quarter string "YYYY-Qn" → comparable integer
const qNum = (q: string) => {
  const m = q.match(/(\d{4})-Q(\d)/)
  return m ? Number(m[1]) * 4 + Number(m[2]) : 99999
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Simulates the skill's fetch+normalize pipeline (Step 1–3).
export async function fetchProjects(filters: {
  city?: string
  status?: 'all' | 'existing' | 'future'
  rooms?: number | null
  budgetMax?: number | null
}): Promise<Project[]> {
  await sleep(1400)
  return PROJECTS.filter(p => {
    if (filters.city && filters.city !== 'הכל' && p.city !== filters.city) return false
    if (filters.status === 'existing' && !['under_construction', 'completed'].includes(p.status)) return false
    if (filters.status === 'future' && !['approved', 'planning'].includes(p.status)) return false
    if (filters.rooms && !p.unit_types.includes(filters.rooms)) return false
    if (filters.budgetMax && p.price_min != null && p.price_min > filters.budgetMax) return false
    return true
  })
}

export interface MatchResult {
  project: Project
  score: number       // optional criteria met (0–3)
  cityMatch: boolean
  roomsMatch: boolean
  budgetMatch: boolean
  timelineMatch: boolean
  star: boolean       // 3+ criteria => ⭐
  listPriceWarning: boolean // source_tier >= 4 => ⚠️
}

// Step 5: match projects to a client profile.
export function matchClient(client: ClientProfile): MatchResult[] {
  return PROJECTS
    .filter(p => p.city === client.city)
    .map(p => {
      const roomsMatch = p.unit_types.includes(client.rooms)
      const budgetMatch = p.price_min != null && p.price_min <= client.budgetMax
      const timelineMatch = qNum(p.delivery_latest) <= qNum(client.deliveryBy)
      const score = [roomsMatch, budgetMatch, timelineMatch].filter(Boolean).length
      return {
        project: p, score, cityMatch: true, roomsMatch, budgetMatch, timelineMatch,
        star: score >= 3,
        listPriceWarning: p.source_tier >= 4,
      }
    })
    .sort((a, b) => b.score - a.score)
}

// All Israeli cities are selectable; 'הכל' (All) leads the filter list.
export const CITIES = ['הכל', ...ISRAELI_CITIES]

// ---- Mutations (manual create) --------------------------------------------
let projSeq = PROJECTS.length
export function addProject(p: Omit<Project, 'id'>): Project {
  const rec: Project = { id: 'pr' + (++projSeq) + '_' + Math.round(performance.now()), ...p }
  PROJECTS.unshift(rec)
  return rec
}

let clientSeq = CLIENT_PROFILES.length
export function addClient(c: Omit<ClientProfile, 'id'>): ClientProfile {
  const rec: ClientProfile = { id: 'c' + (++clientSeq) + '_' + Math.round(performance.now()), ...c }
  CLIENT_PROFILES.push(rec)
  return rec
}
