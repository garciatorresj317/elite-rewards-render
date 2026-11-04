# Referrals and Live Business Themes

## Release status

Implementation commit: `40122de9878769178cc9ff160a728d3c85058e22`

The release is pushed to both GitHub `main` branches. Production deployment is pending because the existing Render service did not auto-deploy the commit and authenticated Render access was declined during release verification.

## Member referrals

- Authenticated members create their referral link from the wallet.
- The public link opens `/join?ref=<opaque token>`.
- The link resolves the business and location server-side; the browser never supplies tenant IDs.
- Referral tokens are deterministic HMAC-derived values and only SHA-256 hashes are stored in PostgreSQL.
- Enrollment creates the member, zero-point balance, attribution record, session, and audit event in one transaction.
- No referral bonus is issued until a business referral policy is approved.
- PostgreSQL-backed rate limits apply by IP subject, token, and normalized email.
- Duplicate-account responses use generic wording to reduce account enumeration.

## Business appearance

Owners use **Admin → Appearance** to publish one of six allowlisted visual presets:

1. Elite Signature
2. MLK Day
3. September 11 Remembrance
4. Winter Holiday
5. Spring Celebration
6. Community Event

The selected preset and optional occasion message are stored per business and apply to that business's admin and member surfaces. Login, setup, activation, and platform marketing surfaces remain on the base Elite Rewards design.

All supplied backgrounds are same-origin 1920×1080 optimized WebP images. Subtle motion uses CSS transforms and is disabled by the existing reduced-motion rule. The commemorative themes contain no sales language, points promotion, or discount messaging.

## Verification

- `npm run check`: passed
- Automated tests: 25/25 passed
- TypeScript: passed
- ESLint: passed with zero warnings
- Production build: passed
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities
- `git diff --check`: passed
- MLK Day and September 11 images were independently vision-reviewed for respectful tone and UI suitability.

## Remaining release action

Authenticate the existing Render account and deploy commit `40122de9878769178cc9ff160a728d3c85058e22`, or restore Render auto-deploy from `garciatorresj317/elite-rewards-render`. After deployment, verify `/api/health`, `/join`, all theme assets, authenticated member referral generation, one test referral signup, tenant attribution, Appearance save/readback, reduced-motion behavior, CSP headers, and unauthorized write rejection.
