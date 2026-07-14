import type { Request, Response, NextFunction } from 'express';
import { TenantPlan } from '@prisma/client';
import { prisma } from './prisma';

// ─── Plan entitlements: the single source of truth ────────────────────────────
// Add a plan → add a row here, and nothing else in the app needs to change.
export interface Entitlements {
  maxLines: number;
  maxUsers: number;
  maxLeads: number;
  dailyMsgCapPerLine: number;
  maxTemplates: number;
  maxAutomations: number;
  features: {
    multiLine: boolean;
    automations: boolean;
    analytics: boolean;
    googleCalendar: boolean;
    apifyLive: boolean;   // live Yad2 listings pull vs. the local estimator
    listings: boolean;    // the "דירות יד שניה" module (nav + screen). Off = a future paid upsell.
    apiAccess: boolean;
    autoReplies: boolean; // greeting / off-hours / away auto-messages
    roundRobin: boolean;  // auto-assign new leads across agents
    scheduledMessages: boolean; // send-later
    customAttributes: boolean;  // per-tenant custom lead fields
    webchat: boolean;     // embeddable website chat widget
  };
}

const INF = Number.POSITIVE_INFINITY;

export const ENTITLEMENTS: Record<TenantPlan, Entitlements> = {
  TRIAL: {
    maxLines: 1, maxUsers: 2, maxLeads: 100, dailyMsgCapPerLine: 50,
    maxTemplates: 5, maxAutomations: 0,
    features: {
      multiLine: false, automations: false, analytics: false, googleCalendar: false,
      apifyLive: false, listings: false, apiAccess: false,
      autoReplies: false, roundRobin: false, scheduledMessages: false, customAttributes: false,
      webchat: false,
    },
  },
  BASIC: {
    maxLines: 1, maxUsers: 3, maxLeads: 1_500, dailyMsgCapPerLine: 150,
    maxTemplates: 20, maxAutomations: 2,
    features: {
      multiLine: false, automations: true, analytics: true, googleCalendar: true,
      apifyLive: false, listings: false, apiAccess: false,
      autoReplies: true, roundRobin: true, scheduledMessages: true, customAttributes: true,
      webchat: true,
    },
  },
  PRO: {
    maxLines: 5, maxUsers: 15, maxLeads: 25_000, dailyMsgCapPerLine: 300,
    maxTemplates: INF, maxAutomations: INF,
    // `listings` is intentionally OFF for now — the second-hand module ships hidden as a
    // future paid upgrade. Flip this to `true` when it's ready to sell.
    features: {
      multiLine: true, automations: true, analytics: true, googleCalendar: true,
      apifyLive: true, listings: false, apiAccess: true,
      autoReplies: true, roundRobin: true, scheduledMessages: true, customAttributes: true,
      webchat: true,
    },
  },
};

export function entitlementsFor(plan: TenantPlan): Entitlements {
  return ENTITLEMENTS[plan] ?? ENTITLEMENTS.TRIAL;
}

async function planOf(tenantId: string): Promise<TenantPlan> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  return t?.plan ?? 'TRIAL';
}

export async function featuresFor(tenantId: string) {
  return entitlementsFor(await planOf(tenantId)).features;
}

// ─── Feature gate — usable as router/route middleware ─────────────────────────
export function requireFeature(feature: keyof Entitlements['features']) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const feats = await featuresFor(req.user!.tenantId);
    if (!feats[feature]) {
      return res.status(403).json({ error: 'התכונה אינה זמינה במסלול הנוכחי — נדרש שדרוג', upgrade: true, feature });
    }
    return next();
  };
}

// ─── Count-based limit — call before creating a row of `model` ────────────────
// Returns true if OK to proceed; sends a 402 and returns false when at the cap.
type CountModel = 'user' | 'lead' | 'line' | 'template' | 'automationWebhook';
const LIMIT_KEY: Record<CountModel, keyof Entitlements> = {
  user: 'maxUsers', lead: 'maxLeads', line: 'maxLines', template: 'maxTemplates', automationWebhook: 'maxAutomations',
};

export async function checkLimit(req: Request, res: Response, model: CountModel): Promise<boolean> {
  const tenantId = req.user!.tenantId;
  const cap = entitlementsFor(await planOf(tenantId))[LIMIT_KEY[model]] as number;
  if (cap === INF) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const used = await (prisma as any)[model].count({ where: { tenantId } });
  if (used >= cap) {
    res.status(402).json({ error: `הגעת למגבלת המסלול (${cap}) — נדרש שדרוג`, upgrade: true, model, cap, used });
    return false;
  }
  return true;
}

// ─── Daily anti-ban cap, using the existing Line.dailyCount columns ───────────
// Core (Express-free — also callable from job handlers, e.g. scheduled sends and
// broadcast campaigns): resets the counter when the date rolls over, increments it,
// and reports whether the send may proceed.
export async function tryBumpDailyCap(
  tenantId: string,
  line: { id: string; dailyCount: number; dailyCountDate: Date | null } | null,
): Promise<{ ok: boolean; cap: number }> {
  const cap = entitlementsFor(await planOf(tenantId)).dailyMsgCapPerLine;
  if (!line) return { ok: true, cap }; // no line yet (legacy tenant) — the tenant-level creds still send
  const today = new Date().toISOString().slice(0, 10);
  const lineDay = line.dailyCountDate?.toISOString().slice(0, 10) ?? null;
  const countToday = lineDay === today ? line.dailyCount : 0;
  if (countToday >= cap) return { ok: false, cap };
  await prisma.line.update({
    where: { id: line.id },
    data: { dailyCount: lineDay === today ? { increment: 1 } : 1, dailyCountDate: new Date() },
  });
  return { ok: true, cap };
}

// Express wrapper: call right before an outbound send from a route handler.
// Returns true if the send may proceed; sends the 429 itself otherwise.
export async function checkAndBumpDailyCap(
  req: Request, res: Response,
  line: { id: string; dailyCount: number; dailyCountDate: Date | null } | null,
): Promise<boolean> {
  const { ok, cap } = await tryBumpDailyCap(req.user!.tenantId, line);
  if (!ok) {
    res.status(429).json({ error: `הגעת למגבלת ההודעות היומית (${cap}) — הגנת אנטי-באן`, upgrade: true });
  }
  return ok;
}
