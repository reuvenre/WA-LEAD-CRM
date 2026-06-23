'use client';
import { useState, useEffect } from 'react'
import { Camera, X, CheckCircle, AlertTriangle, Home, FileSignature, ScanLine, Plus, Pencil } from 'lucide-react'
import { getProperties, scanDocument, addProperty, updateProperty } from '@/lib/realestate/db'
import { Modal, FormRow, TextInput, SelectInput, SubmitButton } from '@/components/realestate/Modal'
import { ISRAELI_CITIES } from '@/lib/realestate/cities'
import type { ScanResult } from '@/lib/realestate/types'

const NEW_PROP = { title: '', street: '', city: '', price: '', status: 'Active', endDate: '' }

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Expired: 'bg-red-100 text-red-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Cancelled: 'bg-slate-100 text-slate-500',
}
const STATUS_HE: Record<string, string> = {
  Active: 'פעיל', Expired: 'פג תוקף', Pending: 'בהמתנה', Cancelled: 'בוטל',
}

export default function Properties() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [scanState, setScanState] = useState<'preview' | 'scanning' | 'done' | 'error'>('preview')
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [np, setNp] = useState({ ...NEW_PROP })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const openAdd = () => { setEditId(null); setNp({ ...NEW_PROP }); setShowAdd(true) }
  const openEdit = (p: any) => {
    setEditId(p.id)
    setNp({ title: p['Property Title'] || '', street: p['Address & City'] || '', city: '', price: String(p['Price Requested'] || ''), status: p['Status'] || 'Active', endDate: p['Exclusivity End Date'] || '' })
    setShowAdd(true)
  }
  const closeModal = () => { setShowAdd(false); setEditId(null); setNp({ ...NEW_PROP }) }

  const submitProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const fields = {
      'Property Title': np.title,
      'Address & City': [np.street, np.city].filter(Boolean).join(', '),
      'Price Requested': Number(np.price) || 0,
      'Status': np.status,
      'Exclusivity End Date': np.endDate,
    }
    try {
      if (editId) {
        const rec = await updateProperty(editId, fields)
        setProperties(prev => prev.map(p => p.id === editId ? rec : p))
      } else {
        const rec = await addProperty(fields)
        setProperties(prev => [rec, ...prev])
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    getProperties().then(setProperties).finally(() => setLoading(false))
  }, [])

  const openScanner = (property: any) => {
    setSelected(property)
    setScanState('preview')
    setScan(null)
  }

  const runScan = async () => {
    setScanState('scanning')
    try {
      const res = await scanDocument()
      setScan(res)
      setScanState('done')
    } catch {
      setScanState('error')
    }
  }

  const closeScanner = () => { setSelected(null); setScanState('preview'); setScan(null) }

  const daysLeft = (endDate: string) => Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">נכסים וחוזי בלעדיות</h2>
          <p className="text-slate-500 text-sm">{properties.length} נכסים</p>
        </div>
        <button
          onClick={openAdd}
          style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> נכס חדש
        </button>
      </div>

      {/* Add / edit property modal */}
      <Modal open={showAdd} onClose={closeModal} title={editId ? 'עריכת נכס' : 'נכס חדש'} subtitle={editId ? 'עדכון פרטי הנכס' : 'הוספת נכס וחוזה בלעדיות'}>
        <form onSubmit={submitProperty} className="space-y-3">
          <FormRow label="כותרת הנכס">
            <TextInput value={np.title} onChange={e => setNp(f => ({ ...f, title: e.target.value }))} placeholder="פנטהאוז רוטשילד 45" required />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="עיר">
              <TextInput list="cities-prop" value={np.city} onChange={e => setNp(f => ({ ...f, city: e.target.value }))} placeholder="תל אביב" required />
              <datalist id="cities-prop">{ISRAELI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
            </FormRow>
            <FormRow label="רחוב ומספר">
              <TextInput value={np.street} onChange={e => setNp(f => ({ ...f, street: e.target.value }))} placeholder="רוטשילד 45" />
            </FormRow>
            <FormRow label="מחיר מבוקש (₪)">
              <TextInput type="number" value={np.price} onChange={e => setNp(f => ({ ...f, price: e.target.value }))} placeholder="9200000" />
            </FormRow>
            <FormRow label="סטטוס">
              <SelectInput value={np.status} onChange={e => setNp(f => ({ ...f, status: e.target.value }))}>
                {[['Active', 'פעיל'], ['Pending', 'בהמתנה'], ['Expired', 'פג תוקף'], ['Cancelled', 'בוטל']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectInput>
            </FormRow>
          </div>
          <FormRow label="תאריך סיום בלעדיות">
            <TextInput type="date" value={np.endDate} onChange={e => setNp(f => ({ ...f, endDate: e.target.value }))} required />
          </FormRow>
          <SubmitButton disabled={saving}>{saving ? 'שומר…' : editId ? 'שמור שינויים' : 'הוסף נכס'}</SubmitButton>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {properties.map((p: any) => {
          const days = p['Exclusivity End Date'] ? daysLeft(p['Exclusivity End Date']) : null
          const isExpiringSoon = days !== null && days <= 7 && days >= 0
          return (
            <div key={p.id} className={`bg-white rounded-xl p-4 shadow-sm border transition-shadow hover:shadow-md ${isExpiringSoon ? 'border-orange-200' : 'border-slate-100'}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-800 text-sm">{p['Property Title']}</h3>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(p)} title="עריכה" className="text-slate-300 hover:text-blue-600 transition"><Pencil size={13} /></button>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p['Status']] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_HE[p['Status']] || p['Status']}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-3">{p['Address & City']}</p>
              <p className="text-sm font-semibold text-slate-700 mb-3">₪{(p['Price Requested'] || 0).toLocaleString()}</p>

              {days !== null && (
                <div className={`text-xs px-2 py-1 rounded-full mb-3 inline-flex items-center gap-1 ${
                  days < 0 ? 'bg-red-100 text-red-600' : isExpiringSoon ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {days < 0 ? '⛔ פג תוקף' : isExpiringSoon ? <><AlertTriangle size={10} /> {days} ימים לסיום בלעדיות</> : `${days} ימים לסיום בלעדיות`}
                </div>
              )}

              <button
                onClick={() => openScanner(p)}
                className="flex items-center gap-2 w-full justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Camera size={15} />
                סרוק הסכם
              </button>
            </div>
          )
        })}
        {properties.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-400">
            <Home size={40} className="mx-auto mb-3 opacity-30" />
            <p>אין נכסים</p>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {selected && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 fade-in"
            onClick={e => e.target === e.currentTarget && closeScanner()}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden fade-in"
            >
              <div className="p-4 flex justify-between items-center border-b">
                <h3 className="font-bold text-slate-800 text-sm">סריקת הסכם — {selected['Property Title']}</h3>
                <button onClick={closeScanner} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>

              <div className="p-4">
                {scanState === 'preview' && (
                  <div className="space-y-3">
                    {/* simulated document preview */}
                    <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ aspectRatio: '4/3', background: '#F8FAFC' }}>
                      <div style={{ position: 'absolute', inset: 18, background: '#fff', borderRadius: 6, boxShadow: '0 1px 6px rgba(0,0,0,.08)', padding: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ height: 9, width: '55%', background: '#0F172A', borderRadius: 2 }} />
                        <div style={{ height: 5, width: '85%', background: '#E2E8F0', borderRadius: 2 }} />
                        <div style={{ height: 5, width: '78%', background: '#E2E8F0', borderRadius: 2 }} />
                        <div style={{ height: 5, width: '90%', background: '#E2E8F0', borderRadius: 2 }} />
                        <div style={{ height: 5, width: '60%', background: '#E2E8F0', borderRadius: 2 }} />
                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <FileSignature size={26} className="text-blue-300" />
                          <div style={{ height: 5, width: '30%', background: '#CBD5E1', borderRadius: 2 }} />
                        </div>
                      </div>
                      <div className="absolute inset-3 border-2 border-blue-400/60 rounded-lg pointer-events-none" />
                    </div>
                    <p className="text-xs text-slate-400 text-center">מצלמת המכשיר תלכוד את ההסכם — Gemini Vision יחלץ את הפרטים אוטומטית</p>
                    <button
                      onClick={runScan}
                      className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                    >
                      <ScanLine size={18} />
                      צלם וסרוק
                    </button>
                  </div>
                )}
                {scanState === 'scanning' && (
                  <div className="py-10 text-center space-y-3">
                    <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
                    <p className="text-slate-600">מעלה ומנתח את המסמך...</p>
                    <p className="text-xs text-slate-400">Gemini Vision מפענח את ההסכם</p>
                  </div>
                )}
                {scanState === 'done' && scan && (
                  <div className="space-y-4 fade-in">
                    <div className="flex items-center gap-2 justify-center">
                      <CheckCircle size={22} className="text-green-500" />
                      <p className="font-semibold text-slate-800">המסמך פוענח בהצלחה</p>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-500">סוג מסמך</span>
                      <span className="font-semibold text-slate-800">{scan.documentType}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-500">חתימות זוהו</span>
                      <span className={`font-semibold ${scan.signaturesDetected ? 'text-green-600' : 'text-red-600'}`}>
                        {scan.signaturesDetected ? '✓ כן' : '✗ לא'}
                      </span>
                    </div>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {scan.extracted.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-slate-500">{label}</span>
                          <span className="font-medium text-slate-800">{value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 bg-green-50 rounded-lg p-2 text-center">המסמך נשמר ב-Google Drive וקושר לנכס</p>
                    <button onClick={closeScanner} className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold">סיום</button>
                  </div>
                )}
                {scanState === 'error' && (
                  <div className="py-10 text-center space-y-3">
                    <AlertTriangle size={48} className="text-red-500 mx-auto" />
                    <p className="font-semibold text-slate-800">שגיאה</p>
                    <p className="text-sm text-slate-500">לא ניתן לפענח את המסמך</p>
                    <button onClick={closeScanner} className="bg-slate-600 text-white px-6 py-2 rounded-lg text-sm font-medium">סגור</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
