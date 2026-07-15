// Opt-out / opt-in handling for inbound messages. A visitor texting "הסר" (or STOP)
// is removed from marketing broadcasts/drips; "הצטרף" re-subscribes. 1:1 conversation
// is never blocked — only bulk sends check `optedOut`.

import { prisma } from './prisma';
import { sendOutboundText } from './outbound';
import { logActivity } from './activity';

// Exact-match phrases (after trim + lowercase) so "אל תסיר את זה" doesn't trigger.
const OPT_OUT = new Set(['הסר', 'הסירו', 'הסירני', 'הסר אותי', 'להסיר', 'הסירו אותי', 'stop', 'unsubscribe', 'ביטול הרשמה']);
const OPT_IN = new Set(['הצטרף', 'הצטרפו', 'הרשם', 'הרשמה', 'start', 'subscribe']);

export type OptKind = 'out' | 'in';

// Classify a message as an opt-out / opt-in command, or null if it's a normal message.
export function classifyOptMessage(content: string): OptKind | null {
  const c = content.trim().toLowerCase();
  if (c.length > 20) return null; // commands are short; skip real sentences
  if (OPT_OUT.has(c)) return 'out';
  if (OPT_IN.has(c)) return 'in';
  return null;
}

// Apply the opt change and send a single confirmation. Best-effort (fire-and-forget).
export async function handleOptChange(tenantId: string, leadId: string, kind: OptKind): Promise<void> {
  try {
    const optedOut = kind === 'out';
    await prisma.lead.update({ where: { id: leadId }, data: { optedOut } });
    await logActivity(leadId, tenantId, optedOut ? 'הוסר מרשימת התפוצה' : 'הצטרף לרשימת התפוצה', 'לפי בקשת הלקוח בהודעה');
    const text = optedOut
      ? 'הוסרת מרשימת התפוצה ולא תקבל עוד הודעות שיווקיות. לשירותך בכל עת 🙏'
      : 'נרשמת מחדש לרשימת התפוצה. תודה! 🙌';
    // A compliance confirmation is expected even for an opt-out; don't count against the cap.
    await sendOutboundText(tenantId, leadId, text, { enforceDailyCap: false });
  } catch (err) {
    console.warn('handleOptChange failed:', (err as Error).message);
  }
}
