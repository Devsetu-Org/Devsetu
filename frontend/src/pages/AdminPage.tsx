import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAppState } from '../context/AppStateContext';
import { isAdminUser } from '../services/authApi';
import {
  fetchAdminOverview,
  fetchAdminSettings,
  saveAdminSettings,
  type AdminOverview,
  type AdminOverviewDay,
} from '../services/adminApi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err.response?.data?.error || err.message || fallback;
}

function dayParts(day: string): { num: string; month: string } {
  const [, month, date] = day.split('-');
  return {
    num: String(Number(date) || ''),
    month: MONTHS[Number(month) - 1] || '',
  };
}

function trend(current: number, previous: number): { text: string; dir: 'up' | 'down' | 'flat' } {
  const delta = current - previous;
  if (delta === 0) return { text: 'Same as the 7 days before', dir: 'flat' };
  const sign = delta > 0 ? '+' : '';
  return {
    text: `${sign}${delta.toLocaleString()} vs the 7 days before`,
    dir: delta > 0 ? 'up' : 'down',
  };
}

function statText(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString();
}

function ActivitySeries({
  label,
  tone,
  days,
  value,
}: {
  label: string;
  tone: 'signups' | 'submissions';
  days: AdminOverviewDay[];
  value: (day: AdminOverviewDay) => number;
}): JSX.Element {
  const counts = days.map(value);
  const max = Math.max(1, ...counts);
  const sum = counts.reduce((total, n) => total + n, 0);
  return (
    <div className="admin-home-series">
      <div className="admin-home-series-head">
        <span>
          <span className={`admin-home-swatch admin-home-swatch--${tone}`} aria-hidden />
          {label}
        </span>
        <span>{sum.toLocaleString()} in 14 days</span>
      </div>
      <div className="admin-home-bars" role="img" aria-label={`${label} for each of the last 14 days`}>
        {days.map((day, index) => {
          const count = counts[index];
          const parts = dayParts(day.day);
          const height = count === 0 ? 0 : Math.max((count / max) * 100, 8);
          return (
            <div key={day.day} className="admin-home-bar-col" title={`${parts.num} ${parts.month}: ${count}`}>
              <div className="admin-home-bar-track">
                <div
                  className={`admin-home-bar admin-home-bar--${tone}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityChart({
  days,
  totalSubmissions,
}: {
  days: AdminOverviewDay[];
  totalSubmissions: number;
}): JSX.Element {
  return (
    <div className="admin-home-chart-body">
      <div className="admin-home-chart-head">
        <h2 id="admin-activity-heading">Last 14 days</h2>
        <span>{totalSubmissions.toLocaleString()} submissions in all</span>
      </div>
      <ActivitySeries label="Signups" tone="signups" days={days} value={(day) => day.signups} />
      <ActivitySeries
        label="Submissions"
        tone="submissions"
        days={days}
        value={(day) => day.submissions}
      />
      <div className="admin-home-day-labels">
        {days.map((day, index) => {
          const parts = dayParts(day.day);
          const prevMonth = index > 0 ? dayParts(days[index - 1].day).month : '';
          return (
            <span key={day.day} className="admin-home-day-label">
              {parts.num}
              {parts.month !== prevMonth ? <span>{parts.month}</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage(): JSX.Element {
  const { currentUser } = useAppState();
  const isAdmin = Boolean(currentUser?.admin) || isAdminUser(currentUser);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [watcherEnabled, setWatcherEnabled] = useState(true);
  const [clusterSynced, setClusterSynced] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      setOverview(await fetchAdminOverview(new Date().getTimezoneOffset()));
    } catch (e: unknown) {
      setOverviewError(errorMessage(e, 'Could not load stats'));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setSettingsLoading(true);
    setSettingsError(null);
    fetchAdminSettings()
      .then((s) => {
        if (cancelled) return;
        setRegistrationOpen(s.registrationOpen);
        setWatcherEnabled(s.sparkJobWatcherEnabled);
        setClusterSynced(s.clusterSynced);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSettingsError(errorMessage(e, 'Could not load settings'));
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadOverview]);

  async function onToggleRegistration(): Promise<void> {
    const next = !registrationOpen;
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const s = await saveAdminSettings({ registrationOpen: next });
      setRegistrationOpen(s.registrationOpen);
      setWatcherEnabled(s.sparkJobWatcherEnabled);
      setClusterSynced(s.clusterSynced);
    } catch (e: unknown) {
      setSettingsError(errorMessage(e, 'Could not save'));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function onToggleWatcher(): Promise<void> {
    const next = !watcherEnabled;
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const s = await saveAdminSettings({ sparkJobWatcherEnabled: next });
      setWatcherEnabled(s.sparkJobWatcherEnabled);
      setRegistrationOpen(s.registrationOpen);
      setClusterSynced(s.clusterSynced);
      if (!s.clusterSynced) {
        setSettingsError('Saved, but the Spark cluster did not take the change. Try again.');
      }
    } catch (e: unknown) {
      setSettingsError(errorMessage(e, 'Could not save'));
    } finally {
      setSettingsSaving(false);
    }
  }

  if (!isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  const users = overview?.users;
  const submissions = overview?.submissions;
  const signupTrend = users ? trend(users.last7, users.prev7) : null;
  const submitTrend = submissions ? trend(submissions.last7, submissions.prev7) : null;
  const pending = users?.pending ?? 0;
  const switchesDisabled = settingsLoading || settingsSaving;

  return (
    <div className="app-page admin-home">
      <header className="admin-home-header">
        <p className="app-page-eyebrow">Platform</p>
        <h1 className="admin-home-title">Admin</h1>
        <p className="admin-home-lead">
          Who has joined, what was submitted, and the switches that run the platform.
        </p>
      </header>

      {overviewError ? (
        <div className="alert app-page-alert admin-home-alert" role="alert">
          <span>{overviewError}</span>
          <button type="button" className="admin-btn" onClick={() => void loadOverview()}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="admin-home-kpis" aria-label="Summary" aria-busy={overviewLoading}>
        <article className="admin-home-card admin-home-kpi">
          <span className="admin-home-kpi-label">Signed up</span>
          <strong className="admin-home-kpi-value">{statText(users?.total)}</strong>
          <span className="admin-home-kpi-detail">
            {users
              ? `${users.yesterday.toLocaleString()} yesterday · ${users.pending.toLocaleString()} waiting`
              : ' '}
          </span>
        </article>
        <article className="admin-home-card admin-home-kpi">
          <span className="admin-home-kpi-label">Signups, last 7 days</span>
          <strong className="admin-home-kpi-value">{statText(users?.last7)}</strong>
          <span className={`admin-home-kpi-detail${signupTrend ? ` is-${signupTrend.dir}` : ''}`}>
            {signupTrend ? signupTrend.text : ' '}
          </span>
        </article>
        <article className="admin-home-card admin-home-kpi">
          <span className="admin-home-kpi-label">Submissions yesterday</span>
          <strong className="admin-home-kpi-value">{statText(submissions?.yesterday)}</strong>
          <span className="admin-home-kpi-detail">
            {submissions
              ? `${submissions.passedYesterday.toLocaleString()} passed`
              : ' '}
          </span>
        </article>
        <article className="admin-home-card admin-home-kpi">
          <span className="admin-home-kpi-label">Submissions, last 7 days</span>
          <strong className="admin-home-kpi-value">{statText(submissions?.last7)}</strong>
          <span className={`admin-home-kpi-detail${submitTrend ? ` is-${submitTrend.dir}` : ''}`}>
            {submitTrend ? submitTrend.text : ' '}
          </span>
        </article>
      </section>

      {users && pending > 0 ? (
        <Link to="/admin/users?status=pending" className="admin-home-pending">
          <strong>
            {pending === 1
              ? '1 person is waiting for approval'
              : `${pending.toLocaleString()} people are waiting for approval`}
          </strong>
          <span>Review</span>
        </Link>
      ) : null}

      <div className="admin-home-stage">
        <section className="admin-home-card admin-home-chart" aria-labelledby="admin-activity-heading">
          {overview ? (
            <ActivityChart days={overview.days} totalSubmissions={overview.submissions.total} />
          ) : (
            <div className="admin-home-chart-body">
              <h2 id="admin-activity-heading">Last 14 days</h2>
              <p className="admin-home-placeholder">
                {overviewError && !overviewLoading ? "Activity didn't load." : 'Loading activity…'}
              </p>
            </div>
          )}
        </section>

        <section className="admin-home-card admin-home-rail" aria-label="Manage">
          <h2>Manage</h2>
          <div className="admin-home-links">
            <Link
              to={pending > 0 ? '/admin/users?status=pending' : '/admin/users'}
              className={`admin-home-link${pending > 0 ? ' admin-home-link--alert' : ''}`}
            >
              <span className="admin-home-link-copy">
                <strong>People</strong>
                <span>
                  {users
                    ? `${users.active.toLocaleString()} active · ${users.pending.toLocaleString()} waiting`
                    : 'Accounts, roles, and approvals'}
                </span>
              </span>
              <span className="admin-home-link-arrow" aria-hidden>
                →
              </span>
            </Link>
            <Link to="/admin/feedback" className="admin-home-link">
              <span className="admin-home-link-copy">
                <strong>Lab feedback</strong>
                <span>Reviews written across every lab</span>
              </span>
              <span className="admin-home-link-arrow" aria-hidden>
                →
              </span>
            </Link>
            <Link to="/admin/waitlist" className="admin-home-link">
              <span className="admin-home-link-copy">
                <strong>Waitlist</strong>
                <span>Landing page sign-ups</span>
              </span>
              <span className="admin-home-link-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </section>
      </div>

      {settingsError ? (
        <p className="profile-setting-status profile-setting-status--error" role="alert">
          {settingsError}
        </p>
      ) : null}

      <div className="admin-home-settings">
        <section className="admin-home-card admin-home-setting" aria-labelledby="admin-registration-heading">
          <div className="profile-setting-row">
            <div className="profile-setting-copy">
              <h2 id="admin-registration-heading" className="admin-home-setting-title">
                Open registration
              </h2>
              <p>
                When this is on, new signups become learners immediately. When it is off, they wait
                for an approval and a role.
              </p>
            </div>
            <button
              type="button"
              className="profile-switch"
              role="switch"
              aria-checked={registrationOpen}
              aria-label="Open registration"
              disabled={switchesDisabled}
              onClick={() => void onToggleRegistration()}
            >
              <span>{settingsLoading ? '…' : registrationOpen ? 'On' : 'Off'}</span>
            </button>
          </div>
        </section>

        <section className="admin-home-card admin-home-setting" aria-labelledby="admin-spark-heading">
          <div className="profile-setting-row">
            <div className="profile-setting-copy">
              <h2 id="admin-spark-heading" className="admin-home-setting-title">
                Spark job watcher
              </h2>
              <p>
                When this is on, the cluster stops jobs that run past the lab time limit. Turn it
                off while testing a long run.
              </p>
            </div>
            <button
              type="button"
              className="profile-switch"
              role="switch"
              aria-checked={watcherEnabled}
              aria-label="Spark job watcher"
              disabled={switchesDisabled}
              onClick={() => void onToggleWatcher()}
            >
              <span>{settingsLoading ? '…' : watcherEnabled ? 'On' : 'Off'}</span>
            </button>
          </div>
          {!settingsLoading && !clusterSynced && !settingsError ? (
            <p className="profile-setting-status">Cluster did not confirm the last change.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
