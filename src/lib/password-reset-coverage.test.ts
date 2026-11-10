import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFile(join(root, ...parts), "utf8");

describe("password reset experience", () => {
  it("links every account sign-in mode to the bilingual recovery flow", async () => {
    const [login, forgot, reset, i18n] = await Promise.all([
      read("src", "routes", "login.tsx"),
      read("src", "routes", "forgot-password.tsx"),
      read("src", "routes", "reset-password.tsx"),
      read("src", "i18n", "index.tsx"),
    ]);
    assert.match(login, /to="\/forgot-password"/);
    assert.match(login, /Forgot password\?/);
    assert.match(forgot, /api\.forgotPassword\(email\)/);
    assert.match(forgot, /If that email belongs to an active account/);
    assert.match(reset, /PasswordField/);
    assert.equal((reset.match(/autoComplete="new-password"/g) ?? []).length, 2);
    assert.match(reset, /api\.resetPassword\(token, password\)/);
    assert.match(reset, /Password reset complete/);
    assert.match(reset, /window\.history\.replaceState/);
    assert.doesNotMatch(reset, /to: result\.role === "member" \? "\/wallet" : "\/admin"/);
    for (const key of [
      "Forgot password?",
      "Request password reset",
      "Secure password reset",
      "Create a new password",
      "Reset password",
    ]) {
      assert.match(i18n, new RegExp(key.replace(/[?]/g, "\\?")));
    }
  });

  it("keeps reset issuance behind platform-admin authentication", async () => {
    const [api, service, migration, admin] = await Promise.all([
      read("src", "server", "api.ts"),
      read("src", "server", "password-reset-service.ts"),
      read("migrations", "013_password_resets.sql"),
      read("src", "routes", "admin.tsx"),
    ]);
    assert.match(api, /\/api\/admin\/password-resets/);
    assert.match(api, /requirePlatformAdmin\(user\)/);
    assert.match(service, /randomBytes\(32\)/);
    assert.match(service, /createHash\("sha256"\)/);
    assert.match(service, /DELETE FROM sessions WHERE user_id/);
    assert.match(service, /password-reset-email/);
    assert.match(service, /password-reset-subject/);
    assert.match(service, /Password reset link is invalid or expired/);
    assert.match(migration, /password_reset_tokens/);
    assert.match(migration, /token_hash text NOT NULL UNIQUE/);
    assert.match(admin, /Password resets/);
    assert.match(admin, /Send this only to the verified account holder/);
  });
});
