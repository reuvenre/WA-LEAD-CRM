/**
 * WA Lead CRM design tokens as a Tailwind preset.
 * Consumers: `presets: [require('@wa-lead/ui/tailwind-preset')]`.
 * Keep in sync with the app's tailwind.config.ts brand/surface scale.
 */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'Heebo', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        navy: {
          DEFAULT: '#0F1F3D',
          light: '#1e3a5f',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          subtle: '#f1f5f9',
          border: '#e2e8f0',
        },
      },
      borderRadius: {
        xl: '12px',
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        card: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
};
