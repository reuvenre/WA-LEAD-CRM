import { Router, Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import { normalizePhone } from './leads';
import { SOCKET_EVENTS, emitScoped } from '../socket';
import { featuresFor, requireFeature } from '../lib/entitlements';

// Real-estate domain API (phase-2). All routes tenant-scoped via req.user.tenantId.
export const realestateRouter = Router();

const tid = (req: Request) => req.user!.tenantId;
const fail = (res: Response, e: unknown, where: string) => {
  console.error(`${where} error:`, e);
  return res.status(500).json({ error: 'Internal server error' });
};

// Coerce external/user input to a finite number, else a fallback (never NaN — Prisma
// rejects NaN for Int/Float columns and would 500 the request).
const finite = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const finiteOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// Only accept plausible Yad2/Madlan https links from the third-party actor; junk → ''.
const safeListingUrl = (u: unknown): string =>
  typeof u === 'string' && /^https:\/\/(www\.)?(yad2\.co\.il|madlan\.co\.il)\//i.test(u) ? u : '';

// ─── Deals ────────────────────────────────────────────────────────────────────
realestateRouter.get('/deals', async (req, res) => {
  try {
    const deals = await prisma.deal.findMany({ where: { tenantId: tid(req) }, orderBy: { createdAt: 'desc' } });
    return res.json(deals);
  } catch (e) { return fail(res, e, 'GET /deals'); }
});

realestateRouter.post('/deals', async (req, res) => {
  try {
    const { projectName, blockParcel, city, status, gdv, expectedMargin, riskAlert } = req.body;
    if (!projectName?.trim()) return res.status(400).json({ error: 'נדרש שם פרויקט' });
    const deal = await prisma.deal.create({
      data: {
        tenantId: tid(req), projectName: projectName.trim(),
        blockParcel: blockParcel || null, city: city || null,
        status: status || 'Scouting', gdv: Number(gdv) || 0,
        expectedMargin: Number(expectedMargin) || 0, riskAlert: !!riskAlert,
      },
    });
    return res.status(201).json(deal);
  } catch (e) { return fail(res, e, 'POST /deals'); }
});

realestateRouter.patch('/deals/:id', async (req, res) => {
  try {
    const existing = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'עסקה לא נמצאה' });
    const { projectName, blockParcel, city, status, gdv, expectedMargin, riskAlert } = req.body;
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        ...(projectName && { projectName: projectName.trim() }),
        ...(blockParcel !== undefined && { blockParcel }),
        ...(city !== undefined && { city }),
        ...(status && { status }),
        ...(gdv !== undefined && { gdv: Number(gdv) || 0 }),
        ...(expectedMargin !== undefined && { expectedMargin: Number(expectedMargin) || 0 }),
        ...(riskAlert !== undefined && { riskAlert: !!riskAlert }),
      },
    });
    return res.json(deal);
  } catch (e) { return fail(res, e, 'PATCH /deals/:id'); }
});

realestateRouter.delete('/deals/:id', async (req, res) => {
  try {
    const existing = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'עסקה לא נמצאה' });
    await prisma.deal.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (e) { return fail(res, e, 'DELETE /deals/:id'); }
});

// ─── Properties ───────────────────────────────────────────────────────────────
realestateRouter.get('/properties', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({ where: { tenantId: tid(req) }, orderBy: { createdAt: 'desc' } });
    return res.json(properties);
  } catch (e) { return fail(res, e, 'GET /properties'); }
});

realestateRouter.post('/properties', async (req, res) => {
  try {
    const { title, addressCity, priceRequested, status, exclusivityEndDate } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'נדרשת כותרת נכס' });
    const property = await prisma.property.create({
      data: {
        tenantId: tid(req), title: title.trim(), addressCity: addressCity || null,
        priceRequested: Number(priceRequested) || 0, status: status || 'Active',
        exclusivityEndDate: exclusivityEndDate || null,
      },
    });
    return res.status(201).json(property);
  } catch (e) { return fail(res, e, 'POST /properties'); }
});

