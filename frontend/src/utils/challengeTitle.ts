/**
 * Turn pack ids (linux-00-…, ds-foundations-01-…, l1-namespace-…) into a
 * readable shelf title when the catalog omits the challenge.
 */
export function humanizeChallengeId(id: string): string {
  const raw = String(id || '').trim();
  if (!raw) return '';

  let body = raw;
  const numbered = raw.match(/^(.*?)-(\d{2})-(.+)$/);
  if (numbered) {
    body = numbered[3];
  } else {
    const prefixed = raw.match(/^[a-z][a-z0-9]*-(.+)$/i);
    if (prefixed) body = prefixed[1];
  }

  const words = body.split('-').filter(Boolean);
  if (!words.length) return raw;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Prefer the pack title; never show a raw id-shaped string. */
export function displayChallengeTitle(
  id: string,
  title?: string | null,
): string {
  const t = String(title || '').trim();
  if (t && t !== id) return t;
  return humanizeChallengeId(id);
}
