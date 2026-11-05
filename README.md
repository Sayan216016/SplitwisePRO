# SplitwisePRO

Split shared expenses with friends and groups, see who owes whom, and settle up.

**Live:** <https://sayan216016.github.io/SplitwisePRO/>

## Features

- Google sign-in; invite friends by email (unknown emails become pending invites).
- Groups with expenses in INR — multiple payers; split equally, by exact amount, percent or shares.
- Simplified "who owes whom" per group and per friend; record payments to settle up.
- Live updates across devices, dashboard with balances and activity feed, dark mode.

## Tech stack

Vanilla JavaScript (ES modules) · Vite · Firebase Auth + Cloud Firestore · GitHub Actions → GitHub Pages.

## Getting started

Requires Node.js 22+ and a Firebase project (see [setup guide](docs/firebase-github-setup.md)).

```bash
cp .env.example .env.local   # fill in the four Firebase values
npm install
npm run dev                  # http://localhost:5173/SplitwisePRO/
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Node test runner) |

CI runs lint, tests and build on every push to `main`/`master`, then deploys to GitHub Pages.

## Project structure

```
├── .github/workflows/   CI + deploy to GitHub Pages
├── docs/                Architecture, design system, setup, status
├── public/              Static assets copied as-is (social share image)
├── src/
│   ├── main.js          Entry: bootstrap, auth gate, hash router
│   ├── config/          Firebase initialisation
│   ├── controllers/     One per route: state, subscriptions, event wiring
│   ├── views/           Pure functions returning page HTML
│   ├── components/      Shared UI: header, modals, skeletons
│   ├── services/        All Firebase Auth / Firestore I/O
│   ├── utils/           Money math (tested), helpers, theme
│   └── styles/          base → layout → components → pages
├── firestore.rules      Security rules (deployed with Firebase CLI)
└── firestore.indexes.json
```

## Documentation

- [Architecture](docs/architecture.md) — layers, patterns, conventions
- [Design system](docs/DESIGN.md) — visual language
- [Firebase + GitHub setup](docs/firebase-github-setup.md) — one-time setup and troubleshooting
- [Session handoff](docs/session-handoff.md) — current status, product and technical decisions