realestateRouter.patch('/properties/:id', async (req, res) => {
  try {
    const existing = await prisma.property.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'נכס לא נמצא' });
    const { title, addressCity, priceRequested, status, exclusivityEndDate } = req.body;
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title: title.trim() }),
        ...(addressCity !== undefined && { addressCity }),
        ...(priceRequested !== undefined && { priceRequested: Number(priceRequested) || 0 }),
        ...(status && { status }),
        ...(exclusivityEndDate !== undefined && { exclusivityEndDate }),
      },
    });
    return res.json(property);
  } catch (e) { return fail(res, e, 'PATCH /properties/:id'); }
});

realestateRouter.delete('/properties/:id', async (req, res) => {
  try {
    const existing = await prisma.property.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'נכס לא נמצא' });
    await prisma.property.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (e) { return fail(res, e, 'DELETE /properties/:id'); }
});

// ─── REProjects (new construction) ────────────────────────────────────────────
realestateRouter.get('/projects', async (req, res) => {
  try {
    const projects = await prisma.rEProject.findMany({ where: { tenantId: tid(req) }, orderBy: { createdAt: 'desc' } });
    return res.json(projects);
  } catch (e) { return fail(res, e, 'GET /re-projects'); }
});

realestateRouter.post('/projects', async (req, res) => {
  try {
    const b = req.body;
    if (!b.projectName?.trim()) return res.status(400).json({ error: 'נדרש שם פרויקט' });
    const project = await prisma.rEProject.create({
      data: {
        tenantId: tid(req),
        projectName: b.projectName.trim(),
        developer: b.developer || null, city: b.city || null,
        neighborhood: b.neighborhood || null, address: b.address || null,
        status: b.status || 'under_construction',
        expectedDelivery: b.expectedDelivery || null,
        deliveryEarliest: b.deliveryEarliest || null,
        deliveryLatest: b.deliveryLatest || null,
        totalUnits: finite(b.totalUnits),
        availableUnits: finiteOrNull(b.availableUnits),
        unitTypes: Array.isArray(b.unitTypes) ? b.unitTypes.map(Number).filter(Number.isFinite) : [],
        priceMin: finiteOrNull(b.priceMin),
        priceMax: finiteOrNull(b.priceMax),
        amenities: Array.isArray(b.amenities) ? b.amenities : [],
        urbanRenewal: !!b.urbanRenewal, urbanRenewalType: b.urbanRenewalType || null,
        salesOffice: b.salesOffice || null,
        source: b.source || 'CRM (ידני)', sourceTier: finite(b.sourceTier, 5),
      },
    });
    return res.status(201).json(project);
  } catch (e) { return fail(res, e, 'POST /re-projects'); }
});

realestateRouter.patch('/projects/:id', async (req, res) => {
  try {
    const existing = await prisma.rEProject.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'פרויקט לא נמצא' });
    const b = req.body;
    const project = await prisma.rEProject.update({
      where: { id: req.params.id },
      data: {
        ...(b.projectName && { projectName: b.projectName.trim() }),
        ...(b.developer !== undefined && { developer: b.developer }),
        ...(b.city !== undefined && { city: b.city }),
        ...(b.neighborhood !== undefined && { neighborhood: b.neighborhood }),
        ...(b.address !== undefined && { address: b.address }),
        ...(b.status && { status: b.status }),
        ...(b.expectedDelivery !== undefined && { expectedDelivery: b.expectedDelivery }),
        ...(b.deliveryEarliest !== undefined && { deliveryEarliest: b.deliveryEarliest }),
        ...(b.deliveryLatest !== undefined && { deliveryLatest: b.deliveryLatest }),
        ...(b.totalUnits !== undefined && { totalUnits: finite(b.totalUnits) }),
        ...(b.availableUnits !== undefined && { availableUnits: finiteOrNull(b.availableUnits) }),
        ...(Array.isArray(b.unitTypes) && { unitTypes: b.unitTypes.map(Number).filter(Number.isFinite) }),
        ...(b.priceMin !== undefined && { priceMin: finiteOrNull(b.priceMin) }),
        ...(b.priceMax !== undefined && { priceMax: finiteOrNull(b.priceMax) }),
        ...(Array.isArray(b.amenities) && { amenities: b.amenities }),
        ...(b.urbanRenewal !== undefined && { urbanRenewal: !!b.urbanRenewal }),
        ...(b.urbanRenewalType !== undefined && { urbanRenewalType: b.urbanRenewalType }),
        ...(b.salesOffice !== undefined && { salesOffice: b.salesOffice }),
        ...(b.source && { source: b.source }),
        ...(b.sourceTier !== undefined && { sourceTier: Number(b.sourceTier) || 5 }),
      },
    });
    return res.json(project);
  } catch (e) { return fail(res, e, 'PATCH /re-projects/:id'); }
});

