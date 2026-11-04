# Elite Rewards

An independent rewards-program website with authenticated business and member access backed by a PostgreSQL rewards ledger.

## Product areas

- `/` — public marketing site
- `/login` — secure business and member access
- `/wallet` — authenticated member wallet, balance, ledger, reward codes, and redemptions
- `/admin` — authenticated business dashboard, members, rewards, live transactions, and point awards
- `/setup` — one-time protected production bootstrap

The current production slice supports one business and one location. Authentication, opaque server sessions, role enforcement, PostgreSQL persistence, an append-only points ledger, idempotent point awards, and atomic reward redemptions are connected. POS ingestion, billing, messaging, multi-location management, and the remaining administrative modules are later phases.

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
- Health check: `/api/health`
- Deploy branch: `main`, after its GitHub checks pass

`npm run build` generates the standalone Node server at `.output/server/index.mjs`. `npm run preview` builds and starts that same production server locally. Render supplies `PORT`; Nitro binds the production server to it automatically.

The Blueprint provisions the web service and `elite-rewards-db` PostgreSQL database, injects `DATABASE_URL`, and creates a private `SETUP_TOKEN`. After the first deployment, open `/setup`, use the private setup token from Render, and create the business, first location, and owner credentials. Members are added after setup. The setup API permanently closes once an owner exists.

## Production status

The authenticated ledger vertical slice is production-capable, but the complete commercial platform is not finished. The detailed completion register is in
[`docs/ELITE-REWARDS-COMPLETION-AUDIT.md`](docs/ELITE-REWARDS-COMPLETION-AUDIT.md).
