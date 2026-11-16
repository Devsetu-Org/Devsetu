'use strict';

/**
 * Credits burned per wall-clock hour by sub-track (pack `category`).
 * Free labs (FREE_LAB_IDS) never burn, even on Plus / Pro.
 */

export type CreditTrack =
  | 'linux'
  | 'docker'
  | 'kubernetes'
  | 'kafka'
  | 'spark'
  | 'k8s-platform';

const CREDIT_RATES_PER_HOUR: Record<CreditTrack, number> = {
  linux: 1,
  docker: 1.5,
  kubernetes: 2,
  kafka: 3,
  spark: 3,
  'k8s-platform': 3,
};

function rateForTrack(track: string | null | undefined): number | null {
  if (!track) return null;
  const rate = CREDIT_RATES_PER_HOUR[track as CreditTrack];
  return typeof rate === 'number' ? rate : null;
}

/** Credits for `minutes` of wall-clock time. Rounded up to 0.01 credit. */
function creditsForMinutes(track: string | null | undefined, minutes: number): number {
  const rate = rateForTrack(track);
  if (rate == null || minutes <= 0) return 0;
  return Math.ceil((minutes / 60) * rate * 100) / 100;
}

module.exports = {
  CREDIT_RATES_PER_HOUR,
  rateForTrack,
  creditsForMinutes,
};
