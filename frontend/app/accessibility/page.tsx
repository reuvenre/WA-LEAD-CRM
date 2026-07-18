'use client';

import { LegalLayout, LegalSection, PH } from '@/components/marketing/LegalLayout';

export default function AccessibilityPage() {
  return (
    <LegalLayout title="הצהרת נגישות" updated="יולי 2026">
      <p>
        <b>Real Estate Lead CRM</b>, המופעל על ידי <PH>שם העסק הרשום</PH>, רואה חשיבות רבה
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
          <br />רכז/ת נגישות: <PH>שם רכז/ת הנגישות</PH>
          <br />אימייל: <PH>אימייל ליצירת קשר</PH>
          <br />טלפון: <PH>טלפון</PH>
        </p>
        <p className="text-xs text-slate-400">הצהרה זו עודכנה בהתאם למועד הבדיקה האחרון. יש לעדכן את תאריך הבדיקה ואת פרטי רכז/ת הנגישות בעת ההשקה.</p>
      </LegalSection>
    </LegalLayout>
  );
}
