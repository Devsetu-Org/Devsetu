import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '../context/AppStateContext';
import { isAdminUser } from '../services/authApi';
import {
  approveAdminUser,
  fetchAdminUsers,
  rejectAdminUser,
  updateAdminUserRole,
  type AdminUser,
} from '../services/adminApi';
import {
  REVIEW_TRACKS,
  USER_ROLE_LABELS,
  USER_ROLES,
  type UserRole,
} from '../constants/roles';

type PeopleTab = 'pending' | 'active' | 'rejected';

type RoleDraft = {
  role: UserRole;
  reviewTracks: string[];
};

const DEFAULT_DRAFT: RoleDraft = { role: 'learner', reviewTracks: [] };

const TABS: Array<{ id: PeopleTab; label: string; empty: string }> = [
  { id: 'pending', label: 'Pending', empty: 'No one is waiting for approval.' },
  { id: 'active', label: 'Active', empty: 'No active accounts.' },
  { id: 'rejected', label: 'Rejected', empty: 'No rejected accounts.' },
];

function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err.response?.data?.error || err.message || fallback;
}

function tabFromSearch(value: string | null): PeopleTab {
  if (value === 'pending' || value === 'rejected') return value;
  return 'active';
}

function draftFromUser(user: AdminUser): RoleDraft {
  const role = (user.role && USER_ROLES.includes(user.role) ? user.role : 'learner') as UserRole;
  return {
    role: user.admin ? 'admin' : role,
    reviewTracks: role === 'reviewer' ? [...(user.reviewTracks || [])] : [],
  };
}

function sameTracks(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const selected = new Set(b);
  return a.every((track) => selected.has(track));
}

function savedRole(user: AdminUser): UserRole {
  return (user.admin ? 'admin' : user.role || 'learner') as UserRole;
}

function savedTracks(user: AdminUser): string[] {
  return user.role === 'reviewer' ? [...(user.reviewTracks || [])] : [];
}