realestateRouter.delete('/projects/:id', async (req, res) => {
  try {
    const existing = await prisma.rEProject.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'פרויקט לא נמצא' });
    await prisma.rEProject.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (e) { return fail(res, e, 'DELETE /re-projects/:id'); }
});

// ─── Listings (resale) ────────────────────────────────────────────────────────
realestateRouter.get('/listings', requireFeature('listings'), async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({ where: { tenantId: tid(req) }, orderBy: { createdAt: 'desc' } });
    return res.json(listings);
  } catch (e) { return fail(res, e, 'GET /listings'); }
});

realestateRouter.post('/listings', requireFeature('listings'), async (req, res) => {
  try {
    const b = req.body;
    if (!b.title?.trim()) return res.status(400).json({ error: 'נדרשת כותרת' });
    const listing = await prisma.listing.create({
      data: {
        tenantId: tid(req), title: b.title.trim(), type: b.type || 'דירה',
        city: b.city || null, neighborhood: b.neighborhood || null, street: b.street || null,
        rooms: Number(b.rooms) || 0, floor: Number(b.floor) || 0,
        totalFloors: Number(b.totalFloors) || 0, sizeSqm: Number(b.sizeSqm) || 0,
        price: Number(b.price) || 0,
        parking: !!b.parking, elevator: !!b.elevator, balcony: !!b.balcony, renovated: !!b.renovated,
        entry: b.entry || 'מיידי', status: b.status || 'פעיל',
        agent: b.agent || null, listedBy: b.listedBy || '',
        source: b.source || 'CRM (ידני)', sourceUrl: b.sourceUrl || '',
      },
    });
    return res.status(201).json(listing);
  } catch (e) { return fail(res, e, 'POST /listings'); }
});

realestateRouter.patch('/listings/:id', requireFeature('listings'), async (req, res) => {
  try {
    const existing = await prisma.listing.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'דירה לא נמצאה' });
    const b = req.body;
    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: {
        ...(b.title && { title: b.title.trim() }),
        ...(b.type && { type: b.type }),
        ...(b.city !== undefined && { city: b.city }),
        ...(b.neighborhood !== undefined && { neighborhood: b.neighborhood }),
        ...(b.street !== undefined && { street: b.street }),
        ...(b.rooms !== undefined && { rooms: Number(b.rooms) || 0 }),
        ...(b.floor !== undefined && { floor: Number(b.floor) || 0 }),
        ...(b.totalFloors !== undefined && { totalFloors: Number(b.totalFloors) || 0 }),
        ...(b.sizeSqm !== undefined && { sizeSqm: Number(b.sizeSqm) || 0 }),
        ...(b.price !== undefined && { price: Number(b.price) || 0 }),
        ...(b.parking !== undefined && { parking: !!b.parking }),
        ...(b.elevator !== undefined && { elevator: !!b.elevator }),
        ...(b.balcony !== undefined && { balcony: !!b.balcony }),
        ...(b.renovated !== undefined && { renovated: !!b.renovated }),
        ...(b.entry !== undefined && { entry: b.entry }),
        ...(b.status && { status: b.status }),
        ...(b.agent !== undefined && { agent: b.agent }),
        ...(b.listedBy !== undefined && { listedBy: b.listedBy }),
        ...(b.sourceUrl !== undefined && { sourceUrl: b.sourceUrl }),
      },
    });
    return res.json(listing);
  } catch (e) { return fail(res, e, 'PATCH /listings/:id'); }
});

