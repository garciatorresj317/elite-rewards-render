import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { seedTransactions } from "../data/rewards.ts";
import { applyDemoAward, readWallet, resetDemoState } from "./demo-storage.ts";

class MemoryStorage {
  values = new Map<string, string>();
  blocked = false;

  getItem(key: string): string | null {
    if (this.blocked) throw new Error("storage blocked");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.blocked) throw new Error("storage blocked");
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: storage,
};

describe("demo storage", () => {
  beforeEach(() => {
    storage.blocked = false;
    storage.values.clear();
  });

  it("falls back safely when stored JSON is corrupted", () => {
    storage.values.set("elite-demo-state-v2", "{not-json");
    assert.deepEqual(readWallet(), { points: 1240, claimed: [], redemptions: [] });
  });

  it("reports a blocked write while preserving the session result", () => {
    storage.blocked = true;
    const result = applyDemoAward({
      id: "session-award",
      member: "Maya Thompson",
      initials: "MT",
      amount: 32,
      points: 160,
      type: "earned",
      time: "Just now",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.saved, false);
    assert.equal(result.transactions[0]?.id, "session-award");
    assert.equal(result.transactions.length, seedTransactions.length + 1);
  });

  it("resets a changed wallet to the deterministic demo seed", () => {
    const award = applyDemoAward({
      id: "award-before-reset",
      member: "Maya Thompson",
      initials: "MT",
      amount: 32,
      points: 160,
      type: "earned",
      time: "Just now",
    });
    assert.equal(award.ok, true);
    assert.equal(readWallet().points, 1400);
    assert.equal(resetDemoState(), true);
    assert.equal(readWallet().points, 1240);
  });
});
