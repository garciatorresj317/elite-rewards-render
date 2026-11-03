import { seedTransactions, type Reward, type Transaction } from "../data/rewards.ts";
import {
  awardPoints,
  redeemReward,
  type DemoRewardsState,
  type Redemption,
} from "./rewards-engine.ts";

export type WalletState = {
  points: number;
  claimed: string[];
  redemptions: Redemption[];
};

type StoredDemoState = DemoRewardsState & { version: 2 };

const stateKey = "elite-demo-state-v2";
const legacyWalletKey = "elite-wallet";
const legacyTransactionsKey = "elite-admin-transactions";
const defaultState: StoredDemoState = {
  version: 2,
  points: 1240,
  redemptions: [],
  transactions: seedTransactions,
};

function readJson(key: string): unknown {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function writeState(value: DemoRewardsState): boolean {
  try {
    const stored: StoredDemoState = { version: 2, ...value };
    window.localStorage.setItem(stateKey, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

function isRedemption(value: unknown): value is Redemption {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Redemption>;
  return (
    typeof candidate.rewardId === "string" &&
    typeof candidate.rewardName === "string" &&
    typeof candidate.points === "number" &&
    Number.isSafeInteger(candidate.points) &&
    candidate.points > 0 &&
    typeof candidate.redeemedAt === "string"
  );
}

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Transaction>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.member === "string" &&
    typeof candidate.initials === "string" &&
    typeof candidate.amount === "number" &&
    Number.isFinite(candidate.amount) &&
    candidate.amount >= 0 &&
    typeof candidate.points === "number" &&
    Number.isSafeInteger(candidate.points) &&
    candidate.points > 0 &&
    (candidate.type === "earned" || candidate.type === "redeemed") &&
    typeof candidate.time === "string" &&
    (candidate.rewardId === undefined || typeof candidate.rewardId === "string") &&
    (candidate.rewardName === undefined || typeof candidate.rewardName === "string")
  );
}

function isStoredState(value: unknown): value is StoredDemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredDemoState>;
  return (
    candidate.version === 2 &&
    typeof candidate.points === "number" &&
    Number.isSafeInteger(candidate.points) &&
    candidate.points >= 0 &&
    Array.isArray(candidate.redemptions) &&
    candidate.redemptions.every(isRedemption) &&
    Array.isArray(candidate.transactions) &&
    candidate.transactions.every(isTransaction)
  );
}

function migrateLegacyState(): StoredDemoState {
  const wallet = readJson(legacyWalletKey);
  const transactions = readJson(legacyTransactionsKey);
  const legacyPoints =
    wallet &&
    typeof wallet === "object" &&
    typeof (wallet as { points?: unknown }).points === "number" &&
    Number.isSafeInteger((wallet as { points: number }).points) &&
    (wallet as { points: number }).points >= 0
      ? (wallet as { points: number }).points
      : defaultState.points;
  const legacyTransactions =
    Array.isArray(transactions) && transactions.every(isTransaction)
      ? transactions
      : defaultState.transactions;
  return { ...defaultState, points: legacyPoints, transactions: legacyTransactions };
}

function readState(): StoredDemoState {
  const current = readJson(stateKey);
  if (isStoredState(current)) return current;
  const migrated = migrateLegacyState();
  writeState(migrated);
  return migrated;
}

export function readWallet(): WalletState {
  const state = readState();
  return {
    points: state.points,
    claimed: state.redemptions.map((item) => item.rewardId),
    redemptions: state.redemptions,
  };
}

export function readTransactions(_fallback: Transaction[] = seedTransactions): Transaction[] {
  return readState().transactions;
}

export function applyDemoAward(
  transaction: Transaction,
): { ok: true; transactions: Transaction[]; saved: boolean } | { ok: false; reason: string } {
  const result = awardPoints(readState(), transaction);
  if (!result.ok) return result;
  return {
    ok: true,
    transactions: result.state.transactions,
    saved: writeState(result.state),
  };
}

export function applyDemoRedemption(
  reward: Reward,
  redeemedAt: string,
  transactionId: string,
): { ok: true; wallet: WalletState; saved: boolean } | { ok: false; reason: string } {
  const result = redeemReward(readState(), reward, redeemedAt, transactionId);
  if (!result.ok) return result;
  const saved = writeState(result.state);
  return {
    ok: true,
    saved,
    wallet: {
      points: result.state.points,
      claimed: result.state.redemptions.map((item) => item.rewardId),
      redemptions: result.state.redemptions,
    },
  };
}

export function resetDemoState(): boolean {
  return writeState(defaultState);
}
