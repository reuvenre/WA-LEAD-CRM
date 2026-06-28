import type { Config } from 'tailwindcss';

// Design tokens come from the shared library — single source of truth.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uiPreset = require('@wa-lead/ui/tailwind-preset');

const config: Config = {
  presets: [uiPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    // Scan the library so the utility classes its components use are generated.
    '../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
