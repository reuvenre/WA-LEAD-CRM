'use client';
import { useEffect, useState } from 'react'
import { TrendingUp, AlertTriangle, X, Calculator, Plus } from 'lucide-react'
import { getDeals, getFeasibilityReport, addDeal } from '@/lib/realestate/db'
import { Modal, FormRow, TextInput, SelectInput, SubmitButton } from '@/components/realestate/Modal'
import { ISRAELI_CITIES } from '@/lib/realestate/cities'
import type { FeasibilityResult } from '@/lib/realestate/types'

const NEW_DEAL = { 'Project Name': '', city: '', 'Block & Parcel': '', 'Status': 'Scouting', gdv: '', margin: '' }

const STATUS_BADGE: Record<string, string> = {
  Scouting: 'bg-cyan-100 text-cyan-700',
  Underwriting: 'bg-yellow-100 text-yellow-700',
  Active: 'bg-green-100 text-green-700',
  Closed: 'bg-blue-100 text-blue-700',
  Rejected: 'bg-red-100 text-red-700',
}

const STATUS_HE: Record<string, string> = {
  Active: 'פעיל', Underwriting: 'חיתום', Scouting: 'סקאוטינג', Closed: 'סגור', Rejected: 'נדחה',
}

export default function DealFlow() {
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ city: '', block: '', parcel: '', sqm: '' })
  const [result, setResult] = useState<FeasibilityResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [sensitivity, setSensitivity] = useState({ costDelta: 0, priceDelta: 0 })
  const [showAdd, setShowAdd] = useState(false)
  const [nd, setNd] = useState({ ...NEW_DEAL })
  const [saving, setSaving] = useState(false)

  const submitDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const rec = await addDeal({
      'Project Name': nd['Project Name'],
      'Block & Parcel': nd['Block & Parcel'] || nd.city,
      'Status': nd['Status'],
      'Estimated Sales Value GDV': Number(nd.gdv) || 0,
      'Expected Margin %': Number(nd.margin) || 0,
    })
    setDeals(prev => [rec, ...prev])
    setSaving(false)
    setShowAdd(false)
    setNd({ ...NEW_DEAL })
  }

  useEffect(() => {
    getDeals().then(setDeals).finally(() => setLoading(false))
  }, [])

  const handleFeasibility = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await getFeasibilityReport({ ...form, sqm: Number(form.sqm) })
      setResult(res)
      setSensitivity({ costDelta: 0, priceDelta: 0 })
    } catch {
      alert('שגיאה בניתוח היתכנות')
    } finally {
      setAnalyzing(false)
    }
  }

  const adjustedMargin = result
    ? result.developer_margin_pct
      + (sensitivity.priceDelta / 100) * 100
      - (sensitivity.costDelta / 100) * (result.construction_cost_estimate / result.gdv_total) * 100
    : 0

  const STATUSES = ['הכל', 'Active', 'Underwriting', 'Scouting', 'Closed', 'Rejected']
  const [filter, setFilter] = useState('הכל')
  const filtered = filter === 'הכל' ? deals : deals.filter((d: any) => d['Status'] === filter)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: 1280 }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>עסקאות ומגרשים</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>{deals.length} עסקאות במערכת</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowAdd(true)}
            style={{ background: '#fff', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            עסקה חדשה
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Calculator size={14} />
            דוח היתכנות
          </button>
        </div>
      </div>

      {/* Add deal modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="עסקה חדשה" subtitle="הוספת מגרש / פרויקט למערכת">
        <form onSubmit={submitDeal} className="space-y-3">
          <FormRow label="שם הפרויקט">
            <TextInput value={nd['Project Name']} onChange={e => setNd(f => ({ ...f, 'Project Name': e.target.value }))} placeholder="מגדלי הצמרת" required />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="עיר">
              <TextInput list="cities-deal" value={nd.city} onChange={e => setNd(f => ({ ...f, city: e.target.value }))} placeholder="תל אביב" />
              <datalist id="cities-deal">{ISRAELI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
            </FormRow>
            <FormRow label="גוש / חלקה">
              <TextInput value={nd['Block & Parcel']} onChange={e => setNd(f => ({ ...f, 'Block & Parcel': e.target.value }))} placeholder="גוש 6638 / חלקה 142" />
            </FormRow>
            <FormRow label="סטטוס">
              <SelectInput value={nd['Status']} onChange={e => setNd(f => ({ ...f, 'Status': e.target.value }))}>
                {[['Scouting', 'סקאוטינג'], ['Underwriting', 'חיתום'], ['Active', 'פעיל'], ['Closed', 'סגור'], ['Rejected', 'נדחה']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectInput>
            </FormRow>
            <FormRow label='GDV משוער (₪)'>
              <TextInput type="number" value={nd.gdv} onChange={e => setNd(f => ({ ...f, gdv: e.target.value }))} placeholder="120000000" />
            </FormRow>
            <FormRow label="מרווח יזמי (%)">
              <TextInput type="number" step="0.1" value={nd.margin} onChange={e => setNd(f => ({ ...f, margin: e.target.value }))} placeholder="20" />
            </FormRow>
          </div>
          <SubmitButton disabled={saving}>{saving ? 'שומר…' : 'הוסף עסקה'}</SubmitButton>
        </form>
      </Modal>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', marginBottom: 4 }}>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderBottom: filter === s ? '2px solid #2563EB' : '2px solid transparent', color: filter === s ? '#2563EB' : '#64748B', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}
          >
            {STATUS_HE[s] || s}
            {s !== 'הכל' && <span style={{ marginRight: 4, fontSize: 10, color: '#94A3B8' }}>({deals.filter((d: any) => d['Status'] === s).length})</span>}
          </button>
        ))}
      </div>

      {/* Deals grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((deal: any) => {
          const margin = deal['Expected Margin %'] || 0
          return (
            <div key={deal.id} className="data-card fade-in" style={{ padding: 0, cursor: 'pointer', borderColor: deal['Risk Alert'] ? '#FECACA' : '#E2E8F0' }}>
              <div style={{ padding: 16 }}>
                <div className="flex justify-between items-start mb-3">
                  <div style={{ flex: 1 }}>
                    <h3 className="text-sm font-semibold leading-tight" style={{ color: '#0F172A' }}>{deal['Project Name'] || 'ללא שם'}</h3>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{deal['Block & Parcel']}</p>
                  </div>
                  <div className="flex gap-1 items-center mr-2">
                    {deal['Risk Alert'] && <AlertTriangle size={13} className="text-red-500" />}
                    <span className={`status-badge ${STATUS_BADGE[deal['Status']] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_HE[deal['Status']] || deal['Status']}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div style={{ background: '#F8FAFC', borderRadius: 6, padding: 10 }}>
                    <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>GDV</p>
                    <p className="text-sm font-bold" style={{ color: '#0F172A' }}>₪{((deal['Estimated Sales Value GDV'] || 0) / 1000000).toFixed(1)}M</p>
                  </div>
                  <div style={{ background: margin >= 18 ? '#ECFDF5' : margin >= 15 ? '#FFFBEB' : '#FEF2F2', borderRadius: 6, padding: 10 }}>
                    <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>מרווח יזמי</p>
                    <p className="text-sm font-bold" style={{ color: margin >= 18 ? '#065F46' : margin >= 15 ? '#92400E' : '#991B1B' }}>{margin.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16" style={{ color: '#94A3B8' }}>
            <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">אין עסקאות</p>
          </div>
        )}
      </div>

      {/* Feasibility Modal */}
      {showModal && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 fade-in"
            style={{ background: 'rgba(0,0,0,.45)' }}
            onClick={e => e.target === e.currentTarget && setShowModal(false)}
          >
            <div
              className="bg-white w-full max-h-[90vh] overflow-y-auto fade-in"
              style={{ borderRadius: 12, maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
            >
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>דוח היתכנות מהיר</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>"דוח אפס" — ניתוח Gemini AI</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">
                <form onSubmit={handleFeasibility} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">עיר</label>
                      <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="תל אביב" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">שטח מוצע (מ"ר)</label>
                      <input type="number" value={form.sqm} onChange={e => setForm(f => ({ ...f, sqm: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="1200" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">גוש</label>
                      <input value={form.block} onChange={e => setForm(f => ({ ...f, block: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="6794" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">חלקה</label>
                      <input value={form.parcel} onChange={e => setForm(f => ({ ...f, parcel: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="152" required />
                    </div>
                  </div>
                  <button type="submit" disabled={analyzing}
                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
                    {analyzing ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />מנתח...</> : 'חשב היתכנות'}
                  </button>
                </form>

                {/* Result */}
                {result && (
                  <div className="mt-5 space-y-4 fade-in">
                    <div className={`p-4 rounded-xl text-center ${result.go_no_go === 'GO' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <span className={`text-3xl font-black ${result.go_no_go === 'GO' ? 'text-green-600' : 'text-red-600'}`}>
                        {result.go_no_go === 'GO' ? '✅ GO' : '❌ NO-GO'}
                      </span>
                      <p className="text-sm text-slate-500 mt-1">רמת סיכון: {result.risk_level}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label: 'שטח בנוי מקסימלי', value: `${result.max_built_area_sqm.toLocaleString()} מ"ר` },
                        { label: 'מחיר למ"ר', value: `₪${result.price_per_sqm_estimate.toLocaleString()}` },
                        { label: 'GDV כולל', value: `₪${(result.gdv_total / 1000000).toFixed(1)}M` },
                        { label: 'עלות בנייה', value: `₪${(result.construction_cost_estimate / 1000000).toFixed(1)}M` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-lg p-3">
                          <p className="text-slate-400 text-xs">{label}</p>
                          <p className="font-semibold text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Sensitivity Matrix */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <h4 className="font-semibold text-slate-700 mb-3 text-sm">מטריצת רגישות</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-500 flex justify-between">
                            <span>שינוי עלות בנייה</span>
                            <span className={sensitivity.costDelta > 0 ? 'text-red-500' : 'text-green-500'}>{sensitivity.costDelta > 0 ? '+' : ''}{sensitivity.costDelta}%</span>
                          </label>
                          <input type="range" min="-20" max="20" value={sensitivity.costDelta}
                            onChange={e => setSensitivity(s => ({ ...s, costDelta: Number(e.target.value) }))}
                            className="w-full mt-1" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 flex justify-between">
                            <span>שינוי מחיר מכירה</span>
                            <span className={sensitivity.priceDelta >= 0 ? 'text-green-500' : 'text-red-500'}>{sensitivity.priceDelta > 0 ? '+' : ''}{sensitivity.priceDelta}%</span>
                          </label>
                          <input type="range" min="-20" max="20" value={sensitivity.priceDelta}
                            onChange={e => setSensitivity(s => ({ ...s, priceDelta: Number(e.target.value) }))}
                            className="w-full mt-1" />
                        </div>
                        <div className={`p-3 rounded-lg text-center ${adjustedMargin < 15 ? 'bg-red-50' : 'bg-green-50'}`}>
                          <p className="text-xs text-slate-500">מרווח יזמי מתואם</p>
                          <p className={`text-xl font-bold ${adjustedMargin < 15 ? 'text-red-600' : 'text-green-600'}`}>
                            {adjustedMargin.toFixed(1)}%
                          </p>
                          {adjustedMargin < 15 && (
                            <p className="text-xs text-red-500 mt-1">⚠️ מתחת לסף המינימום (15%)</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg leading-relaxed">{result.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
