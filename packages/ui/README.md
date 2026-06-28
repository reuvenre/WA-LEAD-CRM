# @wa-lead/ui — WA Lead CRM design system

Presentational React components, design tokens and a Tailwind preset extracted
from the WA Lead CRM app. The library is intentionally **app-agnostic**: every
component is props-driven, with no `fetch`/router/store coupling — so it can be
rendered in Storybook, consumed by the app, and synced to **claude.ai/design**
via `/design-sync`.

## Components
Primitives: `Button`, `IconButton`, `Badge`, `Card` + `KpiCard`, `Stat`,
`Input`, `Select`, `Avatar`, `Spinner`, `Toast`, `EmptyState`, `SectionHeader`,
`Modal`, `Sidebar` (the navy navigation rail).
Real-estate: `ListingCard` (the flagship resale card). Plus the `cn` helper.

## Install & develop

```bash
cd packages/ui
npm install          # installs the lib + Storybook toolchain
npm run build        # tsup → dist/ (ESM + .d.ts)   — verified
npm run typecheck    # tsc --noEmit                 — verified
npm run storybook    # Storybook on http://localhost:6006
```

## Using the components in an app

```ts
// tailwind.config — pull in the design tokens
module.exports = { presets: [require('@wa-lead/ui/tailwind-preset')], content: [/* ... */] }
```

```tsx
import '@wa-lead/ui/styles.css';
import { Button, Sidebar, Badge } from '@wa-lead/ui';
```

## Styling idiom
Tailwind utilities backed by the shipped preset — brand blue (`bg-brand-600`),
the navy rail (`bg-navy`), surface neutrals (`bg-surface-muted`,
`border-surface-border`). A handful of plain-CSS primitives ship in
`src/styles.css` (`.re-kpi-card`, `.re-data-card`, `.re-badge`, `.re-filter-select`).

## Syncing to claude.ai/design
From this directory run `/design-sync` — it detects the Storybook, builds the
library, verifies each component against its story render, and uploads the
components to a Claude Design project so the design agent builds with them.
