import type { FeasibilityResult, ScanResult } from './types'
import { api } from '@/lib/api'
import type { DealRow, PropertyRow } from '@/lib/api'

// ---------------------------------------------------------------------------
// Built-in data store. Returns records in the exact Airtable field shapes used
// across the app (e.g. 'Full Name', 'Status', 'Estimated Sales Value GDV'), so
// the app runs fully out of the box on seed data. Switching to live Airtable is
// a drop-in replacement of these functions (read keys via a serverless proxy —
// never expose the Airtable token in the browser). See README "Going live".
// ---------------------------------------------------------------------------

const MGR = 'recMGR001'
const A1 = 'recAGT001' // שרה לוי  (the sample Agent account)
const A2 = 'recAGT002'
const A3 = 'recAGT003'
const A4 = 'recAGT004'

// dates relative to "now" so countdowns stay realistic
const day = 86400000
const inDays = (n: number) => new Date(Date.now() + n * day).toISOString().split('T')[0]
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString()

export const AGENTS = [
  { id: MGR, 'Full Name': 'יעקב כהן', 'Role': 'Manager', 'Phone Number': '052-123-4567', 'Monthly Target': 0, 'Success Rate %': 0, 'Expected Commission': 0, 'Deals Count': 0 },
  { id: A1, 'Full Name': 'שרה לוי', 'Role': 'Agent', 'Phone Number': '052-765-4321', 'Monthly Target': 4200000, 'Success Rate %': 92, 'Expected Commission': 168000, 'Deals Count': 7 },
  { id: A2, 'Full Name': 'דוד ביטון', 'Role': 'Agent', 'Phone Number': '054-887-2210', 'Monthly Target': 3800000, 'Success Rate %': 78, 'Expected Commission': 121000, 'Deals Count': 5 },
  { id: A3, 'Full Name': 'מירי אזולאי', 'Role': 'Agent', 'Phone Number': '050-334-9981', 'Monthly Target': 3500000, 'Success Rate %': 64, 'Expected Commission': 96000, 'Deals Count': 4 },
  { id: A4, 'Full Name': 'אבי פרץ', 'Role': 'Agent', 'Phone Number': '053-228-7745', 'Monthly Target': 3000000, 'Success Rate %': 41, 'Expected Commission': 54000, 'Deals Count': 2 },
]

export const DEALS: any[] = [
  { id: 'd1', 'Project Name': 'מגדלי הצמרת', 'Block & Parcel': 'גוש 6638 / חלקה 142', 'Status': 'Active', 'Estimated Sales Value GDV': 184000000, 'Expected Margin %': 22.4, 'Risk Alert': false, 'Agent Assigned': [A1] },
  { id: 'd2', 'Project Name': 'פרויקט נווה צדק 12', 'Block & Parcel': 'גוש 7045 / חלקה 88', 'Status': 'Underwriting', 'Estimated Sales Value GDV': 96500000, 'Expected Margin %': 16.8, 'Risk Alert': false, 'Agent Assigned': [A1] },
  { id: 'd3', 'Project Name': 'מתחם הרכבת רמת גן', 'Block & Parcel': 'גוש 6159 / חלקה 301', 'Status': 'Active', 'Estimated Sales Value GDV': 142000000, 'Expected Margin %': 19.1, 'Risk Alert': false, 'Agent Assigned': [A1, A2] },
  { id: 'd4', 'Project Name': 'פינוי בינוי שכונת יד אליהו', 'Block & Parcel': 'גוש 7110 / חלקה 5', 'Status': 'Scouting', 'Estimated Sales Value GDV': 310000000, 'Expected Margin %': 13.2, 'Risk Alert': true, 'Agent Assigned': [A1] },
  { id: 'd5', 'Project Name': 'וילות הים נתניה', 'Block & Parcel': 'גוש 8254 / חלקה 19', 'Status': 'Active', 'Estimated Sales Value GDV': 58000000, 'Expected Margin %': 24.7, 'Risk Alert': false, 'Agent Assigned': [A2] },
  { id: 'd6', 'Project Name': 'מגורי יוקרה הרצליה פיתוח', 'Block & Parcel': 'גוש 6541 / חלקה 77', 'Status': 'Closed', 'Estimated Sales Value GDV': 225000000, 'Expected Margin %': 26.0, 'Risk Alert': false, 'Agent Assigned': [A1] },
  { id: 'd7', 'Project Name': 'תמ"א 38 דיזנגוף 210', 'Block & Parcel': 'גוש 6905 / חלקה 33', 'Status': 'Underwriting', 'Estimated Sales Value GDV': 44000000, 'Expected Margin %': 14.5, 'Risk Alert': true, 'Agent Assigned': [A3] },
  { id: 'd8', 'Project Name': 'קריית המדע ראשון לציון', 'Block & Parcel': 'גוש 3928 / חלקה 410', 'Status': 'Active', 'Estimated Sales Value GDV': 167000000, 'Expected Margin %': 20.3, 'Risk Alert': false, 'Agent Assigned': [A2] },
  { id: 'd9', 'Project Name': 'מתחם הבורסה פתח תקווה', 'Block & Parcel': 'גוש 6388 / חלקה 256', 'Status': 'Scouting', 'Estimated Sales Value GDV': 78000000, 'Expected Margin %': 17.9, 'Risk Alert': false, 'Agent Assigned': [A3] },
  { id: 'd10', 'Project Name': 'גני תקווה Residence', 'Block & Parcel': 'גוש 6720 / חלקה 144', 'Status': 'Rejected', 'Estimated Sales Value GDV': 39000000, 'Expected Margin %': 9.4, 'Risk Alert': true, 'Agent Assigned': [A4] },
  { id: 'd11', 'Project Name': 'מגדל אלון רעננה', 'Block & Parcel': 'גוש 7650 / חלקה 62', 'Status': 'Active', 'Estimated Sales Value GDV': 119000000, 'Expected Margin %': 21.0, 'Risk Alert': false, 'Agent Assigned': [A4] },
  { id: 'd12', 'Project Name': 'פרויקט המושבה כפר סבא', 'Block & Parcel': 'גוש 7602 / חלקה 9', 'Status': 'Closed', 'Estimated Sales Value GDV': 88000000, 'Expected Margin %': 23.3, 'Risk Alert': false, 'Agent Assigned': [A2] },
]

