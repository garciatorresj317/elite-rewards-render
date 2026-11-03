export type Transaction = {
  id: string;
  member: string;
  initials: string;
  amount: number;
  points: number;
  type: "earned" | "redeemed";
  time: string;
  rewardId?: string;
  rewardName?: string;
};

export type Reward = {
  id: string;
  name: string;
  points: number;
  description: string;
  accent: string;
};

export const rewards: Reward[] = [
  {
    id: "r1",
    name: "$5 off",
    points: 500,
    description: "Take $5 off your next purchase.",
    accent: "champagne",
  },
  {
    id: "r2",
    name: "Free favorite",
    points: 850,
    description: "Choose one eligible item on us.",
    accent: "gold",
  },
  {
    id: "r3",
    name: "$15 reward",
    points: 1200,
    description: "A bigger thank-you for loyal members.",
    accent: "amber",
  },
];

export const seedTransactions: Transaction[] = [
  {
    id: "t1",
    member: "Tara Williams",
    initials: "TW",
    amount: 47.29,
    points: 236,
    type: "earned",
    time: "Today, 3:47 PM",
  },
  {
    id: "t2",
    member: "Marcus Johnson",
    initials: "MJ",
    amount: 19.98,
    points: 100,
    type: "earned",
    time: "Today, 3:21 PM",
  },
  {
    id: "t3",
    member: "Lena Carter",
    initials: "LC",
    amount: 62.5,
    points: 313,
    type: "earned",
    time: "Today, 2:58 PM",
  },
  {
    id: "t4",
    member: "Devin Harris",
    initials: "DH",
    amount: 15,
    points: 75,
    type: "earned",
    time: "Today, 2:37 PM",
  },
  {
    id: "t5",
    member: "Riley Davis",
    initials: "RD",
    amount: 28.44,
    points: 500,
    type: "redeemed",
    time: "Today, 2:10 PM",
  },
];

export const growthData = [
  { label: "May", members: 3180 },
  { label: "Jun", members: 3520 },
  { label: "Jul", members: 3905 },
  { label: "Aug", members: 4230 },
  { label: "Sep", members: 4518 },
  { label: "Oct", members: 4892 },
];

export const activityData = [
  { name: "Free items", value: 52, fill: "#ffe27a" },
  { name: "Points discounts", value: 28, fill: "#f6b900" },
  { name: "Special rewards", value: 12, fill: "#c88700" },
  { name: "Other", value: 8, fill: "#76500a" },
];
