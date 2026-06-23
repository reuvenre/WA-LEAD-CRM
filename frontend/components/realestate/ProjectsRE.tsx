'use client';
import { useEffect, useMemo, useState } from 'react'
import { Building, RefreshCw, Star, MapPin, X, Sparkles, Plus, UserPlus, Pencil } from 'lucide-react'
import {
  PROJECTS, CITIES, fetchProjects, matchClient, addProject, addClient,
  loadProjects, loadClients, updateProject,
} from '@/lib/realestate/projects'
import { ISRAELI_CITIES } from '@/lib/realestate/cities'
import { Modal, FormRow, TextInput, SelectInput, SubmitButton } from '@/components/realestate/Modal'
import type { Project, ClientProfile } from '@/lib/realestate/types'

const yearOf = (s: string) => (s.match(/20\d\d/) || ['2027'])[0]
const NEW_PROJ = {
  project_name: '', developer: '', city: '', neighborhood: '', address: '',
  status: 'under_construction' as Project['status'], delivery: '', total_units: '',
  available_units: '', unit_types: '', price_min: '', price_max: '', urban_renewal: false,
}
const NEW_CLIENT = { name: '', phone: '', city: '', rooms: '4', budgetMax: '', deliveryYear: '2027' }

const STATUS_HE: Record<string, string> = {
  under_construction: 'בבנייה', approved: 'מאושר', planning: 'בתכנון', completed: 'הושלם',
}
const STATUS_BADGE: Record<string, string> = {
  under_construction: 'bg-green-100 text-green-700',
  approved: 'bg-blue-100 text-blue-700',
  planning: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-slate-100 text-slate-600',
}
const TIER_INFO: Record<number, { label: string; cls: string }> = {
  1: { label: 'Nadlan.gov.il · עסקאות בפועל', cls: 'bg-emerald-100 text-emerald-700' },
  2: { label: 'רמ"י · תוכניות מאושרות', cls: 'bg-blue-100 text-blue-700' },
  3: { label: 'Madlan', cls: 'bg-slate-100 text-slate-600' },
  4: { label: 'Yad2 · מחירון שיווקי', cls: 'bg-amber-100 text-amber-700' },
  5: { label: 'CSV · לא מאומת', cls: 'bg-red-100 text-red-700' },
}