export const PROPERTIES: any[] = [
  { id: 'p1', 'Property Title': 'פנטהאוז רוטשילד 45', 'Address & City': 'רוטשילד 45, תל אביב', 'Price Requested': 14500000, 'Status': 'Active', 'Exclusivity End Date': inDays(3), 'Agent Assigned': [A1] },
  { id: 'p2', 'Property Title': 'דירת גן הרצליה פיתוח', 'Address & City': 'הנדיב 8, הרצליה', 'Price Requested': 9200000, 'Status': 'Active', 'Exclusivity End Date': inDays(5), 'Agent Assigned': [A1] },
  { id: 'p3', 'Property Title': 'מיני פנטהאוז כיכר המדינה', 'Address & City': 'ה׳ באייר 12, תל אביב', 'Price Requested': 11800000, 'Status': 'Active', 'Exclusivity End Date': inDays(21), 'Agent Assigned': [A1] },
  { id: 'p4', 'Property Title': 'דופלקס רמת אביב ג', 'Address & City': 'איינשטיין 40, תל אביב', 'Price Requested': 7600000, 'Status': 'Pending', 'Exclusivity End Date': inDays(12), 'Agent Assigned': [A2] },
  { id: 'p5', 'Property Title': 'בית פרטי סביון', 'Address & City': 'הגליל 3, סביון', 'Price Requested': 18900000, 'Status': 'Active', 'Exclusivity End Date': inDays(2), 'Agent Assigned': [A2] },
  { id: 'p6', 'Property Title': 'דירת 5 חדרים רעננה', 'Address & City': 'אחוזה 112, רעננה', 'Price Requested': 4350000, 'Status': 'Expired', 'Exclusivity End Date': inDays(-4), 'Agent Assigned': [A3] },
  { id: 'p7', 'Property Title': 'מיני פנטהאוז נווה צדק', 'Address & City': 'שבזי 21, תל אביב', 'Price Requested': 8900000, 'Status': 'Active', 'Exclusivity End Date': inDays(34), 'Agent Assigned': [A1] },
  { id: 'p8', 'Property Title': 'דירת 4 חדרים פתח תקווה', 'Address & City': 'ההגנה 9, פתח תקווה', 'Price Requested': 2980000, 'Status': 'Active', 'Exclusivity End Date': inDays(6), 'Agent Assigned': [A3] },
  { id: 'p9', 'Property Title': 'נכס מסחרי דיזנגוף סנטר', 'Address & City': 'דיזנגוף 50, תל אביב', 'Price Requested': 22000000, 'Status': 'Cancelled', 'Exclusivity End Date': inDays(-15), 'Agent Assigned': [A4] },
  { id: 'p10', 'Property Title': 'וילה קיסריה', 'Address & City': 'הדקל 7, קיסריה', 'Price Requested': 16400000, 'Status': 'Active', 'Exclusivity End Date': inDays(48), 'Agent Assigned': [A2] },
]

