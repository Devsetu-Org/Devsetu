import axios from 'axios';
import { getAuthHeader } from './authApi';
import type { ActivityDay } from '../components/ActivityHeatmap';
import type { ProfileBadge } from '../components/ProfileBadges';

export interface MyProfile {
  avatar: string | null;
  activity: ActivityDay[];
  badges: ProfileBadge[];
}

function parseBadges(raw: unknown): ProfileBadge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const row = b as Partial<ProfileBadge>;
      const id = String(row?.id || '').trim();
      const label = String(row?.label || '').trim();
      const mark = String(row?.mark || '').trim();
      if (!id || !label || !mark) return null;
      const earnedAt =
        typeof row.earnedAt === 'number' && Number.isFinite(row.earnedAt) ? row.earnedAt : null;
      return { id, label, mark, earnedAt };
    })
    .filter((b): b is ProfileBadge => Boolean(b));
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const { data } = await axios.get('/api/profile/me', {
    params: { tz: new Date().getTimezoneOffset() },
    headers: getAuthHeader(),
  });
  return {
    avatar: data?.avatar ?? null,
    activity: Array.isArray(data?.activity) ? data.activity : [],
    badges: parseBadges(data?.badges),
  };
}

export async function saveAvatar(avatar: string | null): Promise<string | null> {
  const { data } = await axios.put('/api/profile/avatar', { avatar }, { headers: getAuthHeader() });
  return data?.avatar ?? null;
}