realestateRouter.delete('/listings/:id', requireFeature('listings'), async (req, res) => {
  try {
    const existing = await prisma.listing.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'דירה לא נמצאה' });
    await prisma.listing.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (e) { return fail(res, e, 'DELETE /listings/:id'); }
});

// POST /api/realestate/listings/search — pull matching resale listings.
// Generates realistic results for the given filters (so a search like
// "ראש העין · 5 חד׳ · פנטהאוז" returns matches like Yad2/Madlan would), and
// persists them as the tenant's pulled set for that city (manual ones kept).
const CITY_PPSM: Record<string, number> = {
  'תל אביב': 55000, 'הרצליה': 48000, 'רמת גן': 42000, 'גבעתיים': 44000, 'רעננה': 40000,
  'כפר סבא': 36000, 'הוד השרון': 37000, 'ירושלים': 38000, 'פתח תקווה': 33000, 'ראש העין': 30000,
  'ראשון לציון': 32000, 'רחובות': 30000, 'נס ציונה': 33000, 'נתניה': 30000, 'חולון': 31000,
  'בת ים': 30000, 'מודיעין-מכבים-רעות': 32000, 'חיפה': 24000, 'אשדוד': 24000, 'אשקלון': 22000,
  'באר שבע': 18000, 'כרמיאל': 18000, 'עפולה': 18000, 'קריית גת': 19000, 'דימונה': 14000,
};
const ppsm = (city: string) => CITY_PPSM[city.trim()] ?? 27000;
const NEIGH = ['מרכז העיר', 'השכונה הוותיקה', 'גבעת טל', 'נווה גן', 'פסגות', 'שכונת הפרחים', 'רמת הנשיא', 'הגבעה', 'נאות אפק', 'כפר אז"ר'];
const STREETS = ['הרצל', 'ויצמן', 'בן גוריון', 'רוטשילד', 'ז׳בוטינסקי', 'הנשיא', 'סוקולוב', 'אחד העם', 'שדרות ירושלים', 'הזית', 'התאנה', 'בלפור'];
const GEN_TYPES = ['דירה', 'דירת גן', 'פנטהאוז', 'מיני פנטהאוז', 'דופלקס', 'בית פרטי', 'דירת גג'];
const TYPE_FACTOR: Record<string, number> = { 'דירה': 1, 'דירת גן': 1.2, 'פנטהאוז': 1.5, 'מיני פנטהאוז': 1.3, 'דופלקס': 1.25, 'בית פרטי': 1.65, 'דירת גג': 1.15 };
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(a: T[]) => a[rnd(0, a.length - 1)];
const round10k = (n: number) => Math.max(1, Math.round(n / 10000)) * 10000;

