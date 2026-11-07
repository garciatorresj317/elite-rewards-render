import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "./auth.ts";

describe("password policy", () => {
  it("accepts passwords from 8 through 200 characters and keeps hashes verifiable", async () => {
    for (const password of ["12345678", "x".repeat(200)]) {
      const hash = await hashPassword(password);
      assert.equal(await verifyPassword(password, hash), true);
      assert.equal(await verifyPassword(`${password}x`, hash), false);
    }
  });

  it("rejects passwords outside the 8 through 200 character policy", async () => {
    await assert.rejects(() => hashPassword("1234567"), /between 8 and 200 characters/);
    await assert.rejects(() => hashPassword("x".repeat(201)), /between 8 and 200 characters/);
  });
});
