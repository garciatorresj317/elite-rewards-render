# Join Rewards and business products

Release date: 2026-11-06

## Join Rewards

Every isolated client business has a permanent customer enrollment URL:

`/join?business=<client-business-id>`

The Elite Rewards platform administrator can copy or open it from **Admin → Clients** and from the client customization panel. The public client/NFC page also displays **Join Rewards**.

A customer supplies their own name, email, and private password. Enrollment resolves the business and primary location from the server, creates a tenant-isolated member and zero-point balance, records an audit event, and signs the member into the wallet. Direct enrollment does not create referral attribution or award bonus points. The Elite Rewards platform tenant is excluded.

The current account schema uses globally unique email addresses, so one email can currently belong to only one Elite Rewards account across all client businesses. Supporting the same person in several client programs requires the planned identity-plus-memberships migration.

## Business products

Products are intentionally separate from redeemable rewards:

- Business owners manage their catalog under **Admin → Products**.
- The sole Elite Rewards platform administrator can manage each client’s catalog under **Admin → Clients → Customize client**.
- Product fields include name, description, category, a $0–$99,999 price, a 0–99,999 points value, an optional details link, visibility, and archive state.
- Product images are chosen from local PNG, JPEG, or WebP files up to 4 MB and stored durably in PostgreSQL; existing legacy image links remain visible until replaced.
- Published products appear on the public client/NFC page and the authenticated member page.
- Products never consume points, decrement reward inventory, or enter the rewards ledger.
- Every read and write is tenant-scoped; platform-admin client operations reject the Elite platform tenant.

## Localization

All fixed enrollment and product-interface copy uses the persistent English/Español system. Business-authored product names and descriptions remain as entered by the business.

## Verification

- `npm run check`
- 55/55 automated tests
- TypeScript, ESLint, and production build passed
- Production dependency audit reported zero vulnerabilities
- Tenant product management, cross-tenant denial, direct customer enrollment, zero balance, duplicate-email rejection, and platform-tenant exclusion are covered by automated tests