function formatJoined(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminUsersPage(): JSX.Element {
  const { currentUser } = useAppState();
  const isAdmin = Boolean(currentUser?.admin) || isAdminUser(currentUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSearch(searchParams.get('status'));

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RoleDraft>>({});

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const all = await fetchAdminUsers();
      setUsers(all);
      setDrafts((prev) => {
        const next: Record<string, RoleDraft> = { ...prev };
        for (const user of all) {
          if (!next[user.id]) next[user.id] = draftFromUser(user);
        }
        return next;
      });
    } catch (e: unknown) {
      setUsersError(errorMessage(e, 'Could not load people'));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin, loadUsers]);

  const counts = useMemo(() => {
    const next = { pending: 0, active: 0, rejected: 0 };
    for (const user of users) {
      if (user.status === 'pending' || user.status === 'active' || user.status === 'rejected') {
        next[user.status] += 1;
      }
    }
    return next;
  }, [users]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (user.status !== tab) return false;
      if (!query) return true;
      return (
        user.email.toLowerCase().includes(query) ||
        (user.name || '').toLowerCase().includes(query)
      );
    });
  }, [users, tab, search]);

  if (!isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  function getDraft(userId: string): RoleDraft {
    return drafts[userId] || DEFAULT_DRAFT;
  }

  function setDraft(userId: string, patch: Partial<RoleDraft>): void {
    setDrafts((prev) => {
      const current = prev[userId] || DEFAULT_DRAFT;
      const nextRole = patch.role ?? current.role;
      return {
        ...prev,
        [userId]: {
          role: nextRole,
          reviewTracks:
            nextRole === 'reviewer'
              ? patch.reviewTracks !== undefined
                ? patch.reviewTracks
                : current.reviewTracks
              : [],
        },
      };
    });
  }

  function toggleTrack(userId: string, trackId: string): void {
    const draft = getDraft(userId);
    const reviewTracks = draft.reviewTracks.includes(trackId)
      ? draft.reviewTracks.filter((track) => track !== trackId)
      : [...draft.reviewTracks, trackId];
    setDraft(userId, { reviewTracks });
  }

  function selectTab(next: PeopleTab): void {
    setUsersError(null);
    setSearchParams({ status: next }, { replace: true });
  }

  async function onApprove(userId: string): Promise<void> {
    const draft = getDraft(userId);
    if (draft.role === 'reviewer' && draft.reviewTracks.length === 0) {
      setUsersError('Pick at least one track for a reviewer.');
      return;
    }
    setActionId(userId);
    setUsersError(null);
    try {
      await approveAdminUser(userId, draft);
      await loadUsers();
    } catch (e: unknown) {
      setUsersError(errorMessage(e, 'Approve failed'));
    } finally {
      setActionId(null);
    }
  }

  async function onSaveRole(userId: string): Promise<void> {
    const draft = getDraft(userId);
    if (draft.role === 'reviewer' && draft.reviewTracks.length === 0) {
      setUsersError('Pick at least one track for a reviewer.');
      return;
    }
    setActionId(userId);
    setUsersError(null);
    try {
      await updateAdminUserRole(userId, draft);
      await loadUsers();
    } catch (e: unknown) {
      setUsersError(errorMessage(e, 'Could not update role'));
    } finally {
      setActionId(null);
    }
  }

  async function onReject(userId: string): Promise<void> {
    setActionId(userId);
    setUsersError(null);
    try {
      await rejectAdminUser(userId);
      await loadUsers();
    } catch (e: unknown) {
      setUsersError(errorMessage(e, 'Reject failed'));
    } finally {
      setActionId(null);
    }
  }

  const tabMeta = TABS.find((item) => item.id === tab) || TABS[1];

  return (
    <div className="app-page admin-people">
      <header className="admin-people-header">
        <p className="admin-crumb">
          <Link to="/admin">Admin</Link>
          <span aria-hidden> / </span>
          People
        </p>
        <div className="admin-people-title-row">
          <div>
            <h1 className="admin-home-title">People</h1>
            <p className="admin-home-lead">
              Approve signups and set roles. Reviewers need at least one track.
            </p>
          </div>
          <button
            type="button"
            className="admin-btn"
            onClick={() => void loadUsers()}
            disabled={usersLoading}
          >
            {usersLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="admin-people-body">
        <nav className="admin-people-nav" aria-label="Account status">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'is-active' : undefined}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => selectTab(item.id)}
            >
              <span>{item.label}</span>
              <span className="admin-people-count">{counts[item.id].toLocaleString()}</span>
            </button>
          ))}
        </nav>

        <section className="admin-home-card admin-people-panel" aria-labelledby="admin-people-heading">
          <div className="admin-people-toolbar">
            <h2 id="admin-people-heading" className="sr-only">
              {tabMeta.label} people
            </h2>
            <input
              type="search"
              className="admin-people-search"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search people"
            />
            <span className="admin-people-shown">
              {search.trim()
                ? `${visible.length.toLocaleString()} of ${counts[tab].toLocaleString()}`
                : counts[tab].toLocaleString()}
            </span>
          </div>

          {usersError ? (
            <p className="admin-people-error" role="alert">
              {usersError}
            </p>
          ) : null}

          <div className="admin-people-table-wrap">
            {usersLoading && users.length === 0 ? (
              <p className="admin-people-empty">Loading people…</p>
            ) : visible.length === 0 ? (
              <p className="admin-people-empty">
                {search.trim() ? 'No one matches that search.' : tabMeta.empty}
              </p>
            ) : (
              <table className="admin-people-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th className="col-actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => {
                    const draft = getDraft(user.id);
                    const busy = actionId === user.id;
                    const needsTracks = draft.role === 'reviewer' && draft.reviewTracks.length === 0;
                    const dirty =
                      draft.role !== savedRole(user) || !sameTracks(draft.reviewTracks, savedTracks(user));
                    const name = user.name?.trim();
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="admin-people-person">
                            <strong>{name || user.email}</strong>
                            {name ? <span className="admin-people-email">{user.email}</span> : null}
                          </div>
                        </td>
                        <td className="admin-people-access">
                          <select
                            className="admin-role-select admin-people-select"
                            value={draft.role}
                            aria-label={`Role for ${user.email}`}
                            onChange={(e) => setDraft(user.id, { role: e.target.value as UserRole })}
                          >
                            {USER_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {USER_ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                          {draft.role === 'reviewer' ? (
                            <>
                              <div className="admin-people-tracks">
                                {REVIEW_TRACKS.map((track) => (
                                  <label key={track.id}>
                                    <input
                                      type="checkbox"
                                      checked={draft.reviewTracks.includes(track.id)}
                                      onChange={() => toggleTrack(user.id, track.id)}
                                    />
                                    <span>{track.label}</span>
                                  </label>
                                ))}
                              </div>
                              {needsTracks ? (
                                <p className="admin-people-warn">Select at least one track.</p>
                              ) : null}
                            </>
                          ) : null}
                        </td>
                        <td
                          className="admin-people-joined"
                          title={user.createdAt ? new Date(user.createdAt).toLocaleString() : undefined}
                        >
                          {formatJoined(user.createdAt)}
                        </td>
                        <td className="col-actions">
                          <div className="admin-user-actions">
                            {tab === 'pending' || tab === 'rejected' ? (
                              <button
                                type="button"
                                className="admin-btn admin-btn--approve"
                                disabled={busy || needsTracks}
                                onClick={() => void onApprove(user.id)}
                              >
                                {busy ? '…' : 'Approve'}
                              </button>
                            ) : null}
                            {tab === 'pending' ? (
                              <button
                                type="button"
                                className="admin-btn admin-btn--reject"
                                disabled={busy}
                                onClick={() => void onReject(user.id)}
                              >
                                Reject
                              </button>
                            ) : null}
                            {tab === 'active' ? (
                              <button
                                type="button"
                                className="admin-btn admin-btn--approve"
                                disabled={busy || !dirty || needsTracks}
                                onClick={() => void onSaveRole(user.id)}
                              >
                                {busy ? '…' : 'Save'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
