import { PrismaClient, LeadStatus, Priority, MessageDirection } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany();
  await prisma.template.deleteMany();
  await prisma.lead.deleteMany();

  // --- Hebrew Quick-Reply Templates ---
  await prisma.template.createMany({
    data: [
      {
        title: 'ברוכים הבאים',
        body: 'שלום! תודה שפנית אלינו 😊 אשמח לעזור – ספר לי במה אוכל לסייע?',
        category: 'פתיחה',
      },
      {
        title: 'שאלת מחיר',
        body: 'המחיר שלנו מתחיל מ-₪X לשעה. האם תרצה לקבל הצעת מחיר מפורטת?',
        category: 'מכירות',
      },
      {
        title: 'קביעת פגישה',
        body: 'נשמח לקבוע פגישה! איזה יום ושעה מתאימים לך השבוע?',
        category: 'מכירות',
      },
      {
        title: 'מעקב לאחר פגישה',
        body: 'היי! רציתי לבדוק אם יש לך שאלות נוספות לאחר שיחתנו. אנחנו כאן לכל עניין 🙏',
        category: 'מעקב',
      },
      {
        title: 'סגירת עסקה',
        body: 'מעולה! אשלח לך את מסמכי ההתקשרות עוד מעט. תודה על הבחירה בנו 🎉',
        category: 'סגירה',
      },
    ],
  });

  // --- Dummy Leads ---
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        name: 'יוסי כהן',
        phone: '972501234567',
        status: LeadStatus.HOT,
        priority: Priority.High,
        assignedTo: 'אורן לוי',
        internalNotes: 'מעוניין בחבילה הפרימיום. דיברנו ב-03/04, ביקש הצעת מחיר עד סוף השבוע.',
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 30),
      },
    }),
    prisma.lead.create({
      data: {
        name: 'רחל אברהם',
        phone: '972527654321',
        status: LeadStatus.IN_PROGRESS,
        priority: Priority.Med,
        assignedTo: 'שירה מזרחי',
        internalNotes: 'ממתינה לאישור תקציב מהמנהל שלה. לחזור אליה ביום שלישי.',
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
    }),
    prisma.lead.create({
      data: {
        name: 'דוד לוי',
        phone: '972541112233',
        status: LeadStatus.NEW,
        priority: Priority.Low,
        assignedTo: null,
        internalNotes: null,
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      },
    }),
  ]);

  // --- Seed Messages ---
  await prisma.message.createMany({
    data: [
      {
        leadId: leads[0].id,
        content: 'שלום, אני מעוניין לשמוע על החבילות שלכם',
        type: 'text',
        direction: MessageDirection.inbound,
        status: 'read',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
      },
      {
        leadId: leads[0].id,
        content: 'שלום יוסי! ברוך הבא 😊 אשמח לספר לך על החבילות שלנו. מה הצורך העיקרי שלך?',
        type: 'text',
        direction: MessageDirection.outbound,
        status: 'read',
        timestamp: new Date(Date.now() - 1000 * 60 * 55),
      },
      {
        leadId: leads[0].id,
        content: 'אני מחפש פתרון לניהול לידים. יש לכם משהו מתאים?',
        type: 'text',
        direction: MessageDirection.inbound,
        status: 'read',
        timestamp: new Date(Date.now() - 1000 * 60 * 40),
      },
      {
        leadId: leads[0].id,
        content: 'בוודאי! יש לנו בדיוק את הפתרון המושלם. שולח לך הצעת מחיר עכשיו 🔥',
        type: 'text',
        direction: MessageDirection.outbound,
        status: 'delivered',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
      },
      {
        leadId: leads[1].id,
        content: 'היי, ראיתי את הפרסום שלכם ברשת. מה המחירים?',
        type: 'text',
        direction: MessageDirection.inbound,
        status: 'read',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
      },
      {
        leadId: leads[1].id,
        content: 'שלום רחל! המחירים שלנו מתחילים מ-₪299 לחודש. האם תרצי לקבוע שיחת היכרות?',
        type: 'text',
        direction: MessageDirection.outbound,
        status: 'read',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        leadId: leads[2].id,
        content: 'שלום, שלחתם לי מסרון על מבצע. מה הפרטים?',
        type: 'text',
        direction: MessageDirection.inbound,
        status: 'read',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
      },
    ],
  });

  console.log('✅ Seed data created successfully');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
