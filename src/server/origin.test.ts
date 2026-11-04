import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSameOrigin } from "./api.ts";

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

  it("accepts the public origin supplied by Render's trusted proxy headers", () => {
    assert.equal(
      isSameOrigin(
        request({
          origin: "https://elite-rewards.onrender.com",
          "sec-fetch-site": "same-origin",
          "x-forwarded-host": "elite-rewards.onrender.com",
          "x-forwarded-proto": "https",
        }),
      ),
      true,
    );
  });

  it("accepts the first proxy hop when forwarded headers contain a chain", () => {
    assert.equal(
      isSameOrigin(
        request({
          origin: "https://elite-rewards.onrender.com",
          "sec-fetch-site": "same-origin",
          "x-forwarded-host": "elite-rewards.onrender.com, internal-render-host:10000",
          "x-forwarded-proto": "https, http",
        }),
      ),
      true,
    );
  });

  it("rejects a different origin even when it targets the public service", () => {
    assert.equal(
      isSameOrigin(
        request({
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
          "x-forwarded-host": "elite-rewards.onrender.com",
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
});
