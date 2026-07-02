import type { Lead } from '@/types';

/**
 * Replaces {{variable}} placeholders in a template body with lead data.
 * Supported: {{שם}}, {{טלפון}}, {{סטטוס}}, {{נציג}}
 */
export function applyTemplateVars(body: string, lead: Lead): string {
  const STATUS_LABELS: Record<string, string> = {
    NEW: 'חדש', IN_PROGRESS: 'בטיפול', HOT: 'חם', CLOSED: 'סגור', LOST: 'הפסד',
  };

  // Function replacers: a literal string replacement would interpret $-sequences
  // (e.g. a lead name containing "$'") as special patterns and garble the output.
  return body
    .replace(/\{\{שם\}\}/g, () => lead.name)
    .replace(/\{\{טלפון\}\}/g, () => lead.phone)
    .replace(/\{\{סטטוס\}\}/g, () => STATUS_LABELS[lead.status] ?? lead.status)
    .replace(/\{\{נציג\}\}/g, () => lead.assignedTo ?? '')
    .replace(/\{\{name\}\}/g, () => lead.name)
    .replace(/\{\{phone\}\}/g, () => lead.phone);
}
