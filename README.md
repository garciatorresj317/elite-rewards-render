# Elite Rewards

An independent rewards-program website and interactive product demo for businesses and their members.

## Product areas

- `/` — public marketing site
- `/wallet` — member wallet and rewards catalog
- `/admin` — business dashboard with reporting, reward activity, transactions, and demo controls

The current app is a front-end product demonstration. It persists demonstration activity in browser local storage so core interactions can be evaluated before authentication, database, billing, and POS services are connected.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run preview
```

Run the complete local gate with `npm run check`.

## Deployment

Elite Rewards deploys independently from the Dynasty Designs site as a Render Node web service. The root [`render.yaml`](render.yaml) is the infrastructure Blueprint used by Render:

- Build: `npm ci --include=dev && npm run check`
- Start: `npm run start`
- Health check: `/`
- Deploy branch: `main`, after its GitHub checks pass

`npm run build` generates the standalone Node server at `.output/server/index.mjs`. `npm run preview` builds and starts that same production server locally. Render supplies `PORT`; Nitro binds the production server to it automatically.

To create the service, connect the GitHub repository to Render and apply the repository Blueprint. After creation, pushes to `main` deploy automatically.

## Production status

This repository is not production-complete. The detailed verified completion register is in
[`docs/ELITE-REWARDS-COMPLETION-AUDIT.md`](docs/ELITE-REWARDS-COMPLETION-AUDIT.md).
