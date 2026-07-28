'use client';

import { LegalLayout, LegalSection, Detail } from '@/components/marketing/LegalLayout';
import { COMPANY } from '@/lib/company';

export default function AccessibilityPage() {
  return (
    <LegalLayout title="הצהרת נגישות" updated="יולי 2026">
      <p>
        <b>Real Estate Lead CRM</b>, המופעל על ידי <Detail value={COMPANY.legalName} label="שם העסק הרשום" />, רואה חשיבות רבה
        בהנגשת השירות לכלל המשתמשים, לרבות אנשים עם מוגבלות, בהתאם לחוק שוויון זכויות לאנשים
        עם מוגבלות, התשנ״ח-1998 ולתקנותיו.
      </p>

      <LegalSection title="רמת ההנגשה">
        <p>אנו פועלים ליישם את הנחיות <b>WCAG 2.1</b> ברמה AA ככל שניתן: ניגודיות צבעים, תמיכה בניווט מקלדת, טקסט חלופי לתמונות, ומבנה כותרות סמנטי. האתר נבנה בעברית עם תמיכה מלאה בכיווניות RTL.</p>
      </LegalSection>

      <LegalSection title="מגבלות ידועות">
        <p>ייתכנו רכיבים שטרם הונגשו במלואם. אנו פועלים לשיפור מתמשך של הנגישות. אם נתקלת בקושי, נשמח לסייע ולתקן.</p>
      </LegalSection>

      <LegalSection title="פנייה ורכז נגישות">
        <p>
          נתקלת בבעיית נגישות? נשמח לקבל פנייה ולטפל בה בהקדם.
          <br />רכז/ת נגישות: <Detail value={COMPANY.accessibilityOfficer} label="שם רכז/ת הנגישות" />
          <br />אימייל: <Detail value={COMPANY.email} label="אימייל ליצירת קשר" />
          <br />טלפון: <Detail value={COMPANY.phone} label="טלפון" />
        </p>
        <p className="text-xs text-slate-400">הצהרה זו עודכנה בהתאם למועד הבדיקה האחרון. יש לעדכן את תאריך הבדיקה ואת פרטי רכז/ת הנגישות בעת ההשקה.</p>
      </LegalSection>
    </LegalLayout>
  );
}
