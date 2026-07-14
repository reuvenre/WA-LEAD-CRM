// Custom lead attributes: validate incoming values against the tenant's definitions,
// dropping unknown keys and coercing by declared type. Keeps arbitrary/oversized data
// out of the JSONB column.

export interface AttributeDef { key: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }

export function parseDefs(json: unknown): AttributeDef[] {
  return Array.isArray(json) ? (json as AttributeDef[]) : [];
}

/**
 * Return a clean attributes object containing only keys defined by `defs`, with values
 * coerced to their declared type (number → Number, select → must be an allowed option,
 * text → trimmed string, capped length). Unknown keys and empty values are dropped.
 */
export function sanitizeAttributes(defs: AttributeDef[], input: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  for (const def of defs) {
    if (!(def.key in src)) continue;
    const raw = src[def.key];
    if (raw === null || raw === undefined || raw === '') continue;
    if (def.type === 'number') {
      const n = Number(raw);
      if (Number.isFinite(n)) out[def.key] = n;
    } else if (def.type === 'select') {
      const v = String(raw);
      if (!def.options || def.options.includes(v)) out[def.key] = v;
    } else {
      out[def.key] = String(raw).slice(0, 500);
    }
  }
  return out;
}
