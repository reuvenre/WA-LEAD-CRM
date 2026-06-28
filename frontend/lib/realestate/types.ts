// Real-estate domain types (ported from the Real Estate Suite). Kept separate
// from the CRM's core types (Lead, Message, Tenant, User) to avoid collisions.

export interface FeasibilityResult {
  max_built_area_sqm: number
  price_per_sqm_estimate: number
  gdv_total: number
  construction_cost_estimate: number
  developer_margin_pct: number
  go_no_go: 'GO' | 'NO-GO'
  risk_level: 'Low' | 'Medium' | 'High'
  notes: string
}

export interface ScanResult {
  documentType: string
  signaturesDetected: boolean
  extracted: { label: string; value: string }[]
  ocrStatus: 'Success' | 'Failed OCR review required'
}

export type ProjectStatus = 'under_construction' | 'approved' | 'planning' | 'completed'

export interface Project {
  id: string
  project_name: string
  developer: string
  city: string
  neighborhood: string
  address: string
  status: ProjectStatus
  expected_delivery: string
  delivery_earliest: string
  delivery_latest: string
  total_units: number
  available_units: number | 'לא ידוע'
  unit_types: number[]
  price_min: number | null
  price_max: number | null
  amenities: string[]
  urban_renewal: boolean
  urban_renewal_type?: string
  sales_office: string
  source: string
  source_tier: 1 | 2 | 3 | 4 | 5
}

export interface ClientProfile {
  id: string
  name: string
  phone: string
  city: string
  rooms: number
  budgetMax: number
  deliveryBy: string
  linkedToWhatsapp?: boolean
}
