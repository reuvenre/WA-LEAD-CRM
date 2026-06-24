'use client';
import { useEffect, useMemo, useState } from 'react'
import { KeyRound, RefreshCw, Plus, MapPin, Car, ArrowUpDown, Trees, Sparkles, Star, X, UserPlus, Pencil, ExternalLink } from 'lucide-react'
import {
  LISTING_TYPES, addListing, updateListing, matchListings, loadListings, searchListings,
} from '@/lib/realestate/listings'
import { addClient, loadClients } from '@/lib/realestate/projects'
import { ISRAELI_CITIES } from '@/lib/realestate/cities'
import { Modal, FormRow, TextInput, SelectInput, SubmitButton } from '@/components/realestate/Modal'
import type { Listing, ListingType, ListingStatus } from '@/lib/realestate/listings'
import type { ClientProfile } from '@/lib/realestate/types'

const CITY_OPTS = ['הכל', ...ISRAELI_CITIES]
const STATUS_BADGE: Record<string, string> = { 'פעיל': 'bg-green-100 text-green-700', 'בהמתנה': 'bg-yellow-100 text-yellow-700', 'נמכר': 'bg-slate-100 text-slate-500' }
const SOURCE_BADGE: Record<string, string> = { 'Yad2': 'bg-amber-100 text-amber-700', 'Madlan': 'bg-slate-100 text-slate-600', 'CRM (ידני)': 'bg-blue-100 text-blue-700' }

const NEW_LISTING = { title: '', type: 'דירה' as ListingType, city: '', neighborhood: '', street: '', rooms: '4', floor: '', total_floors: '', size_sqm: '', price: '', parking: false, elevator: false, balcony: false, renovated: false, status: 'פעיל' as ListingStatus, listed_by: 'פרטי', sourceUrl: '' }
const LISTED_BY_BADGE: Record<string, string> = { 'פרטי': 'bg-emerald-100 text-emerald-700', 'בתיווך': 'bg-indigo-100 text-indigo-700' }
const NEW_CLIENT = { name: '', phone: '', city: '', rooms: '4', budgetMax: '', deliveryYear: '2027' }