let WHATSAPP: any[] = [
  { id: 'm1', 'Recipient Name': 'אורי מזרחי', 'Phone Number': '050-111-2233', 'Message Text': 'שלום, ראיתי את הפנטהאוז ברוטשילד. אפשר לקבוע סיור?', 'Direction': 'Inbound', 'API Channel Type': 'Unofficial', 'Delivery Status': 'Read', 'Timestamp': hoursAgo(5) },
  { id: 'm2', 'Recipient Name': 'אורי מזרחי', 'Phone Number': '050-111-2233', 'Message Text': 'בוודאי! מחר ב-17:00 מתאים לך? אשלח מיקום מדויק.', 'Direction': 'Outbound', 'API Channel Type': 'Unofficial', 'Delivery Status': 'Read', 'Timestamp': hoursAgo(4.8) },
  { id: 'm3', 'Recipient Name': 'אורי מזרחי', 'Phone Number': '050-111-2233', 'Message Text': '[WHISPER]לקוח חם — תקציב עד 15M, מימון מאושר מבנק לאומי', 'Direction': 'Outbound', 'API Channel Type': 'Unofficial', 'Delivery Status': 'Sent', 'Timestamp': hoursAgo(4.7) },
  { id: 'm4', 'Recipient Name': 'אורי מזרחי', 'Phone Number': '050-111-2233', 'Message Text': 'מעולה, נתראה מחר. תודה שרה!', 'Direction': 'Inbound', 'API Channel Type': 'Unofficial', 'Delivery Status': 'Read', 'Timestamp': hoursAgo(4.5) },
  { id: 'm5', 'Recipient Name': 'תמר גולן', 'Phone Number': '054-998-1100', 'Message Text': 'היי, האם דירת הגן בהרצליה עדיין זמינה?', 'Direction': 'Inbound', 'API Channel Type': 'Official', 'Delivery Status': 'Read', 'Timestamp': hoursAgo(2.2) },
  { id: 'm6', 'Recipient Name': 'תמר גולן', 'Phone Number': '054-998-1100', 'Message Text': 'כן, זמינה! המחיר 9.2M. רוצה שאשלח לך מצגת ותוכניות?', 'Direction': 'Outbound', 'API Channel Type': 'Official', 'Delivery Status': 'Delivered', 'Timestamp': hoursAgo(2) },
  { id: 'm7', 'Recipient Name': 'יוסי לוגסי', 'Phone Number': '052-440-7788', 'Message Text': 'קיבלתי את החוזה לחתימה, אעבור עליו עם עוה"ד היום.', 'Direction': 'Inbound', 'API Channel Type': 'Unofficial', 'Delivery Status': 'Read', 'Timestamp': hoursAgo(1.1) },
  { id: 'm8', 'Recipient Name': 'יוסי לוגסי', 'Phone Number': '052-440-7788', 'Message Text': 'מצוין. אני זמינה לכל שאלה. נדבר אחר הצהריים 🙏', 'Direction': 'Outbound', 'API Channel Type': 'Unofficial', 'Delivery Status': 'Delivered', 'Timestamp': hoursAgo(0.9) },
]

export interface Investor { id: string; name: string; phone: string; equity: number; zones: string; risk: 'Low' | 'Medium' | 'High' }
export const INVESTORS: Investor[] = [
  { id: 'i1', name: 'קרן הראל נדל"ן', phone: '03-555-1200', equity: 45000000, zones: 'מרכז, שרון', risk: 'Medium' },
  { id: 'i2', name: 'משפחת אדלר', phone: '052-700-1199', equity: 18000000, zones: 'תל אביב', risk: 'Low' },
  { id: 'i3', name: 'גלובל אינווסט', phone: '03-612-8800', equity: 120000000, zones: 'ארצי', risk: 'High' },
]