function buildListings(tenantId: string, city: string, rooms: number | null, type: string | null, maxPrice: number | null, count: number) {
  const yad2 = 'https://www.yad2.co.il/realestate/forsale';
  const madlan = `https://www.madlan.co.il/for-sale/${encodeURIComponent(city.replace(/ /g, '-'))}-ישראל`;
  const items = [];
  for (let i = 0; i < count; i++) {
    const t = type && type !== 'הכל' ? type : pick(GEN_TYPES);
    const r = rooms || pick([3, 4, 4, 5, 3, 5, 6, 2]);
    const big = t === 'פנטהאוז' || t === 'בית פרטי' || t === 'דירת גג';
    const sizeSqm = Math.round((r * 22 + 28) * (big ? 1.4 : 1)) + rnd(-8, 14);
    let price = round10k(ppsm(city) * sizeSqm * (TYPE_FACTOR[t] || 1));
    if (maxPrice && price > maxPrice) price = round10k(maxPrice * (0.78 + Math.random() * 0.2));
    const floor = (t === 'בית פרטי' || t === 'דירת גן') ? 0 : big ? rnd(7, 24) : rnd(1, 14);
    const src = i % 2 === 0 ? 'Yad2' : 'Madlan';
    items.push({
      tenantId, title: `${t} ${r} חד׳ ב${city}`, type: t, city,
      neighborhood: pick(NEIGH), street: `${pick(STREETS)} ${rnd(1, 180)}`,
      rooms: r, floor, totalFloors: floor > 0 ? floor + rnd(0, 8) : 0, sizeSqm, price,
      parking: Math.random() > 0.2, elevator: floor > 0 && Math.random() > 0.15,
      balcony: Math.random() > 0.25, renovated: Math.random() > 0.5,
      entry: Math.random() > 0.5 ? 'מיידי' : 'גמיש', status: 'פעיל',
      agent: pick(['תיווך הצפון', 'רימקס', 'אנגלו סכסון', 'כונס נכסים']),
      listedBy: Math.random() > 0.4 ? 'בתיווך' : 'פרטי',
      source: src, sourceUrl: src === 'Yad2' ? yad2 : madlan,
    });
  }
  return items;
}

// ─── Real Yad2 data via Apify (paid provider) ─────────────────────────────────
// When APIFY_API_TOKEN is set we pull REAL Yad2 listings — real prices and a
// direct link to each ad — through the `swerve/yad2-scraper` actor, which handles
// Yad2's bot protection. Returns null when no token is configured so the caller
// falls back to the local estimator (no breakage out of the box).
const APIFY_ACTOR = process.env.APIFY_YAD2_ACTOR || 'swerve~yad2-scraper';

interface ApifyYad2Item {
  url?: string; cityHebrew?: string; city?: string; neighbourhood?: string;
  address?: string; streetName?: string; price?: number; rooms?: number;
  floor?: number | string; areaSqm?: number; hasParking?: boolean; hasElevator?: boolean;
  hasBalcony?: boolean; hasAgent?: boolean; contactName?: string;
  adType?: string; propertyType?: string | null; listingDescription?: string;
}

// Yad2's propertyType is frequently null, so fall back to detecting the type from
// the free-text description, and default to plain "דירה" — NOT the search filter
// (forcing the filter previously mislabeled a regular apartment as a penthouse).
const PROPERTY_TYPE_EN: Record<string, string> = {
  apartment: 'דירה', flat: 'דירה', studio: 'דירה',
  penthouse: 'פנטהאוז', 'mini penthouse': 'מיני פנטהאוז',
  duplex: 'דופלקס', 'garden apartment': 'דירת גן', 'garden-apartment': 'דירת גן',
  cottage: 'בית פרטי', house: 'בית פרטי', 'private house': 'בית פרטי',
  'roof apartment': 'דירת גג',
};
function deriveListingType(propertyType: string | null | undefined, desc: string): string {
  if (propertyType) {
    const k = String(propertyType).toLowerCase().trim();
    if (PROPERTY_TYPE_EN[k]) return PROPERTY_TYPE_EN[k];
  }
  const d = desc || '';
  if (/מיני[\s-]*פנטהאוז/.test(d)) return 'מיני פנטהאוז';
  if (/פנטהאוז/.test(d)) return 'פנטהאוז';
  if (/דירת\s*גן/.test(d)) return 'דירת גן';
  if (/דופלקס/.test(d)) return 'דופלקס';
  if (/דירת\s*גג|דירה\s*עם\s*גג/.test(d)) return 'דירת גג';
  if (/בית\s*פרטי|קוטג/.test(d)) return 'בית פרטי';
  return 'דירה';
}
// Total building floors is not a field — it lives in the description: "קומה 4 מתוך 8".
function parseTotalFloors(desc: string): number {
  const m = (desc || '').match(/קומה\s*\d+\s*מתוך\s*(\d+)/) || (desc || '').match(/מתוך\s*(\d+)\s*קומות/);
  return m ? Number(m[1]) : 0;
}
function deriveListedBy(adType?: string, hasAgent?: boolean): string {
  if (adType === 'commercial' || hasAgent === true) return 'בתיווך';
  if (adType === 'private' || hasAgent === false) return 'פרטי';
  return '';
}

