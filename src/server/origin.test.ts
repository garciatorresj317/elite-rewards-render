import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleApiRequest, isSameOrigin } from "./api.ts";

function request(
  headers: Record<string, string>,
  url = "http://internal-render-host:10000/api/setup",
) {
  return new Request(url, { method: "POST", headers });
}

describe("same-origin mutation guard", () => {
  it("accepts a direct same-origin request", () => {
    assert.equal(
      isSameOrigin(
        request(
          {
            origin: "https://elite-rewards.onrender.com",
            "sec-fetch-site": "same-origin",
          },
          "https://elite-rewards.onrender.com/api/setup",
        ),
      ),
      true,
    );
  });

  it("accepts Render's configured public URL when the internal request URL differs", () => {
    const previous = process.env["RENDER_EXTERNAL_URL"];
    process.env["RENDER_EXTERNAL_URL"] = "https://elite-rewards.onrender.com";
    try {
      assert.equal(
        isSameOrigin(
          request({
            origin: "https://elite-rewards.onrender.com",
            "sec-fetch-site": "same-origin",
          }),
        ),
        true,
      );
    } finally {
      if (previous === undefined) delete process.env["RENDER_EXTERNAL_URL"];
      else process.env["RENDER_EXTERNAL_URL"] = previous;
    }
  });

  it("rejects a different origin even when it targets the public service", () => {
    assert.equal(
      isSameOrigin(
        request({
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        }),
      ),
      false,
    );
  });

  it("does not trust spoofed forwarded headers", () => {
    assert.equal(
      isSameOrigin(
        request({
          origin: "https://attacker.example",
          "sec-fetch-site": "same-origin",
          "x-forwarded-host": "attacker.example",
          "x-forwarded-proto": "https",
        }),
      ),
      false,
    );
  });

  it("fails closed when Origin is absent or malformed", () => {
    assert.equal(isSameOrigin(request({ "sec-fetch-site": "same-origin" })), false);
    assert.equal(
      isSameOrigin(request({ origin: "not a URL", "sec-fetch-site": "same-origin" })),
      false,
    );
  });

  it("rejects cross-origin API mutations before database initialization", async () => {
    const previousDatabaseUrl = process.env["DATABASE_URL"];
    delete process.env["DATABASE_URL"];
    try {
      const response = await handleApiRequest(
        new Request("https://elite-rewards.onrender.com/api/auth/logout", {
          method: "POST",
          headers: {
            origin: "https://attacker.example",
            "sec-fetch-site": "cross-site",
          },
        }),
      );
      assert.equal(response?.status, 403);
      assert.deepEqual(await response?.json(), { error: "Cross-origin request rejected" });
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = previousDatabaseUrl;
    }
  });
});
