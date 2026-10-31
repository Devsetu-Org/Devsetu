import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import GoogleAuthCallbackPage from './pages/GoogleAuthCallbackPage';
import { getMinor } from './constants/minors';
import { getProject } from './constants/projects';
import PlayPage from './pages/PlayPage';
import QuizPage from './pages/QuizPage';
import WhitePapersPage from './pages/WhitePapersPage';
import WhiteboardPage from './pages/WhiteboardPage';
import { WHITEBOARD_ENABLED } from './constants/whiteboard';
import SideQuestsPage from './pages/SideQuestsPage';
import PlaygroundsPage from './pages/PlaygroundsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectModulePage from './pages/ProjectModulePage';
import MinorsPage from './pages/MinorsPage';
import SparkPlaygroundPage from './pages/SparkPlaygroundPage';
import SparkPlaygroundOpenPage from './pages/SparkPlaygroundOpenPage';
import SparkPrimerPage from './pages/SparkPrimerPage';
import K8sPrimerPage from './pages/K8sPrimerPage';
import K8sReadingPage from './pages/K8sReadingPage';
import ProfilePage from './pages/ProfilePage';
import FeedbackPage, { FEEDBACK_SIGN_IN } from './pages/FeedbackPage';
import AdminPage from './pages/AdminPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import AdminWaitlistPage from './pages/AdminWaitlistPage';
import DbExplorerPage from './pages/DbExplorerPage';
import TrackLeaderboardPage from './pages/TrackLeaderboardPage';
import PricingPage from './pages/PricingPage';
import MonthlyPaperPage from './pages/MonthlyPaperPage';
import PlatformLeaderboardPage from './pages/PlatformLeaderboardPage';
import LearnerProfilePage from './pages/LearnerProfilePage';
import AppLayout from './layouts/AppLayout';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { getToken, getCurrentUser, logout, fetchMe, takePostLoginPath } from './services/authApi';
import { fetchChallenges, fetchChallenge } from './services/challengeApi';
import { startSession, startBoardSession, endSession, restoreSession } from './services/sessionApi';
import { startSparkSession, startK8sSession, cancelInflightK8sStart, fetchK8sAvailability } from './services/workspaceApi';
import {
  LAB_HEARTBEAT_MS,
  LAB_LEASE_RECLAIMED_EVENT,
  LAB_LEASE_TAKEN_EVENT,
  LAB_SESSION_ENDED_EVENT,
  LAB_SESSION_IDLE_EVENT,
  labConflictFromError,
  releaseLabLease,
  sendLabHeartbeat,
  type LabConflict,
} from './services/labTabLease';
import ConfirmDialog from './components/ConfirmDialog';
import AdminOnlyRoute from './components/AdminOnlyRoute';
import LoginModal from './components/LoginModal';
import UsernameGate from './components/UsernameGate';
import { buildDailyProductSalesProject } from './fixtures/dailyProductSalesL1';
import {
  buildSparkPlaygroundChallenge,
  buildSparkPlaygroundStarter,
} from './fixtures/sparkPlaygroundStarter';
import { isSparkPlatformChallenge } from './components/SparkPlatformWorkspace';
import { isBoardChallenge } from './components/BoardWorkspace';
import {
  isBoxChallenge,
  isKubernetesChallenge,
  isPublicLabComingSoon,
  LAB_COMING_SOON_MSG,
} from './components/K8sLabWorkspace';
import { SPARK_PLAYGROUND_CHALLENGE_ID } from './constants/playgroundDatasets';
import { PRICING_PATH } from './constants/pricing';
import { catalogPathForChallenge, isPlayDomainId, looksLikePlaySessionId } from './constants/playCatalog';import type {
  AuthMode,
  PlayState,
  WorkspaceTab,
  ActiveSession,
  ChallengePublic,
  ChallengeFull,
  UserRecord,
  EndSessionResult,
  AppState,
} from './types/domain';

const LAB_LOCKED_FALLBACK_MSG = 'Something is down on our side. Please contact the administrator.';

/** Started Kubernetes labs (machine requested or shell up) need a leave warning. */
function needsK8sLeaveConfirm(session: ActiveSession | null | undefined): boolean {
  return Boolean(
    session
    && session.runtime === 'kubernetes'
    && !session.notStarted
    && !session.id.startsWith('pending-k8s-'),
  );
}

/** Old /play/* links (bookmarks, published lab solutions) moved to /track, /majors and /minors. */
function LegacyPlayRedirect(): JSX.Element {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.replace(/^\/play/, '');
  let to = `/track${rest}`;
  if (/^\/(majors|minors)(\/|$)/.test(rest)) to = rest;
  else if (/^\/projects(\/|$)/.test(rest)) to = rest.replace(/^\/projects/, '/majors');
  return <Navigate to={to + search + hash} replace />;
}

const parentPath = (pathname: string): string => pathname.replace(/\/[^/]+\/?$/, '') || '/track';

/** Set while signing out, so a signed-in-only page does not prompt for login on its way to the landing page. */
let signingOut = false;

/** Guests are sent to `fallback` with the sign-in modal open, then returned here after signing in. */
function SignedInOnlyRoute({
  children,
  fallback = () => '/track',
  unopened,
  prompt,
}: {
  children: React.ReactElement;
  fallback?: (pathname: string) => string;
  /** Items that are not open yet redirect on their own; asking guests to sign in for them is pointless. */
  unopened?: (pathname: string) => boolean;
  /** Shown on the sign-in modal when a guest lands on this route. */
  prompt?: { title: string; body: string };
}): React.ReactElement {
  const { authMode, onRequestLogin } = useAppState();
  const { pathname, search } = useLocation();
  const signedIn = authMode === 'interviewer';
  const pass = signedIn || Boolean(unopened?.(pathname));
  useEffect(() => {
    if (!pass && !signingOut) onRequestLogin(pathname + search, prompt);
  }, [pass, onRequestLogin, pathname, search, prompt]);
  if (!pass && signingOut) return <Navigate to="/" replace />;
  return pass ? children : <Navigate to={fallback(pathname)} replace />;
}

const minorUnopened = (pathname: string): boolean =>
  getMinor(pathname.split('/')[2])?.status !== 'ready';
const majorUnopened = (pathname: string): boolean =>
  getProject(pathname.split('/')[2])?.status !== 'ready';

