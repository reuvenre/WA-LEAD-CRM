# WhatsApp CRM — מערכת ניהול לידים

מערכת CRM מלאה לניהול לידים ושיחות WhatsApp בעברית.

## ארכיטקטורה

```
whatsapp-crm/
├── backend/          # Node.js + Express + Prisma + Socket.io
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── server.ts
│       ├── socket.ts
│       ├── lib/prisma.ts
│       └── routes/
│           ├── leads.ts
│           ├── messages.ts
│           ├── templates.ts
│           └── webhook.ts
└── frontend/         # Next.js 14 App Router + Tailwind + RTL
    ├── app/
    ├── components/
    ├── hooks/
    ├── lib/
    └── types/
```

## הפעלה מהירה

### 1. Backend

```bash
cd backend
cp .env.example .env
# ערוך את ה-.env עם פרטי PostgreSQL
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

פתח: http://localhost:3000

---

## API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/leads` | רשימת לידים עם פילטרים |
| GET | `/api/leads/:id` | ליד בודד עם הודעות |
| PATCH | `/api/leads/:id` | עדכון סטטוס/עדיפות/הערות |
| DELETE | `/api/leads/:id` | מחיקת ליד |
| GET | `/api/messages/:leadId` | הודעות של ליד |
| POST | `/api/messages/send` | שליחת הודעה |
| GET | `/api/templates` | רשימת תבניות |
| POST | `/api/templates` | יצירת תבנית |
| GET | `/api/webhook` | Meta webhook verification |
| POST | `/api/webhook` | קבלת הודעות מ-Meta |

## Socket.io Events

| Event | כיוון | תיאור |
|-------|-------|-------|
| `message:new` | server→client | הודעה חדשה התקבלה |
| `lead:updated` | server→client | ליד עודכן |
| `lead:created` | server→client | ליד חדש נוצר |
| `join:lead` | client→server | הצטרפות לחדר ליד |
| `leave:lead` | client→server | עזיבת חדר ליד |

## הגדרת Meta Webhook

1. לך ל-Meta for Developers → WhatsApp → Configuration
2. הגדר Webhook URL: `https://your-domain.com/api/webhook`
3. Verify Token: הערך שהגדרת ב-`META_VERIFY_TOKEN`
4. Subscribe לאירועים: `messages`
