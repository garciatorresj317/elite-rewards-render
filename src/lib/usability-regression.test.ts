import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = (...parts: string[]) => readFile(join(process.cwd(), "src", ...parts), "utf8");

describe("user-friendly experience regression coverage", () => {
  it("keeps member routing intent and adds recoverable wallet states", async () => {
    const wallet = await source("routes", "wallet.tsx");
    assert.match(wallet, /navigate\(\{ to: "\/login", search: \{ access: "member" \} \}\)/);
    assert.match(wallet, /<PageStatus/);
    assert.match(wallet, /onRetry=\{\(\) => void load\(\)\}/);
  });

  it("uses router-validated join parameters and recoverable public page errors", async () => {
    const [joinPage, clientPage, status] = await Promise.all([
      source("routes", "join.tsx"),
      source("routes", "clients.$clientId.tsx"),
      source("components", "PageStatus.tsx"),
    ]);
    assert.match(joinPage, /validateSearch/);
    assert.match(joinPage, /Route\.useSearch\(\)/);
    assert.doesNotMatch(joinPage, /new URLSearchParams\(location\.search\)/);
    assert.match(joinPage, /Your account is private/);
    assert.match(clientPage, /retryLabel=\{t\("Try again"\)\}/);
    assert.match(clientPage, /to="\/join"/);
    assert.match(status, /aria-live="polite"/);
  });

  it("makes redemptions deliberate and referral copying visible", async () => {
    const wallet = await source("routes", "wallet.tsx");
    assert.match(wallet, /window\.confirm/);
    assert.match(wallet, /This will deduct the points from your balance/);
    assert.match(wallet, /redeemingId/);
    assert.match(wallet, /if \(redeemingId !== null\) return/);
    assert.match(wallet, /disabled=\{disabled \|\| redeemingId !== null\}/);
    assert.match(wallet, /Referral link copied/);
    assert.match(wallet, /Copy failed\. Select and copy the link manually/);
  });

  it("adds dashboard quick actions and limits transaction search to relevant sections", async () => {
    const admin = await source("routes", "admin.tsx");
    assert.match(admin, /className="quick-actions"/);
    assert.match(admin, /setActive\("Members"\)/);
    assert.match(admin, /setActive\("Rewards"\)/);
    assert.match(admin, /setActive\("Products"\)/);
    assert.match(admin, /setActive\("Appearance"\)/);
    assert.match(admin, /active === "Dashboard" \|\| active === "Transactions"/);
    assert.match(admin, /initialLoadFailed/);
  });

  it("keeps the bilingual control at the bottom of every screen", async () => {
    const styles = await source("styles.css");
    const localeStart = styles.indexOf(".language-switcher {");
    const localeEnd = styles.indexOf(".language-switcher button", localeStart);
    const localeRule = styles.slice(localeStart, localeEnd);
    assert.match(localeRule, /bottom:/);
    assert.match(localeRule, /top:\s*auto/);
  });

  it("keeps mobile escape links visible and removes fake or empty public controls", async () => {
    const [styles, home, client, admin] = await Promise.all([
      source("styles.css"),
      source("routes", "index.tsx"),
      source("routes", "clients.$clientId.tsx"),
      source("routes", "admin.tsx"),
    ]);
    assert.doesNotMatch(styles, /\n\s*\.back-link \{ font-size: 0; \}/);
    assert.match(styles, /\.wallet-page \.back-link \{ font-size: 0; \}/);
    assert.match(styles, /\.password-visibility-toggle[\s\S]*width: 44px; height: 44px/);
    assert.doesNotMatch(home, /<button>\{t\("Use reward"\)\}<\/button>/);
    assert.match(client, /\{data\.products\.length > 0 && \(/);
    assert.match(admin, /Enroll your first member/);
  });

  it("keeps every sign-in control off the How It Works marketing page", async () => {
    const home = await source("routes", "index.tsx");
    assert.doesNotMatch(home, /to="\/login"/);
    assert.doesNotMatch(home, /href="\/login/);
    assert.doesNotMatch(home, /Member sign in|Business sign in|Sign in to Elite Rewards/);
  });

  it("keeps portrait-phone layouts fitted, touchable, and dismissible", async () => {
    const [styles, admin] = await Promise.all([
      source("styles.css"),
      source("routes", "admin.tsx"),
    ]);
    assert.match(styles, /@media \(max-width: 430px\)/);
    assert.match(styles, /\.container-wide, \.container-mid \{ width: calc\(100% - 24px\); \}/);
    assert.match(styles, /\.admin-mobile-scrim[\s\S]*position: fixed; z-index: 29; inset: 0/);
    const themedSurfaceRule = styles.indexOf(
      ".admin-sidebar, .admin-main, .wallet-header, .wallet-layout, .themed-surface-content",
    );
    const mobileSidebarFix = styles.indexOf(
      ".admin-sidebar { position: fixed; height: 100dvh; }",
      themedSurfaceRule,
    );
    assert.ok(themedSurfaceRule >= 0, "expected the themed-surface stacking rule");
    assert.ok(
      mobileSidebarFix > themedSurfaceRule,
      "the portrait sidebar override must follow the shared position rule so it stays out of flow",
    );
    assert.match(styles, /\.modal-backdrop \{ align-items: end; padding: 10px; \}/);
    assert.match(styles, /\.language-switcher \{ right: 50%; transform: translateX\(50%\); \}/);
    assert.match(admin, /className="admin-mobile-scrim"/);
    assert.match(admin, /onClick=\{\(\) => setMobile\(false\)\}/);
    assert.match(admin, /document\.body\.style\.overflow = "hidden"/);
    assert.match(admin, /event\.key === "Escape"/);
    assert.match(admin, /aria-label=\{tr\([\s\S]*"Scrollable transaction table"/);
  });

  it("shows the registered LLC notice beneath the How It Works footer message", async () => {
    const home = await source("routes", "index.tsx");
    assert.match(
      home,
      /Thoughtful loyalty tools for growing businesses\."\)}<\/p>[\s\S]*Trade Marked and Registered LLC/,
    );
  });

  it("details branding, loyalty modes, referrals, and team benefits on How It Works", async () => {
    const [home, i18n] = await Promise.all([
      source("routes", "index.tsx"),
      source("i18n", "index.tsx"),
    ]);
    for (const phrase of [
      "Built around your brand",
      "Choose points or visits",
      "Grow through referrals",
      "Add a loyalty system your whole team can use.",
    ]) {
      assert.match(home, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(i18n, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(home, /logo, colors, business motto or live message/);
    assert.match(home, /points for eligible purchases or count visits/);
    assert.match(home, /personal link with friends and family/);
    assert.match(home, /className="team-benefits container-wide"/);
  });
});
