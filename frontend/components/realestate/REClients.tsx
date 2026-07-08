'use client';
import { useEffect, useMemo, useState } from 'react'
import { Users, Plus, Pencil, Trash2, Phone, MapPin, Home, Wallet, CalendarClock, Search, MessageCircle } from 'lucide-react'
import { loadClients, addClient, updateClient, deleteClient } from '@/lib/realestate/projects'
import { ISRAELI_CITIES } from '@/lib/realestate/cities'
import { Modal, FormRow, TextInput, SelectInput, SubmitButton } from '@/components/realestate/Modal'
import { useConfirm } from '@/components/useConfirm'
import type { ClientProfile } from '@/lib/realestate/types'

const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030']
const blank = { name: '', phone: '', city: '', rooms: '4', budgetMax: '', deliveryYear: '2027' }
const yearOf = (deliveryBy: string) => (deliveryBy && /^\d{4}/.test(deliveryBy) ? deliveryBy.slice(0, 4) : '2027')

export default function REClients() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<ClientProfile | null>(null)
  const [f, setF] = useState({ ...blank })
  const [saving, setSaving] = useState(false)
  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => { loadClients().then(c => setClients([...c])).finally(() => setLoading(false)) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  const filtered = useMemo(() => clients.filter(c =>
    !search || c.name.includes(search) || (c.phone || '').includes(search) || (c.city || '').includes(search)
  ), [clients, search])

  const openAdd = () => { setEditing(null); setF({ ...blank }); setShow(true) }
  const openEdit = (c: ClientProfile) => {
    setEditing(c)
    setF({ name: c.name, phone: c.phone, city: c.city, rooms: String(c.rooms || 4), budgetMax: String(c.budgetMax || ''), deliveryYear: yearOf(c.deliveryBy) })
    setShow(true)
  }
  const close = () => { setShow(false); setEditing(null); setF({ ...blank }) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const payload: Omit<ClientProfile, 'id'> = {
      name: f.name.trim(), phone: f.phone.trim(), city: f.city.trim(),
      rooms: Number(f.rooms) || 0, budgetMax: Number(f.budgetMax) || 0, deliveryBy: `${f.deliveryYear}-Q4`,
    }
    setSaving(true)
    try {
      if (editing) {
        const rec = await updateClient(editing.id, payload)
        setClients(prev => prev.map(c => c.id === editing.id ? rec : c))
        setToast(`"${rec.name}" עודכן`)
      } else {
        const rec = await addClient(payload)
        setClients(prev => [...prev, rec])
        setToast(`הלקוח "${rec.name}" נוסף`)
      }
      close()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (c: ClientProfile) => {
    if (!(await confirm(`למחוק את הלקוח "${c.name}"?`))) return
    let alsoDelete = false
    if (c.linkedToWhatsapp) {
      alsoDelete = await confirm(
        `הלקוח מחובר לאיש קשר ב-WhatsApp.\n\nאישור — מחק גם את איש הקשר וההתכתבות מ-WhatsApp.\nביטול — מחק רק את הלקוח, השאר את איש הקשר ב-WhatsApp.`,
      )
    }
    await deleteClient(c.id, alsoDelete)
    setClients(prev => prev.filter(x => x.id !== c.id))
    setToast(alsoDelete ? `"${c.name}" נמחק (כולל WhatsApp)` : `"${c.name}" נמחק`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: 1100 }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>ניהול לקוחות</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>פרופילי קונים — כל הפרטים ניתנים לעריכה</p>
        </div>
        <button onClick={openAdd} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> לקוח חדש
        </button>
      </div>

      <div className="data-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Search size={15} className="text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם / טלפון / עיר…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', background: 'transparent', color: '#0F172A' }} />
        <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{filtered.length} לקוחות</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="data-card fade-in" style={{ padding: 16 }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">{c.name?.[0] || '?'}</div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{c.name}</h3>
                  <p className="text-xs flex items-center gap-1" style={{ color: '#94A3B8' }}><Phone size={10} />{c.phone || '—'}</p>
                  {c.linkedToWhatsapp && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                      <MessageCircle size={10} /> מחובר ל-WhatsApp
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(c)} title="עריכה" className="text-slate-300 hover:text-blue-600 transition"><Pencil size={14} /></button>
                <button onClick={() => remove(c)} title="מחיקה" className="text-slate-300 hover:text-red-600 transition"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Info icon={MapPin} label="עיר" value={c.city || '—'} />
              <Info icon={Home} label="חדרים" value={c.rooms || '—'} />
              <Info icon={Wallet} label="תקציב" value={c.budgetMax ? `₪${(c.budgetMax / 1e6).toFixed(2)}M` : '—'} />
              <Info icon={CalendarClock} label="מסירה עד" value={c.deliveryBy || '—'} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16" style={{ color: '#94A3B8' }}>
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">אין לקוחות עדיין. לחץ "לקוח חדש" כדי להוסיף.</p>
          </div>
        )}
      </div>

      <Modal open={show} onClose={close} title={editing ? 'עריכת לקוח' : 'לקוח חדש'} subtitle={editing ? 'כל הפרטים ניתנים לעריכה' : 'פרופיל קונה חדש'}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="שם"><TextInput value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} required /></FormRow>
            <FormRow label="טלפון"><TextInput value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} /></FormRow>
            <FormRow label="עיר"><TextInput list="cities-reclient" value={f.city} onChange={e => setF(s => ({ ...s, city: e.target.value }))} /><datalist id="cities-reclient">{ISRAELI_CITIES.map(c => <option key={c} value={c} />)}</datalist></FormRow>
            <FormRow label="חדרים"><SelectInput value={f.rooms} onChange={e => setF(s => ({ ...s, rooms: e.target.value }))}>{[2, 3, 4, 5, 6].map(r => <option key={r} value={r}>{r}</option>)}</SelectInput></FormRow>
            <FormRow label="תקציב מקס׳ (₪)"><TextInput type="number" value={f.budgetMax} onChange={e => setF(s => ({ ...s, budgetMax: e.target.value }))} required /></FormRow>
            <FormRow label="מסירה עד (שנה)"><SelectInput value={f.deliveryYear} onChange={e => setF(s => ({ ...s, deliveryYear: e.target.value }))}>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</SelectInput></FormRow>
          </div>
          <SubmitButton disabled={saving}>{saving ? 'שומר…' : editing ? 'שמור שינויים' : 'הוסף לקוח'}</SubmitButton>
        </form>
      </Modal>

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg fade-in">✓ {toast}</div>}
      {confirmDialog}
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '8px 10px' }}>
      <p className="text-[10px] flex items-center gap-1" style={{ color: '#94A3B8' }}><Icon size={10} />{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: '#0F172A' }}>{value}</p>
    </div>
  )
}
