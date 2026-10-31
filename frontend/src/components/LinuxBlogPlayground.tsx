import React, { useEffect, useMemo, useRef, useState } from 'react';
import TerminalPanel from './TerminalPanel';
import ConfirmDialog from './ConfirmDialog';
import { LINUX_BLOG_PLAYGROUND_ID } from '../constants/linuxPlayground';
import { fetchK8sAvailability, startK8sSession } from '../services/workspaceApi';
import { endSession } from '../services/sessionApi';
import {
  LAB_HEARTBEAT_MS,
  labConflictFromError,
  sendLabHeartbeat,
  withLabClientId,
  type LabConflict,
} from '../services/labTabLease';

interface LinuxBlogPlaygroundProps {
  onClose: () => void;
  /** Paid-track check failed. The parent sends the reader to pricing. */
  onSubscribe: () => void;
}

type Phase = 'starting' | 'ready' | 'error' | 'taken' | 'ended';

function k8sTerminalWsUrl(sessionId: string, terminalWsUrl: string | null): string {
  if (terminalWsUrl) return withLabClientId(terminalWsUrl);
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return withLabClientId(`${proto}://${window.location.host}/ws/k8s-terminal?sessionId=${sessionId}`);
}

function errorText(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err.response?.data?.error || err.message || fallback;
}

function isSubscriptionLocked(e: unknown): boolean {
  const err = e as { response?: { status?: number; data?: { code?: string } } };
  return err.response?.status === 402 || err.response?.data?.code === 'LAB_LOCKED';
}

/** Latest open wins. A superseded start must not end the machine the new one is using. */
let playgroundLiveToken = 0;
let playgroundStart: Promise<Awaited<ReturnType<typeof startK8sSession>>> | null = null;

function startPlayground(force: boolean): Promise<Awaited<ReturnType<typeof startK8sSession>>> {
  if (!force && playgroundStart) return playgroundStart;
  let run: Promise<Awaited<ReturnType<typeof startK8sSession>>>;
  run = startK8sSession(LINUX_BLOG_PLAYGROUND_ID, { force }).finally(() => {
    if (playgroundStart === run) playgroundStart = null;
  });
  playgroundStart = run;
  return run;
}

