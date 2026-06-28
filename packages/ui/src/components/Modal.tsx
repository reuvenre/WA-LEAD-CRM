import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Max width in px. */
  width?: number;
  children: ReactNode;
}

/** Centered dialog with a dimmed backdrop. Closes on backdrop click. */
export function Modal({ open, onClose, title, subtitle, width = 460, children }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 re-fade-in"
      style={{ background: 'rgba(15,31,61,.45)' }}
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="px-5 pt-5 pb-3 border-b border-surface-border">
            {title && <h3 className="text-base font-bold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
