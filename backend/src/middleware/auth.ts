import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/config';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  tenantName: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';
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
