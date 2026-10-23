import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../context/AppStateContext';
import { isAdminUser, saveUsername } from '../services/authApi';
import { IconCoins } from '../components/ChromeIcons';
import SubscriptionsPanel from '../components/SubscriptionsPanel';
import Avatar, { AvatarPicker } from '../components/Avatar';
import ActivityHeatmap, { type ActivityDay } from '../components/ActivityHeatmap';
import { fetchMyProfile, saveAvatar } from '../services/profileApi';

export type ProfileSection = 'overview' | 'subscriptions' | 'privacy';

const USERNAME_RE = /^[a-z][a-z0-9_]{2,23}$/;

const NAV_ITEMS: { id: ProfileSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'privacy', label: 'Privacy' },
];

export default function ProfilePage(): JSX.Element {
  const { currentUser, challenges, onLogout, onUserUpdated } = useAppState();
  const isAdmin = Boolean(currentUser?.admin) || isAdminUser(currentUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section');
  const section: ProfileSection = NAV_ITEMS.some((item) => item.id === requested)
    ? (requested as ProfileSection)
    : 'overview';
  const setSection = (next: ProfileSection): void => {
    setSearchParams(next === 'overview' ? {} : { section: next }, { replace: true });
  };
  const [avatar, setAvatar] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityDay[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(currentUser?.username || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const displayName = currentUser?.username || currentUser?.name || currentUser?.email || 'You';
  const usernameValid = USERNAME_RE.test(usernameDraft);
  const usernameDirty = usernameDraft !== (currentUser?.username || '');

  useEffect(() => {
    setUsernameDraft(currentUser?.username || '');
  }, [currentUser?.username]);

  const closeEditor = (): void => {
    setEditing(false);
    setUsernameDraft(currentUser?.username || '');
    setUsernameError(null);
  };

  const onSaveUsername = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!usernameValid || !usernameDirty || savingUsername) return;
    setSavingUsername(true);
    setUsernameError(null);
    saveUsername(usernameDraft)
      .then((user) => onUserUpdated(user))
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setUsernameError(err.response?.data?.error || err.message || 'Could not save that username');
      })
      .finally(() => setSavingUsername(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((p) => {
        if (cancelled) return;
        setAvatar(p.avatar);
        setActivity(p.activity);
      })
      .catch(() => { if (!cancelled) setActivity([]); });
    return () => { cancelled = true; };
  }, [currentUser?.email]);

  const onSelectAvatar = (next: string | null): void => {
    const previous = avatar;
    setAvatar(next);
    setAvatarError(null);
    setSavingAvatar(true);
    saveAvatar(next)
      .catch(() => {
        setAvatar(previous);
        setAvatarError('Could not save your picture. Try again.');
      })
      .finally(() => setSavingAvatar(false));
  };

  const finalizedCount = useMemo(
    () => challenges.filter((c) => c.finalized).length,
    [challenges],
  );
  const solvedCount = useMemo(
    () => challenges.filter((c) => c.solved && c.finalized).length,
    [challenges],
  );
  const tokenCount = useMemo(
    () =>
      challenges
        .filter((c) => c.solved && c.finalized)
        .reduce(
          (sum, c) =>
            sum +
            (typeof c.earnedTokens === 'number'
              ? c.earnedTokens
              : typeof c.tokens === 'number'
                ? c.tokens
                : 10),
          0,
        ),
    [challenges],
  );

  return (
    <div className="app-page profile-page">
      <header className="profile-hero profile-hero--avatar">
        <Avatar avatar={avatar} name={displayName} size={72} className="profile-avatar" />
        <div className="profile-hero-copy">
          <h1 className="profile-title">{currentUser?.username || 'Username'}</h1>
          <p className="profile-lead">
            {currentUser?.email ? `Signed in as ${currentUser.email}` : 'Your account.'}
          </p>
          <button
            type="button"
            className="profile-avatar-change"
            aria-expanded={editing}
            onClick={() => (editing ? closeEditor() : setEditing(true))}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </header>

      {editing && (
        <section className="profile-panel profile-edit-panel" aria-label="Edit profile">
          <form className="profile-edit-username" onSubmit={onSaveUsername}>
            <label className="profile-edit-label" htmlFor="profile-username">
              Username
            </label>
            <div className="profile-edit-username-row">
              <input
                id="profile-username"
                type="text"
                name="username"
                autoComplete="username"
                spellCheck={false}
                maxLength={24}
                value={usernameDraft}
                aria-invalid={Boolean(usernameError)}
                onChange={(event) => {
                  setUsernameError(null);
                  setUsernameDraft(
                    event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24),
                  );
                }}
              />
              <button type="submit" disabled={!usernameValid || !usernameDirty || savingUsername}>
                {savingUsername ? 'Saving…' : 'Save'}
              </button>
            </div>
            {usernameError ? (
              <p className="profile-edit-error" role="alert">{usernameError}</p>
            ) : (
              <p className="profile-edit-hint">
                3–24 characters. Start with a letter, then letters, numbers, or underscores.
              </p>
            )}
          </form>
          <div className="profile-edit-picture">
            <p className="profile-edit-label">Picture</p>
            <AvatarPicker value={avatar} name={displayName} disabled={savingAvatar} onSelect={onSelectAvatar} />
            {avatarError && <p className="profile-edit-error">{avatarError}</p>}
          </div>
        </section>
      )}

      <div className="profile-body">
        <nav className="profile-nav" aria-label="Profile sections">
          <ul className="profile-nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`profile-nav-item${section === item.id ? ' is-active' : ''}`}
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            {isAdmin ? (
              <li>
                <Link to="/admin" className="profile-nav-item">
                  Admin
                </Link>
              </li>
            ) : null}
          </ul>


          <button
            type="button"
            className="profile-nav-item profile-nav-item--signout profile-nav-signout-desktop"
            onClick={onLogout}
          >
            Sign out
          </button>
        </nav>

        <div className="profile-stack">
          {section === 'overview' ? (
            <section className="profile-panel" aria-labelledby="profile-account-heading">
              <h2 id="profile-account-heading" className="profile-panel-title">
                Account
              </h2>
              <dl className="profile-account-dl">
                <div>
                  <dt>Username</dt>
                  <dd>{currentUser?.username || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{currentUser?.email || '—'}</dd>
                </div>
                {currentUser?.name ? (
                  <div>
                    <dt>Name</dt>
                    <dd>{currentUser.name}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {section === 'overview' ? (
            <section className="profile-panel" aria-labelledby="profile-activity-heading">
              <h2 id="profile-activity-heading" className="profile-panel-title">
                Activity
              </h2>
              {activity ? (
                <ActivityHeatmap activity={activity} />
              ) : (
                <p className="profile-panel-copy"><span className="spinner" /> Loading…</p>
              )}
            </section>
          ) : null}

          {section === 'subscriptions' ? <SubscriptionsPanel /> : null}

          {section === 'privacy' ? (
            <section className="profile-panel" aria-labelledby="profile-privacy-heading">
              <h2 id="profile-privacy-heading" className="profile-panel-title">
                Privacy
              </h2>
              <p className="profile-panel-copy">
                We store your account email, lab progress, and session activity to run the practice
                floor. Export and delete controls will appear here as the account tools expand.
              </p>
            </section>
          ) : null}
        </div>

        {section === 'overview' ? (
          <aside className="profile-side" aria-label="Collections">
            <section className="profile-shelf profile-shelf--progress" aria-labelledby="profile-progress-heading">
              <h2 id="profile-progress-heading" className="profile-shelf-title">
                Your progress
              </h2>
              <div className="profile-progress-hero">
                <strong>{solvedCount}</strong>
                <span>/{Math.max(finalizedCount, 1)}</span>
                <em>solved</em>
              </div>
            </section>

            <section className="profile-shelf" aria-labelledby="profile-tokens-heading">
              <div className="profile-shelf-icon" aria-hidden="true">
                <IconCoins />
              </div>
              <div className="profile-shelf-copy">
                <h2 id="profile-tokens-heading" className="profile-shelf-title">
                  Tokens
                </h2>
                <p className="profile-shelf-lead">Earned from solved labs</p>
              </div>
              <p className="profile-shelf-count" aria-label={`${tokenCount} tokens`}>
                {tokenCount}
              </p>
            </section>
          </aside>
        ) : (
          <div className="profile-side profile-side--spacer" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