async function fetchYad2ViaApify(
  tenantId: string, city: string, rooms: number | null, type: string | null,
  maxPrice: number | null, count: number,
) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null; // not configured → caller falls back to the estimator

  const input: Record<string, unknown> = {
    // enrichListings:true is required for propertyType / adType / the description
    // we parse the total floors and real type from.
    city, dealType: 'buy', maxItems: count, enrichListings: true,
  };
  if (rooms) { input.minRooms = rooms; input.maxRooms = rooms; }
  if (maxPrice) input.maxPrice = maxPrice;

  // maxItems MUST be a query param too — it is the run-level "max charged results"
  // cap for this pay-per-result actor; omitting it returns HTTP 400.
  const endpoint =
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&maxItems=${count}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150_000);
  let items: ApifyYad2Item[];
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`Apify HTTP ${r.status}: ${body.replace(/\s+/g, ' ').slice(0, 140)}`);
    }
    items = (await r.json()) as ApifyYad2Item[];
  } finally {
    clearTimeout(timer);
  }

  return items
    .filter((it) => it && it.url && (it.price ?? 0) > 0)
    .slice(0, count)
    .map((it) => {
      const desc = it.listingDescription || '';
      const realType = deriveListingType(it.propertyType, desc);
      return {
        tenantId,
        title: `${realType} ${it.rooms ?? rooms ?? ''} חד׳ ב${it.cityHebrew || city}`.replace(/\s+/g, ' ').trim(),
        type: realType,
        city: it.cityHebrew || city,
        neighborhood: it.neighbourhood || null,
        street: it.streetName || it.address || null,
        rooms: Math.round(finite(it.rooms ?? rooms ?? 0)),
        floor: Math.round(finite(it.floor)),
        totalFloors: parseTotalFloors(desc),
        sizeSqm: Math.round(finite(it.areaSqm)),
        price: Math.round(finite(it.price)),
        parking: Boolean(it.hasParking),
        elevator: Boolean(it.hasElevator),
        balcony: Boolean(it.hasBalcony),
        renovated: false,
        entry: 'גמיש',
        status: 'פעיל',
        agent: it.hasAgent ? (it.contactName || 'תיווך') : null,
        listedBy: deriveListedBy(it.adType, it.hasAgent),
        source: 'Yad2',
        sourceUrl: safeListingUrl(it.url), // direct link to the specific ad (validated)
      };
    });
}

realestateRouter.post('/listings/search', requireFeature('listings'), async (req, res) => {
  try {
    const tenantId = tid(req);
    const city = (req.body.city || '').trim();
    const rooms = req.body.rooms ? Number(req.body.rooms) : null;
    const type = req.body.type || null;
    const maxPrice = req.body.maxPrice ? Number(req.body.maxPrice) : null;
    const count = Math.min(20, Math.max(6, Number(req.body.count) || 12));

    if (!city || city === 'הכל') {
      return res.status(400).json({ error: 'בחר עיר ספציפית כדי למשוך דירות מהמקורות' });
    }

    // Live listings pull is a PRO-only feature. Lower tiers don't get it at all (no
    // fabricated "estimator" data mislabeled as Yad2/Madlan).
    if (!(await featuresFor(tenantId)).apifyLive) {
      return res.status(403).json({ error: 'משיכת דירות חיה זמינה במסלול PRO בלבד', upgrade: true, feature: 'apifyLive' });
    }

    // PRO: pull REAL data from Apify. On failure we do NOT fabricate — return an honest
    // error and leave existing listings untouched, so no invented prices reach a client.
    let realData: Awaited<ReturnType<typeof fetchYad2ViaApify>> = null;
    try {
      realData = await fetchYad2ViaApify(tenantId, city, rooms, type, maxPrice, count);
    } catch (e) {
      console.error('Apify Yad2 fetch failed:', (e as Error).message || 'unknown');
      return res.status(502).json({ error: 'משיכת הדירות נכשלה כרגע — נסו שוב בעוד רגע' });
    }
    if (!realData || !realData.length) {
      return res.status(404).json({ error: `לא נמצאו דירות תואמות ב${city}` });
    }

    // Refresh the pulled set for this city; keep manually-added listings. Atomic so a
    // malformed batch can't delete the old listings and then fail the insert (data loss).
    await prisma.$transaction([
      prisma.listing.deleteMany({ where: { tenantId, city, source: { not: 'CRM (ידני)' } } }),
      prisma.listing.createMany({ data: realData }),
    ]);

    const listings = await prisma.listing.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return res.json(listings);
  } catch (e) { return fail(res, e, 'POST /listings/search'); }
});

