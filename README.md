# midnight-markers

A dark, polished bookmark extension for Brave & Chrome.

## Dev

    npm install
    npm run dev          # Vite in extension dev mode
    npm run build        # outputs dist/ — load as unpacked extension
    npm test             # unit tests
    npm run test:e2e     # Playwright

## Loading the unpacked extension

1. `npm run build`
2. Brave/Chrome → Extensions → enable Developer mode → Load unpacked → pick `dist/`.

See [`docs/superpowers/specs/2026-05-03-midnight-markers-design.md`](docs/superpowers/specs/2026-05-03-midnight-markers-design.md) for the design and [`docs/superpowers/plans/`](docs/superpowers/plans/) for implementation plans.
