'use client';
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, subtitle, children, width = 460 }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: number
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 fade-in"
      style={{ background: 'rgba(15,31,61,.4)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white w-full max-h-[90vh] overflow-y-auto fade-in"
        style={{ borderRadius: 12, maxWidth: width, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: '#fff', borderRadius: '12px 12px 0 0' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>{title}</h3>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #CBD5E1', borderRadius: 6, padding: '8px 10px',
  fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#0F172A',
}

export function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, cursor: 'pointer', ...(props.style || {}) }} />
}

export function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={disabled}
      className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium text-sm transition-colors">
      {children}
    </button>
  )
}