// 12-month revenue trend (closed deal value, ₪M) for the dashboard
export const REVENUE_TREND = [
  { month: 'יול', value: 24 }, { month: 'אוג', value: 31 }, { month: 'ספט', value: 28 },
  { month: 'אוק', value: 42 }, { month: 'נוב', value: 38 }, { month: 'דצמ', value: 55 },
  { month: 'ינו', value: 47 }, { month: 'פבר', value: 61 }, { month: 'מרץ', value: 58 },
  { month: 'אפר', value: 72 }, { month: 'מאי', value: 69 }, { month: 'יונ', value: 84 },
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
// Always return a fresh array so callers never alias (and mutate) the store.
const scoped = (rows: any[], rec?: string) =>
  !rec ? [...rows] : rows.filter(r => (r['Agent Assigned'] || []).includes(rec))

// ---- Data API — backed by the CRM backend (tenant-scoped) -----------------
// Records are returned in the Airtable-shaped form the UI components expect.
const mapDeal = (d: DealRow) => ({
  id: d.id,
  'Project Name': d.projectName,
  'Block & Parcel': d.blockParcel || '',
  'Status': d.status,
  'Estimated Sales Value GDV': d.gdv,
  'Expected Margin %': d.expectedMargin,
  'Risk Alert': d.riskAlert,
})
const mapProp = (p: PropertyRow) => ({
  id: p.id,
  'Property Title': p.title,
  'Address & City': p.addressCity || '',
  'Price Requested': p.priceRequested,
  'Status': p.status,
  'Exclusivity End Date': p.exclusivityEndDate || '',
})

export async function getAgents() { await sleep(250); return [...AGENTS] }
export async function getDeals(_rec?: string) {
  const rows = await api.realestate.deals.list()
  return rows.map(mapDeal)
}
export async function getProperties(_rec?: string) {
  const rows = await api.realestate.properties.list()
  return rows.map(mapProp)
}
export async function getExpiringProperties() {
  await sleep(200)
  return PROPERTIES.filter(p => {
    const d = Math.ceil((new Date(p['Exclusivity End Date']).getTime() - Date.now()) / day)
    return d >= 0 && d <= 7 && p['Status'] === 'Active'
  })
}
export async function getWhatsAppMessages() { await sleep(250); return [...WHATSAPP] }
export async function createWhatsAppMessage(fields: Record<string, any>) {
  const rec = { id: 'm' + (WHATSAPP.length + 1) + '_' + Math.round(performance.now()), ...fields }
  WHATSAPP.push(rec)
  return rec
}
// busy-day baseline so the daily counter is meaningful against the 2,000 cap
const DAILY_BASELINE = 1240
export async function getDailyMessageCount() {
  await sleep(150)
  const today = new Date().toISOString().split('T')[0]
  return WHATSAPP.filter(m => m['Direction'] === 'Outbound' && (m['Timestamp'] || '').startsWith(today)).length + DAILY_BASELINE
}

// ---- Mutations (persisted via the backend) --------------------------------
export async function addDeal(fields: Record<string, any>, _agentRecordId?: string) {
  const created = await api.realestate.deals.create({
    projectName: fields['Project Name'],
    blockParcel: fields['Block & Parcel'] || null,
    status: fields['Status'],
    gdv: fields['Estimated Sales Value GDV'] || 0,
    expectedMargin: fields['Expected Margin %'] || 0,
    riskAlert: !!fields['Risk Alert'],
  })
  return mapDeal(created)
}

export async function addProperty(fields: Record<string, any>, _agentRecordId?: string) {
  const created = await api.realestate.properties.create({
    title: fields['Property Title'],
    addressCity: fields['Address & City'] || null,
    priceRequested: fields['Price Requested'] || 0,
    status: fields['Status'],
    exclusivityEndDate: fields['Exclusivity End Date'] || null,
  })
  return mapProp(created)
}

export async function updateProperty(id: string, fields: Record<string, any>) {
  const updated = await api.realestate.properties.update(id, {
    title: fields['Property Title'],
    addressCity: fields['Address & City'] || null,
    priceRequested: fields['Price Requested'] || 0,
    status: fields['Status'],
    exclusivityEndDate: fields['Exclusivity End Date'] || null,
  })
  return mapProp(updated)
}

// ---- Meetings (calendar; syncs to Google Calendar in production) ----------
export interface Meeting {
  id: string
  title: string
  client: string
  date: string   // YYYY-MM-DD
  time: string   // HH:MM
  location: string
  type: 'סיור נכס' | 'פגישת לקוח' | 'חתימת חוזה' | 'אחר'
  googleSynced: boolean
}
const MEETINGS: Meeting[] = [
  { id: 'mt1', title: 'סיור בפנטהאוז רוטשילד', client: 'אורי מזרחי', date: inDays(0), time: '17:00', location: 'רוטשילד 45, תל אביב', type: 'סיור נכס', googleSynced: true },
  { id: 'mt2', title: 'חתימת חוזה בלעדיות', client: 'יוסי לוגסי', date: inDays(1), time: '11:30', location: 'משרד ראשי', type: 'חתימת חוזה', googleSynced: true },
  { id: 'mt3', title: 'פגישת ייעוץ — דירת גן', client: 'תמר גולן', date: inDays(2), time: '09:00', location: 'הנדיב 8, הרצליה', type: 'פגישת לקוח', googleSynced: false },
  { id: 'mt4', title: 'הצגת פרויקט נווה צדק', client: 'דנה שטרן', date: inDays(4), time: '16:00', location: 'שבזי 21, תל אביב', type: 'פגישת לקוח', googleSynced: false },
]
let meetSeq = MEETINGS.length
export async function getMeetings() { await sleep(200); return [...MEETINGS].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) }
export async function addMeeting(m: Omit<Meeting, 'id'>) {
  await sleep(150)
  const rec: Meeting = { id: 'mt' + (++meetSeq), ...m }
  MEETINGS.push(rec)
  return rec
}

