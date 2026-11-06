# Elite Rewards

An independent rewards-program website with authenticated business and member access backed by a PostgreSQL rewards ledger.

## Three-level client structure

1. **Elite platform administrator** — the single platform authority who creates client businesses and centrally manages each client’s identity and initial reward catalog from Admin → Clients.
2. **Client business owner/staff** — operates only that isolated business, its members, points ledger, appearance, and rewards.
3. **Member/customer** — sees only that business’s branded wallet, balance, history, referral link, and published rewards.

The Elite platform tenant is never listed as one of its own clients. Platform administrators upload PNG, JPEG, or WebP client logos from local files; the application validates them and stores them durably in PostgreSQL rather than Render’s ephemeral filesystem.

## Product areas

- `/` — public marketing site
- `/clients/:clientId` — permanent public client page and NFC-card destination
- `/login` — secure business and member access
- `/wallet` — authenticated member page with the client business’s products, balance, ledger, reward codes, and redemptions
- `/admin` — authenticated business dashboard with customer enrollment links, editable product and reward catalogs, live transactions, point awards, and appearance controls
- `/join?business=:clientId` — permanent, tenant-branded Join Rewards self-enrollment link for each client business
- `/join?ref=:referralCode` — secure member referral enrollment from a member-owned share link
- `/activate-member` — single-use member wallet activation
- `/setup` — one-time protected production bootstrap

The current production slice supports isolated business clients and one location per client. Authentication, opaque server sessions, role enforcement, PostgreSQL persistence, an append-only points ledger, idempotent point awards, atomic reward redemptions, direct Join Rewards self-enrollment, member referral attribution, per-business product and reward catalogs, and per-business visual themes are connected. Every client receives a permanent Join Rewards link in Admin → Clients; customers use it to create a zero-point wallet for that client. Owners manage ordinary merchandise separately under **Admin → Products**, and published products appear on that client’s public page and authenticated member page without becoming redeemable rewards. Owners can create, edit, publish, hide, inventory-limit, and archive reward offers from **Admin → Rewards**; available changes appear in that business's member wallets while redemption history retains the original offer name and points cost. Referral links enroll members at a zero-point balance; no automatic referral award is issued until a business policy is defined. Business owners can enable automatic holiday themes from **Admin → Appearance**; Elite Rewards resolves dates server-side in the selected business time zone and temporarily applies MLK Day, Spring Celebration, September 11 Remembrance, and Winter Holiday themes without overwriting the business's manual theme. POS ingestion, billing, messaging, multi-location management, and the remaining administrative modules are later phases.

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

The Blueprint provisions the web service and `elite-rewards-db` PostgreSQL database, injects `DATABASE_URL`, and creates a private `SETUP_TOKEN`. After the first deployment, open `/setup`, use the private setup token from Render, and create the business, first location, and owner credentials. Owners and staff then enroll members from **Admin → Members** and send each member the generated single-use activation link. Active members can create a stable referral share link from their wallet; referred friends enroll through `/join`, start with zero points, and are attributed to the referrer. Owners customize the business dashboard and member wallet from **Admin → Appearance**, choosing high-resolution animated holiday, commemoration, and event themes with optional live messages. The same admin-only page contains the automatic-holiday toggle and business time-zone selector; member wallets only display the effective theme. The setup API permanently closes once an owner exists.

## Production status

The authenticated ledger vertical slice is production-capable, but the complete commercial platform is not finished. The detailed completion register is in
[`docs/ELITE-REWARDS-COMPLETION-AUDIT.md`](docs/ELITE-REWARDS-COMPLETION-AUDIT.md).
