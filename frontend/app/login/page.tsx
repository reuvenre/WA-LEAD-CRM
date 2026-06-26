'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, MessageSquare, AlertCircle, Lock, User, ShieldCheck, UserPlus, KeyRound, Mail, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoginBackground } from '@/components/LoginBackground';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Explicitly offer the credentials to the browser's password manager (Chrome/Edge).
// This is needed for SPA logins (fetch + preventDefault never navigate, so the
// automatic save-password heuristic may not fire). Safe no-op where unsupported.
async function saveToPasswordManager(id: string, password: string) {
  try {
    const w = window as unknown as {
      PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential;
    };
    if (w.PasswordCredential && navigator.credentials?.store) {
      const cred = new w.PasswordCredential({ id, password, name: id });
      await navigator.credentials.store(cred);
    }
  } catch {
    /* unsupported or dismissed by user — ignore */
  }
}

type Step = 'credentials' | '2fa' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [needsCompany, setNeedsCompany] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step === '2fa') {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // ─── Step 1: credentials ────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('נא להזין שם משתמש'); return; }
    if (!password) { setError('נא להזין סיסמה'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          ...(companyEmail.trim() ? { companyEmail: companyEmail.trim() } : {}),
        }),
      });
      const data = await res.json() as { token?: string; tempToken?: string; requires2FA?: boolean; requiresCompany?: boolean; error?: string };

      if (!res.ok) {
        if (data.requiresCompany) setNeedsCompany(true);
        setError(data.error ?? 'שגיאה בהתחברות');
        return;
      }

      if (data.requires2FA && data.tempToken) {
        setTempToken(data.tempToken);
        setStep('2fa');
      } else if (data.token) {
        localStorage.setItem('crm_token', data.token);
        await saveToPasswordManager(username.trim(), password);
        router.push('/');
      }
    } catch {
      setError('לא ניתן להתחבר לשרת');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: 2FA ────────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpCode];
    next[index] = value;
    setOtpCode(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') handleVerify2FA();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const next = [...otpCode];
    digits.forEach((d, i) => { next[i] = d; });
    setOtpCode(next);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleVerify2FA = async () => {
    const code = otpCode.join('');
    if (code.length < 6) { setError('הזן קוד בן 6 ספרות'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/login/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code }),
      });
      const data = await res.json() as { token?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'קוד שגוי');
        setOtpCode(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
        return;
      }

      localStorage.setItem('crm_token', data.token!);
      await saveToPasswordManager(username.trim(), password);
      router.push('/');
    } catch {
      setError('שגיאה בשרת');
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot password ────────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!forgotEmail.trim()) { setError('נא להזין כתובת אימייל'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      await res.json();
      // Always show success (prevents email enumeration)
      setForgotSent(true);
    } catch {
      setError('לא ניתן להתחבר לשרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 p-4" dir="rtl">
      <LoginBackground />
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4 border border-white/20">
            {step === '2fa'
              ? <ShieldCheck className="w-8 h-8 text-white" />
              : <MessageSquare className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white">WA Lead CRM</h1>
          <p className="text-brand-200 text-sm mt-1">
            {step === '2fa' ? 'אימות דו-שלבי' : step === 'forgot' ? 'שחזור סיסמה' : 'מבית Win Solutions'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          {step === 'credentials' ? (
            <>
              <h2 className="text-lg font-bold text-slate-800 text-center">כניסה למערכת</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Username */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">שם משתמש</label>
                  <div className="relative">
                    <User className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text" value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="שם משתמש" name="username" id="username" autoComplete="username" dir="ltr"
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
                      placeholder="הזן סיסמה..." name="password" id="current-password" autoComplete="current-password" dir="ltr"
                      className={inputCls + ' pr-9 pl-10'}
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600 transition">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Company email — only shown when the username matches multiple companies */}
                {needsCompany && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">אימייל חברה</label>
                    <div className="relative">
                      <Mail className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="email" value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="email@company.com" autoComplete="email" dir="ltr"
                        className={inputCls + ' pr-9'}
                      />
                    </div>
                  </div>
                )}

                {error && <ErrorBox message={error} />}

                <button type="submit" disabled={loading || !username.trim() || !password}
                  className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50 shadow-soft">
                  {loading ? 'מתחבר...' : 'כניסה למערכת'}
                </button>
              </form>

              <button type="button" onClick={() => { setStep('forgot'); setError(''); setForgotSent(false); setForgotEmail(''); }}
                className="w-full text-center text-xs text-brand-600 hover:text-brand-700 font-semibold transition">
                <KeyRound className="w-3 h-3 inline ml-1" />
                שכחת סיסמה?
              </button>

              <div className="pt-1 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 mb-1">לקוח חדש?</p>
                <button onClick={() => router.push('/register')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition">
                  <UserPlus className="w-3.5 h-3.5" />
                  פתיחת חשבון חדש
                </button>
              </div>

            </>
          ) : step === 'forgot' ? (
            <>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-slate-800">שחזור סיסמה</h2>
                <p className="text-xs text-slate-500">הזן את כתובת האימייל הרשומה במערכת</p>
              </div>

              {forgotSent ? (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="font-bold text-green-700 text-sm">הקישור נשלח!</p>
                  <p className="text-xs text-slate-500">
                    אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה.
                    <br />בדוק את תיבת האימייל שלך.
                  </p>
                  <button onClick={() => { setStep('credentials'); setError(''); }}
                    className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition">
                    חזרה להתחברות
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">כתובת אימייל</label>
                    <div className="relative">
                      <Mail className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="email@company.com" dir="ltr" autoComplete="email"
                        className={inputCls + ' pr-9'} />
                    </div>
                  </div>

                  {error && <ErrorBox message={error} />}

                  <button type="submit" disabled={loading || !forgotEmail.trim()}
                    className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50 shadow-soft">
                    {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
                  </button>

                  <button type="button" onClick={() => { setStep('credentials'); setError(''); }}
                    className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition">
                    ← חזרה להתחברות
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-slate-800">אימות דו-שלבי</h2>
                <p className="text-xs text-slate-500">הזן את הקוד מאפליקציית Google Authenticator</p>
              </div>

              {/* OTP inputs */}
              <div className="flex justify-center gap-2" dir="ltr" onPaste={handleOtpPaste}>
                {otpCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={cn(
                      'w-11 h-14 text-center text-xl font-bold rounded-xl border-2 transition',
                      'focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200',
                      digit ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 bg-slate-50'
                    )}
                  />
                ))}
              </div>

              <p className="text-center text-xs text-slate-400">הקוד מתחדש כל 30 שניות</p>

              {error && <ErrorBox message={error} />}

              <div className="space-y-2">
                <button onClick={handleVerify2FA} disabled={loading || otpCode.join('').length < 6}
                  className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
                  {loading ? 'מאמת...' : 'אמת קוד'}
                </button>
                <button onClick={() => { setStep('credentials'); setError(''); setOtpCode(['', '', '', '', '', '']); }}
                  className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition">
                  ← חזרה להתחברות
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-brand-300 text-xs mt-6">
          מאובטח עם JWT + TOTP · סשן פעיל 8 שעות
        </p>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition';

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}
