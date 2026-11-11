import React, { useState } from 'react';
import { joinWaitlist, type WaitlistRole } from '../services/waitlistApi';
import { LAUNCH_OFFER } from '../constants/pricing';
import { PILOT } from '../constants/accessLock';

const ROLE_OPTIONS: ReadonlyArray<{ id: WaitlistRole; label: string }> = [
  { id: 'student', label: 'Student' },
  { id: 'developer', label: 'Developer' },
];

function sourceFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  return params.get('ref') || params.get('utm_source') || undefined;
}

export interface WaitlistFormProps {
  /** Closed pilot page — student-leaning defaults, tagged source. */
  variant?: 'default' | 'pilot';
}

export default function WaitlistForm({ variant = 'default' }: WaitlistFormProps): JSX.Element {
  const isPilot = variant === 'pilot';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WaitlistRole>('student');
  const [organization, setOrganization] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const trimmed = email.trim().toLowerCase();
      await joinWaitlist({
        email: trimmed,
        role: isPilot ? 'student' : role,
        organization: organization.trim() || undefined,
        source: isPilot ? 'pilot' : sourceFromUrl(),
        website,
      });
      setDone(true);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { error?: string } }; message?: string };
      setError(ex.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="waitlist-done" role="status">
        <strong>You&rsquo;re on the list.</strong>
        <span>
          {isPilot
            ? `We\u2019ll email you before the ${PILOT.startsLabel}–${PILOT.endsLabel} pilot opens.`
            : `We\u2019ll email you before launch with your ${LAUNCH_OFFER.percentOff}% off launch offer.`}
        </span>
      </div>
    );
  }

  const orgLabel = isPilot
    ? 'Year of study (optional)'
    : role === 'developer'
      ? 'Company (optional)'
      : 'College (optional)';

  return (
    <form className="waitlist-form" onSubmit={(e) => void onSubmit(e)}>
      {!isPilot ? (
        <div className="waitlist-roles" role="radiogroup" aria-label="I am a">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={role === opt.id}
              className={`waitlist-role${role === opt.id ? ' is-active' : ''}`}
              onClick={() => setRole(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
      <input
        className="waitlist-input"
        type="email"
        required
        autoComplete="email"
        placeholder={isPilot ? 'arjun@nitw.ac.in' : 'Your email'}
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="waitlist-input"
        type="text"
        maxLength={120}
        placeholder={orgLabel}
        aria-label={orgLabel}
        value={organization}
        onChange={(e) => setOrganization(e.target.value)}
      />
      <input
        className="waitlist-honeypot"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <button type="submit" className="landing-cta-primary waitlist-submit" disabled={busy}>
        {busy ? 'Submitting…' : isPilot ? 'Submit' : 'Join the waitlist'}
        <span className="landing-cta-arrow" aria-hidden>
          →
        </span>
      </button>
      {error ? <p className="waitlist-error">{error}</p> : null}
    </form>
  );
}
