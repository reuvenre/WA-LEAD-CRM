import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Real Estate Lead CRM | מבית Win Solutions',
  description: 'מערכת CRM לניהול לידים ושיחות WhatsApp לנדל״ן — מבית Win Solutions',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'RE Lead CRM' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};

// Mobile-friendly viewport (the app shell is mobile-responsive) + PWA theme color.
export const viewport: Viewport = {
  themeColor: '#101E38',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