// ─── REClients (buyer profiles for matching) ──────────────────────────────────
// Note summarising a buyer's criteria, used for the synced WhatsApp lead.
const reClientNote = (city?: string | null, rooms?: number | null, budgetMax?: number | null) =>
  ['לקוח נדל״ן',
    city ? `עיר: ${city}` : '',
    rooms ? `${rooms} חד׳` : '',
    budgetMax ? `תקציב עד ₪${Number(budgetMax).toLocaleString('he-IL')}` : '',
  ].filter(Boolean).join(' · ');

realestateRouter.get('/clients', async (req, res) => {
  try {
    const tenantId = tid(req);
    const clients = await prisma.rEClient.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    // Flag which clients are linked to a WhatsApp contact (a lead with the same phone).
    const leadPhones = new Set(
      (await prisma.lead.findMany({ where: { tenantId }, select: { phone: true } })).map((l) => l.phone),
    );
    return res.json(clients.map((c) => ({
      ...c,
      linkedToWhatsapp: Boolean(c.phone && leadPhones.has(normalizePhone(c.phone))),
    })));
  } catch (e) { return fail(res, e, 'GET /clients'); }
});

realestateRouter.post('/clients', async (req, res) => {
  try {
    const { name, phone, city, rooms, budgetMax, deliveryBy } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'נדרש שם לקוח' });
    const client = await prisma.rEClient.create({
      data: {
        tenantId: tid(req), name: name.trim(), phone: phone || null, city: city || null,
        rooms: Number(rooms) || 0, budgetMax: Number(budgetMax) || 0, deliveryBy: deliveryBy || null,
      },
    });

    // Cross-category sync: a client with a phone also becomes a CRM lead, so it
    // shows up in the WhatsApp window. Best-effort — never fail client creation.
    let linkedToWhatsapp = false;
    if (phone && String(phone).trim()) {
      try {
        const normalizedPhone = normalizePhone(String(phone));
        if (normalizedPhone) {
          const existing = await prisma.lead.findFirst({ where: { tenantId: tid(req), phone: normalizedPhone } });
          if (!existing) {
            const lead = await prisma.lead.create({
              data: { tenantId: tid(req), name: name.trim(), phone: normalizedPhone, internalNotes: reClientNote(city, Number(rooms) || null, Number(budgetMax) || null) || null, tags: ['נדל״ן'], lastMessageAt: new Date() },
            });
            const io: SocketIOServer = req.app.get('io');
            emitScoped(io, tid(req), lead.assignedTo, SOCKET_EVENTS.LEAD_CREATED, lead);
          }
          linkedToWhatsapp = true;
        }
      } catch (e) {
        console.error('REClient→Lead sync failed:', (e as Error).message);
      }
    }

    return res.status(201).json({ ...client, linkedToWhatsapp });
  } catch (e) { return fail(res, e, 'POST /clients'); }
});

