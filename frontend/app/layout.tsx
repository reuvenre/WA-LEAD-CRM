import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://wa-lead-crm.vercel.app'),
  title: {
    default: 'Real Estate Lead CRM — ה-CRM ל-WhatsApp לעולם הנדל״ן',
    template: '%s | Real Estate Lead CRM',
  },
  description: 'כל שיחות ה-WhatsApp, הלידים, הפגישות והנציגים שלכם במערכת אחת. מענה אוטומטי, קמפיינים, ודשבורד — בעברית מלאה. 14 יום חינם.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'RE Lead CRM' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    siteName: 'Real Estate Lead CRM',
    title: 'Real Estate Lead CRM — ה-CRM ל-WhatsApp לעולם הנדל״ן',
    description: 'הפסיקו לאבד לידים בין הצ׳אטים. כל שיחות ה-WhatsApp, הלידים והפגישות במקום אחד. 14 יום חינם.',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Real Estate Lead CRM' }],
  },
  twitter: { card: 'summary', title: 'Real Estate Lead CRM', description: 'ה-CRM ל-WhatsApp לעולם הנדל״ן' },
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
      {/* min-h-screen (not h-screen+overflow-hidden): the authenticated app manages its
          own fixed h-screen layout, while the tall marketing/legal pages need the body
          to scroll. */}
      <body className="min-h-screen bg-surface-muted font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
