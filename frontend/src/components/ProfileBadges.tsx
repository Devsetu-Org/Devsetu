import React from 'react';
import { IconBadge } from './ChromeIcons';

export interface ProfileBadge {
  id: string;
  label: string;
  mark: string;
  earnedAt: number | null;
}

function formatEarned(ms: number | null): string {
  if (!ms) return 'Track complete';
  return `Earned ${new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

/** Crest tray of track-completion seals. Empty state when none earned yet. */
export default function ProfileBadges({
  badges,
  loading = false,
}: {
  badges: ProfileBadge[] | null;
  loading?: boolean;
}): JSX.Element {
  if (loading || badges == null) {
    return <p className="profile-shelf-empty"><span className="spinner" /> Loading…</p>;
  }

  if (badges.length === 0) {
    return (
      <p className="profile-shelf-empty">
        Complete every lab in a track to earn its seal.
      </p>
    );
  }

  return (
    <ul className="profile-badge-tray" aria-label="Earned track seals">
      {badges.map((badge) => (
        <li key={badge.id}>
          <span
            className={`profile-badge-slot profile-badge-slot--earned profile-badge-slot--${badge.id}`}
            title={`${badge.label} — ${formatEarned(badge.earnedAt)}`}
          >
            <IconBadge />
            <em className="profile-badge-mark">{badge.mark}</em>
            <span className="sr-only">
              {badge.label}. {formatEarned(badge.earnedAt)}.
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
