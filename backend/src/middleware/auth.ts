import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/config';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  tenantName: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AGENT';
  step?: '2fa_pending';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'לא מורשה — נדרשת התחברות' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;

    // Reject intermediate 2FA tokens
    if (payload.step === '2fa_pending') {
      return res.status(401).json({ error: 'נדרש אימות דו-שלבי' });
    }

    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'טוקן לא תקין או פג תוקף' });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'גישה מוגבלת למנהל על בלבד' });
  }
  return next();
}

// ─── Per-agent visibility (RBAC) ──────────────────────────────────────────────
// Managers (MANAGER / ADMIN / SUPER_ADMIN) see every conversation in the tenant and
// can manage agents. A plain AGENT sees only leads assigned to them.
export function isManager(req: Request): boolean {
  const r = req.user!.role;
  return r === 'MANAGER' || r === 'ADMIN' || r === 'SUPER_ADMIN';
}

// The most sensitive company-level actions (profile, plan, managing admins/managers)
// stay with true admins only — a MANAGER is deliberately below this.
export function isAdmin(req: Request): boolean {
  return req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
}

// A Prisma `where` fragment restricting leads to what the caller may see.
// Managers → {} (no restriction); agents → only their assigned leads.
export function leadScope(req: Request): Record<string, unknown> {
  return isManager(req) ? {} : { assignedTo: req.user!.username };
}

// Whether the caller may act on a specific lead, given that lead's assignedTo.
export function canAccessLead(req: Request, assignedTo: string | null): boolean {
  return isManager(req) || assignedTo === req.user!.username;
}
