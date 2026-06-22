// Google Calendar — one-way sync (CRM → Google), per user.
// Inert until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are configured.

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';
import { prisma } from './prisma';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

// ─── OAuth ────────────────────────────────────────────────────────────────────
export function buildAuthUrl(userId: string): string {
  // Sign the userId into `state` (JWT) so the public callback can trust it.
  const state = jwt.sign({ userId, kind: 'google_oauth' }, JWT_SECRET, { expiresIn: '15m' });
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function verifyState(state: string): string | null {
  try {
    const p = jwt.verify(state, JWT_SECRET) as { userId: string; kind: string };
    return p.kind === 'google_oauth' ? p.userId : null;
  } catch {
    return null;
  }
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Google token endpoint error ${r.status}`);
  return (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function exchangeCode(code: string) {
  return tokenRequest({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const data = await tokenRequest({
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  return data.access_token;
}

export async function getGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { email?: string };
    return d.email ?? null;
  } catch {
    return null;
  }
}

// ─── Calendar event sync ────────────────────────────────────────────────────────
type SyncableLead = {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  meetingDate: Date | null;
  meetingNotes: string | null;
  googleEventId: string | null;
  googleCalendarUserId: string | null;
};

function eventBody(lead: SyncableLead) {
  const start = lead.meetingDate as Date;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    summary: `פגישה: ${lead.name}`,
    description: [lead.meetingNotes, `טלפון: +${lead.phone}`, lead.company]
      .filter(Boolean)
      .join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

/**
 * Reflects a lead's meeting into the owner's Google Calendar (one-way).
 * - owner = the calendar that already holds the event, else the acting user.
 * - meeting set   → create or update the event
 * - meeting clear → delete the event
 * Best-effort: never throws (callers fire-and-forget); errors are logged.
 */
export async function syncLeadMeeting(lead: SyncableLead, actingUserId: string): Promise<void> {
  try {
    if (!isGoogleConfigured()) return;

    const ownerId = lead.googleCalendarUserId || actingUserId;
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner?.googleRefreshToken) return; // owner hasn't connected Google

    const accessToken = await getAccessToken(owner.googleRefreshToken);
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Meeting cleared → delete any existing event
    if (!lead.meetingDate) {
      if (lead.googleEventId) {
        await fetch(`${CAL_BASE}/${lead.googleEventId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { googleEventId: null, googleCalendarUserId: null },
        });
      }
      return;
    }

    const body = JSON.stringify(eventBody(lead));

    // Update existing event
    if (lead.googleEventId) {
      const r = await fetch(`${CAL_BASE}/${lead.googleEventId}`, {
        method: 'PATCH',
        headers: authHeader,
        body,
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) return;
      if (r.status !== 404) return; // transient error — leave as-is
      // 404 → event was deleted in Google; fall through to recreate
    }

    // Create new event
    const r = await fetch(CAL_BASE, { method: 'POST', headers: authHeader, body, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const created = (await r.json()) as { id?: string };
    if (created.id) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { googleEventId: created.id, googleCalendarUserId: ownerId },
      });
    }
  } catch (err) {
    console.warn('Google Calendar sync failed:', err);
  }
}
