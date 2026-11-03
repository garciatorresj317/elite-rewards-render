# Elite Rewards — Next Implementation Slice

Date: 2026-11-03

## Goal

Move Elite Rewards from an untested front-end demonstration to a reproducible, regression-tested demonstration with a consistent rewards ledger model, connected demo activity, and an evidence-based production roadmap—without pretending that authentication, a database, billing, or POS services already exist.

## Context verified

- The repository builds, type-checks, and lints successfully at commit `c3a97b120cdfc345f15c8c6e527a2fa080988d0a`.
- Production dependency audit reports zero known vulnerabilities.
- The public site, wallet, and admin dashboard are implemented.
- The approved deep-black and metallic-gold design system is present.
- Demo state uses browser local storage.
- Admin navigation except Dashboard is placeholder-only.
- Wallet reward history is nonfunctional.
- Wallet redemptions do not appear in admin activity.
- There is no automated test command or regression suite.
- There is no production identity, authorization, database, billing, POS, notification, or observability service.

## Approach

1. Add a deterministic rewards-ledger domain layer with validation and balance invariants.
2. Add automated tests for ledger behavior and corrupted/blocked browser-storage handling.
3. Connect wallet redemption to shared demo activity and make reward history functional.
4. Replace selected dead controls with honest, functional demo interactions and improve dialog keyboard/focus behavior.
5. Update the audit so completed, partial, blocked, and decision-dependent work is explicit.
6. Run type, lint, unit, build, dependency, route, browser, and responsive checks.
7. Reconcile the independent PRODUCT ENGINEER review, then commit, push, deploy, and verify the live build.

## Risks and verification

- Local-storage synchronization can regress balances: prove it with unit tests and browser readback.
- Modal changes can regress keyboard behavior: test Escape, focus, and close behavior in-browser.
- Deployment may remain temporary if no owned Cloudflare account is authenticated: inspect `wrangler whoami`, deploy only through the existing verified route, and report ownership truthfully.
- No demo change will be labeled as a production backend feature.

## Out of scope for this slice

- Choosing pricing, POS vendor, authentication provider, email/SMS provider, or legal policy.
- Claiming production readiness.
- Wiring unowned infrastructure or fabricating service credentials.
- Replacing the Commander-approved visual system.
