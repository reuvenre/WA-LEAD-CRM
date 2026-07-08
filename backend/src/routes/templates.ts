import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { checkLimit } from '../lib/entitlements';

export const templatesRouter = Router();

// Hebrew real-estate quick-replies every new tenant starts with, so the templates
// panel is never empty on day one. Supports {{שם}} / {{טלפון}} variables.
export const DEFAULT_TEMPLATES: { title: string; body: string; category: string }[] = [
  { category: 'ברכה', title: 'ברכה ראשונית', body: 'שלום {{שם}}, תודה שפנית אלינו! אשמח לעזור לך למצוא את הנכס המתאים. מתי נוח לך לשוחח?' },
  { category: 'מעקב', title: 'מעקב אחרי פנייה', body: 'היי {{שם}}, רק מוודא שקיבלת את הפרטים ששלחתי. יש שאלות? אני כאן.' },
  { category: 'פגישה', title: 'תיאום פגישה', body: 'שלום {{שם}}, אשמח לתאם פגישה לצפייה בנכס. אילו ימים ושעות מתאימים לך?' },
  { category: 'פגישה', title: 'תזכורת לפגישה', body: 'היי {{שם}}, תזכורת לפגישה שלנו. נתראה בקרוב! אם צריך לשנות — עדכן אותי.' },
  { category: 'נכס', title: 'שליחת נכס מתאים', body: 'מצאתי נכס שיכול להתאים לך {{שם}} — שולח פרטים ותמונות. אשמח לשמוע מה דעתך.' },
  { category: 'סגירה', title: 'תודה לאחר סגירה', body: 'תודה רבה {{שם}} על האמון! מאחל לך המון הצלחה בנכס החדש 🙏' },
];

// Seed the defaults for a tenant that has none. Safe to call more than once.
export async function seedDefaultTemplates(tenantId: string): Promise<void> {
  const existing = await prisma.template.count({ where: { tenantId } });
  if (existing > 0) return;
  await prisma.template.createMany({ data: DEFAULT_TEMPLATES.map((t) => ({ ...t, tenantId })) });
}

// GET /templates
templatesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const templates = await prisma.template.findMany({
      where: { tenantId },
      orderBy: { category: 'asc' },
    });
    return res.json(templates);
  } catch (error) {
    console.error('GET /templates error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /templates
templatesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { title, body, category } = req.body;
    if (!title || !body || !category) {
      return res.status(400).json({ error: 'title, body, category required' });
    }
    if (!(await checkLimit(req, res, 'template'))) return; // plan template cap
    const template = await prisma.template.create({
      data: { tenantId, title, body, category },
    });
    return res.status(201).json(template);
  } catch (error) {
    console.error('POST /templates error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /templates/:id
templatesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.template.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.template.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /templates/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
