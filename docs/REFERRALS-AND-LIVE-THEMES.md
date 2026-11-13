# Referrals and Live Business Themes

## Release status

The referral, business-theme, and automatic holiday scheduling releases are maintained on both GitHub `main` branches and deployed through the existing Render service.

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

The Elite Rewards platform administrator uses **Elite Dashboard → Customization** to choose a client and publish one of six allowlisted visual presets:

1. Elite Signature
2. MLK Day
3. September 11 Remembrance
4. Winter Holiday
5. Spring Celebration
6. Community Event

The selected preset and optional occasion message are stored per business and apply to that business's admin and member surfaces. Login, setup, activation, and platform marketing surfaces remain on the base Elite Rewards design.

The platform-only Customization workspace includes compact, descriptive wallpaper cards and four additional 4K live styles: Emerald Pulse, Ruby Velocity, Arctic Prism, and Golden Horizon. Live styles use subtle layered motion on supported devices and stop automatically when the visitor requests reduced motion. Join Rewards pages also reinforce the selected business identity with a central logo watermark and two low-opacity floating logo accents that never accept pointer input or cover the enrollment form.

The Elite Rewards platform administrator can enable **Automatic holiday themes** and select the business time zone from the same platform-only Customization tab. Business owners and staff can see the effective appearance but cannot change it. Automatic resolution runs server-side and temporarily overrides the displayed wallpaper and occasion message without changing the saved manual theme:

- MLK Day — third Monday in January
- Spring Celebration — Easter Sunday
- September 11 Remembrance — September 11
- Winter Holiday — December 24 through December 26

When the toggle is off or the scheduled date ends, the saved manual theme and message display again. Community Event remains manual because it has no universal date. New and existing businesses default to UTC until the Elite Rewards platform administrator selects the correct business time zone.

All supplied backgrounds are same-origin optimized images. Standard previews are at least 1600×900, the four newest live styles are 3840×2160 WebP, and automatic holiday live artwork is 3840×2160 JPEG. Subtle motion uses CSS transforms and is disabled by the existing reduced-motion rule. The commemorative themes contain no sales language, points promotion, or discount messaging.

## Verification

- `npm run check`: passed
- Automated tests: 38/38 passed
- TypeScript: passed
- ESLint: passed with zero warnings
- Production build: passed
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities
- `git diff --check`: passed
- MLK Day and September 11 images were independently vision-reviewed for respectful tone and UI suitability.

Automatic theme tests cover MLK Day, Easter Sunday, September 11 local-date boundaries, the December 24–26 winter window, manual-theme restoration, disabled automation, invalid-time-zone fallback, and the exclusion of Community Event from automatic scheduling.
