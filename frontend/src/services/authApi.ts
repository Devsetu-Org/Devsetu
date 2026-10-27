import axios from 'axios';
import type { UserRecord } from '../types/domain';
import { readMigrating, removeMigrating, writeMigrating } from '../utils/storageMigrate';

const TOKEN_KEY = 'devsetu_jwt';
const USER_KEY = 'devsetu_user';
/** Pre-rebrand keys — read once, then remove. */
const LEGACY_TOKEN_KEY = 'devlabs_jwt';
const LEGACY_USER_KEY = 'devlabs_user';

export function getToken(): string | null {
  return readMigrating(localStorage, TOKEN_KEY, LEGACY_TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) writeMigrating(localStorage, TOKEN_KEY, LEGACY_TOKEN_KEY, token);
  else removeMigrating(localStorage, TOKEN_KEY, LEGACY_TOKEN_KEY);
}

export function clearToken(): void {
  removeMigrating(localStorage, TOKEN_KEY, LEGACY_TOKEN_KEY);
  removeMigrating(localStorage, USER_KEY, LEGACY_USER_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function getCurrentUser(): UserRecord | null {
  try {
    const raw = readMigrating(localStorage, USER_KEY, LEGACY_USER_KEY);
    return raw ? (JSON.parse(raw) as UserRecord) : null;
  } catch (_e) {
    return null;
  }
}

function saveUser(user: UserRecord): void {
  if (user) writeMigrating(localStorage, USER_KEY, LEGACY_USER_KEY, JSON.stringify(user));
}

export type SignupResult =
  | { pending: true; message: string; user: UserRecord }
  | { pending?: false; token: string; user: UserRecord };

export async function saveUsername(username: string): Promise<UserRecord> {
  const { data } = await axios.put(
    '/api/auth/username',
    { username },
    { headers: getAuthHeader() },
  );
  const user = (data as { user: UserRecord }).user;
  saveUser(user);
  return user;
}

export async function signup(
  email: string,
  password: string,
): Promise<SignupResult> {
  const { data, status } = await axios.post('/api/auth/signup', { email, password });
  const res = data as SignupResult;
  if (status === 202 || (res as { pending?: boolean }).pending) {
    return {
      pending: true,
      message: (res as { message?: string }).message || 'Awaiting admin approval.',
      user: (res as { user: UserRecord }).user,
    };
  }
  const authed = res as { token: string; user: UserRecord };
  setToken(authed.token);
  saveUser(authed.user);
  return authed;
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: UserRecord }> {
  const { data } = await axios.post('/api/auth/login', { email, password });
  const res = data as { token: string; user: UserRecord };
  setToken(res.token);
  saveUser(res.user);
  return res;
}

export async function fetchMe(): Promise<{ user?: UserRecord }> {
  const { data } = await axios.get('/api/auth/me', { headers: getAuthHeader() });
  const res = data as { user?: UserRecord };
  if (res.user) saveUser(res.user);
  return res;
}

export function isAdminUser(user: UserRecord | null | undefined): boolean {
  return Boolean(user?.admin) || user?.role === 'admin';
}

export function getUserRole(user: UserRecord | null | undefined): 'admin' | 'reviewer' | 'learner' {
  if (!user) return 'learner';
  if (user.admin || user.role === 'admin') return 'admin';
  if (user.role === 'reviewer') return 'reviewer';
  return 'learner';
}

export function isReviewStaff(user: UserRecord | null | undefined): boolean {
  const role = getUserRole(user);
  return role === 'admin' || role === 'reviewer';
}

export function logout(): void {
  clearToken();
}

/** Apply JWT + user from Google OAuth redirect query params. */
export function acceptAuthSession(token: string, user: UserRecord): void {
  setToken(token);
  saveUser(user);
}

const POST_LOGIN_PATH_KEY = 'devsetu_post_login_path';
/** postMessage type from the Google OAuth popup back to the opener tab. */
export const GOOGLE_OAUTH_RESULT = 'devlabs:google-oauth-result';
/** localStorage bridge when postMessage / window.opener is unavailable (COOP). */
export const GOOGLE_OAUTH_BRIDGE_KEY = 'devsetu_google_oauth_bridge';
/** Named window so the callback can tell it is the OAuth tab, not the lab tab. */
export const GOOGLE_OAUTH_WINDOW_NAME = 'devlabs_google_oauth';
const GOOGLE_OAUTH_START = '/api/auth/google';
const POPUP_BLOCKED_MSG =
  'Pop-ups are blocked. Allow pop-ups for this site, then try Google sign-in again.';

export type GoogleOAuthResult =
  | { type: typeof GOOGLE_OAUTH_RESULT; ok: true; token: string; user: UserRecord }
  | { type: typeof GOOGLE_OAUTH_RESULT; ok: false; error: string; pending?: boolean };

export type GoogleSignInHandlers = {
  onSuccess?: (user: UserRecord) => void;
  onError?: (message: string, pending?: boolean) => void;
};

function rememberPostLoginPath(returnTo?: string | null): void {
  const { pathname, search } = window.location;
  const path = returnTo || (pathname === '/' || pathname.startsWith('/auth/') ? null : pathname + search);
  if (path) sessionStorage.setItem(POST_LOGIN_PATH_KEY, path);
  else sessionStorage.removeItem(POST_LOGIN_PATH_KEY);
}

function readOAuthBridge(): GoogleOAuthResult | null {
  try {
    const raw = localStorage.getItem(GOOGLE_OAUTH_BRIDGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(GOOGLE_OAUTH_BRIDGE_KEY);
    const data = JSON.parse(raw) as GoogleOAuthResult;
    if (!data || data.type !== GOOGLE_OAUTH_RESULT) return null;
    return data;
  } catch {
    try { localStorage.removeItem(GOOGLE_OAUTH_BRIDGE_KEY); } catch { /* ignore */ }
    return null;
  }
}

/** Write OAuth outcome for the opener tab (and clear any prior bridge value). */
export function writeOAuthBridge(result: GoogleOAuthResult): void {
  try {
    localStorage.setItem(GOOGLE_OAUTH_BRIDGE_KEY, JSON.stringify(result));
  } catch { /* ignore */ }
}

function applyOAuthResult(data: GoogleOAuthResult, handlers?: GoogleSignInHandlers): void {
  if (data.ok) {
    acceptAuthSession(data.token, data.user);
    handlers?.onSuccess?.(data.user);
    return;
  }
  handlers?.onError?.(data.error || 'Google sign-in failed', Boolean(data.pending));
}

function preferOAuthNewTab(): boolean {
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    if (window.matchMedia('(max-width: 820px)').matches) return true;
  } catch { /* ignore */ }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function openOAuthViaAnchor(): Window | null {
  const anchor = document.createElement('a');
  anchor.href = GOOGLE_OAUTH_START;
  anchor.target = GOOGLE_OAUTH_WINDOW_NAME;
  // Explicit opener so postMessage works when the browser allows it.
  anchor.rel = 'opener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  try {
    const named = window.open('', GOOGLE_OAUTH_WINDOW_NAME);
    if (named && named !== window && !named.closed) return named;
  } catch { /* ignore */ }
  return null;
}

/**
 * Open Google OAuth in a separate tab/window only. Never navigate this tab —
 * same-tab OAuth puts accounts.google.com under the lab and swipe-back shows it again.
 * Mobile/device-mode: use a real new tab (<a target>). Desktop: centered popup.
 */
function openGoogleOAuthWindow(): Window | null {
  // Mobile first: never window.open(about:blank) — that often replaces THIS tab.
  if (preferOAuthNewTab()) {
    return openOAuthViaAnchor();
  }

  const width = 520;
  const height = 680;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`;

  let popup: Window | null = null;
  try {
    popup = window.open('about:blank', GOOGLE_OAUTH_WINDOW_NAME, features);
  } catch {
    popup = null;
  }
  if (popup && popup !== window && !popup.closed) {
    try {
      popup.location.replace(GOOGLE_OAUTH_START);
      return popup;
    } catch {
      try { popup.close(); } catch { /* ignore */ }
    }
  }

  return openOAuthViaAnchor();
}

/**
 * Start Google sign-in in a separate tab/window so accounts.google.com never enters
 * this tab's history. Does not fall back to same-tab redirect (that reopened
 * "Choose an account" on swipe-back).
 *
 * Pass `openedByLink: true` when a real <a target> is letting the browser open the
 * tab (most reliable on mobile); we only listen for the result.
 */
export function startGoogleSignIn(
  returnTo?: string | null,
  handlers?: GoogleSignInHandlers,
  opts?: { openedByLink?: boolean },
): void {
  rememberPostLoginPath(returnTo);
  try { localStorage.removeItem(GOOGLE_OAUTH_BRIDGE_KEY); } catch { /* ignore */ }

  const popup = opts?.openedByLink ? null : openGoogleOAuthWindow();
  // Never continue if open() reused this tab — that puts Google in swipe-back history.
  if (popup === window) {
    handlers?.onError?.(POPUP_BLOCKED_MSG);
    return;
  }

  let finished = false;
  const finish = (): boolean => {
    if (finished) return false;
    finished = true;
    window.clearInterval(pollTimer);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    return true;
  };

  const complete = (data: GoogleOAuthResult): void => {
    if (!finish()) return;
    if (popup && popup !== window) {
      try { popup.close(); } catch { /* ignore */ }
    }
    applyOAuthResult(data, handlers);
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as GoogleOAuthResult | null;
    if (!data || data.type !== GOOGLE_OAUTH_RESULT) return;
    complete(data);
  };

  const onStorage = (event: StorageEvent): void => {
    if (event.key !== GOOGLE_OAUTH_BRIDGE_KEY || !event.newValue) return;
    const bridged = readOAuthBridge();
    if (bridged) complete(bridged);
  };

  window.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);

  // popup may be null when a new tab opened with noopener — still wait on the bridge.
  // Never same-tab redirect; that is what put "Choose an account" under the lab.
  const pollTimer = window.setInterval(() => {
    const bridged = readOAuthBridge();
    if (bridged) {
      complete(bridged);
      return;
    }
    if (popup && popup !== window && popup.closed) {
      if (!finish()) return;
      handlers?.onError?.('Google sign-in was closed before it finished.');
    }
  }, 400);

  if (!popup && !opts?.openedByLink) {
    window.setTimeout(() => {
      if (finished) return;
      if (!finish()) return;
      handlers?.onError?.(POPUP_BLOCKED_MSG);
    }, 15000);
  }
}

/** Where the guest was when they chose to sign in; read once. */
export function takePostLoginPath(): string | null {
  const path = sessionStorage.getItem(POST_LOGIN_PATH_KEY);
  sessionStorage.removeItem(POST_LOGIN_PATH_KEY);
  return path;
}

export async function fetchGoogleAuthStatus(): Promise<boolean> {
  try {
    const { data } = await axios.get('/api/auth/google/status');
    return Boolean((data as { enabled?: boolean }).enabled);
  } catch {
    return false;
  }
}