export default function Listings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [toast, setToast] = useState('')
  const [city, setCity] = useState('הכל')
  const [rooms, setRooms] = useState<number | null>(null)
  const [type, setType] = useState('הכל')
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showClient, setShowClient] = useState(false)
  const [nl, setNl] = useState({ ...NEW_LISTING })
  const [cf, setCf] = useState({ ...NEW_CLIENT })
  const [matchId, setMatchId] = useState('')
  const [editing, setEditing] = useState<Listing | null>(null)

  useEffect(() => {
    Promise.all([loadListings(), loadClients()])
      .then(([l, c]) => { setListings([...l]); setClients([...c]) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  const openAdd = () => { setEditing(null); setNl({ ...NEW_LISTING }); setShowAdd(true) }
  const openEdit = (l: Listing) => {
    setEditing(l)
    setNl({
      title: l.title, type: l.type, city: l.city, neighborhood: l.neighborhood, street: l.street,
      rooms: String(l.rooms), floor: String(l.floor), total_floors: String(l.total_floors || ''), size_sqm: String(l.size_sqm), price: String(l.price),
      parking: l.parking, elevator: l.elevator, balcony: l.balcony, renovated: l.renovated,
      status: l.status, listed_by: l.listed_by || 'פרטי', sourceUrl: l.sourceUrl,
    })
    setShowAdd(true)
  }
  const closeModal = () => { setShowAdd(false); setEditing(null); setNl({ ...NEW_LISTING }) }

  const filtered = useMemo(() => listings.filter(l => {
    if (city !== 'הכל' && l.city !== city) return false
    if (rooms && l.rooms !== rooms) return false
    if (type !== 'הכל' && l.type !== type) return false
    if (maxPrice && l.price > maxPrice) return false
    return true
  }), [listings, city, rooms, type, maxPrice])

  const refresh = async () => {
    if (city === 'הכל') { setToast('בחר עיר ספציפית כדי למשוך דירות מהמקורות'); return }
    setFetching(true)
    try {
      const all = await searchListings({ city, rooms, type, maxPrice })
      setListings([...all])
      const inCity = all.filter(l => l.city === city).length
      setToast(`נמשכו ${inCity} דירות ב${city} מ-Yad2 · Madlan`)
    } catch {
      setToast('משיכת הדירות נכשלה')
    } finally {
      setFetching(false)
    }
  }

  const submitListing = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Omit<Listing, 'id'> = {
      title: nl.title, type: nl.type, city: nl.city, neighborhood: nl.neighborhood, street: nl.street,
      rooms: Number(nl.rooms) || 0, floor: Number(nl.floor) || 0, total_floors: Number(nl.total_floors) || 0, size_sqm: Number(nl.size_sqm) || 0,
      price: Number(nl.price) || 0, parking: nl.parking, elevator: nl.elevator, balcony: nl.balcony,
      renovated: nl.renovated, entry: editing?.entry || 'מיידי', status: nl.status,
      agent: editing?.agent || 'משרד', listed_by: nl.listed_by, source: editing?.source || 'CRM (ידני)', sourceUrl: nl.sourceUrl,
    }
    if (editing) {
      const rec = await updateListing(editing.id, payload)
      setListings(prev => prev.map(l => l.id === editing.id ? rec : l))
      setToast(`"${rec.title}" עודכנה`)
    } else {
      const rec = await addListing(payload)
      setListings(prev => [rec, ...prev])
      setToast(`הדירה "${rec.title}" נוספה`)
    }
    closeModal()
  }

  const submitClient = async (e: React.FormEvent) => {
    e.preventDefault()
    const rec = await addClient({ name: cf.name, phone: cf.phone, city: cf.city, rooms: Number(cf.rooms) || 0, budgetMax: Number(cf.budgetMax) || 0, deliveryBy: `${cf.deliveryYear}-Q4` })
    setClients(prev => [...prev, rec]); setMatchId(rec.id); setShowClient(false); setCf({ ...NEW_CLIENT }); setToast(`הלקוח "${rec.name}" נוסף`)
  }

  const client = clients.find(c => c.id === matchId)
  const matches = client ? matchListings(client) : []

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: 1280 }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>דירות למכירה — יד שנייה</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>נמשך מ-Yad2 · Madlan · מתאים למשרדי תיווך</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openAdd} style={{ background: '#fff', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> דירה חדשה
          </button>
          <button onClick={refresh} disabled={fetching} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: fetching ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: fetching ? 0.7 : 1 }}>
            <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'מושך…' : 'משוך מ-Yad2 · Madlan'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="data-card" style={{ padding: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="עיר"><select value={city} onChange={e => setCity(e.target.value)} className="filter-select">{CITY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="חדרים"><select value={rooms ?? ''} onChange={e => setRooms(e.target.value ? Number(e.target.value) : null)} className="filter-select"><option value="">הכל</option>{[2, 3, 4, 5, 6].map(r => <option key={r} value={r}>{r}</option>)}</select></Field>
        <Field label="סוג"><select value={type} onChange={e => setType(e.target.value)} className="filter-select"><option value="הכל">הכל</option>{LISTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
        <Field label="מחיר עד (₪)"><input type="number" value={maxPrice ?? ''} onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : null)} className="filter-select" placeholder="ללא הגבלה" style={{ width: 130 }} /></Field>
        <div style={{ marginRight: 'auto', fontSize: 12, color: '#64748B', fontWeight: 600 }}>{filtered.length} דירות</div>
      </div>

      {/* Buyer matcher */}
      <div className="data-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Sparkles size={16} className="text-blue-600" />
          <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>התאמת דירות לקונה</span>
          <select value={matchId} onChange={e => setMatchId(e.target.value)} className="filter-select" style={{ marginRight: 8 }}>
            <option value="">בחר לקוח…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.city} · {c.rooms} חד׳ · עד ₪{(c.budgetMax / 1e6).toFixed(1)}M</option>)}
          </select>
          <button onClick={() => setShowClient(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #BFDBFE', background: '#fff', color: '#2563EB', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><UserPlus size={13} /> הוסף לקוח</button>
          {client && <button onClick={() => setMatchId('')} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>}
        </div>
        {client && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {matches.length === 0 && <p className="text-sm" style={{ color: '#94A3B8' }}>לא נמצאו דירות ב{client.city}.</p>}
            {matches.map(m => (
              <div key={m.listing.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${m.star ? '#A7F3D0' : '#E2E8F0'}`, background: m.star ? '#F0FDF4' : '#fff' }}>
                <div style={{ width: 26, textAlign: 'center' }}>{m.star ? <Star size={18} className="text-amber-500" fill="#f59e0b" /> : <span className="text-xs text-slate-400">{[m.roomsMatch, m.budgetMatch].filter(Boolean).length}/2</span>}</div>
                <div style={{ flex: 1 }}>
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{m.listing.title}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{m.listing.neighborhood}, {m.listing.city} · {m.listing.rooms} חד׳ · ₪{(m.listing.price / 1e6).toFixed(2)}M</p>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <Crit ok={m.roomsMatch}>חדרים</Crit>
                  <Crit ok={m.budgetMatch}>תקציב</Crit>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(l => (
          <div key={l.id} onClick={() => openEdit(l)} title="לחץ לצפייה ועריכה" className="data-card fade-in" style={{ padding: 16, opacity: l.status === 'נמכר' ? 0.6 : 1, cursor: 'pointer' }}>
            <div className="flex justify-between items-start mb-2">
              <div style={{ flex: 1 }}>
                <h3 className="text-sm font-semibold leading-tight" style={{ color: '#0F172A' }}>{l.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{l.type} · {l.neighborhood}</p>
              </div>
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                {l.sourceUrl && (
                  <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" title="פתח את המודעה המקורית" className="text-slate-300 hover:text-blue-600 transition"><ExternalLink size={13} /></a>
                )}
                <button onClick={() => openEdit(l)} title="עריכה" className="text-slate-300 hover:text-blue-600 transition"><Pencil size={13} /></button>
                <span className={`status-badge ${STATUS_BADGE[l.status]}`}>{l.status}</span>
              </div>
            </div>
            <p className="text-xs flex items-center gap-1 mb-2" style={{ color: '#64748B' }}><MapPin size={11} />{l.street}, {l.city}</p>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-base font-bold" style={{ color: '#0F172A' }}>₪{l.price.toLocaleString()}</span>
              <span className="text-xs" style={{ color: '#94A3B8' }}>₪{Math.round(l.price / l.size_sqm).toLocaleString()}/מ״ר</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="חדרים" value={l.rooms} />
              <Stat label="קומה" value={l.floor === 0 ? 'קרקע' : (l.total_floors > 0 ? `${l.floor} מתוך ${l.total_floors}` : l.floor)} />
              <Stat label="מ״ר" value={l.size_sqm} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {l.parking && <Chip icon={Car}>חניה</Chip>}
              {l.elevator && <Chip icon={ArrowUpDown}>מעלית</Chip>}
              {l.balcony && <Chip icon={Trees}>מרפסת</Chip>}
              {l.renovated && <Chip>משופצת</Chip>}
            </div>
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span className={`status-badge ${SOURCE_BADGE[l.source]}`} style={{ fontSize: 9 }}>{l.source}</span>
                {l.listed_by && <span className={`status-badge ${LISTED_BY_BADGE[l.listed_by] || 'bg-slate-100 text-slate-600'}`} style={{ fontSize: 9 }}>{l.listed_by}</span>}
              </div>
              <span className="text-xs" style={{ color: '#CBD5E1' }}>כניסה {l.entry}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16" style={{ color: '#94A3B8' }}>
            <KeyRound size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">לא נמצאו דירות. בחר עיר וסנן לפי חדרים/סוג, ואז לחץ "משוך מ-Yad2 · Madlan".</p>
          </div>
        )}
      </div>

      {/* Add / edit listing modal */}
      <Modal open={showAdd} onClose={closeModal} title={editing ? 'פרטי הדירה' : 'דירה חדשה'} subtitle={editing ? 'צפייה ועריכה — כל הפרטים ניתנים לעדכון' : 'הוספת דירה למכירה (יד שנייה)'} width={520}>
        <form onSubmit={submitListing} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="כותרת"><TextInput value={nl.title} onChange={e => setNl(f => ({ ...f, title: e.target.value }))} required /></FormRow>
            <FormRow label="סוג"><SelectInput value={nl.type} onChange={e => setNl(f => ({ ...f, type: e.target.value as ListingType }))}>{LISTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</SelectInput></FormRow>
            <FormRow label="עיר"><TextInput list="cities-listing" value={nl.city} onChange={e => setNl(f => ({ ...f, city: e.target.value }))} required /><datalist id="cities-listing">{ISRAELI_CITIES.map(c => <option key={c} value={c} />)}</datalist></FormRow>
            <FormRow label="שכונה"><TextInput value={nl.neighborhood} onChange={e => setNl(f => ({ ...f, neighborhood: e.target.value }))} /></FormRow>
            <FormRow label="רחוב ומספר"><TextInput value={nl.street} onChange={e => setNl(f => ({ ...f, street: e.target.value }))} /></FormRow>
            <FormRow label="חדרים"><SelectInput value={nl.rooms} onChange={e => setNl(f => ({ ...f, rooms: e.target.value }))}>{[1, 2, 3, 4, 5, 6, 7].map(r => <option key={r} value={r}>{r}</option>)}</SelectInput></FormRow>
            <FormRow label="קומה"><TextInput type="number" value={nl.floor} onChange={e => setNl(f => ({ ...f, floor: e.target.value }))} /></FormRow>
            <FormRow label="מתוך כמה קומות"><TextInput type="number" value={nl.total_floors} onChange={e => setNl(f => ({ ...f, total_floors: e.target.value }))} placeholder="סך קומות בבניין" /></FormRow>
            <FormRow label="גודל (מ״ר)"><TextInput type="number" value={nl.size_sqm} onChange={e => setNl(f => ({ ...f, size_sqm: e.target.value }))} /></FormRow>
            <FormRow label="מחיר (₪)"><TextInput type="number" value={nl.price} onChange={e => setNl(f => ({ ...f, price: e.target.value }))} required /></FormRow>
            <FormRow label="סטטוס"><SelectInput value={nl.status} onChange={e => setNl(f => ({ ...f, status: e.target.value as ListingStatus }))}>{(['פעיל', 'בהמתנה', 'נמכר'] as ListingStatus[]).map(s => <option key={s} value={s}>{s}</option>)}</SelectInput></FormRow>
            <FormRow label="פרסום"><SelectInput value={nl.listed_by} onChange={e => setNl(f => ({ ...f, listed_by: e.target.value }))}>{['פרטי', 'בתיווך'].map(s => <option key={s} value={s}>{s}</option>)}</SelectInput></FormRow>
          </div>
          <FormRow label="קישור למודעה המקורית (Yad2 / Madlan)"><TextInput type="url" value={nl.sourceUrl} onChange={e => setNl(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="https://www.yad2.co.il/item/..." /></FormRow>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#374151' }}>
            {([['parking', 'חניה'], ['elevator', 'מעלית'], ['balcony', 'מרפסת'], ['renovated', 'משופצת']] as const).map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={nl[k]} onChange={e => setNl(f => ({ ...f, [k]: e.target.checked }))} />{label}
              </label>
            ))}
          </div>
          {editing?.sourceUrl && (
            <a href={editing.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium transition-colors">
              <ExternalLink size={15} /> צפה במודעה המקורית
            </a>
          )}
          <SubmitButton>{editing ? 'שמור שינויים' : 'הוסף דירה'}</SubmitButton>
        </form>
      </Modal>

      {/* Add client modal */}
      <Modal open={showClient} onClose={() => setShowClient(false)} title="לקוח חדש" subtitle="פרופיל קונה להתאמת דירות">
        <form onSubmit={submitClient} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="שם"><TextInput value={cf.name} onChange={e => setCf(f => ({ ...f, name: e.target.value }))} required /></FormRow>
            <FormRow label="טלפון"><TextInput value={cf.phone} onChange={e => setCf(f => ({ ...f, phone: e.target.value }))} /></FormRow>
            <FormRow label="עיר"><TextInput list="cities-lclient" value={cf.city} onChange={e => setCf(f => ({ ...f, city: e.target.value }))} required /><datalist id="cities-lclient">{ISRAELI_CITIES.map(c => <option key={c} value={c} />)}</datalist></FormRow>
            <FormRow label="חדרים"><SelectInput value={cf.rooms} onChange={e => setCf(f => ({ ...f, rooms: e.target.value }))}>{[2, 3, 4, 5].map(r => <option key={r} value={r}>{r} חדרים</option>)}</SelectInput></FormRow>
            <FormRow label="תקציב מקס׳ (₪)"><TextInput type="number" value={cf.budgetMax} onChange={e => setCf(f => ({ ...f, budgetMax: e.target.value }))} required /></FormRow>
          </div>
          <SubmitButton>הוסף לקוח</SubmitButton>
        </form>
      </Modal>

      {fetching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center fade-in" style={{ background: 'rgba(15,31,61,.35)' }}>
          <div className="bg-white rounded-xl px-6 py-5 text-center" style={{ boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <RefreshCw size={26} className="animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800">מושך דירות מהמקורות…</p>
            <p className="text-xs text-slate-400 mt-1">Yad2 · Madlan</p>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg fade-in">✓ {toast}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{label}</span>{children}</label>
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '7px 4px', textAlign: 'center' }}><p className="text-xs" style={{ color: '#94A3B8' }}>{label}</p><p className="text-sm font-bold" style={{ color: '#0F172A' }}>{value}</p></div>
}
function Chip({ icon: Icon, children }: { icon?: any; children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#F1F5F9', color: '#475569', fontSize: 10, padding: '2px 7px', borderRadius: 4 }}>{Icon && <Icon size={10} />}{children}</span>
}
function Crit({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: ok ? '#DCFCE7' : '#F1F5F9', color: ok ? '#15803D' : '#94A3B8' }}>{ok ? '✓ ' : '· '}{children}</span>
}