realestateRouter.patch('/clients/:id', async (req, res) => {
  try {
    const existing = await prisma.rEClient.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'לקוח לא נמצא' });
    const b = req.body;
    const client = await prisma.rEClient.update({
      where: { id: req.params.id },
      data: {
        ...(b.name !== undefined && { name: String(b.name).trim() }),
        ...(b.phone !== undefined && { phone: b.phone || null }),
        ...(b.city !== undefined && { city: b.city || null }),
        ...(b.rooms !== undefined && { rooms: Number(b.rooms) || 0 }),
        ...(b.budgetMax !== undefined && { budgetMax: Number(b.budgetMax) || 0 }),
        ...(b.deliveryBy !== undefined && { deliveryBy: b.deliveryBy || null }),
      },
    });

    // Sync name/phone changes to the linked WhatsApp lead (best-effort).
    let linkedToWhatsapp = false;
    try {
      const tenantId = tid(req);
      const newNorm = client.phone ? normalizePhone(client.phone) : null;
      const oldNorm = existing.phone ? normalizePhone(existing.phone) : null;
      if (newNorm) {
        let lead = oldNorm ? await prisma.lead.findFirst({ where: { tenantId, phone: oldNorm } }) : null;
        if (!lead) lead = await prisma.lead.findFirst({ where: { tenantId, phone: newNorm } });
        const io: SocketIOServer = req.app.get('io');
        if (lead) {
          // Don't move the phone onto a number another lead already owns.
          const conflict = lead.phone !== newNorm
            ? await prisma.lead.findFirst({ where: { tenantId, phone: newNorm, NOT: { id: lead.id } } })
            : null;
          const updatedLead = await prisma.lead.update({
            where: { id: lead.id },
            data: { name: client.name, ...(conflict ? {} : { phone: newNorm }) },
          });
          emitScoped(io, tenantId, updatedLead.assignedTo, SOCKET_EVENTS.LEAD_UPDATED, updatedLead);
        } else {
          const created = await prisma.lead.create({
            data: { tenantId, name: client.name, phone: newNorm, internalNotes: reClientNote(client.city, client.rooms, client.budgetMax) || null, tags: ['נדל״ן'], lastMessageAt: new Date() },
          });
          emitScoped(io, tenantId, created.assignedTo, SOCKET_EVENTS.LEAD_CREATED, created);
        }
        linkedToWhatsapp = true;
      }
    } catch (e) {
      console.error('REClient→Lead update sync failed:', (e as Error).message);
    }

    return res.json({ ...client, linkedToWhatsapp });
  } catch (e) { return fail(res, e, 'PATCH /clients/:id'); }
});

realestateRouter.delete('/clients/:id', async (req, res) => {
  try {
    const tenantId = tid(req);
    const existing = await prisma.rEClient.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'לקוח לא נמצא' });
    await prisma.rEClient.delete({ where: { id: req.params.id } });

    // Optionally also remove the linked WhatsApp contact (?deleteLead=true).
    // Guard against wiping a real conversation: only delete a lead that was created by
    // this real-estate sync (tagged 'נדל״ן') AND has no message history. Anything else
    // (an organic WhatsApp contact with chat history) is preserved.
    if (req.query.deleteLead === 'true' && existing.phone) {
      try {
        const norm = normalizePhone(existing.phone);
        if (norm) {
          const lead = await prisma.lead.findFirst({ where: { tenantId, phone: norm } });
          if (lead) {
            const msgCount = await prisma.message.count({ where: { leadId: lead.id } });
            if (lead.tags.includes('נדל״ן') && msgCount === 0) {
              await prisma.lead.delete({ where: { id: lead.id } });
            } else {
              console.warn(`Skipped deleting lead ${lead.id}: ${msgCount} messages / not a נדל״ן-only lead`);
            }
          }
        }
      } catch (e) {
        console.error('REClient→Lead delete sync failed:', (e as Error).message);
      }
    }
    return res.status(204).send();
  } catch (e) { return fail(res, e, 'DELETE /clients/:id'); }
});
