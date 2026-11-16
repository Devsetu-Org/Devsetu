/**
 * When locked, anyone can browse tracks/sections, but only admins can open labs
 * or other live content. Flip to false (and ACCESS_LOCKED=0 on the backend)
 * when the pilot opens to a wider audience.
 */
export const ACCESS_LOCKED = true;

export const WAITLIST_PATH = '/waitlist';

/** Old campus URL — keep working via redirect. */
export const LEGACY_WAITLIST_PATH = '/nitw';

export const ACCESS_LOCKED_OPEN_MSG =
  'Labs open with the closed pilot (28 Nov – 28 Dec). Join the waitlist at /waitlist.';

/** Closed pilot window shown on the waitlist page. */
export const PILOT = {
  startsLabel: '28 Nov 2026',
  endsLabel: '28 Dec 2026',
  startsIso: '2026-11-28',
  endsIso: '2026-12-28',
} as const;
