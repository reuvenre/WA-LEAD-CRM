// ─── The business's own details — fill these ONCE, before launch ─────────────
//
// This is the only place the company's legal identity lives. The terms, privacy and
// accessibility pages, the marketing footer and every contact link read from here.
//
// While a value is an empty string the site treats itself as a DRAFT: the field shows
// as a [bracketed placeholder] and an amber "not ready for launch" banner appears on
// every legal page. Fill all eight and both disappear on their own — there is no
// second switch to remember to flip.
//
// ⚠️ Filling these does not substitute for having a lawyer read the documents.

export interface CompanyDetails {
  /** Registered business name, exactly as it appears on the company registration. */
  legalName: string;
  /** ח.פ / ע.מ number. */
  registration: string;
  /** Full postal address. */
  address: string;
  /** City whose courts have jurisdiction (terms of service). */
  city: string;
  /** Public contact phone, also used as the accessibility hotline. */
  phone: string;
  /** Public contact mailbox — legal, privacy and accessibility enquiries. */
  email: string;
  /** One sentence, e.g. "החזר מלא תוך 14 יום מהחיוב הראשון". */
  refundPolicy: string;
  /** Name of the person designated as accessibility coordinator (legally required). */
  accessibilityOfficer: string;
}

export const COMPANY: CompanyDetails = {
  legalName: '',
  registration: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  refundPolicy: '',
  accessibilityOfficer: '',
};

/** Every field filled = the legal pages are no longer a draft. */
export function isCompanyConfigured(): boolean {
  return Object.values(COMPANY).every((v) => v.trim().length > 0);
}

/** The fields still missing, for the pre-launch banner. */
export function missingCompanyFields(): string[] {
  return Object.entries(COMPANY).filter(([, v]) => !v.trim()).map(([k]) => k);
}
