export const PRICING_PATH = '/pricing';

export const LAUNCH_OFFER = {
  percentOff: 40,
  endsAt: new Date('2026-11-30T23:59:59+05:30'),
};

export function offerPrice(price: number): number {
  return Math.round(price * (1 - LAUNCH_OFFER.percentOff / 100));
}

const COMMUNITY = 'Community access (Discord)';

/** Credits burned per wall-clock hour by sub-track. Free labs never burn. */
export const CREDIT_RATES_PER_HOUR: Record<string, number> = {
  linux: 1,
  docker: 1.5,
  kubernetes: 2,
  kafka: 3,
  spark: 3,
  'k8s-platform': 3,
};

/** Display order for the pricing page rate strip. */
export const CREDIT_RATE_ROWS: { id: string; label: string; rate: number }[] = [
  { id: 'linux', label: 'Linux', rate: CREDIT_RATES_PER_HOUR.linux },
  { id: 'docker', label: 'Docker', rate: CREDIT_RATES_PER_HOUR.docker },
  { id: 'kubernetes', label: 'Kubernetes', rate: CREDIT_RATES_PER_HOUR.kubernetes },
  { id: 'kafka', label: 'Kafka Platform', rate: CREDIT_RATES_PER_HOUR.kafka },
  { id: 'spark', label: 'Spark Platform', rate: CREDIT_RATES_PER_HOUR.spark },
  { id: 'k8s-platform', label: 'K8s platform', rate: CREDIT_RATES_PER_HOUR['k8s-platform'] },
];

export interface PricingPlan {
  id: string;
  name: string;
  /** Monthly price in INR. 0 = free tier. */
  price: number;
  /** Lab credits granted each billing month (unused do not roll). */
  credits: number;
  /** Higher number wins when a user holds more than one plan. */
  rank: number;
  checklist: string[];
  featured?: boolean;
  /** Free tier — no checkout. */
  free?: boolean;
}

/**
 * Ladder: Lite → Base (access) → Plus / Pro (access + credits).
 * Burn: see CREDIT_RATES_PER_HOUR. Free labs never burn credits.
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'lite',
    name: 'Lite',
    price: 0,
    credits: 0,
    rank: 0,
    free: true,
    checklist: [
      '1 project',
      '2 free labs per track',
      COMMUNITY,
    ],
  },
  {
    id: 'base',
    name: 'Base',
    price: 149,
    credits: 0,
    rank: 1,
    checklist: [
      'All projects',
      'All whiteboards',
      '2 free labs per track',
      COMMUNITY,
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 349,
    credits: 100,
    rank: 2,
    checklist: [
      'All projects',
      'All whiteboards',
      '100 lab credits / month',
      COMMUNITY,
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 499,
    credits: 200,
    rank: 3,
    featured: true,
    checklist: [
      'All projects',
      'All whiteboards',
      '200 lab credits / month',
      COMMUNITY,
    ],
  },
];

/** Old plan ids → current membership cards. */
const PLAN_ALIASES: Record<string, string> = {
  free: 'lite',
  scout: 'lite',
  landing: 'lite',
  builder: 'base',
  forge: 'base',
  pier: 'base',
  starter: 'plus',
  crew: 'plus',
  span: 'plus',
  member: 'pro',
  fleet: 'pro',
  keystone: 'pro',
};

export function pricingPlan(id: string): PricingPlan | null {
  const resolved = PLAN_ALIASES[id] || id;
  return PRICING_PLANS.find((p) => p.id === resolved) || null;
}

/** Credits for `minutes` of wall-clock lab time on a sub-track (0 for free labs / unknown). */
export function creditsForMinutes(track: string, minutes: number): number {
  const rate = CREDIT_RATES_PER_HOUR[track];
  if (!rate || minutes <= 0) return 0;
  return Math.ceil((minutes / 60) * rate * 100) / 100;
}
