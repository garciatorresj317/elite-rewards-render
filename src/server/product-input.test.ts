import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productInput } from "./api.ts";

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: "Catalog Product",
    description: "A product offered by the business.",
    category: "Featured",
    priceCents: 0,
    pointsCost: 0,
    visitsCost: 1,
    imageUrl: null,
    purchaseUrl: null,
    active: true,
    ...overrides,
  };
}

describe("product input limits", () => {
  it("accepts the inclusive product price and points boundaries", () => {
    assert.equal(productInput(input()).priceCents, 0);
    assert.equal(productInput(input()).pointsCost, 0);
    assert.equal(productInput(input({ priceCents: 9_999_900 })).priceCents, 9_999_900);
    assert.equal(productInput(input({ pointsCost: 99_999 })).pointsCost, 99_999);
    assert.equal(productInput(input({ visitsCost: 1_000_000 })).visitsCost, 1_000_000);
  });

  it("rejects product prices and points outside the approved ranges", () => {
    assert.throws(() => productInput(input({ priceCents: -1 })), /Price is invalid/);
    assert.throws(() => productInput(input({ priceCents: 9_999_901 })), /Price is invalid/);
    assert.throws(() => productInput(input({ pointsCost: -1 })), /Points is invalid/);
    assert.throws(() => productInput(input({ pointsCost: 100_000 })), /Points is invalid/);
    assert.throws(() => productInput(input({ visitsCost: 1_000_001 })), /Visits is invalid/);
  });

  it("keeps legacy image URLs restricted to public HTTPS addresses", () => {
    assert.throws(
      () =>
        productInput(
          input({ imageUrl: "/api/admin/clients/biz_client/products/prd_product/image" }),
        ),
      /Product image is invalid/,
    );
  });
});
