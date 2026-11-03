import type { Reward, Transaction } from "../data/rewards.ts";

export type Redemption = {
  rewardId: string;
  rewardName: string;
  points: number;
  redeemedAt: string;
};

export type DemoRewardsState = {
  points: number;
  redemptions: Redemption[];
  transactions: Transaction[];
};

export type EngineResult =
  | { ok: true; state: DemoRewardsState }
  | { ok: false; reason: "invalid-points" | "insufficient-points" | "already-redeemed" };

function validPositivePoints(points: number): boolean {
  return Number.isSafeInteger(points) && points > 0;
}

export function awardPoints(state: DemoRewardsState, transaction: Transaction): EngineResult {
  if (transaction.type !== "earned" || !validPositivePoints(transaction.points)) {
    return { ok: false, reason: "invalid-points" };
  }

  return {
    ok: true,
    state: {
      ...state,
      points: state.points + transaction.points,
      transactions: [transaction, ...state.transactions],
    },
  };
}

export function redeemReward(
  state: DemoRewardsState,
  reward: Reward,
  redeemedAt: string,
  transactionId: string,
): EngineResult {
  if (!validPositivePoints(reward.points)) {
    return { ok: false, reason: "invalid-points" };
  }
  if (state.redemptions.some((item) => item.rewardId === reward.id)) {
    return { ok: false, reason: "already-redeemed" };
  }
  if (state.points < reward.points) {
    return { ok: false, reason: "insufficient-points" };
  }

  const redemption: Redemption = {
    rewardId: reward.id,
    rewardName: reward.name,
    points: reward.points,
    redeemedAt,
  };
  const transaction: Transaction = {
    id: transactionId,
    member: "Maya Thompson",
    initials: "MT",
    amount: 0,
    points: reward.points,
    type: "redeemed",
    time: redeemedAt,
    rewardId: reward.id,
    rewardName: reward.name,
  };

  return {
    ok: true,
    state: {
      points: state.points - reward.points,
      redemptions: [redemption, ...state.redemptions],
      transactions: [transaction, ...state.transactions],
    },
  };
}
