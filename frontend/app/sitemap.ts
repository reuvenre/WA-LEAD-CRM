import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://wa-lead-crm.vercel.app';

// Only the publicly meaningful pages. `/` and `/pricing` are what we actually want
// ranking; the legal pages are listed because search engines (and buyers) treat their
// presence as a credibility signal, but at a low priority.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/pricing`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/register`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/login`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/accessibility`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
