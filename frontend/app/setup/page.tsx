'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, Eye, EyeOff, Copy, AlertCircle, CheckCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PASSWORD_RULES = [
  { label: 'מינימום 12 תווים', test: (p: string) => p.length >= 12 },
  { label: 'אות גדולה באנגלית (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'תו מיוחד (!@#$%^&*)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ AUTH_USERNAME: string; AUTH_PASSWORD_HASH: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Verify setup is actually needed
  useEffect(() => {
    fetch(`${API}/api/auth/needs-setup`)
      .then((r) => r.json())
      .then((data: { needsSetup: boolean }) => {
        if (!data.needsSetup) {
          router.replace('/login');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError('נא להזין שם משתמש'); return; }
    if (!passwordValid) { setError('הסיסמה אינה עומדת בדרישות'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json() as { envVars?: { AUTH_USERNAME: string; AUTH_PASSWORD_HASH: string }; error?: string };
      if (!res.ok) { setError(data.error ?? 'שגיאה'); return; }
      setResult(data.envVars!);
    } catch {
      setError('לא ניתן להתחבר לשרת');
    } finally {
      setLoading(false);
    }
  };

  const envText = result
    ? `AUTH_USERNAME=${result.AUTH_USERNAME}\nAUTH_PASSWORD_HASH=${result.AUTH_PASSWORD_HASH}`
    : '';

  const copyEnv = () => {
    navigator.clipboard.writeText(envText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900">
        <div className="w-8 h-8 rounded-full border-4 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4 border border-white/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WA Lead CRM</h1>
          <p className="text-brand-200 text-sm mt-1">מבית Win Solutions · הגדרה ראשונית</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          {result ? (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-green-700">המשתמש נוצר בהצלחה!</p>
                <p className="text-xs text-slate-500 mt-1">הוסף את השורות הבאות לקובץ <code className="bg-slate-100 px-1 rounded">.env</code> של השרת:</p>
              </div>

              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">backend/.env</span>
                  <button onClick={copyEnv} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition">
                    <Copy className="w-3 h-3" />
                    {copied ? 'הועתק!' : 'העתק'}
                  </button>
                </div>
                <pre className="text-green-400 text-[11px] font-mono whitespace-pre-wrap break-all">{envText}</pre>
              </div>

              <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700 text-center">
                ⚠️ הפעל מחדש את השרת לאחר עדכון ה-.env, ואז התחבר עם הפרטים שבחרת
              </div>

              <button
                onClick={() => router.push('/login')}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition"
              >
                עבור לדף הכניסה
              </button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-800 text-center">יצירת משתמש ראשוני</h2>
                <p className="text-xs text-slate-500 text-center mt-1">הגדר שם משתמש וסיסמה לגישה למערכת</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">שם משתמש</label>
                  <div className="relative">
                    <User className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text" value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin" dir="ltr"
                      className={inputCls + ' pr-9'}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">סיסמה</label>
                  <div className="relative">
                    <Lock className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="לפחות 12 תווים..." dir="ltr"
                      className={inputCls + ' pr-9 pl-10'}
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600 transition">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <div key={rule.label} className={cn('flex items-center gap-2 text-xs transition-colors duration-200', ok ? 'text-green-600' : 'text-slate-400')}>
                          <span className={cn(
                            'w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200',
                            ok ? 'bg-green-500' : 'bg-slate-200'
                          )}>
                            {ok && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </span>
                          {rule.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading || !username.trim() || !passwordValid}
                  className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50 shadow-soft">
                  {loading ? 'יוצר...' : 'צור משתמש'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-brand-300 text-xs mt-6">
          דף זה נגיש רק בהגדרה ראשונית של המערכת
        </p>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition';
