import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Reward, Transaction } from "../data/rewards.ts";
import { awardPoints, redeemReward, type DemoRewardsState } from "./rewards-engine.ts";

const baseState = (): DemoRewardsState => ({ points: 1_240, redemptions: [], transactions: [] });
const reward: Reward = {
  id: "r1",
  name: "$5 off",
  points: 500,
  description: "Take $5 off your next purchase.",
  accent: "champagne",
};

describe("rewards engine", () => {
  it("awards positive integer points and appends a ledger entry", () => {
    const transaction: Transaction = {
      id: "t1",
      member: "Maya Thompson",
      initials: "MT",
      amount: 32,
      points: 160,
      type: "earned",
      time: "Just now",
    };
    const result = awardPoints(baseState(), transaction);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.points, 1_400);
    assert.deepEqual(result.state.transactions, [transaction]);
  });

  it("rejects zero, negative, fractional, and redeemed award entries", () => {
    for (const points of [0, -1, 1.5]) {
      const result = awardPoints(baseState(), {
        id: "bad",
        member: "Maya Thompson",
        initials: "MT",
        amount: 0,
        points,
        type: "earned",
        time: "Now",
      });
      assert.deepEqual(result, { ok: false, reason: "invalid-points" });
    }
    const redeemed = awardPoints(baseState(), {
      id: "bad-type",
      member: "Maya Thompson",
      initials: "MT",
      amount: 0,
      points: 10,
      type: "redeemed",
      time: "Now",
    });
    assert.deepEqual(redeemed, { ok: false, reason: "invalid-points" });
  });

  it("redeems atomically without allowing a negative balance", () => {
    const result = redeemReward(baseState(), reward, "Nov 3, 2026, 12:00 PM", "redeem-1");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.points, 740);
    assert.equal(result.state.redemptions[0]?.rewardId, "r1");
    assert.equal(result.state.transactions[0]?.type, "redeemed");
    assert.equal(result.state.transactions[0]?.points, 500);
  });

  it("rejects insufficient points and duplicate redemption", () => {
    const insufficient = redeemReward({ ...baseState(), points: 499 }, reward, "Now", "redeem-low");
    assert.deepEqual(insufficient, { ok: false, reason: "insufficient-points" });

    const duplicateState: DemoRewardsState = {
      ...baseState(),
      redemptions: [{ rewardId: "r1", rewardName: "$5 off", points: 500, redeemedAt: "Earlier" }],
    };
    const duplicate = redeemReward(duplicateState, reward, "Now", "redeem-duplicate");
    assert.deepEqual(duplicate, { ok: false, reason: "already-redeemed" });
  });

  it("does not mutate its input state", () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    redeemReward(state, reward, "Now", "redeem-immutable");
    assert.deepEqual(state, snapshot);
  });
});
