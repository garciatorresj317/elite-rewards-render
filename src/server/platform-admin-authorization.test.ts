import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionUser } from "./auth.ts";
import { requirePlatformAdmin } from "./auth.ts";

const platformAdministrator: SessionUser = {
  id: "usr_platform",
  businessId: "biz_platform",
  locationId: "loc_platform",
  role: "staff",
  name: "Platform Administrator",
  email: "admin@example.com",
  memberCode: null,
  platformAdmin: true,
};

describe("platform administrator authorization", () => {
  it("uses the immutable platform-administrator assignment instead of a stale role value", () => {
    assert.doesNotThrow(() => requirePlatformAdmin(platformAdministrator));
  });

  it("rejects signed-out and non-platform users", () => {
    assert.throws(() => requirePlatformAdmin(null), /Authentication required/);
    assert.throws(
      () => requirePlatformAdmin({ ...platformAdministrator, platformAdmin: false }),
      /Platform administrator access required/,
    );
  });
});
