'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useAuth() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for a valid session token. (The old first-boot /setup flow is gone —
    // onboarding happens via /register.)
    const token = localStorage.getItem('crm_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    fetch(`${API}/api/auth/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { valid: boolean }) => {
        if (!d.valid) {
          localStorage.removeItem('crm_token');
          router.replace('/login');
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        // Can't verify the session — fail closed and send the user to login
        // rather than rendering an authenticated-looking shell on a bogus token.
        router.replace('/login');
      });
  }, [router]);

  const logout = () => {
    localStorage.removeItem('crm_token');
    router.replace('/login');
  };

  return { ready, logout };
}
