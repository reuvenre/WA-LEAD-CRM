/** Tailwind config for Storybook rendering (uses the shipped design-system preset). */
module.exports = {
  presets: [require('./tailwind-preset.cjs')],
  content: ['./src/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}'],
};