const priceRange = (p: Project) =>
  p.price_min == null || p.price_max == null
    ? 'לא ידוע'
    : `₪${(p.price_min / 1e6).toFixed(2)}M – ₪${(p.price_max / 1e6).toFixed(2)}M`

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [toast, setToast] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [city, setCity] = useState('הכל')
  const [status, setStatus] = useState<'all' | 'existing' | 'future'>('all')
  const [rooms, setRooms] = useState<number | null>(null)
  const [matchClientId, setMatchClientId] = useState('')
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [showAddProj, setShowAddProj] = useState(false)
  const [showAddClient, setShowAddClient] = useState(false)
  const [pf, setPf] = useState({ ...NEW_PROJ })
  const [cf, setCf] = useState({ ...NEW_CLIENT })

  // Load from the backend on mount
  useEffect(() => {
    Promise.all([loadProjects(), loadClients()])
      .then(([p, c]) => { setProjects([...p]); setClients([...c]) })
      .finally(() => setLoading(false))
  }, [])

  const openAddProj = () => { setEditId(null); setPf({ ...NEW_PROJ }); setShowAddProj(true) }
  const openEditProj = (p: Project) => {
    setEditId(p.id)
    setPf({
      project_name: p.project_name, developer: p.developer, city: p.city, neighborhood: p.neighborhood,
      address: p.address, status: p.status, delivery: p.expected_delivery,
      total_units: String(p.total_units || ''),
      available_units: p.available_units === 'לא ידוע' ? '' : String(p.available_units),
      unit_types: p.unit_types.join(','),
      price_min: p.price_min == null ? '' : String(p.price_min),
      price_max: p.price_max == null ? '' : String(p.price_max),
      urban_renewal: p.urban_renewal,
    })
    setShowAddProj(true)
  }
  const closeProjModal = () => { setShowAddProj(false); setEditId(null); setPf({ ...NEW_PROJ }) }

  const submitProject = async (e: React.FormEvent) => {
    e.preventDefault()
    const yr = yearOf(pf.delivery)
    const payload: Omit<Project, 'id'> = {
      project_name: pf.project_name, developer: pf.developer || 'לא ידוע',
      city: pf.city, neighborhood: pf.neighborhood, address: pf.address,
      status: pf.status,
      expected_delivery: pf.delivery || `Q4 ${yr}`,
      delivery_earliest: `${yr}-Q1`, delivery_latest: `${yr}-Q4`,
      total_units: Number(pf.total_units) || 0,
      available_units: pf.available_units ? Number(pf.available_units) : 'לא ידוע',
      unit_types: pf.unit_types.split(',').map(n => Number(n.trim())).filter(Boolean),
      price_min: pf.price_min ? Number(pf.price_min) : null,
      price_max: pf.price_max ? Number(pf.price_max) : null,
      amenities: [], urban_renewal: pf.urban_renewal,
      sales_office: 'לא ידוע', source: 'CRM (ידני)', source_tier: 5,
    }
    if (editId) {
      const rec = await updateProject(editId, payload)
      setProjects(prev => prev.map(p => p.id === editId ? rec : p))
      setToast(`הפרויקט "${rec.project_name}" עודכן`)
    } else {
      const rec = await addProject(payload)
      setProjects(prev => [rec, ...prev])
      setToast(`הפרויקט "${rec.project_name}" נוסף ל-CRM`)
    }
    closeProjModal()
  }

  const submitClient = async (e: React.FormEvent) => {
    e.preventDefault()
    const rec = await addClient({
      name: cf.name, phone: cf.phone, city: cf.city,
      rooms: Number(cf.rooms) || 0, budgetMax: Number(cf.budgetMax) || 0,
      deliveryBy: `${cf.deliveryYear}-Q4`,
    })
    setClients(prev => [...prev, rec])
    setMatchClientId(rec.id)
    setShowAddClient(false)
    setCf({ ...NEW_CLIENT })
    setToast(`הלקוח "${rec.name}" נוסף`)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => projects.filter(p => {
    if (city !== 'הכל' && p.city !== city) return false
    if (status === 'existing' && !['under_construction', 'completed'].includes(p.status)) return false
    if (status === 'future' && !['approved', 'planning'].includes(p.status)) return false
    if (rooms && !p.unit_types.includes(rooms)) return false
    return true
  }), [projects, city, status, rooms])

  const refresh = async () => {
    setFetching(true)
    const r = await fetchProjects({ city, status, rooms })
    setProjects([...PROJECTS])
    setFetching(false)
    setToast(`רוענן מהשרת — ${r.length} פרויקטים תואמי סינון`)
  }

  // Data-quality flags (skill Step 6)
  const dq = useMemo(() => ({
    unknownPrice: filtered.filter(p => p.price_min == null).length,
    soldOut: filtered.filter(p => p.available_units === 0).length,
    listPrice: filtered.filter(p => p.source_tier >= 4).length,
  }), [filtered])

  const client: ClientProfile | undefined = clients.find(c => c.id === matchClientId)
  const matches = client ? matchClient(client) : []

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: 1280 }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>פרויקטים — בנייה חדשה</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>נמשך אוטומטית מ-Yad2 · Madlan · Nadlan.gov.il · רשות מקרקעי ישראל</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={openAddProj}
            style={{ background: '#fff', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> פרויקט חדש
          </button>
          <button
            onClick={refresh}
            disabled={fetching}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: fetching ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: fetching ? 0.7 : 1 }}
          >
            <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'מושך נתונים…' : 'משוך נתונים מהמקורות'}
          </button>
        </div>
      </div>

      {/* Add / edit project modal */}
      <Modal open={showAddProj} onClose={closeProjModal} title={editId ? 'עריכת פרויקט' : 'פרויקט חדש'} subtitle={editId ? 'עדכון פרטי הפרויקט' : 'הוספה ידנית ל-CRM (דרגת מקור 5 — לא מאומת)'} width={520}>
        <form onSubmit={submitProject} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="שם הפרויקט"><TextInput value={pf.project_name} onChange={e => setPf(f => ({ ...f, project_name: e.target.value }))} required /></FormRow>
            <FormRow label="יזם"><TextInput value={pf.developer} onChange={e => setPf(f => ({ ...f, developer: e.target.value }))} placeholder="אאורה ישראל" /></FormRow>
            <FormRow label="עיר">
              <TextInput list="cities-proj" value={pf.city} onChange={e => setPf(f => ({ ...f, city: e.target.value }))} required />
              <datalist id="cities-proj">{ISRAELI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
            </FormRow>
            <FormRow label="שכונה"><TextInput value={pf.neighborhood} onChange={e => setPf(f => ({ ...f, neighborhood: e.target.value }))} /></FormRow>
            <FormRow label="כתובת"><TextInput value={pf.address} onChange={e => setPf(f => ({ ...f, address: e.target.value }))} placeholder="הרצל 88" /></FormRow>
            <FormRow label="סטטוס">
              <SelectInput value={pf.status} onChange={e => setPf(f => ({ ...f, status: e.target.value as Project['status'] }))}>
                {[['under_construction', 'בבנייה'], ['approved', 'מאושר'], ['planning', 'בתכנון'], ['completed', 'הושלם']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectInput>
            </FormRow>
            <FormRow label="מסירה צפויה"><TextInput value={pf.delivery} onChange={e => setPf(f => ({ ...f, delivery: e.target.value }))} placeholder="Q3 2027" /></FormRow>
            <FormRow label="סוגי דירות (חדרים)"><TextInput value={pf.unit_types} onChange={e => setPf(f => ({ ...f, unit_types: e.target.value }))} placeholder="3,4,5" /></FormRow>
            <FormRow label='סה"כ יח״ד'><TextInput type="number" value={pf.total_units} onChange={e => setPf(f => ({ ...f, total_units: e.target.value }))} /></FormRow>
            <FormRow label="יח״ד פנויות"><TextInput type="number" value={pf.available_units} onChange={e => setPf(f => ({ ...f, available_units: e.target.value }))} placeholder="ריק = לא ידוע" /></FormRow>
            <FormRow label="מחיר מינ׳ (₪)"><TextInput type="number" value={pf.price_min} onChange={e => setPf(f => ({ ...f, price_min: e.target.value }))} /></FormRow>
            <FormRow label="מחיר מקס׳ (₪)"><TextInput type="number" value={pf.price_max} onChange={e => setPf(f => ({ ...f, price_max: e.target.value }))} /></FormRow>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
            <input type="checkbox" checked={pf.urban_renewal} onChange={e => setPf(f => ({ ...f, urban_renewal: e.target.checked }))} />
            התחדשות עירונית (תמ״א 38 / פינוי-בינוי)
          </label>
          <SubmitButton>{editId ? 'שמור שינויים' : 'הוסף פרויקט'}</SubmitButton>
        </form>
      </Modal>

      {/* Add client modal */}
      <Modal open={showAddClient} onClose={() => setShowAddClient(false)} title="לקוח חדש" subtitle="פרופיל לקוח להתאמת פרויקטים">
        <form onSubmit={submitClient} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="שם הלקוח"><TextInput value={cf.name} onChange={e => setCf(f => ({ ...f, name: e.target.value }))} required /></FormRow>
            <FormRow label="טלפון"><TextInput value={cf.phone} onChange={e => setCf(f => ({ ...f, phone: e.target.value }))} placeholder="050-000-0000" /></FormRow>
            <FormRow label="עיר מבוקשת">
              <TextInput list="cities-client" value={cf.city} onChange={e => setCf(f => ({ ...f, city: e.target.value }))} required />
              <datalist id="cities-client">{ISRAELI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
            </FormRow>
            <FormRow label="חדרים">
              <SelectInput value={cf.rooms} onChange={e => setCf(f => ({ ...f, rooms: e.target.value }))}>
                {[2, 3, 4, 5].map(r => <option key={r} value={r}>{r} חדרים</option>)}
              </SelectInput>
            </FormRow>
            <FormRow label="תקציב מקס׳ (₪)"><TextInput type="number" value={cf.budgetMax} onChange={e => setCf(f => ({ ...f, budgetMax: e.target.value }))} placeholder="3500000" required /></FormRow>
            <FormRow label="מסירה עד שנת"><TextInput type="number" value={cf.deliveryYear} onChange={e => setCf(f => ({ ...f, deliveryYear: e.target.value }))} /></FormRow>
          </div>
          <SubmitButton>הוסף לקוח</SubmitButton>
        </form>
      </Modal>

      {/* Filters */}
      <div className="data-card" style={{ padding: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="עיר">
          <select value={city} onChange={e => setCity(e.target.value)} className="filter-select">
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="סטטוס">
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="filter-select">
            <option value="all">הכל</option>
            <option value="existing">קיים (בבנייה/הושלם)</option>
            <option value="future">עתידי (מאושר/בתכנון)</option>
          </select>
        </Field>
        <Field label="חדרים">
          <select value={rooms ?? ''} onChange={e => setRooms(e.target.value ? Number(e.target.value) : null)} className="filter-select">
            <option value="">הכל</option>
            {[2, 3, 4, 5].map(r => <option key={r} value={r}>{r} חדרים</option>)}
          </select>
        </Field>
        <div style={{ marginRight: 'auto', fontSize: 12, color: '#64748B', fontWeight: 600 }}>{filtered.length} פרויקטים</div>
      </div>

      {/* Data quality */}
      {(dq.unknownPrice > 0 || dq.soldOut > 0 || dq.listPrice > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
          {dq.listPrice > 0 && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '4px 10px', borderRadius: 999, fontWeight: 600 }}>⚠️ {dq.listPrice} במחירון שיווקי (לא מחיר עסקה בפועל)</span>}
          {dq.unknownPrice > 0 && <span style={{ background: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: 999, fontWeight: 600 }}>❓ {dq.unknownPrice} ללא מחיר — דרוש מחירון מהמשרד</span>}
          {dq.soldOut > 0 && <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: 999, fontWeight: 600 }}>🚫 {dq.soldOut} אזלו — להחריג מדיוור</span>}
        </div>
      )}

      {/* Client matcher */}
      <div className="data-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Sparkles size={16} className="text-blue-600" />
          <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>התאמת פרויקטים ללקוח</span>
          <select value={matchClientId} onChange={e => setMatchClientId(e.target.value)} className="filter-select" style={{ marginRight: 8 }}>
            <option value="">בחר לקוח…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.city} · {c.rooms} חד׳ · עד ₪{(c.budgetMax / 1e6).toFixed(1)}M</option>)}
          </select>
          <button onClick={() => setShowAddClient(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #BFDBFE', background: '#fff', color: '#2563EB', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <UserPlus size={13} /> הוסף לקוח
          </button>
          {client && <button onClick={() => setMatchClientId('')} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>}
        </div>
        {client && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {matches.length === 0 && <p className="text-sm" style={{ color: '#94A3B8' }}>לא נמצאו פרויקטים ב{client.city}.</p>}
            {matches.map(m => (
              <div key={m.project.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${m.star ? '#A7F3D0' : '#E2E8F0'}`, background: m.star ? '#F0FDF4' : '#fff' }}>
                <div style={{ width: 26, textAlign: 'center' }}>{m.star ? <Star size={18} className="text-amber-500" fill="#f59e0b" /> : <span className="text-xs text-slate-400">{m.score}/3</span>}</div>
                <div style={{ flex: 1 }}>
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{m.project.project_name} {m.listPriceWarning && <span title="מחיר שיווקי" >⚠️</span>}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{m.project.developer} · {m.project.neighborhood} · {priceRange(m.project)}</p>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <Crit ok={m.roomsMatch}>חדרים</Crit>
                  <Crit ok={m.budgetMatch}>תקציב</Crit>
                  <Crit ok={m.timelineMatch}>לו"ז</Crit>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="data-card fade-in" style={{ padding: 16 }}>
            <div className="flex justify-between items-start mb-2">
              <div style={{ flex: 1 }}>
                <h3 className="text-sm font-semibold leading-tight" style={{ color: '#0F172A' }}>{p.project_name}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{p.developer}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEditProj(p)} title="עריכה" className="text-slate-300 hover:text-blue-600 transition"><Pencil size={13} /></button>
                <span className={`status-badge ${STATUS_BADGE[p.status]}`}>{STATUS_HE[p.status]}</span>
              </div>
            </div>
            <p className="text-xs flex items-center gap-1 mb-3" style={{ color: '#64748B' }}>
              <MapPin size={11} /> {p.neighborhood}, {p.city}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Cell label="טווח מחירים (כולל מע״מ)" value={priceRange(p)} accent={p.price_min == null} />
              <Cell label="מסירה" value={p.expected_delivery} />
              <Cell label="יח״ד פנויות" value={`${p.available_units === 'לא ידוע' ? 'לא ידוע' : p.available_units} / ${p.total_units}`} />
              <Cell label="חדרים" value={p.unit_types.join(', ')} />
            </div>
            {p.urban_renewal && (
              <span style={{ display: 'inline-block', background: '#EEF2FF', color: '#4338CA', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, marginBottom: 8 }}>
                התחדשות עירונית · {p.urban_renewal_type}
              </span>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {p.amenities.slice(0, 4).map(a => (
                <span key={a} style={{ background: '#F8FAFC', color: '#64748B', fontSize: 10, padding: '2px 7px', borderRadius: 4 }}>{a}</span>
              ))}
              {p.amenities.length > 4 && <span style={{ color: '#94A3B8', fontSize: 10, padding: '2px 4px' }}>+{p.amenities.length - 4}</span>}
            </div>
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={`status-badge ${TIER_INFO[p.source_tier].cls}`} style={{ fontSize: 9 }}>
                {TIER_INFO[p.source_tier].label}
              </span>
              <span className="text-xs" style={{ color: '#CBD5E1' }}>{p.sales_office}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16" style={{ color: '#94A3B8' }}>
            <Building size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">לא נמצאו פרויקטים — נסה לרענן מהמקורות</p>
          </div>
        )}
      </div>

      {/* fetch overlay + toast */}
      {fetching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center fade-in" style={{ background: 'rgba(15,31,61,.35)' }}>
          <div className="bg-white rounded-xl px-6 py-5 text-center" style={{ boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <RefreshCw size={26} className="animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800">מושך פרויקטים מהמקורות…</p>
            <p className="text-xs text-slate-400 mt-1">Yad2 · Madlan · Nadlan.gov.il · רמ"י</p>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg fade-in">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{label}</span>
      {children}
    </label>
  )
}
function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? '#FFFBEB' : '#F8FAFC', borderRadius: 6, padding: '7px 9px' }}>
      <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-xs font-bold" style={{ color: accent ? '#92400E' : '#0F172A' }}>{value}</p>
    </div>
  )
}
function Crit({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: ok ? '#DCFCE7' : '#F1F5F9', color: ok ? '#15803D' : '#94A3B8' }}>
      {ok ? '✓ ' : '· '}{children}
    </span>
  )
}
