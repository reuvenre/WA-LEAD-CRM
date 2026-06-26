import type { Project, ClientProfile } from './types'
import { ISRAELI_CITIES } from './cities'
import { api } from '@/lib/api'
import type { REProjectRow, REClientRow } from '@/lib/api'

// ---------------------------------------------------------------------------
// New-construction projects + buyer profiles, persisted in the CRM backend
// (tenant-scoped). The module-level caches below are hydrated from the API via
// loadProjects()/loadClients(); the match helpers read those caches. In
// production the project list can also be populated by the nadlan fetcher.
// ---------------------------------------------------------------------------

export const PROJECTS: Project[] = []
export const CLIENT_PROFILES: ClientProfile[] = []

const mapProject = (r: REProjectRow): Project => ({
  id: r.id,
  project_name: r.projectName,
  developer: r.developer || 'לא ידוע',
  city: r.city || '',
  neighborhood: r.neighborhood || '',
  address: r.address || '',
  status: r.status as Project['status'],
  expected_delivery: r.expectedDelivery || '',
  delivery_earliest: r.deliveryEarliest || '',
  delivery_latest: r.deliveryLatest || '',
  total_units: r.totalUnits,
  available_units: r.availableUnits == null ? 'לא ידוע' : r.availableUnits,
  unit_types: r.unitTypes || [],
  price_min: r.priceMin,
  price_max: r.priceMax,
  amenities: r.amenities || [],
  urban_renewal: r.urbanRenewal,
  urban_renewal_type: r.urbanRenewalType || undefined,
  sales_office: r.salesOffice || 'לא ידוע',
  source: r.source,
  source_tier: r.sourceTier as Project['source_tier'],
})

const mapClient = (r: REClientRow): ClientProfile => ({
  id: r.id, name: r.name, phone: r.phone || '', city: r.city || '',
  rooms: r.rooms, budgetMax: r.budgetMax, deliveryBy: r.deliveryBy || '',
})

export async function loadProjects(): Promise<Project[]> {
  const rows = await api.realestate.projects.list()
  PROJECTS.length = 0
  PROJECTS.push(...rows.map(mapProject))
  return PROJECTS
}

export async function loadClients(): Promise<ClientProfile[]> {
  const rows = await api.realestate.clients.list()
  CLIENT_PROFILES.length = 0
  CLIENT_PROFILES.push(...rows.map(mapClient))
  return CLIENT_PROFILES
}

// quarter string "YYYY-Qn" → comparable integer
const qNum = (q: string) => {
  const m = q.match(/(\d{4})-Q(\d)/)
  return m ? Number(m[1]) * 4 + Number(m[2]) : 99999
}

// Reload from the backend, then apply the local filters.
export async function fetchProjects(filters: {
  city?: string
  status?: 'all' | 'existing' | 'future'
  rooms?: number | null
  budgetMax?: number | null
}): Promise<Project[]> {
  await loadProjects()
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
  score: number
  cityMatch: boolean
  roomsMatch: boolean
  budgetMatch: boolean
  timelineMatch: boolean
  star: boolean
  listPriceWarning: boolean
}

// Step 5: match projects to a client profile (reads the hydrated cache).
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

// ---- Mutations (persisted via the backend) --------------------------------
export async function addProject(p: Omit<Project, 'id'>): Promise<Project> {
  const created = await api.realestate.projects.create({
    projectName: p.project_name, developer: p.developer, city: p.city,
    neighborhood: p.neighborhood, address: p.address, status: p.status,
    expectedDelivery: p.expected_delivery, deliveryEarliest: p.delivery_earliest,
    deliveryLatest: p.delivery_latest, totalUnits: p.total_units,
    availableUnits: p.available_units === 'לא ידוע' ? null : p.available_units,
    unitTypes: p.unit_types, priceMin: p.price_min, priceMax: p.price_max,
    amenities: p.amenities, urbanRenewal: p.urban_renewal,
    urbanRenewalType: p.urban_renewal_type ?? null, salesOffice: p.sales_office,
    source: p.source, sourceTier: p.source_tier,
  })
  const mapped = mapProject(created)
  PROJECTS.unshift(mapped)
  return mapped
}

export async function updateProject(id: string, p: Omit<Project, 'id'>): Promise<Project> {
  const updated = await api.realestate.projects.update(id, {
    projectName: p.project_name, developer: p.developer, city: p.city,
    neighborhood: p.neighborhood, address: p.address, status: p.status,
    expectedDelivery: p.expected_delivery, deliveryEarliest: p.delivery_earliest,
    deliveryLatest: p.delivery_latest, totalUnits: p.total_units,
    availableUnits: p.available_units === 'לא ידוע' ? null : p.available_units,
    unitTypes: p.unit_types, priceMin: p.price_min, priceMax: p.price_max,
    amenities: p.amenities, urbanRenewal: p.urban_renewal,
    urbanRenewalType: p.urban_renewal_type ?? null, salesOffice: p.sales_office,
    source: p.source, sourceTier: p.source_tier,
  })
  const mapped = mapProject(updated)
  const i = PROJECTS.findIndex(x => x.id === id)
  if (i >= 0) PROJECTS[i] = mapped
  return mapped
}

export async function addClient(c: Omit<ClientProfile, 'id'>): Promise<ClientProfile> {
  const created = await api.realestate.clients.create({
    name: c.name, phone: c.phone, city: c.city, rooms: c.rooms,
    budgetMax: c.budgetMax, deliveryBy: c.deliveryBy,
  })
  const mapped = mapClient(created)
  CLIENT_PROFILES.push(mapped)
  return mapped
}

export async function updateClient(id: string, c: Omit<ClientProfile, 'id'>): Promise<ClientProfile> {
  const updated = await api.realestate.clients.update(id, {
    name: c.name, phone: c.phone, city: c.city, rooms: c.rooms,
    budgetMax: c.budgetMax, deliveryBy: c.deliveryBy,
  })
  const mapped = mapClient(updated)
  const i = CLIENT_PROFILES.findIndex(x => x.id === id)
  if (i >= 0) CLIENT_PROFILES[i] = mapped
  return mapped
}

export async function deleteClient(id: string): Promise<void> {
  await api.realestate.clients.remove(id)
  const i = CLIENT_PROFILES.findIndex(x => x.id === id)
  if (i >= 0) CLIENT_PROFILES.splice(i, 1)
}
