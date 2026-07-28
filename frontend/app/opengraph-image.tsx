import { ImageResponse } from 'next/og';

// The share card for WhatsApp, Facebook and LinkedIn — the channels this product is
// actually sold through. Replaces the old 512×512 icon, which link previews cropped
// into a small square thumbnail.
//
// Deliberately English-only: the renderer behind ImageResponse does not do RTL shaping,
// so Hebrew would come out reversed. The brand is English anyway, and the description
// stays in the OG text metadata where real text rendering applies.

export const runtime = 'edge';
export const alt = 'Real Estate Lead CRM — WhatsApp CRM for real estate';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #101E38 0%, #1e3a6d 55%, #4f46e5 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 78, fontWeight: 700, letterSpacing: -2 }}>
          Real Estate Lead CRM
        </div>
        <div style={{ display: 'flex', marginTop: 22, fontSize: 34, color: '#c7d2fe' }}>
          WhatsApp leads, conversations and follow-ups in one place
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 52,
            padding: '14px 34px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            fontSize: 27,
            color: '#e0e7ff',
          }}
        >
          14 days free · by WIN SOLUTIONS
        </div>
      </div>
    ),
    size,
  );
}