export default function LinuxBlogPlayground({ onClose, onSubscribe }: LinuxBlogPlaygroundProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('starting');
  const [status, setStatus] = useState('Starting your Linux machine…');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<LabConflict | null>(null);
  const [wsUrl, setWsUrl] = useState('');
  const [attempt, setAttempt] = useState(0);
  const forceRef = useRef(false);
  const ownsSession = useRef(true);
  const sessionIdRef = useRef<string | null>(null);
  const onSubscribeRef = useRef(onSubscribe);
  onSubscribeRef.current = onSubscribe;

  const terminalUrl = useMemo(() => (phase === 'ready' && wsUrl ? wsUrl : ''), [phase, wsUrl]);

  useEffect(() => {
    const token = ++playgroundLiveToken;
    let cancelled = false;
    ownsSession.current = true;
    const held = { id: null as string | null };
    const force = forceRef.current;
    forceRef.current = false;
    setPhase('starting');
    setError(null);
    setStatus(force ? 'Ending the other lab and starting the playground…' : 'Starting your Linux machine…');

    const stopIfStillOurs = (id: string): void => {
      if (token !== playgroundLiveToken || !ownsSession.current) return;
      playgroundLiveToken = 0;
      void endSession(id).catch(() => undefined);
    };

    const start = async (): Promise<void> => {
      try {
        const availability = await fetchK8sAvailability(LINUX_BLOG_PLAYGROUND_ID).catch(() => ({
          available: false,
          message: 'The Linux machines are unavailable right now.',
        }));
        if (cancelled || token !== playgroundLiveToken) return;
        if (!availability.available) {
          setPhase('error');
          setStatus('Unavailable');
          setError(availability.message || 'The Linux machines are unavailable right now.');
          return;
        }
        const res = await startPlayground(force);
        if (token !== playgroundLiveToken) return;
        if (cancelled) {
          stopIfStillOurs(res.sessionId);
          return;
        }
        held.id = res.sessionId;
        sessionIdRef.current = res.sessionId;
        setWsUrl(k8sTerminalWsUrl(res.sessionId, res.terminalWsUrl ?? null));
        setPhase('ready');
        setStatus('Ready');
      } catch (e) {
        if (cancelled || token !== playgroundLiveToken) return;
        const hit = labConflictFromError(e);
        if (hit) {
          setConflict(hit);
          setPhase('error');
          setStatus('Waiting');
          return;
        }
        if (isSubscriptionLocked(e)) {
          onSubscribeRef.current();
          return;
        }
        setPhase('error');
        setStatus('Unavailable');
        setError(errorText(e, 'Could not open the playground.'));
      }
    };
    void start();

    const onHide = (): void => {
      const id = held.id;
      if (!id || !ownsSession.current || token !== playgroundLiveToken) return;
      try {
        navigator.sendBeacon(`/api/session/${id}/end`, new Blob(['{}'], { type: 'application/json' }));
      } catch {
        /* the unmount path still ends it */
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onHide);
      const id = held.id;
      held.id = null;
      if (sessionIdRef.current === id) sessionIdRef.current = null;
      if (id) stopIfStillOurs(id);
    };
  }, [attempt]);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || phase !== 'ready') return undefined;
    let cancelled = false;
    const beat = async (): Promise<void> => {
      const result = await sendLabHeartbeat(sessionId);
      if (cancelled) return;
      if (result === 'taken') {
        ownsSession.current = false;
        setStatus('Open elsewhere');
        setPhase('taken');
        return;
      }
      if (result === 'idle' || result === 'ended') {
        setStatus('Stopped');
        setPhase('ended');
        return;
      }
      if (document.visibilityState === 'visible') {
        // A plain read counts as activity, so reading the blog keeps the machine up.
        void fetch(`/api/session/${sessionId}`).catch(() => undefined);
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), LAB_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, wsUrl]);

  const retry = (force: boolean): void => {
    forceRef.current = force;
    setConflict(null);
    setAttempt((n) => n + 1);
  };

  return (
    <section className="linux-blog-playground" aria-label="Linux playground">
      <header className="linux-blog-playground-bar">
        <div className="linux-blog-playground-title">
          <span className={`linux-blog-playground-dot${phase === 'ready' ? ' is-ready' : ''}`} aria-hidden />
          <strong>Playground</strong>
          <span className="linux-blog-playground-status">{status}</span>
        </div>
        <button type="button" className="ghost sm" onClick={onClose}>
          Close
        </button>
      </header>

      {phase === 'ready' ? (
        <div className="linux-blog-playground-term">
          <div className="linux-blog-playground-term-host">
            {terminalUrl ? (
              <TerminalPanel wsUrl={terminalUrl} isActive resizeProtocol />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="linux-blog-playground-message" role="status">
          {phase === 'starting' ? (
            <>
              <span className="spinner" aria-hidden />
              <p>{status}</p>
              <p className="linux-blog-playground-hint">A fresh machine usually takes under a minute.</p>
            </>
          ) : null}
          {phase === 'error' && !conflict ? (
            <>
              <p>{error || 'Could not open the playground.'}</p>
              <button type="button" className="sm" onClick={() => retry(false)}>Try again</button>
            </>
          ) : null}
          {phase === 'taken' ? (
            <>
              <p>This playground is open in another tab. Close it there, or open it in this one.</p>
              <button type="button" className="sm" onClick={() => retry(true)}>Open here</button>
            </>
          ) : null}
          {phase === 'ended' ? (
            <>
              <p>The playground stopped. Open it again when you want the machine back.</p>
              <button type="button" className="sm" onClick={() => retry(false)}>Open again</button>
            </>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(conflict)}
        title={conflict?.code === 'LAB_OPEN_IN_OTHER_TAB' ? 'Playground is open elsewhere' : 'A lab is still open'}
        confirmLabel={conflict?.code === 'LAB_OPEN_IN_OTHER_TAB' ? 'Use it here' : 'End it and open'}
        cancelLabel="Not now"
        onCancel={() => {
          setConflict(null);
          onClose();
        }}
        onConfirm={() => retry(true)}
      >
        {conflict?.code === 'LAB_OPEN_IN_OTHER_TAB' ? (
          <p>The playground is already open in another tab. Open it in this one instead?</p>
        ) : (
          <p>
            {conflict?.activeTitle ? <strong>{conflict.activeTitle}</strong> : 'Another lab'} is still running.
            End it and open the playground beside this blog?
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