// ---- Make.com / Gemini equivalents (simulated AI) -------------------------
const CITY_PRICE: Record<string, number> = {
  'תל אביב': 62000, 'הרצליה': 55000, 'רמת גן': 48000, 'רעננה': 45000, 'כפר סבא': 41000,
  'ירושלים': 42000, 'פתח תקווה': 38000, 'ראשון לציון': 37000, 'נתניה': 35000,
  'חיפה': 28000, 'באר שבע': 22000,
}

export async function getFeasibilityReport(payload: { city: string; block: string; parcel: string; sqm: number }): Promise<FeasibilityResult> {
  await sleep(1700) // emulate Gemini Flash round-trip via Make.com
  const sqm = Math.max(1, payload.sqm)
  const pricePerSqm = CITY_PRICE[payload.city.trim()] ?? 35000
  // pseudo-deterministic build ratio from parcel digits → 2.0–2.7
  const seed = Number((payload.parcel || '0').replace(/\D/g, '')) || 1
  const buildRatio = 2.0 + ((seed % 8) / 10)
  const maxBuilt = Math.round(sqm * buildRatio)
  const sellable = maxBuilt * 0.82
  const gdv = Math.round(sellable * pricePerSqm)
  const construction = Math.round(maxBuilt * 8700)
  const land = Math.round(gdv * 0.34)
  const soft = Math.round(construction * 0.16)
  const totalCost = construction + land + soft
  const margin = +(((gdv - totalCost) / gdv) * 100).toFixed(1)
  const go = margin >= 18
  const risk = margin >= 22 ? 'Low' : margin >= 16 ? 'Medium' : 'High'
  return {
    max_built_area_sqm: maxBuilt,
    price_per_sqm_estimate: pricePerSqm,
    gdv_total: gdv,
    construction_cost_estimate: construction,
    developer_margin_pct: margin,
    go_no_go: go ? 'GO' : 'NO-GO',
    risk_level: risk,
    notes: go
      ? `הפרויקט ב${payload.city || 'מיקום זה'} (גוש ${payload.block}/חלקה ${payload.parcel}) מציג היתכנות כלכלית חיובית. יחס בנייה משוער ${buildRatio.toFixed(1)}, מרווח יזמי ${margin}% מעל סף ה-18%. מומלץ להתקדם לבדיקת זכויות מפורטת מול הוועדה המקומית.`
      : `מרווח יזמי של ${margin}% נמוך מסף הכדאיות (18%). עלות הקרקע המוערכת (₪${(land / 1e6).toFixed(1)}M) גבוהה ביחס ל-GDV. מומלץ לנהל מו"מ על מחיר הקרקע או לבחון תמהיל יח"ד צפוף יותר.`,
  }
}

export async function scanDocument(): Promise<ScanResult> {
  await sleep(2200) // emulate Gemini Vision OCR via Make.com
  return {
    documentType: 'הסכם בלעדיות',
    signaturesDetected: true,
    ocrStatus: 'Success',
    extracted: [
      { label: 'שם המוכר', value: 'אורי מזרחי' },
      { label: 'כתובת הנכס', value: 'רוטשילד 45, תל אביב' },
      { label: 'תקופת בלעדיות', value: '90 ימים' },
      { label: 'עמלת תיווך', value: '2% + מע"מ' },
      { label: 'תאריך חתימה', value: new Date().toLocaleDateString('he-IL') },
    ],
  }
}
