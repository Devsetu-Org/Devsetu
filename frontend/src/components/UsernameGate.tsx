import React, { useState } from 'react';
import { saveUsername } from '../services/authApi';
import type { UserRecord } from '../types/domain';

const USERNAME_RE = /^[a-z][a-z0-9_]{2,23}$/;

interface UsernameGateProps {
  onSaved: (user: UserRecord) => void;
  onLogout: () => void;
}

export default function UsernameGate({ onSaved, onLogout }: UsernameGateProps): JSX.Element {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = USERNAME_RE.test(username);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveUsername(username));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Could not save that username');
      setSaving(false);
    }
  }

  return (
    <div className="username-gate">
      <form className="login-card username-gate-card" onSubmit={(event) => void onSubmit(event)}>
        <div className="login-card-head">
          <h1>Choose a username</h1>
          <p className="login-card-sub">
            This is the name on your profile. It has to be unique. You can change it later.
          </p>
        </div>
        <label className="username-gate-field">
          <span>Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoFocus
            spellCheck={false}
            maxLength={24}
            value={username}
            placeholder="Arjun"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setError(null);
              setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24));
            }}
          />
          <span className="username-gate-hint">
            3–24 characters. Start with a letter, then letters, numbers, or underscores.
          </span>
        </label>
        {error ? (
          <p className="username-gate-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={!valid || saving}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
        <button type="button" className="ghost username-gate-signout" onClick={onLogout}>
          Sign out
        </button>
      </form>
    </div>
  );
}
