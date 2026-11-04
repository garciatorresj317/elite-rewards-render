# Elite Rewards — Production Vertical Slice Plan

Date: 2026-11-03

## Goal

Deliver one real, deployed rewards flow for a single business and location: authenticated owner/staff/member access, a PostgreSQL-backed append-only points ledger, staff point awards, member balance/history, one-time reward redemption, admin visibility, and automated release checks.

## Verified context

- The app is a TanStack Start/Nitro Node service deployed on Render.
- `/`, `/admin`, and `/wallet` exist and use the approved black-and-gold design.
- Current balances, awards, and redemptions are browser-local demonstration data.
- `src/server.ts` already wraps all server requests and is the narrowest place to add same-origin JSON APIs without replacing the existing SSR entry.
- `src/routes/admin.tsx` and `src/routes/wallet.tsx` directly use `src/lib/demo-storage.ts`.
- The repository already has unit tests, TypeScript, ESLint, build, GitHub Actions, Render configuration, and baseline security headers.
- No production database, authentication, session, role, migration, API, or deployment secret configuration exists.

## Approach

1. Add PostgreSQL runtime support, tracked SQL migrations, and an idempotent startup migrator/bootstrap path.
2. Add secure password hashing, opaque database-backed sessions, same-origin cookies, owner/staff/member role checks, login/logout/session endpoints, and password-change support.
3. Add a server-authoritative rewards service with append-only ledger entries, database-enforced nonnegative balances, idempotent staff awards, row-locked redemptions, and immutable audit events.
4. Add same-origin JSON APIs for health, authentication, dashboard data, member wallet data, point awards, reward redemption, and initial business setup.
5. Add a black-and-gold login/setup route, protect `/admin` and `/wallet` by API session state, replace local-storage flows with live APIs, and expose real transaction/balance data.
6. Add unit and PostgreSQL integration tests for authorization, idempotency, insufficient funds, duplicate redemption, and concurrent-safe mutations; retain the existing front-end checks.
7. Update Render infrastructure for PostgreSQL and production secrets, commit and push both canonical and Render deployment repositories, deploy, then verify live health, login, award, wallet, redemption, logout, headers, and unauthorized behavior.

## Risks and unknowns

- Creating a managed Render PostgreSQL database may require account billing or a human payment confirmation. Code and deployment configuration can still be completed; the exact external blocker will be reported if Render stops at payment.
- Existing Render service ownership and repository authorization must be revalidated before changing production.
- Initial owner credentials must never be committed. A one-time setup token will be supplied as a Render secret, and setup will permanently close after the first owner is created.
- API interception must preserve TanStack SSR and static assets. Route and 404 smoke tests will prove it.
- PostgreSQL integration tests require an isolated test database URL. They will run when `TEST_DATABASE_URL` is available and fail closed in CI production gates when required.

## Out of scope for this slice

- Multi-business or multi-location tenancy UI.
- POS/payment ingestion, billing, SMS/email, birthday automation, advanced analytics, and public member self-registration.
- Claiming final legal, privacy, accessibility, performance, incident-response, or full production-completion gates.
- Replacing the approved visual design.

## Verification

The slice is accepted only when unit/type/lint/build checks pass; PostgreSQL migration and integration tests prove ledger and authorization invariants; local production routes and APIs behave correctly; the code is committed and pushed; and the live Render service passes authenticated award/redeem and unauthorized-access smoke tests.