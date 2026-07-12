export interface TokenPayload {
  userId: string;
  tenantId: string;
  tenantName: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AGENT';
  exp: number;
}

export function decodeToken(): TokenPayload | null {
  try {
    const token = localStorage.getItem('crm_token');
    if (!token) return null;
    const segment = token.split('.')[1];
    if (!segment) return null;

    // JWT uses base64url (- and _, no padding); atob expects standard base64.
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      segment.length + ((4 - (segment.length % 4)) % 4),
      '='
    );

    // decodeURIComponent + atob preserves UTF-8 (Hebrew) characters.
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json) as TokenPayload;

    // Treat an expired token as no identity (client-side trust only; server still enforces).
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'מנהל-על',
  ADMIN: 'אדמין',
  MANAGER: 'מנהל',
  AGENT: 'נציג',
};
