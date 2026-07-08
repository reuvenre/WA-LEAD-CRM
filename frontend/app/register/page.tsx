'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Building2, Mail, User, Lock, Eye, EyeOff, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoginBackground } from '@/components/LoginBackground';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PASSWORD_RULES = [
  { label: 'מינימום 12 תווים', test: (p: string) => p.length >= 12 },
  { label: 'אות גדולה באנגלית (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'תו מיוחד (!@#$%^&*)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!companyName.trim()) { setError('נא להזין שם חברה'); return; }
    if (!email.trim()) { setError('נא להזין כתובת אימייל'); return; }
    if (!username.trim()) { setError('נא להזין שם משתמש'); return; }
    if (!passwordValid) { setError('הסיסמה אינה עומדת בדרישות'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, email, username, password }),
      });
      const data = await res.json() as { token?: string; error?: string };

      if (!res.ok) { setError(data.error ?? 'שגיאה בהרשמה'); return; }

      localStorage.setItem('crm_token', data.token!);
      router.push('/');
    } catch {
      setError('לא ניתן להתחבר לשרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#1e63c8] via-[#5b9be8] to-[#cfe3f7] p-4" dir="rtl">
      <LoginBackground />
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4 border border-white/20">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WA Lead CRM</h1>
          <p className="text-brand-200 text-sm mt-1">מבית Win Solutions</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">הרשמה למערכת</h2>
            <p className="text-xs text-slate-500 mt-1">ניסיון חינם ל-14 ימים, ללא כרטיס אשראי</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">שם החברה / העסק</label>
              <div className="relative">
                <Building2 className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text" value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="לדוגמה: סוכנות Win Solutions"
                  className={inputCls + ' pr-9'}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">אימייל</label>
              <div className="relative">
                <Mail className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" dir="ltr"
                  className={inputCls + ' pr-9'}
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">שם משתמש לכניסה</label>
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

              {/* Password rules */}
              <div className="mt-2 space-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <div key={rule.label} className={cn('flex items-center gap-2 text-xs transition-colors duration-200', ok ? 'text-green-600' : 'text-slate-400')}>
                      <span className={cn('w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200', ok ? 'bg-green-500' : 'bg-slate-200')}>
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

            <button type="submit"
              disabled={loading || !companyName.trim() || !email.trim() || !username.trim() || !passwordValid}
              className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50 shadow-soft">
              {loading ? 'יוצר חשבון...' : 'צור חשבון והתחל'}
            </button>
          </form>

          <div className="text-center pt-1 border-t border-slate-100">
            <button onClick={() => router.push('/login')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 transition">
              <ArrowRight className="w-3.5 h-3.5" />
              יש לך כבר חשבון? כניסה למערכת
            </button>
          </div>
        </div>

        <p className="text-center text-[#15356a] text-xs mt-6 font-medium">
          מאובטח עם JWT · נתונים מוצפנים · תמיכה בעברית
        </p>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition';
