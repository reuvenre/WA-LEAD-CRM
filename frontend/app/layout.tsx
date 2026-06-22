import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WA Lead CRM | מבית Win Solutions',
  description: 'מערכת CRM לניהול לידים ושיחות WhatsApp — מבית Win Solutions',
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
