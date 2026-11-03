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

Built with TanStack Start and the Lovable-compatible Vite configuration. `npm run preview` runs the generated Cloudflare Worker locally after a build. `npm run deploy` builds and deploys through the authenticated Cloudflare account. Elite Rewards deploys independently from the Dynasty Designs site.

## Production status

This repository is not production-complete. The detailed verified completion register is in
[`docs/ELITE-REWARDS-COMPLETION-AUDIT.md`](docs/ELITE-REWARDS-COMPLETION-AUDIT.md).
