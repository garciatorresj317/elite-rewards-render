import type { Transaction } from "@/data/rewards";

export type WalletState = {
  points: number;
  claimed: string[];
};

const walletKey = "elite-wallet";
const transactionsKey = "elite-admin-transactions";
const defaultWallet: WalletState = { points: 1240, claimed: [] };

function readJson<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    const parsed: unknown = JSON.parse(value);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isWalletState(value: unknown): value is WalletState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WalletState>;
  return (
    typeof candidate.points === "number" &&
    Number.isFinite(candidate.points) &&
    candidate.points >= 0 &&
    Array.isArray(candidate.claimed) &&
    candidate.claimed.every((id) => typeof id === "string")
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
    typeof candidate.points === "number" &&
    Number.isFinite(candidate.points) &&
    (candidate.type === "earned" || candidate.type === "redeemed") &&
    typeof candidate.time === "string"
  );
}

function isTransactionList(value: unknown): value is Transaction[] {
  return Array.isArray(value) && value.every(isTransaction);
}

export function readWallet(): WalletState {
  return readJson(walletKey, defaultWallet, isWalletState);
}

export function saveWallet(value: WalletState): boolean {
  return writeJson(walletKey, value);
}

export function readTransactions(fallback: Transaction[]): Transaction[] {
  return readJson(transactionsKey, fallback, isTransactionList);
}

export function saveTransactions(value: Transaction[]): boolean {
  return writeJson(transactionsKey, value);
}

export function addDemoPoints(points: number): boolean {
  const wallet = readWallet();
  return saveWallet({ ...wallet, points: wallet.points + points });
}
