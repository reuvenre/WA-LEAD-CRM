import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://wa-lead-crm.vercel.app';

// Crawlers get the marketing surface and nothing else. The authenticated screens are
// client-rendered behind a token so there is nothing there to index anyway, but the
// transactional routes are listed explicitly: a payment-return URL surfacing in search
// results is confusing at best.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/billing/', '/reset-password', '/api/'],
    }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
