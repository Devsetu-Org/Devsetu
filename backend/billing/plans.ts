'use strict';

/**
 * Membership plans (sellable) plus legacy ids kept so existing subscribers
 * keep their entitlements after renames.
 *
 * Ladder: Base (access) → Plus / Pro (access + credits).
 * Covers: projects | whiteboard | linux | docker | kubernetes | kafka | spark | k8s-platform
 * Burn rates: backend/billing/creditRates.ts
 */

export type PlanId =
  | 'base'
  | 'plus'
  | 'pro'
  | 'pier'
  | 'span'
  | 'keystone'
  | 'forge'
  | 'crew'
  | 'fleet'
  | 'builder'
  | 'starter'
  | 'member'
  | 'linux'
  | 'docker'
  | 'kubernetes'
  | 'devops-engineer';

export type FeatureId =
  | 'projects'
  | 'whiteboard'
  | 'linux'
  | 'docker'
  | 'kubernetes'
  | 'kafka'
  | 'spark'
  | 'k8s-platform';

export interface BillingPlan {
  id: PlanId;
  name: string;
  /** Monthly price in INR. Must match the Razorpay plan amount. */
  price: number;
  /** Lab credits granted each billing month (unused do not roll). */
  credits: number;
  /** Rank for upgrades / “already included” checks. Higher includes lower. */
  rank: number;
  /** Features and paid tracks this plan unlocks. */
  covers: FeatureId[];
  envKey: string;
  /** When false, hidden from /api/billing/config and createRazorpayPlans. */
  sellable?: boolean;
}

const TRACKS: FeatureId[] = ['linux', 'docker', 'kubernetes', 'kafka', 'spark', 'k8s-platform'];
const ACCESS: FeatureId[] = ['projects', 'whiteboard'];

const PLANS: BillingPlan[] = [
  {
    id: 'base',
    name: 'Base',
    price: 149,
    credits: 0,
    rank: 1,
    covers: [...ACCESS],
    envKey: 'RAZORPAY_PLAN_BASE',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 349,
    credits: 100,
    rank: 2,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_PLUS',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 499,
    credits: 200,
    rank: 3,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_PRO',
  },
  // Pre-rename membership ids.
  {
    id: 'pier',
    name: 'Base',
    price: 149,
    credits: 0,
    rank: 1,
    covers: [...ACCESS],
    envKey: 'RAZORPAY_PLAN_PIER',
    sellable: false,
  },
  {
    id: 'span',
    name: 'Plus',
    price: 349,
    credits: 100,
    rank: 2,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_SPAN',
    sellable: false,
  },
  {
    id: 'keystone',
    name: 'Pro',
    price: 499,
    credits: 200,
    rank: 3,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_KEYSTONE',
    sellable: false,
  },
  {
    id: 'forge',
    name: 'Base',
    price: 149,
    credits: 0,
    rank: 1,
    covers: [...ACCESS],
    envKey: 'RAZORPAY_PLAN_FORGE',
    sellable: false,
  },
  {
    id: 'crew',
    name: 'Plus',
    price: 349,
    credits: 100,
    rank: 2,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_CREW',
    sellable: false,
  },
  {
    id: 'fleet',
    name: 'Pro',
    price: 499,
    credits: 200,
    rank: 3,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_FLEET',
    sellable: false,
  },
  {
    id: 'builder',
    name: 'Base',
    price: 149,
    credits: 0,
    rank: 1,
    covers: [...ACCESS],
    envKey: 'RAZORPAY_PLAN_BUILDER',
    sellable: false,
  },
  {
    id: 'starter',
    name: 'Plus',
    price: 349,
    credits: 100,
    rank: 2,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_STARTER',
    sellable: false,
  },
  {
    id: 'member',
    name: 'Pro',
    price: 499,
    credits: 200,
    rank: 3,
    covers: [...ACCESS, ...TRACKS],
    envKey: 'RAZORPAY_PLAN_MEMBER',
    sellable: false,
  },
  // Legacy track SKUs — still resolve entitlements for existing payments.
  {
    id: 'linux',
    name: 'Linux',
    price: 199,
    credits: 0,
    rank: 0,
    covers: ['linux'],
    envKey: 'RAZORPAY_PLAN_LINUX',
    sellable: false,
  },
  {
    id: 'docker',
    name: 'Docker',
    price: 249,
    credits: 0,
    rank: 0,
    covers: ['docker'],
    envKey: 'RAZORPAY_PLAN_DOCKER',
    sellable: false,
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    price: 399,
    credits: 0,
    rank: 0,
    covers: ['kubernetes'],
    envKey: 'RAZORPAY_PLAN_KUBERNETES',
    sellable: false,
  },
  {
    id: 'devops-engineer',
    name: 'DevOps Engineer',
    price: 699,
    credits: 0,
    rank: 0,
    covers: ['linux', 'docker', 'kubernetes'],
    envKey: 'RAZORPAY_PLAN_DEVOPS',
    sellable: false,
  },
];

function listPlans(): BillingPlan[] {
  return PLANS.filter((p) => p.sellable !== false);
}

function listAllPlans(): BillingPlan[] {
  return PLANS;
}

function getPlan(id: string): BillingPlan | null {
  return PLANS.find((p) => p.id === id) || null;
}

function razorpayPlanId(plan: BillingPlan): string {
  return String(process.env[plan.envKey] || '').trim();
}

/** True when an entitled `holder` already includes everything `wanted` sells. */
function planIncludes(holder: BillingPlan, wanted: BillingPlan): boolean {
  if (holder.id === wanted.id) return false;
  if (holder.rank > 0 && wanted.rank > 0) return holder.rank > wanted.rank;
  return wanted.covers.every((f) => holder.covers.includes(f));
}

/** Launch offer: percent off the first month when LAUNCH_OFFER_PERCENT is set. Off by default. */
function launchOffer(): { percentOff: number; endsAt: number } | null {
  const percentOff = parseInt(process.env.LAUNCH_OFFER_PERCENT || '0', 10);
  const endsAt = Date.parse(process.env.LAUNCH_OFFER_ENDS_AT || '2026-11-30T23:59:59+05:30');
  if (!percentOff || percentOff <= 0 || percentOff >= 100 || Number.isNaN(endsAt)) return null;
  if (Date.now() > endsAt) return null;
  return { percentOff, endsAt };
}

function offerPrice(price: number, percentOff: number): number {
  return Math.round(price * (1 - percentOff / 100));
}

module.exports = {
  listPlans,
  listAllPlans,
  getPlan,
  razorpayPlanId,
  planIncludes,
  launchOffer,
  offerPrice,
};
