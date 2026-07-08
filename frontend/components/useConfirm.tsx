'use client';

import { useState, useCallback } from 'react';

type Pending = { message: string; danger: boolean; resolve: (ok: boolean) => void };

/**
 * Promise-based confirm dialog — a Hebrew RTL replacement for the native confirm(),
 * which renders English OK/Cancel buttons in an LTR chrome. Usage:
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm('למחוק?'))) return;
 *   ...  and render {dialog} once in the component tree.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (message: string, opts?: { danger?: boolean }) =>
      new Promise<boolean>((resolve) => setPending({ message, danger: opts?.danger ?? true, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={() => close(false)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-slate-700 mb-4 whitespace-pre-line leading-relaxed">{pending.message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 rounded-lg border border-surface-border text-sm text-slate-600 hover:bg-surface-subtle transition"
          >
            ביטול
          </button>
          <button
            onClick={() => close(true)}
            className={
              'px-4 py-2 rounded-lg text-white text-sm font-semibold transition ' +
              (pending.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700')
            }
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
