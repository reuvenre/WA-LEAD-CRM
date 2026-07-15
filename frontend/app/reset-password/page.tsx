'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoginBackground } from '@/components/LoginBackground';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PASSWORD_RULES = [
  { label: 'מינימום 12 תווים', test: (p: string) => p.length >= 12 },
  { label: 'אות גדולה (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'תו מיוחד (!@#$...)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1e63c8] via-[#5b9be8] to-[#cfe3f7]">
        <div className="w-8 h-8 rounded-full border-4 border-white/40 border-t-white animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const allValid = PASSWORD_RULES.every((r) => r.test(newPassword));

  useEffect(() => {
    if (!token) {
      setError('קישור לא תקין — חסר טוקן');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!allValid) { setError('הסיסמה אינה עומדת בדרישות'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'שגיאה באיפוס הסיסמה');
        return;
      }
      setSuccess(true);
    } catch {
      setError('לא ניתן להתחבר לשרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#1e63c8] via-[#5b9be8] to-[#cfe3f7] p-4" dir="rtl">
      <LoginBackground />
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="Real Estate Lead CRM" className="w-full h-full object-contain p-3.5" />
          </div>
          <h1 className="text-3xl font-bold text-white">Real Estate Lead CRM</h1>
          <p className="text-white/90 text-sm font-semibold tracking-wide mt-1.5">מבית WIN SOLUTIONS</p>
          <p className="text-brand-200 text-sm mt-1">איפוס סיסמה</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">הסיסמה אופסה בהצלחה!</h2>
              <p className="text-xs text-slate-500">כעת ניתן להתחבר עם הסיסמה החדשה</p>
              <button onClick={() => router.push('/login')}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition shadow-soft">
                כניסה למערכת
              </button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-slate-800">הגדר סיסמה חדשה</h2>
                <p className="text-xs text-slate-500">הזן סיסמה חדשה לחשבון שלך</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">סיסמה חדשה</label>
                  <div className="relative">
                    <Lock className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="לפחות 12 תווים..."
                      dir="ltr"
                      autoComplete="new-password"
                      className="w-full pr-9 pl-10 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600 transition">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password rules */}
                <div className="space-y-1.5">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(newPassword);
                    return (
                      <div key={rule.label} className={cn('flex items-center gap-2 text-xs transition-colors', ok ? 'text-green-600' : 'text-slate-400')}>
                        <span className={cn('w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all', ok ? 'bg-green-500' : 'bg-slate-200')}>
                          {ok && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                        {rule.label}
                      </div>
                    );
                  })}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading || !allValid || !token}
                  className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50 shadow-soft">
                  {loading ? 'מאפס...' : 'אפס סיסמה'}
                </button>

                <button type="button" onClick={() => router.push('/login')}
                  className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition">
                  ← חזרה להתחברות
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[#15356a] text-xs mt-6 font-medium">
          מאובטח עם JWT + TOTP · סשן פעיל 8 שעות
        </p>
      </div>
    </div>
  );
}
