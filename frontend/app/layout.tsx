import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'מערכת ניהול לידים | WhatsApp CRM',
  description: 'מערכת CRM לניהול לידים ושיחות WhatsApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="h-screen overflow-hidden bg-surface-muted font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
