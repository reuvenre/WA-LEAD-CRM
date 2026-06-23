import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Real-estate domain API (phase-2). All routes tenant-scoped via req.user.tenantId.
export const realestateRouter = Router();

const tid = (req: Request) => req.user!.tenantId;
const fail = (res: Response, e: unknown, where: string) => {
  console.error(`${where} error:`, e);
  return res.status(500).json({ error: 'Internal server error' });
};

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
        totalUnits: Number(b.totalUnits) || 0,
        availableUnits: b.availableUnits == null ? null : Number(b.availableUnits),
        unitTypes: Array.isArray(b.unitTypes) ? b.unitTypes.map(Number) : [],
        priceMin: b.priceMin == null ? null : Number(b.priceMin),
        priceMax: b.priceMax == null ? null : Number(b.priceMax),
        amenities: Array.isArray(b.amenities) ? b.amenities : [],
        urbanRenewal: !!b.urbanRenewal, urbanRenewalType: b.urbanRenewalType || null,
        salesOffice: b.salesOffice || null,
        source: b.source || 'CRM (ידני)', sourceTier: Number(b.sourceTier) || 5,
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
        ...(b.totalUnits !== undefined && { totalUnits: Number(b.totalUnits) || 0 }),
        ...(b.availableUnits !== undefined && { availableUnits: b.availableUnits == null ? null : Number(b.availableUnits) }),
        ...(Array.isArray(b.unitTypes) && { unitTypes: b.unitTypes.map(Number) }),
        ...(b.priceMin !== undefined && { priceMin: b.priceMin == null ? null : Number(b.priceMin) }),
        ...(b.priceMax !== undefined && { priceMax: b.priceMax == null ? null : Number(b.priceMax) }),
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
realestateRouter.get('/listings', async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({ where: { tenantId: tid(req) }, orderBy: { createdAt: 'desc' } });
    return res.json(listings);
  } catch (e) { return fail(res, e, 'GET /listings'); }
});

realestateRouter.post('/listings', async (req, res) => {
  try {
    const b = req.body;
    if (!b.title?.trim()) return res.status(400).json({ error: 'נדרשת כותרת' });
    const listing = await prisma.listing.create({
      data: {
        tenantId: tid(req), title: b.title.trim(), type: b.type || 'דירה',
        city: b.city || null, neighborhood: b.neighborhood || null, street: b.street || null,
        rooms: Number(b.rooms) || 0, floor: Number(b.floor) || 0, sizeSqm: Number(b.sizeSqm) || 0,
        price: Number(b.price) || 0,
        parking: !!b.parking, elevator: !!b.elevator, balcony: !!b.balcony, renovated: !!b.renovated,
        entry: b.entry || 'מיידי', status: b.status || 'פעיל',
        agent: b.agent || null, source: b.source || 'CRM (ידני)', sourceUrl: b.sourceUrl || '',
      },
    });
    return res.status(201).json(listing);
  } catch (e) { return fail(res, e, 'POST /listings'); }
});

realestateRouter.patch('/listings/:id', async (req, res) => {
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
        ...(b.sizeSqm !== undefined && { sizeSqm: Number(b.sizeSqm) || 0 }),
        ...(b.price !== undefined && { price: Number(b.price) || 0 }),
        ...(b.parking !== undefined && { parking: !!b.parking }),
        ...(b.elevator !== undefined && { elevator: !!b.elevator }),
        ...(b.balcony !== undefined && { balcony: !!b.balcony }),
        ...(b.renovated !== undefined && { renovated: !!b.renovated }),
        ...(b.entry !== undefined && { entry: b.entry }),
        ...(b.status && { status: b.status }),
        ...(b.agent !== undefined && { agent: b.agent }),
        ...(b.sourceUrl !== undefined && { sourceUrl: b.sourceUrl }),
      },
    });
    return res.json(listing);
  } catch (e) { return fail(res, e, 'PATCH /listings/:id'); }
});

realestateRouter.delete('/listings/:id', async (req, res) => {
  try {
    const existing = await prisma.listing.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'דירה לא נמצאה' });
    await prisma.listing.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (e) { return fail(res, e, 'DELETE /listings/:id'); }
});

// ─── REClients (buyer profiles for matching) ──────────────────────────────────
realestateRouter.get('/clients', async (req, res) => {
  try {
    const clients = await prisma.rEClient.findMany({ where: { tenantId: tid(req) }, orderBy: { createdAt: 'desc' } });
    return res.json(clients);
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
    return res.status(201).json(client);
  } catch (e) { return fail(res, e, 'POST /clients'); }
});

realestateRouter.delete('/clients/:id', async (req, res) => {
  try {
    const existing = await prisma.rEClient.findFirst({ where: { id: req.params.id, tenantId: tid(req) } });
    if (!existing) return res.status(404).json({ error: 'לקוח לא נמצא' });
    await prisma.rEClient.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (e) { return fail(res, e, 'DELETE /clients/:id'); }
});
