import React, { useEffect, useState } from 'react';
import BrandMark from './BrandMark';
import {
  startGoogleSignIn,
  fetchGoogleAuthStatus,
  GOOGLE_OAUTH_WINDOW_NAME,
} from '../services/authApi';
import type { UserRecord } from '../types/domain';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLoggedIn: (user: UserRecord) => void;
  initialError?: string | null;
  /** Page to land on after sign-in; defaults to the current page. */
  returnTo?: string | null;
  /** Replaces the default welcome line when sign-in was opened for a specific reason. */
  prompt?: { title: string; body: string } | null;
}

function GoogleMark(): JSX.Element {
  return (
    <svg className="login-google-mark" width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginModal({
  open,
  onClose,
  onLoggedIn,
  initialError = null,
  returnTo = null,
  prompt = null,
}: LoginModalProps): JSX.Element | null {
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState<boolean>(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(initialError);
    setBusy(false);
    setGoogleEnabled(null);
    void fetchGoogleAuthStatus().then((enabled) => {
      setGoogleEnabled(enabled);
      if (!enabled) {
        setError('Google sign-in is not configured yet.');
      }
    });
  }, [open, initialError]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const handleGoogle = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (!googleEnabled || busy) {
      event.preventDefault();
      return;
    }
    setError(null);
    setBusy(true);
    // Let the browser open target=named tab (default action). That keeps Google
    // out of this tab's history — critical for mobile swipe-back.
    startGoogleSignIn(
      returnTo,
      {
        onSuccess: (user) => {
          setBusy(false);
          onLoggedIn(user);
          onClose();
        },
        onError: (message) => {
          setBusy(false);
          setError(message);
        },
      },
      { openedByLink: true },
    );
  };

  if (!open) return null;

  return (
    <div
      className="login-modal-overlay"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-card login-modal-card login-modal-card--oauth">
          <button
            type="button"
            className="login-modal-close"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
              <path d="M2.4 2.4l7.2 7.2M9.6 2.4L2.4 9.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <header className="login-card-head login-oauth-head">
            <div className="login-oauth-brand" aria-hidden>
              <BrandMark className="brand-mark login-oauth-mark" title="" />
            </div>
            <h1 id="login-modal-title">{prompt?.title || 'Welcome to DevSetu'}</h1>
            <p className="login-card-sub">
              {prompt?.body || 'Sign in with Google to continue.'}
            </p>
          </header>

          {error && <div className="alert login-alert">{error}</div>}

          <a
            className={`login-google${busy || googleEnabled !== true ? ' login-google--disabled' : ''}`}
            href="/api/auth/google"
            target={GOOGLE_OAUTH_WINDOW_NAME}
            rel="opener"
            aria-disabled={busy || googleEnabled !== true}
            onClick={handleGoogle}
          >
            <GoogleMark />
            <span>{busy ? 'Finish sign-in in the Google window…' : 'Continue with Google'}</span>
          </a>

          <p className="login-oauth-note">
            By continuing you agree to use DevSetu for learning and practice.
          </p>
        </div>
      </div>
    </div>
  );
}