export default function App(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const openingSessionRef = useRef<string | null>(null);
  /** Bumped per lab start/restore; a superseded attempt must not touch UI state when it resolves. */
  const startAttemptRef = useRef(0);
  const startAbortRef = useRef<AbortController | null>(null);
  const openSeqRef = useRef(0);
  const pendingStartRef = useRef(false);
  const pendingStartPathRef = useRef<string | null>(null);
  const pendingStartChallengeRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>('resolving');
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [challenges, setChallenges] = useState<ChallengePublic[]>([]);
  const [challengesError, setChallengesError] = useState<string | null>(null);

  const [playState, setPlayState] = useState<PlayState>('library');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  activeSessionIdRef.current = activeSession?.id ?? null;
  const [activeChallenge, setActiveChallenge] = useState<ChallengePublic | ChallengeFull | null>(null);
  const [endResult, setEndResult] = useState<EndSessionResult | null>(null);
  const [ending, setEnding] = useState<boolean>(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('problem');
  const [labConflict, setLabConflict] = useState<{
    challenge: ChallengePublic | ChallengeFull;
    conflict: LabConflict;
  } | null>(null);
  const [labLeaseLost, setLabLeaseLost] = useState<'taken' | 'ended' | null>(null);
  const [labLeaseBusy, setLabLeaseBusy] = useState<boolean>(false);
  /** Browser/trackpad back or header Back while a started k8s lab is open. */
  const [leaveLabPrompt, setLeaveLabPrompt] = useState<{
    session: ActiveSession;
    dest: string;
  } | null>(null);
  const leaveLabPromptRef = useRef(leaveLabPrompt);
  leaveLabPromptRef.current = leaveLabPrompt;
  const [heartbeatEpoch, setHeartbeatEpoch] = useState<number>(0);
  const [loginOpen, setLoginOpen] = useState<boolean>(false);
  const [loginReturnTo, setLoginReturnTo] = useState<string | null>(null);
  const [loginPrompt, setLoginPrompt] = useState<{ title: string; body: string } | null>(null);
  const requestLogin = useCallback((returnTo?: string, prompt?: { title: string; body: string }): void => {
    setLoginReturnTo(typeof returnTo === 'string' ? returnTo : null);
    setLoginPrompt(prompt ?? null);
    setLoginOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function resolveAuth(): Promise<void> {
      if (!getToken()) {
        if (!cancelled) setAuthMode('unauthenticated');
        return;
      }
      setCurrentUser(getCurrentUser());
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (me.user) setCurrentUser(me.user);
        setAuthMode('interviewer');
      } catch (_e) {
        if (cancelled) return;
        logout();
        setCurrentUser(null);
        setAuthMode('unauthenticated');
      }
    }
    void resolveAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshChallenges = async (): Promise<void> => {
    try {
      const list = await fetchChallenges();
      setChallenges(list);
      setChallengesError(null);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setChallenges([]);
      setChallengesError(err?.response?.data?.error || err.message || 'Unknown error');
    }
  };

  /** Leaving the UI used to drop client state only — end on the server so K8s can park/wipe. */
  const endActiveSessionBestEffort = useCallback((session: ActiveSession | null): Promise<void> => {
    if (!session?.id || session.id.startsWith('pending-k8s-')) return Promise.resolve();
    return endSession(session.id).then(
      () => undefined,
      (err: unknown) => {
        console.warn('[session] end on leave failed', err);
      },
    );
  }, []);

  const beginStartAttempt = (challengeId: string | null = null): {
    stale: () => boolean;
    settle: () => void;
    signal: AbortSignal;
    openSeq: number;
  } => {
    startAbortRef.current?.abort();
    const abort = new AbortController();
    startAbortRef.current = abort;
    const openSeq = ++openSeqRef.current;
    // Drop a boot the learner already left. The sequence keeps a newer open alive
    // if this cancel arrives after that open has started.
    void cancelInflightK8sStart(openSeq);
    const attempt = ++startAttemptRef.current;
    pendingStartRef.current = true;
    pendingStartPathRef.current = window.location.pathname;
    pendingStartChallengeRef.current = challengeId;
    const stale = (): boolean => startAttemptRef.current !== attempt;
    return {
      stale,
      signal: abort.signal,
      openSeq,
      settle: () => {
        if (!stale()) pendingStartRef.current = false;
      },
    };
  };

  /** User navigated away while a lab was still opening — drop it and return to the catalog. */
  const abandonPendingStart = (): void => {
    startAbortRef.current?.abort();
    startAbortRef.current = null;
    void cancelInflightK8sStart(++openSeqRef.current);
    startAttemptRef.current += 1;
    pendingStartRef.current = false;
    pendingStartPathRef.current = null;
    openingSessionRef.current = null;
    setLeaveLabPrompt(null);
    setLabLeaseLost(null);
    setPlayState('library');
    setActiveSession(null);
    setActiveChallenge(null);
    setEndResult(null);
  };

  /**
   * End a session created by an abandoned start. Reopening the same lab reuses
   * its session id, so skip it when it is on screen or a newer start for the same
   * lab is in flight; ending it would park the lab the user just reopened.
   */
  const discardStartedSession = (sessionId: string | null | undefined, challengeId: string | null = null): void => {
    if (!sessionId) return;
    if (activeSessionIdRef.current === sessionId) return;
    if (challengeId && pendingStartRef.current && pendingStartChallengeRef.current === challengeId) return;
    endSession(sessionId).catch((err: unknown) => {
      console.warn('[session] end of abandoned start failed', err);
    });
  };

  /** End the lab in the background and return to the catalog immediately. */
  const dismissK8sLabToCatalog = useCallback((
    session: ActiveSession,
    dest: string,
  ): void => {
    setLeaveLabPrompt(null);
    void endActiveSessionBestEffort(session);
    setEnding(false);
    setPlayState('library');
    setActiveSession(null);
    setActiveChallenge(null);
    setEndResult(null);
    setLabLeaseLost(null);
    navigate(dest, { replace: true });
    void refreshChallenges();
  }, [endActiveSessionBestEffort, navigate]);

  /**
   * Keep one same-URL history entry above a live k8s lab. Trackpad/browser Back then
   * stays in the app (leave confirm / abandon) instead of jumping to Google OAuth
   * left under the session from sign-in.
   */
  useEffect(() => {
    if (playState !== 'active' || ending) return undefined;
    if (!activeSession || activeSession.runtime !== 'kubernetes') return undefined;
    if (leaveLabPrompt) return undefined;

    const session = activeSession;
    const challenge = activeChallenge;
    const marker = { devlabsLabGuard: session.id };
    const labUrl = () => (
      session.id.startsWith('pending-k8s-') || session.notStarted
        ? window.location.pathname + window.location.search
        : `/track/${session.id}`
    );
    window.history.pushState(marker, '', labUrl());

    const onPopState = (): void => {
      const panelDest = catalogPathForChallenge(
        challenge?.id,
        challenge?.sandboxType,
        challenge?.tags,
      );
      if (session.notStarted || session.id.startsWith('pending-k8s-')) {
        abandonPendingStart();
        navigate(panelDest !== '/track' ? panelDest : '/track', { replace: true });
        return;
      }
      window.history.pushState(marker, '', `/track/${session.id}`);
      navigate(`/track/${session.id}`, { replace: true });
      setLeaveLabPrompt({ session, dest: panelDest !== '/track' ? panelDest : '/track' });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    playState,
    ending,
    leaveLabPrompt,
    activeSession?.id,
    activeSession?.notStarted,
    activeSession?.runtime,
    activeChallenge?.id,
    activeChallenge?.sandboxType,
    activeChallenge?.tags,
    navigate,
  ]);

  useEffect(() => {
    if (authMode !== 'resolving') {
      void refreshChallenges();
    }
  }, [authMode]);

  const handleSelectChallenge = async (
    challenge: ChallengePublic | ChallengeFull,
    opts: { force?: boolean; start?: boolean } = {},
  ): Promise<void> => {
    if (authMode !== 'interviewer') {
      requestLogin();
      return;
    }
    if ((challenge as ChallengePublic).locked) {
      navigate(PRICING_PATH);
      return;
    }
    const force = Boolean(opts.force);
    const startNow = force || Boolean(opts.start);
    setStartError(null);
    setLabConflict(null);
    setLabLeaseLost(null);
    setActiveChallenge(challenge);
    const attempt = beginStartAttempt(challenge.id);
    // K8s: open the lab UI immediately (no full-page loader). Other runtimes keep the spinner.
    if (!isKubernetesChallenge(challenge)) {
      setPlayState('loading');
    }

    if (isBoardChallenge(challenge)) {
      try {
        const full = await fetchChallenge(challenge.id);
        if (attempt.stale()) return;
        const res = await startBoardSession(full.id, { force });
        if (attempt.stale()) {
          discardStartedSession(res.sessionId);
          return;
        }
        attempt.settle();
        const hydrated =
          (res.challenge as ChallengeFull | undefined)
          || (res.session as { challenge?: ChallengeFull } | undefined)?.challenge
          || full;
        setActiveSession({
          id: res.sessionId,
          startTime: Date.now(),
          recovered: false,
          terminalWsUrl: null,
          metricsWsUrl: null,
          portMap: null,
          services: [],
          terminalService: null,
          runtime: 'board',
        });
        setActiveChallenge(hydrated);
        openingSessionRef.current = res.sessionId;
        setPlayState('active');
        navigate(`/track/${res.sessionId}`);
      } catch (e) {
        if (attempt.stale()) return;
        attempt.settle();
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setActiveChallenge(null);
        setActiveSession(null);
        setPlayState('library');
        navigate(catalogPathForChallenge(challenge.id, challenge.sandboxType, challenge.tags), { replace: true });
        const labConflictHit = labConflictFromError(e);
        if (labConflictHit) {
          setLabConflict({ challenge, conflict: labConflictHit });
          return;
        }
        setStartError(
          err?.response?.data?.error
            || err.message
            || 'Failed to start board session',
        );
      }
      return;
    }

    // Spark-platform: hydrate meta from MinIO; seed starter from MinIO when contentSource=minio.
    if (isSparkPlatformChallenge(challenge)) {
      try {
        const full = await fetchChallenge(challenge.id);
        if (attempt.stale()) return;
        const platform = full.sparkPlatform;
        const contentSource = full.contentSource || platform?.contentSource;
        // MinIO SSOT labs: backend loads challenges/<id>/starter/.
        // Legacy labs (e.g. DPS) still use FE fixtures until migrated.
        const useMinioStarter = contentSource === 'minio';
        if (!useMinioStarter && !platform) {
          throw new Error('Missing sparkPlatform spec');
        }
        const starterFiles = useMinioStarter
          ? null
          : buildDailyProductSalesProject(platform!);
        const res = await startSparkSession(
          full.id,
          starterFiles,
          platform?.starterFileName,
          { force },
        );
        if (attempt.stale()) {
          discardStartedSession(res.sessionId);
          return;
        }
        attempt.settle();
        const hydrated =
          (res.challenge as ChallengeFull | undefined)
          || (res.session as { challenge?: ChallengeFull } | undefined)?.challenge
          || full;
        setActiveSession({
          id: res.sessionId,
          startTime: Date.now(),
          recovered: false,
          terminalWsUrl: null,
          metricsWsUrl: null,
          portMap: null,
          services: [],
          terminalService: null,
          runtime: 'spark-platform',
        });
        setActiveChallenge(hydrated);
        setActiveTab('editor');
        openingSessionRef.current = res.sessionId;
        setPlayState('active');
        navigate(`/track/${res.sessionId}`);
      } catch (e) {
        if (attempt.stale()) return;
        attempt.settle();
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setActiveChallenge(null);
        setActiveSession(null);
        setPlayState('library');
        navigate(catalogPathForChallenge(challenge.id, challenge.sandboxType, challenge.tags), { replace: true });
        const labConflictHit = labConflictFromError(e);
        if (labConflictHit) {
          setLabConflict({ challenge, conflict: labConflictHit });
          return;
        }
        setStartError(
          err?.response?.data?.error
            || err.message
            || 'Failed to start spark session (MinIO unreachable)',
        );
      }
      return;
    }

    if (isKubernetesChallenge(challenge)) {
      const pendingId = `pending-k8s-${challenge.id}`;
      const pendingSession: ActiveSession = {
        id: pendingId,
        startTime: Date.now(),
        recovered: false,
        terminalWsUrl: null,
        metricsWsUrl: null,
        portMap: null,
        services: [],
        terminalService: null,
        runtime: 'kubernetes',
        k8sNamespace: null,
        labReady: false,
        bootSeq: attempt.openSeq,
      };
      // Pool down: keep the lab on screen with its brief readable and the terminal locked.
      // Capacity applies to every role — there is no admin bypass.
      const lockLab = (message: string | null): void => {
        setActiveSession({ ...pendingSession, lockedMessage: message || LAB_LOCKED_FALLBACK_MSG });
      };
      setActiveTab('problem');
      // Locked/checking first — never show Start or Creating until the pool is
      // confirmed up. Admins used to flash Start/Creating when kafka was empty.
      setActiveSession({
        ...pendingSession,
        lockedMessage: 'Checking whether the lab machines are available…',
      });
      setPlayState('active');
      openingSessionRef.current = pendingId;

      try {
        const full = await fetchChallenge(challenge.id);
        if (attempt.stale()) return;
        setActiveChallenge(full);

        // Public users can read the brief; live terminals stay admin-only for now.
        // This is only the Coming soon preview gate — not a capacity bypass.
        if (isPublicLabComingSoon(full, currentUser)) {
          attempt.settle();
          lockLab(LAB_COMING_SOON_MSG);
          return;
        }

        // Fail closed for everyone (including admin): a down pool or a failed
        // check locks the terminal. Do not show Start, then Pending pods.
        const availability = await fetchK8sAvailability(full.id).catch(() => ({
          available: false,
          message: LAB_LOCKED_FALLBACK_MSG,
        }));
        if (attempt.stale()) return;
        if (!availability.available) {
          attempt.settle();
          lockLab(availability.message);
          return;
        }

        if (!startNow) {
          attempt.settle();
          setActiveSession({ ...pendingSession, notStarted: true });
          return;
        }

        // Pool is up — only now leave the lock and show the boot/warming UI.
        setActiveSession(pendingSession);
        await cancelInflightK8sStart(attempt.openSeq);
        if (attempt.stale()) return;
        const res = await startK8sSession(full.id, { force, signal: attempt.signal, openSeq: attempt.openSeq });
        if (attempt.stale()) {
          discardStartedSession(res.sessionId);
          return;
        }
        attempt.settle();
        const hydrated =
          (res.challenge as ChallengeFull | undefined)
          || (res.session as { challenge?: ChallengeFull } | undefined)?.challenge
          || full;
        setActiveSession({
          id: res.sessionId,
          startTime: Date.now(),
          recovered: false,
          terminalWsUrl: res.terminalWsUrl ?? null,
          metricsWsUrl: null,
          portMap: null,
          services: [],
          terminalService: null,
          runtime: 'kubernetes',
          k8sNamespace: res.k8sNamespace
            || (res.session as { k8sNamespace?: string } | undefined)?.k8sNamespace
            || null,
          labReady: true,
        });
        setActiveChallenge(hydrated);
        openingSessionRef.current = res.sessionId;
        navigate(`/track/${res.sessionId}`);
      } catch (e) {
        const code = (e as { response?: { data?: { code?: string }; code?: string } })?.response?.data?.code
          || (e as { code?: string }).code;
        if (attempt.stale() || code === 'ERR_CANCELED' || code === 'START_SUPERSEDED') return;
        attempt.settle();
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        if (code === 'LAB_ENV_UNAVAILABLE') {
          lockLab(err?.response?.data?.error || null);
          return;
        }
        setActiveChallenge(null);
        setActiveSession(null);
        setPlayState('library');
        navigate(catalogPathForChallenge(challenge.id, challenge.sandboxType, challenge.tags), { replace: true });
        const labConflictHit = labConflictFromError(e);
        if (labConflictHit) {
          setLabConflict({ challenge, conflict: labConflictHit });
          return;
        }
        setStartError(
          err?.response?.data?.error
            || err.message
            || 'Failed to start Kubernetes lab session',
        );
      }
      return;
    }

    try {
      const res = await startSession(challenge.id);
      if (attempt.stale()) {
        discardStartedSession(res.sessionId);
        return;
      }
      attempt.settle();
      const rawSession = res.session as {
        startTime?: number;
        portMap?: Record<string, string | number> | null;
      } | null | undefined;
      setActiveSession({
        id: res.sessionId,
        startTime: rawSession?.startTime || Date.now(),
        recovered: false,
        terminalWsUrl: (res.terminalWsUrl as string | null) ?? null,
        metricsWsUrl: (res.metricsWsUrl as string | null) ?? null,
        portMap: rawSession?.portMap ?? null,
        services: res.services || [],
        terminalService: res.terminalService ?? null,
        runtime: 'compose',
      });
      setActiveChallenge((res.challenge as ChallengePublic | null) || challenge);
      setActiveTab('problem');
      openingSessionRef.current = res.sessionId;
      setPlayState('active');
      navigate(`/track/${res.sessionId}`);
    } catch (e) {
      if (attempt.stale()) return;
      attempt.settle();
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setStartError(err?.response?.data?.error || err.message || 'Unknown error');
      setPlayState('library');
      navigate(catalogPathForChallenge(challenge.id, challenge.sandboxType, challenge.tags), { replace: true });
    }
  };

  // Keep play UI in sync with the URL (browser Back/Forward, deep links).
  useEffect(() => {
    if (authMode === 'resolving') return;

    // A locked or not-started lab keeps the catalog URL, so leaving that URL drops it.
    const abandoned =
      (pendingStartRef.current || Boolean(activeSession?.lockedMessage) || Boolean(activeSession?.notStarted))
      && window.location.pathname !== pendingStartPathRef.current;
    if (abandoned) {
      // Prefer the lab's panel (/track/.../linux), not the domain hub history may land on.
      const fromChallenge = catalogPathForChallenge(
        activeChallenge?.id,
        activeChallenge?.sandboxType,
        activeChallenge?.tags,
      );
      const panelDest =
        fromChallenge !== '/track'
          ? fromChallenge
          : (pendingStartPathRef.current || '/track');
      abandonPendingStart();
      navigate(panelDest, { replace: true });
      return;
    }
    const currentPlayState: PlayState = abandoned ? 'library' : playState;
    const currentSession = abandoned ? null : activeSession;

    const path = location.pathname.replace(/\/$/, '') || '/';
    const segments = path.split('/').filter(Boolean); // ['track', ...]
    const underPlay = segments[0] === 'track';
    if (!underPlay) return;

    const a = segments[1] || null;
    const b = segments[2] || null;

    // Quiz / papers / quests / playgrounds — not session restore paths
    if (
      a === 'quiz' ||
      a === 'papers' ||
      a === 'quests' ||
      a === 'whiteboard' ||
      a === 'playgrounds' ||
      a === 'spark-playground'
    ) {
      return;
    }

    // Catalog: /track | /track/:domain | /track/:domain/:panel
    if (!a || isPlayDomainId(a)) {
      if (currentPlayState === 'loading') return;
      if (openingSessionRef.current) return;
      if (ending) return;
      if (currentPlayState === 'active' || currentPlayState === 'ended') {
        const leaving = currentPlayState === 'active' ? currentSession : null;
        if (leaving?.runtime === 'kubernetes') {
          const fromChallenge = catalogPathForChallenge(
            activeChallenge?.id,
            activeChallenge?.sandboxType,
            activeChallenge?.tags,
          );
          const landed = location.pathname.replace(/\/$/, '') || '/track';
          // Panel for this lab, not a domain hub entry from the history stack.
          const catalogDest =
            fromChallenge !== '/track'
              ? fromChallenge
              : (landed.startsWith('/track') ? landed : '/track');
          // Trackpad/browser back lands on a catalog URL. Ask before ending a started lab.
          if (needsK8sLeaveConfirm(leaving)) {
            if (!leaveLabPromptRef.current) {
              navigate(`/track/${leaving.id}`, { replace: true });
              setLeaveLabPrompt({ session: leaving, dest: catalogDest });
            }
            return;
          }
          dismissK8sLabToCatalog(leaving, catalogDest);
          return;
        }
        setPlayState('library');
        setActiveSession(null);
        setActiveChallenge(null);
        setEndResult(null);
        if (leaving) void endActiveSessionBestEffort(leaving);
      }
      return;
    }

    // Session: /track/:sessionId (UUID / opaque id — not a catalog domain slug)
    if (b) return;
    const sessionId = a;

    if (!looksLikePlaySessionId(sessionId)) {
      navigate('/track', { replace: true });
      return;
    }

    if (authMode !== 'interviewer') {
      navigate('/track', { replace: true });
      requestLogin();
      return;
    }

    if (openingSessionRef.current === sessionId) {
      openingSessionRef.current = null;
    }

    if (currentPlayState === 'active' && currentSession?.id === sessionId) return;
    if (currentPlayState === 'loading') return;

    setPlayState('loading');
    const attempt = beginStartAttempt();

    void (async () => {
      try {
        const res = await restoreSession(sessionId);
        if (attempt.stale()) return;
        const runtime =
          (res?.session as { runtime?: string } | null | undefined)?.runtime ||
          (res as { runtime?: string } | null | undefined)?.runtime ||
          null;

        if (runtime === 'board' || isBoardChallenge(res?.challenge || null)) {
          await restoreBoardWorkspace(sessionId, res);
          return;
        }

        if (runtime === 'kubernetes' || isKubernetesChallenge(res?.challenge || null)) {
          const sess = res?.session as {
            recovered?: boolean;
            k8sNamespace?: string;
            workspacePrefix?: string;
            endReason?: string | null;
          } | null | undefined;
          const idleLocked = res?.status === 'ended' && sess?.endReason === 'idle_timeout';
          // A finished lab in history is not something to reopen as active (except idle lock).
          if (res?.status === 'ended' && !idleLocked) {
            attempt.settle();
            setPlayState('library');
            setActiveSession(null);
            setActiveChallenge(null);
            setLabLeaseLost(null);
            navigate(
              catalogPathForChallenge(
                res?.challenge?.id || (res?.session as { challengeId?: string } | null | undefined)?.challengeId,
                (res?.challenge as ChallengePublic | null | undefined)?.sandboxType,
                (res?.challenge as ChallengePublic | null | undefined)?.tags,
              ),
              { replace: true },
            );
            return;
          }
          setActiveSession({
            id: res?.sessionId || sessionId,
            startTime: res?.startTime || Date.now(),
            recovered: sess?.recovered ?? false,
            terminalWsUrl: res?.terminalWsUrl ?? null,
            metricsWsUrl: null,
            portMap: null,
            services: [],
            terminalService: null,
            runtime: 'kubernetes',
            k8sNamespace: sess?.k8sNamespace
              || (res as { k8sNamespace?: string } | null)?.k8sNamespace
              || sess?.workspacePrefix
              || null,
            labReady: !idleLocked,
            idleLocked,
          });
          attempt.settle();
          setActiveChallenge((res?.challenge as ChallengeFull | null) || null);
          setActiveTab('problem');
          setPlayState('active');
          return;
        }

        if (!res || res.status === 'ended') {
          await restoreSparkWorkspace(sessionId, null);
          return;
        }

        if (runtime === 'spark-platform' || sessionId.startsWith('spark-')) {
          await restoreSparkWorkspace(sessionId, res);
          return;
        }

        setActiveSession({
          id: res.sessionId,
          startTime: res.startTime || Date.now(),
          recovered: (res.session as { recovered?: boolean } | null | undefined)?.recovered ?? false,
          terminalWsUrl: res.terminalWsUrl ?? null,
          metricsWsUrl: res.metricsWsUrl ?? null,
          portMap: res.portMap || null,
          services: res.services || [],
          terminalService: res.terminalService || null,
          runtime: 'compose',
        });
        attempt.settle();
        setActiveChallenge(res.challenge || null);
        setActiveTab('problem');
        setPlayState('active');
      } catch {
        if (attempt.stale()) return;
        try {
          await restoreSparkWorkspace(sessionId, null);
        } catch {
          if (attempt.stale()) return;
          attempt.settle();
          setPlayState('library');
          setActiveSession(null);
          setActiveChallenge(null);
          navigate('/track', { replace: true });
        }
      }
    })();

    async function restoreBoardWorkspace(
      sid: string,
      sessionRes: Awaited<ReturnType<typeof restoreSession>>,
    ): Promise<void> {
      const challengeId =
        (sessionRes?.session as { challengeId?: string } | null | undefined)?.challengeId ||
        sessionRes?.challenge?.id ||
        null;
      let full: ChallengeFull | ChallengePublic | null = sessionRes?.challenge || null;
      if (challengeId) {
        try {
          full = await fetchChallenge(challengeId);
        } catch {
          /* keep session challenge payload */
        }
      }
      if (attempt.stale()) return;
      attempt.settle();
      setActiveSession({
        id: sid,
        startTime: sessionRes?.startTime || Date.now(),
        recovered: true,
        terminalWsUrl: null,
        metricsWsUrl: null,
        portMap: null,
        services: [],
        terminalService: null,
        runtime: 'board',
      });
      setActiveChallenge(full);
      setPlayState('active');
    }

    async function restoreSparkWorkspace(
      sid: string,
      sessionRes: Awaited<ReturnType<typeof restoreSession>>,
    ): Promise<void> {
      const challengeId =
        (sessionRes?.session as { challengeId?: string } | null | undefined)?.challengeId ||
        sessionRes?.challenge?.id ||
        null;

      let full: ChallengeFull | null = null;
      if (challengeId === SPARK_PLAYGROUND_CHALLENGE_ID) {
        full = buildSparkPlaygroundChallenge();
      } else if (challengeId) {
        full = await fetchChallenge(challengeId);
      } else {
        // Workspace exists without a recoverable challenge id — probe MinIO then default lab.
        const { fetchWorkspace } = await import('./services/workspaceApi');
        await fetchWorkspace(sid);
        full = await fetchChallenge('l1-filter-valid-sales-rows');
      }

      if (challengeId !== SPARK_PLAYGROUND_CHALLENGE_ID && !full?.sparkPlatform && full) {
        // Ensure spark fields exist even if list payload was thin.
        full = await fetchChallenge(full.id);
      }

      if (attempt.stale()) return;
      attempt.settle();
      setActiveSession({
        id: sid,
        startTime: sessionRes?.startTime || Date.now(),
        recovered: true,
        terminalWsUrl: null,
        metricsWsUrl: null,
        portMap: null,
        services: [],
        terminalService: null,
        runtime: 'spark-platform',
      });
      setActiveChallenge(full);
      setActiveTab('editor');
      setPlayState('active');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, authMode, navigationType]);

  const handleEnd = async (): Promise<void> => {
    if (!activeSession || ending) return;
    if (activeSession.id.startsWith('pending-k8s-')) {
      abandonPendingStart();
      setEnding(false);
      return;
    }
    setEnding(true);
    try {
      if (activeSession.runtime === 'board') {
        const res = await endSession(activeSession.id);
        setEndResult(res as EndSessionResult);
        setPlayState('ended');
        return;
      }
      if (activeSession.runtime === 'spark-platform' || activeSession.id.startsWith('spark-')) {
        try {
          await endSession(activeSession.id);
        } catch (_e) {
          /* still close UI */
        }
        setEndResult({
          sessionId: activeSession.id,
          elapsed: Date.now() - activeSession.startTime,
        });
        setPlayState('ended');
        return;
      }
      if (activeSession.runtime === 'kubernetes') {
        const dest = catalogPathForChallenge(
          activeChallenge?.id,
          activeChallenge?.sandboxType,
          activeChallenge?.tags,
        );
        dismissK8sLabToCatalog(activeSession, dest);
        return;
      }
      // compose: end on server, then summary card
      const res = await endSession(activeSession.id);
      setEndResult(res as EndSessionResult);
      setPlayState('ended');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setStartError(err?.response?.data?.error || err.message || 'Unknown error');
    } finally {
      setEnding(false);
    }
  };

  const handleOpenSparkPlayground = async (): Promise<void> => {
    if (authMode !== 'interviewer') {
      requestLogin();
      return;
    }
    setStartError(null);
    setPlayState('loading');
    const attempt = beginStartAttempt();
    const challenge = buildSparkPlaygroundChallenge();
    try {
      const res = await startSparkSession(
        SPARK_PLAYGROUND_CHALLENGE_ID,
        buildSparkPlaygroundStarter(),
        'src/main.py',
      );
      if (attempt.stale()) {
        discardStartedSession(res.sessionId);
        return;
      }
      attempt.settle();
      setActiveSession({
        id: res.sessionId,
        startTime: Date.now(),
        recovered: false,
        terminalWsUrl: null,
        metricsWsUrl: null,
        portMap: null,
        services: [],
        terminalService: null,
        runtime: 'spark-platform',
      });
      setActiveChallenge(challenge);
      setActiveTab('editor');
      openingSessionRef.current = res.sessionId;
      setPlayState('active');
      navigate(`/track/${res.sessionId}`);
    } catch (e) {
      if (attempt.stale()) return;
      attempt.settle();
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setActiveChallenge(null);
      setActiveSession(null);
      setPlayState('library');
      setStartError(
        err?.response?.data?.error
          || err.message
          || 'Failed to open Spark Playground',
      );
      navigate('/track/spark-playground', { replace: true });
      throw e;
    }
  };

  const handleBackToLibrary = (): void => {
    const dest = catalogPathForChallenge(activeChallenge?.id, activeChallenge?.sandboxType, activeChallenge?.tags);    // A lab still opening keeps the catalog URL, so navigating there alone never
    // invalidates the start; it would finish and pull the user back into the lab.
    if (pendingStartRef.current || activeSession?.id.startsWith('pending-k8s-')) {
      abandonPendingStart();
      navigate(dest);
      void refreshChallenges();
      return;
    }
    const leaving = playState === 'active' ? activeSession : null;
    if (leaving?.runtime === 'kubernetes') {
      if (ending) return;
      if (needsK8sLeaveConfirm(leaving)) {
        setLeaveLabPrompt({ session: leaving, dest });
        return;
      }
      dismissK8sLabToCatalog(leaving, dest);
      return;
    }
    setPlayState('library');
    setActiveSession(null);
    setActiveChallenge(null);
    setEndResult(null);
    navigate(dest);
    if (leaving) void endActiveSessionBestEffort(leaving);
    void refreshChallenges();
  };

  /**
   * The lab's fixed time ran out: keep the brief up and replace the shell with
   * a screen to start again. Returns false for other runtimes, which keep the ended dialog.
   */
  const lockLabForInactivity = (): boolean => {
    let applied = false;
    setActiveSession((prev) => {
      if (!prev || prev.runtime !== 'kubernetes') return prev;
      applied = true;
      if (prev.idleLocked) return prev;
      return { ...prev, idleLocked: true, labReady: false };
    });
    if (applied) setLabLeaseLost(null);
    return applied;
  };

  // Not while ending: the user's own end request tears the lab down, and that must not read as "ended elsewhere".
  const leaseSessionId =
    playState === 'active'
    && !ending
    && activeSession
    && !activeSession.id.startsWith('pending-k8s-')
    && (activeSession.runtime === 'kubernetes'
      || activeSession.runtime === 'spark-platform'
      || activeSession.runtime === 'board')
    && !activeSession.idleLocked
    && activeChallenge?.id !== SPARK_PLAYGROUND_CHALLENGE_ID
      ? activeSession.id
      : null;

  useEffect(() => {
    if (!leaseSessionId || labLeaseLost) return undefined;
    let cancelled = false;
    const beat = async (): Promise<void> => {
      const result = await sendLabHeartbeat(leaseSessionId);
      // Opening another lab replaces the session before this response lands.
      // Applying it would mark the new lab as open in another tab.
      if (cancelled || activeSessionIdRef.current !== leaseSessionId) return;
      if (result === 'idle') {
        if (!lockLabForInactivity()) setLabLeaseLost('ended');
        return;
      }
      if (result === 'taken' || result === 'ended') setLabLeaseLost(result);
    };
    void beat();
    const timer = window.setInterval(() => void beat(), LAB_HEARTBEAT_MS);
    const onPageHide = (): void => releaseLabLease(leaseSessionId);
    // Switching back to this tab should reveal a takeover at once, not at the next beat.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void beat();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [leaseSessionId, labLeaseLost, heartbeatEpoch]);

  useEffect(() => {
    if (!leaseSessionId) return undefined;
    const onTaken = (): void => setLabLeaseLost((prev) => prev || 'taken');
    const onEnded = (): void => setLabLeaseLost('ended');
    const onIdle = (): void => {
      if (!lockLabForInactivity()) setLabLeaseLost('ended');
    };
    window.addEventListener(LAB_LEASE_TAKEN_EVENT, onTaken);
    window.addEventListener(LAB_SESSION_ENDED_EVENT, onEnded);
    window.addEventListener(LAB_SESSION_IDLE_EVENT, onIdle);
    return () => {
      window.removeEventListener(LAB_LEASE_TAKEN_EVENT, onTaken);
      window.removeEventListener(LAB_SESSION_ENDED_EVENT, onEnded);
      window.removeEventListener(LAB_SESSION_IDLE_EVENT, onIdle);
    };
  }, [leaseSessionId]);

  const handleUseLabHere = async (): Promise<void> => {
    if (!leaseSessionId) return;
    setLabLeaseBusy(true);
    const result = await sendLabHeartbeat(leaseSessionId, true);
    setLabLeaseBusy(false);
    if (result === 'ok') {
      setLabLeaseLost(null);
      setHeartbeatEpoch((n) => n + 1);
      window.dispatchEvent(new Event(LAB_LEASE_RECLAIMED_EVENT));
    } else if (result === 'ended') {
      setLabLeaseLost('ended');
    }
  };

  /** Leave without ending: the session belongs to the other tab (or is already over). */
  const handleLeaveLostLab = (): void => {
    const dest = catalogPathForChallenge(activeChallenge?.id, activeChallenge?.sandboxType, activeChallenge?.tags);
    setLabLeaseLost(null);
    setPlayState('library');
    setActiveSession(null);
    setActiveChallenge(null);
    setEndResult(null);
    navigate(dest);
    void refreshChallenges();
  };

  const handleLogout = (): void => {
    signingOut = true;
    logout();
    setCurrentUser(null);
    setAuthMode('unauthenticated');
    setLoginOpen(false);
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (location.pathname === '/') signingOut = false;
  }, [location.pathname]);

  const handleUserUpdated = useCallback((user: UserRecord): void => {
    setCurrentUser(user);
  }, []);

  const handleLoggedIn = (user?: UserRecord | null): void => {
    setCurrentUser(user || getCurrentUser());
    setAuthMode('interviewer');
    setLoginOpen(false);
    // Google callback does a hard location.replace; OTP / other logins stay in-app.
    if (!window.location.pathname.startsWith('/auth/google/callback')) {
      navigate(takePostLoginPath() || '/track', { replace: true });
    }
  };

  useEffect(() => {
    if (authMode !== 'unauthenticated' && authMode !== 'resolving' && location.pathname === '/') {
      navigate('/track', { replace: true });
    }
  }, [authMode, location.pathname, navigate]);

  const appState = useMemo<AppState>(() => ({
    authMode,
    currentUser,
    playState,
    challenges,
    challengesError,
    startError,
    activeSession,
    activeChallenge,
    endResult,
    activeTab,
    setActiveTab,
    ending,
    onSelectChallenge: handleSelectChallenge,
    onOpenSparkPlayground: handleOpenSparkPlayground,
    onBackToLibrary: handleBackToLibrary,
    onEnd: handleEnd,
    onLogout: handleLogout,
    onUserUpdated: handleUserUpdated,
    onRequestLogin: requestLogin,
    refreshChallenges,
  }), [
    authMode,
    currentUser,
    playState,
    challenges,
    challengesError,
    startError,
    activeSession,
    activeChallenge,
    endResult,
    activeTab,
    ending,
  ]);

  const needsUsername =
    authMode === 'interviewer' && Boolean(currentUser) && !currentUser?.username;

  if (authMode === 'resolving') {
    return (
      <div className="login">
        <div><span className="spinner" /> Loading…</div>
      </div>
    );
  }

  return (
    <AppStateProvider value={appState}>
      <Routes>
        <Route
          path="/"
          element={
            authMode === 'unauthenticated'
              ? <LandingPage onSignIn={() => requestLogin()} onGetStarted={() => navigate('/track')} />
              : <Navigate to="/track" replace />
          }
        />
        <Route
          path="/auth/google/callback"
          element={<GoogleAuthCallbackPage onLoggedIn={handleLoggedIn} />}
        />
        <Route path="play/*" element={<LegacyPlayRedirect />} />
        <Route element={<AppLayout />}>
          <Route path="track" element={<PlayPage />} />
          <Route path="track/quiz/:quizId" element={<SignedInOnlyRoute><QuizPage /></SignedInOnlyRoute>} />
          <Route path="track/papers" element={<AdminOnlyRoute><WhitePapersPage /></AdminOnlyRoute>} />
          <Route path="track/papers/:sectionId" element={<AdminOnlyRoute><WhitePapersPage /></AdminOnlyRoute>} />
          <Route
            path="track/whiteboard"
            element={
              WHITEBOARD_ENABLED
                ? <AdminOnlyRoute><WhiteboardPage /></AdminOnlyRoute>
                : <Navigate to="/track" replace />
            }
          />
          <Route
            path="track/whiteboard/:sectionId"
            element={
              WHITEBOARD_ENABLED
                ? <AdminOnlyRoute><WhiteboardPage /></AdminOnlyRoute>
                : <Navigate to="/track" replace />
            }
          />
          <Route path="track/quests" element={<SideQuestsPage />} />
          <Route path="track/quests/:topicId" element={<SideQuestsPage />} />
          <Route path="track/playgrounds" element={<PlaygroundsPage />} />
          <Route path="majors" element={<ProjectsPage />} />
          <Route path="majors/:projectId" element={<ProjectsPage />} />
          <Route
            path="majors/:projectId/:moduleId"
            element={<SignedInOnlyRoute fallback={parentPath} unopened={majorUnopened}><ProjectModulePage /></SignedInOnlyRoute>}
          />
          <Route path="minors" element={<MinorsPage />} />
          <Route
            path="minors/:minorId"
            element={<SignedInOnlyRoute fallback={parentPath} unopened={minorUnopened}><MinorsPage /></SignedInOnlyRoute>}
          />
          <Route
            path="minors/:minorId/:chapterId"
            element={<SignedInOnlyRoute fallback={parentPath} unopened={minorUnopened}><MinorsPage /></SignedInOnlyRoute>}
          />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="monthly-paper" element={<MonthlyPaperPage />} />
          <Route path="leaderboard" element={<PlatformLeaderboardPage />} />
          <Route path="learners/:learnerId" element={<LearnerProfilePage />} />
          <Route path="track/spark-playground/open" element={<SparkPlaygroundOpenPage />} />
          <Route path="track/spark-playground" element={<SparkPlaygroundPage />} />
          <Route path="track/data-engineer/spark/intro" element={<SparkPrimerPage />} />
          <Route path="track/devops-engineer/kubernetes/intro" element={<K8sPrimerPage />} />
          <Route
            path="track/devops-engineer/read/:readingSlug"
            element={<K8sReadingPage trackId="devops" />}
          />
          <Route
            path="track/devops-engineer/kubernetes/read/:readingSlug"
            element={<K8sReadingPage />}
          />
          <Route
            path="track/devops-engineer/linux/read/:readingSlug"
            element={<K8sReadingPage trackId="linux" />}
          />
          <Route
            path="track/devops-engineer/docker/read/:readingSlug"
            element={<K8sReadingPage trackId="docker" />}
          />
          <Route path="track/:domainId/:panelId/leaderboard" element={<TrackLeaderboardPage />} />
          <Route path="track/:domainId" element={<PlayPage />} />
          <Route path="track/:domainId/:panelId" element={<PlayPage />} />
          <Route path="profile" element={<SignedInOnlyRoute><ProfilePage /></SignedInOnlyRoute>} />
          <Route path="feedback" element={<SignedInOnlyRoute prompt={FEEDBACK_SIGN_IN}><FeedbackPage /></SignedInOnlyRoute>} />
          <Route path="admin" element={<SignedInOnlyRoute><AdminPage /></SignedInOnlyRoute>} />
          <Route path="admin/users" element={<SignedInOnlyRoute><AdminUsersPage /></SignedInOnlyRoute>} />
          <Route path="admin/feedback" element={<SignedInOnlyRoute><AdminFeedbackPage /></SignedInOnlyRoute>} />
          <Route path="admin/waitlist" element={<SignedInOnlyRoute><AdminWaitlistPage /></SignedInOnlyRoute>} />
          {import.meta.env.DEV && (
            <Route path="dev/db" element={<SignedInOnlyRoute><DbExplorerPage /></SignedInOnlyRoute>} />
          )}
        </Route>
        <Route path="*" element={<Navigate to="/track" replace />} />
      </Routes>
      <LoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setLoginPrompt(null);
        }}
        onLoggedIn={handleLoggedIn}
        returnTo={loginReturnTo}
        prompt={loginPrompt}
      />
      <ConfirmDialog
        open={Boolean(labConflict)}
        title={
          labConflict?.conflict.code === 'LAB_OPEN_IN_OTHER_TAB'
            ? 'Lab already open in another tab'
            : 'You already have a lab open'
        }
        confirmLabel={
          labConflict?.conflict.code === 'LAB_OPEN_IN_OTHER_TAB' ? 'Use it here' : 'End it and open this'
        }
        cancelLabel="Cancel"
        onCancel={() => setLabConflict(null)}
        onConfirm={() => {
          if (labConflict) void handleSelectChallenge(labConflict.challenge, { force: true });
        }}
      >
        {labConflict?.conflict.code === 'LAB_OPEN_IN_OTHER_TAB' ? (
          <p>
            <strong>{labConflict.challenge.title}</strong> is already open in another tab or window.
            Continue here? The other tab will be disconnected.
          </p>
        ) : (
          <p>
            Only one lab can run at a time.{' '}
            {labConflict?.conflict.activeTitle ? (
              <>
                <strong>{labConflict.conflict.activeTitle}</strong> is still running.{' '}
              </>
            ) : null}
            End it and open <strong>{labConflict?.challenge.title}</strong>?
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(labLeaseLost)}
        title={labLeaseLost === 'ended' ? 'This lab session has ended' : 'Lab opened in another tab'}
        confirmLabel={labLeaseLost === 'ended' ? 'Back to labs' : 'Use it here'}
        cancelLabel={labLeaseLost === 'ended' ? 'Close' : 'Back to labs'}
        busy={labLeaseBusy}
        onCancel={handleLeaveLostLab}
        onConfirm={() => {
          if (labLeaseLost === 'ended') handleLeaveLostLab();
          else void handleUseLabHere();
        }}
      >
        {labLeaseLost === 'ended' ? (
          <p>This session was closed, most likely because another lab was started. Head back to the catalog to continue.</p>
        ) : (
          <p>This lab is now active in another tab or window. Only one tab can drive a lab at a time.</p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(leaveLabPrompt)}
        title="Leave this lab?"
        confirmLabel="Leave lab"
        cancelLabel="Stay"
        onCancel={() => setLeaveLabPrompt(null)}
        onConfirm={() => {
          const prompt = leaveLabPrompt;
          setLeaveLabPrompt(null);
          if (!prompt) return;
          dismissK8sLabToCatalog(prompt.session, prompt.dest);
        }}
      >
        <p>
          {activeChallenge?.sandboxType === 'kafka'
            ? 'Your cluster will be stopped. Topics you created in this lab are removed.'
            : isBoxChallenge(activeChallenge)
              ? 'Your machine will be stopped. All unsaved progress will be removed.'
              : 'You will leave this lab. Unsaved changes on the machine may be lost.'}
        </p>
      </ConfirmDialog>
      {needsUsername ? (
        <UsernameGate onSaved={(user) => setCurrentUser(user)} onLogout={handleLogout} />
      ) : null}
    </AppStateProvider>
  );
}
