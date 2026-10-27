import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import {
  acceptAuthSession,
  GOOGLE_OAUTH_RESULT,
  GOOGLE_OAUTH_WINDOW_NAME,
  takePostLoginPath,
  writeOAuthBridge,
  type GoogleOAuthResult,
} from '../services/authApi';
import type { UserRecord } from '../types/domain';

interface GoogleAuthCallbackPageProps {
  onLoggedIn: (user: UserRecord) => void;
}

function safeAppPath(path: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/auth/')) {
    return '/track';
  }
  return path;
}

function isOAuthPopupWindow(): boolean {
  try {
    if (window.opener && !window.opener.closed) return true;
  } catch { /* cross-origin */ }
  return window.name === GOOGLE_OAUTH_WINDOW_NAME;
}

/**
 * Hand result to the lab tab. Returns true when this window should stay on the
 * "you can close this" screen (separate OAuth tab) instead of navigating in-app.
 */
function deliverToOpener(result: GoogleOAuthResult): boolean {
  writeOAuthBridge(result);
  if (result.ok) {
    acceptAuthSession(result.token, result.user);
  }
  let posted = false;
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(result, window.location.origin);
      posted = true;
    }
  } catch { /* ignore */ }
  const popup = isOAuthPopupWindow();
  try { window.close(); } catch { /* ignore */ }
  return posted || popup;
}

/** Landing after Google OAuth redirect (?token=&user= / ?pending= / ?error=). */
export default function GoogleAuthCallbackPage({
  onLoggedIn,
}: GoogleAuthCallbackPageProps): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>('Finishing Google sign-in…');
  const [tone, setTone] = useState<'pending' | 'error' | 'ok'>('ok');
  const onLoggedInRef = useRef(onLoggedIn);
  onLoggedInRef.current = onLoggedIn;
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return undefined;
    handledRef.current = true;
    const error = searchParams.get('error');
    const pending = searchParams.get('pending');
    const pendingMessage = searchParams.get('message');
    const token = searchParams.get('token');
    const userRaw = searchParams.get('user');

    const finishPopup = (msg: string, nextTone: 'pending' | 'error' | 'ok'): void => {
      setTone(nextTone);
      setMessage(msg);
    };

    if (error) {
      if (deliverToOpener({ type: GOOGLE_OAUTH_RESULT, ok: false, error })) {
        finishPopup('You can close this window.', 'error');
        return undefined;
      }
      setTone('error');
      setMessage(error);
      const t = window.setTimeout(() => navigate('/', { replace: true }), 2800);
      return () => window.clearTimeout(t);
    }

    if (pending === '1') {
      const msg = pendingMessage || 'Account created. Awaiting admin approval.';
      if (deliverToOpener({ type: GOOGLE_OAUTH_RESULT, ok: false, error: msg, pending: true })) {
        finishPopup(msg, 'pending');
        return undefined;
      }
      setTone('pending');
      setMessage(msg);
      const t = window.setTimeout(() => navigate('/', { replace: true }), 3200);
      return () => window.clearTimeout(t);
    }

    if (!token || !userRaw) {
      const msg = 'Missing sign-in details. Returning home…';
      if (deliverToOpener({ type: GOOGLE_OAUTH_RESULT, ok: false, error: msg })) {
        finishPopup(msg, 'error');
        return undefined;
      }
      setTone('error');
      setMessage(msg);
      const t = window.setTimeout(() => navigate('/', { replace: true }), 2000);
      return () => window.clearTimeout(t);
    }

    try {
      const user = JSON.parse(userRaw) as UserRecord;
      if (deliverToOpener({ type: GOOGLE_OAUTH_RESULT, ok: true, token, user })) {
        // Lab tab picks up the session via bridge / postMessage. Stay here so this
        // tab is not a second app with Google under it.
        finishPopup('Signed in. You can close this window.', 'ok');
        return undefined;
      }
      // Same-tab OAuth (legacy / popup blocked): session already stored by deliver.
      onLoggedInRef.current(user);
      window.location.replace(safeAppPath(takePostLoginPath()));
    } catch {
      const msg = 'Could not complete Google sign-in.';
      if (deliverToOpener({ type: GOOGLE_OAUTH_RESULT, ok: false, error: msg })) {
        finishPopup(msg, 'error');
        return undefined;
      }
      setTone('error');
      setMessage(msg);
      const t = window.setTimeout(() => navigate('/', { replace: true }), 2500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [searchParams, navigate]);

  return (
    <div className="login login-oauth-callback">
      <div className="login-card login-modal-card--oauth">
        <div className="login-oauth-brand" aria-hidden>
          <BrandMark className="brand-mark login-oauth-mark" title="" />
        </div>
        <p className={`login-oauth-callback-msg login-oauth-callback-msg--${tone}`}>
          {message}
        </p>
      </div>
    </div>
  );
}
