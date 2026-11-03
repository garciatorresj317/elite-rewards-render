# Elite rewaerds

An independent rewards-program website and interactive product demo for businesses and their members.

## Product areas

- `/` — public marketing site
- `/wallet` — member wallet and rewards catalog
- `/admin` — business dashboard with reporting, reward activity, transactions, and demo controls

The app persists demo activity in browser local storage so core interactions can be tested without external services.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

## Deployment

Built with TanStack Start and the Lovable-compatible Vite configuration. Pushes to the connected production branch can be deployed independently from the Dynasty Designs site.
