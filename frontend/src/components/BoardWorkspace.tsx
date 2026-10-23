import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconSubmit } from './ChromeIcons';
import MarkdownProse from './MarkdownProse';
import {
  answerBoardFinale,
  checkBoardStep,
  fetchBoardState,
  fetchBoardSubmissions,
  judgeBoardClaims,
  saveBoardGraph,
  submitBoard,
  type BoardSubmissionRecord,
} from '../services/sessionApi';
import { SubmitReaction, type GradeModalPhase } from './SubmitReaction';
import type {
  ActiveSession,
  BoardGameState,
  BoardGradeResult,
  BoardState,
  ChallengeFull,
  ChallengePublic,
  PublicBoardPiece,
  PublicBoardSlot,
} from '../types/domain';

interface BoardWorkspaceProps {
  challenge: ChallengePublic | ChallengeFull | null | undefined;
  session: ActiveSession;
}

const EMPTY_PIECES: PublicBoardPiece[] = [];
const SLOT_W = 228;
const SLOT_H = 70;

function storyText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function boardStory(challenge: ChallengePublic | ChallengeFull | null | undefined): {
  overview: string;
  briefing: string;
  incident: string;
  yourTask: string;
  steps: string[];
  hints: string[];
  paperHref: string;
} {
  const ps = challenge?.problemStatement;
  const rec = ps && typeof ps === 'object' && !Array.isArray(ps)
    ? (ps as {
      overview?: unknown;
      briefing?: unknown;
      incident?: unknown;
      yourTask?: unknown;
      yourTaskSteps?: unknown;
      hints?: unknown;
      paperHref?: unknown;
    })
    : {};
  const steps = Array.isArray(rec.yourTaskSteps)
    ? rec.yourTaskSteps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  const hints = Array.isArray(rec.hints)
    ? rec.hints.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  return {
    overview: storyText(rec.overview),
    briefing: storyText(rec.briefing),
    incident: storyText(rec.incident),
    yourTask: storyText(rec.yourTask),
    steps,
    hints,
    paperHref: storyText(rec.paperHref),
  };
}

function slotAnchor(box: PublicBoardSlot, other: PublicBoardSlot): { x: number; y: number } {
  const cx = box.x + SLOT_W / 2;
  const cy = box.y + SLOT_H / 2;
  const ox = other.x + SLOT_W / 2;
  const oy = other.y + SLOT_H / 2;
  const dx = ox - cx;
  const dy = oy - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { x: box.x + SLOT_W, y: cy } : { x: box.x, y: cy };
  }
  return dy > 0 ? { x: cx, y: box.y + SLOT_H } : { x: cx, y: box.y };
}

function edgePath(a: PublicBoardSlot, b: PublicBoardSlot): string {
  const p1 = slotAnchor(a, b);
  const p2 = slotAnchor(b, a);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }
  const r = 14;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = p1.x + dx / 2;
    const dirY = dy >= 0 ? 1 : -1;
    const dirX = dx >= 0 ? 1 : -1;
    return [
      `M ${p1.x} ${p1.y}`,
      `L ${midX - dirX * r} ${p1.y}`,
      `Q ${midX} ${p1.y} ${midX} ${p1.y + dirY * r}`,
      `L ${midX} ${p2.y - dirY * r}`,
      `Q ${midX} ${p2.y} ${midX + dirX * r} ${p2.y}`,
      `L ${p2.x} ${p2.y}`,
    ].join(' ');
  }
  const midY = p1.y + dy / 2;
  const dirX = dx >= 0 ? 1 : -1;
  const dirY = dy >= 0 ? 1 : -1;
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p1.x} ${midY - dirY * r}`,
    `Q ${p1.x} ${midY} ${p1.x + dirX * r} ${midY}`,
    `L ${p2.x - dirX * r} ${midY}`,
    `Q ${p2.x} ${midY} ${p2.x} ${midY + dirY * r}`,
    `L ${p2.x} ${p2.y}`,
  ].join(' ');
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
    || (err as { message?: string })?.message
    || fallback;
}

function hitBoardDrop(clientX: number, clientY: number): { slotId: string | null; palette: boolean } {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const node of stack) {
    if (!(node instanceof Element) || node.closest('.board-drag-ghost')) continue;
    const slot = node.closest('.board-slot');
    if (slot instanceof HTMLElement && slot.dataset.slotId) {
      return { slotId: slot.dataset.slotId, palette: false };
    }
    if (node.closest('.board-palette') || node.closest('[data-board-return]')) {
      return { slotId: null, palette: true };
    }
  }
  return { slotId: null, palette: false };
}

export default function BoardWorkspace({
  challenge,
  session,
}: BoardWorkspaceProps): JSX.Element {
  const spec = challenge?.boardSpec;
  const pieces = spec?.pieces || EMPTY_PIECES;
  const slots = spec?.shadow?.slots || [];
  const shadowEdges = spec?.shadow?.edges || [];
  const byId = useMemo(() => {
    const map = new Map<string, PublicBoardPiece>();
    for (const p of pieces) map.set(p.id, p);
    return map;
  }, [pieces]);
  const slotById = useMemo(() => {
    const map = new Map<string, PublicBoardSlot>();
    for (const s of slots) map.set(s.id, s);
    return map;
  }, [slots]);
  const stepIndex = useMemo(() => {
    const map = new Map<string, number>();
    slots.filter((s) => !s.optional).forEach((s, i) => map.set(s.id, i + 1));
    return map;
  }, [slots]);
  const spine = useMemo(() => {
    const required = slots.filter((s) => !s.optional);
    if (required.length === 0) return null;
    const first = required[0];
    const last = required[required.length - 1];
    return {
      x: first.x - 18,
      y: first.y - 18,
      w: SLOT_W + 36,
      h: last.y + SLOT_H - first.y + 36,
    };
  }, [slots]);

  const [trayOrder, setTrayOrder] = useState<string[]>(() => pieces.map((p) => p.id));
  const [fills, setFills] = useState<Record<string, string | null>>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [grade, setGrade] = useState<BoardGradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 48, y: 20 });
  const [zoom, setZoom] = useState(0.82);
  const [dropSlot, setDropSlot] = useState<string | null>(null);
  const [dropPalette, setDropPalette] = useState(false);
  const [storyOpen, setStoryOpen] = useState(true);
  const [game, setGame] = useState<BoardGameState | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [showClaimResults, setShowClaimResults] = useState(false);
  const [finaleFeedback, setFinaleFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<BoardSubmissionRecord[]>([]);
  const [gradeModal, setGradeModal] = useState<GradeModalPhase | null>(null);
  const mode = spec?.game?.mode || 'classic';
  const finale = spec?.finale || null;
  const trayLabel = spec?.trayLabel || 'Unused';
  const requiredSlots = useMemo(() => slots.filter((s) => !s.optional), [slots]);
  const currentStepSlotId = mode === 'unlock' && game ? requiredSlots[game.step]?.id ?? null : null;
  const isRequiredSlot = (slotId: string): boolean => requiredSlots.some((s) => s.id === slotId);
  const gameOver = Boolean(game?.over);
  const claimsPending = mode === 'debate' && game != null && !game.claims;
  const [pieceDragPos, setPieceDragPos] = useState<{
    pieceId: string;
    fromSlotId: string;
    x: number;
    y: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const fillsRef = useRef(fills);
  fillsRef.current = fills;
  const panning = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const userZoomed = useRef(false);
  const pieceDrag = useRef<{
    pointerId: number;
    pieceId: string;
    fromSlotId: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const pieceDragListeners = useRef<{
    move: (ev: PointerEvent) => void;
    up: (ev: PointerEvent) => void;
  } | null>(null);
  const story = boardStory(challenge);
  const storyTabs = useMemo(() => {
    if (!story.briefing && !story.incident) return [];
    const tabs: Array<{ id: string; label: string; href?: string }> = [];
    if (story.briefing) tabs.push({ id: 'crawler', label: 'Crawler' });
    if (story.incident) tabs.push({ id: 'incident', label: 'Incident' });
    if (story.overview) tabs.push({ id: 'brief', label: 'Brief' });
    if (story.yourTask || story.steps.length > 0) tabs.push({ id: 'task', label: 'Task' });
    if (story.paperHref) tabs.push({ id: 'paper', label: 'Paper', href: story.paperHref });
    if (mode === 'unlock') tabs.push({ id: 'clues', label: 'Clues' });
    tabs.push({ id: 'submissions', label: 'Submissions' });
    return tabs;
  }, [story.briefing, story.incident, story.overview, story.yourTask, story.steps.length, story.paperHref, mode]);
  const [storyTab, setStoryTab] = useState('incident');
  const activeStoryTab = storyTabs.some((tab) => tab.id === storyTab)
    ? storyTab
    : (storyTabs.find((tab) => tab.id === 'incident')?.id || storyTabs[0]?.id || '');

  useEffect(() => {
    let live = true;
    fetchBoardSubmissions(session.id)
      .then((rows) => { if (live) setSubmissions(rows); })
      .catch(() => { if (live) setSubmissions([]); });
    return () => { live = false; };
  }, [session.id]);

  const world = useMemo(() => {
    const maxX = slots.reduce((m, s) => Math.max(m, s.x + SLOT_W), 640);
    const maxY = slots.reduce((m, s) => Math.max(m, s.y + SLOT_H), 320);
    return { w: maxX + 72, h: maxY + 48 };
  }, [slots]);

  const persist = useCallback((nextFills: Record<string, string | null>, reset = false) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const run = (): void => {
      void saveBoardGraph(session.id, { fills: nextFills, reset }).catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
            ?.error
          || (err as { message?: string })?.message
          || 'Save failed';
        setSaveError(msg);
      });
    };
    if (reset) {
      run();
      return;
    }
    saveTimer.current = window.setTimeout(run, 400);
  }, [session.id]);

  const applyServerState = (state: BoardState | null | undefined): void => {
    if (!state) return;
    if (state.fills) setFills(state.fills);
    if (state.trayOrder?.length) setTrayOrder(state.trayOrder);
    setGame(state.game ?? null);
  };

  const applyFills = useCallback((nextFills: Record<string, string | null>, reset = false) => {
    setFills(nextFills);
    setSaveError(null);
    persist(nextFills, reset);
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    void fetchBoardState(session.id)
      .then((res) => {
        if (cancelled) return;
        const state = res.boardState;
        if (state?.trayOrder?.length) setTrayOrder(state.trayOrder);
        else setTrayOrder(pieces.map((p) => p.id));
        setFills(state?.fills && typeof state.fills === 'object' ? state.fills : {});
        setGrade(state?.lastGrade ?? null);
        setGame(state?.game ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
            ?.error
          || (err as { message?: string })?.message
          || 'Failed to load board';
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, pieces]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || slots.length === 0) return;
    const fit = (): void => {
      if (userZoomed.current) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 40 || h < 40) return;
      const next = Math.min(1, Math.max(0.55, Math.min((w - 56) / world.w, (h - 36) / world.h)));
      if (Number.isFinite(next)) {
        setZoom(next);
        setPan({
          x: Math.max(24, Math.round((w - world.w * next) / 2)),
          y: 20,
        });
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [world.w, world.h, slots.length]);

  useEffect(() => () => {
    const listeners = pieceDragListeners.current;
    if (listeners) {
      window.removeEventListener('pointermove', listeners.move);
      window.removeEventListener('pointerup', listeners.up);
      window.removeEventListener('pointercancel', listeners.up);
    }
  }, []);

  const usedIds = useMemo(() => {
    const set = new Set<string>();
    for (const id of Object.values(fills)) {
      if (id) set.add(id);
    }
    return set;
  }, [fills]);

  const trayPieces = trayOrder
    .map((id) => byId.get(id))
    .filter((p): p is PublicBoardPiece => p != null && !usedIds.has(p.id));

  const selectedSlot = selectedSlotId ? slotById.get(selectedSlotId) || null : null;
  const selectedFillId = selectedSlotId ? fills[selectedSlotId] || null : null;
  const selectedPiece = selectedFillId
    ? byId.get(selectedFillId) || null
    : selectedPieceId && !usedIds.has(selectedPieceId)
      ? byId.get(selectedPieceId) || null
      : null;

  const lockedStep = (slotId: string): boolean => mode === 'unlock' && isRequiredSlot(slotId);

  const checkStep = async (slotId: string, pieceId: string): Promise<void> => {
    if (slotId !== currentStepSlotId) {
      setFlash({ ok: false, text: 'That step is still locked. Fill the highlighted step first.' });
      return;
    }
    setBusy(true);
    try {
      const res = await checkBoardStep(session.id, { slotId, pieceId });
      applyServerState(res.boardState);
      if (res.grade) setGrade(res.grade);
      setFlash(
        res.correct
          ? { ok: true, text: res.clue ? `Locked in. New clue: ${res.clue}` : 'Locked in.' }
          : { ok: false, text: res.detail },
      );
      setSelectedPieceId(null);
    } catch (err: unknown) {
      setFlash({ ok: false, text: errorMessage(err, 'Check failed') });
    } finally {
      setBusy(false);
    }
  };

  const fillSlot = (slotId: string, pieceId: string): void => {
    if (!slotById.has(slotId) || !byId.has(pieceId)) return;
    if (gameOver || busy) return;
    if (lockedStep(slotId)) {
      if (!fillsRef.current[slotId]) void checkStep(slotId, pieceId);
      return;
    }
    const next: Record<string, string | null> = { ...fillsRef.current };
    for (const [sid, pid] of Object.entries(next)) {
      if (pid === pieceId) next[sid] = null;
    }
    next[slotId] = pieceId;
    applyFills(next);
    setSelectedSlotId(slotId);
    setSelectedPieceId(null);
  };

  const clearSlot = (slotId: string): void => {
    if (lockedStep(slotId) || gameOver) return;
    applyFills({ ...fillsRef.current, [slotId]: null });
    if (selectedSlotId === slotId) setSelectedPieceId(null);
  };

  const returnPiece = (pieceId: string): void => {
    const next: Record<string, string | null> = { ...fillsRef.current };
    let changed = false;
    for (const [sid, pid] of Object.entries(next)) {
      if (pid === pieceId && !lockedStep(sid)) {
        next[sid] = null;
        changed = true;
      }
    }
    if (!changed || gameOver) return;
    applyFills(next);
    setSelectedPieceId(pieceId);
    setSelectedSlotId(null);
  };

  const resetBoard = (): void => {
    if (!window.confirm('Reset the board? Every card goes back to Unused.')) {
      return;
    }
    const empty: Record<string, string | null> = {};
    for (const slot of slots) empty[slot.id] = null;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setFills(empty);
    setTrayOrder(pieces.map((p) => p.id));
    setGrade(null);
    setSelectedSlotId(null);
    setSelectedPieceId(null);
    setDropSlot(null);
    setDropPalette(false);
    setFlash(null);
    setVerdicts({});
    setShowClaimResults(false);
    setFinaleFeedback(null);
    void saveBoardGraph(session.id, { fills: empty, reset: true })
      .then((state) => applyServerState(state))
      .catch((err: unknown) => setSaveError(errorMessage(err, 'Reset failed')));
  };

  const submitClaims = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await judgeBoardClaims(session.id, verdicts);
      applyServerState(res.boardState);
      setShowClaimResults(true);
    } catch (err: unknown) {
      setFlash({ ok: false, text: errorMessage(err, 'Could not judge the claims') });
    } finally {
      setBusy(false);
    }
  };

  const submitFinale = async (optionId: string): Promise<void> => {
    setBusy(true);
    try {
      const res = await answerBoardFinale(session.id, optionId);
      applyServerState(res.boardState);
      setGrade(res.grade);
      setFinaleFeedback({ ok: res.correct, text: res.explanation });
    } catch (err: unknown) {
      setFinaleFeedback({ ok: false, text: errorMessage(err, 'Could not check the answer') });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setSaveError(null);
    setGradeModal('grading');
    const started = Date.now();
    try {
      const res = await submitBoard(session.id, { fills: fillsRef.current });
      setGrade(res.grade);
      applyServerState(res.boardState);
      const rows = await fetchBoardSubmissions(session.id).catch(() => null);
      if (rows) setSubmissions(rows);
      const wait = 900 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
      setGradeModal(res.grade.passed ? 'pass' : 'fail');
    } catch (err: unknown) {
      setGradeModal(null);
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error
        || (err as { message?: string })?.message
        || 'Submit failed';
      setSaveError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const slotClass = (slot: PublicBoardSlot): string => {
    const filled = Boolean(fills[slot.id]);
    const parts = ['board-slot', filled ? 'is-filled' : 'is-empty'];
    if (slot.optional) parts.push('is-optional');
    if (selectedSlotId === slot.id) parts.push('is-selected');
    if (dropSlot === slot.id) parts.push('is-drop');
    if (pieceDragPos && fills[slot.id] === pieceDragPos.pieceId) parts.push('is-dragging');
    if (mode === 'unlock' && !slot.optional) {
      if (slot.id === currentStepSlotId) parts.push('is-current');
      else if (!filled) parts.push('is-locked');
      else parts.push('is-ok');
    }
    return parts.join(' ');
  };

  const onCanvasPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.board-slot')) return;
    setSelectedSlotId(null);
    panning.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCanvasPointerMove = (e: React.PointerEvent): void => {
    if (!panning.current) return;
    setPan({
      x: panning.current.x + (e.clientX - panning.current.px),
      y: panning.current.y + (e.clientY - panning.current.py),
    });
  };

  const onCanvasPointerUp = (): void => {
    panning.current = null;
  };

  const tryPlaceSelected = (slotId: string): void => {
    if (selectedPieceId && !usedIds.has(selectedPieceId)) {
      fillSlot(slotId, selectedPieceId);
      return;
    }
    setSelectedSlotId(slotId);
  };

  const onFilledPointerDown = (
    e: React.PointerEvent,
    slot: PublicBoardSlot,
    piece: PublicBoardPiece,
  ): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (lockedStep(slot.id) || gameOver) {
      setSelectedSlotId(slot.id);
      return;
    }
    const drag = {
      pointerId: e.pointerId,
      pieceId: piece.id,
      fromSlotId: slot.id,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
    pieceDrag.current = drag;

    const onMove = (ev: PointerEvent): void => {
      if (ev.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 8) return;
        drag.active = true;
      }
      ev.preventDefault();
      setPieceDragPos({
        pieceId: drag.pieceId,
        fromSlotId: drag.fromSlotId,
        x: ev.clientX,
        y: ev.clientY,
      });
      const hit = hitBoardDrop(ev.clientX, ev.clientY);
      setDropSlot(hit.slotId);
      setDropPalette(hit.palette);
    };
    const onUp = (ev: PointerEvent): void => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      pieceDragListeners.current = null;
      const wasActive = drag.active;
      pieceDrag.current = null;
      setPieceDragPos(null);
      setDropSlot(null);
      setDropPalette(false);
      if (!wasActive) {
        tryPlaceSelected(slot.id);
        return;
      }
      const hit = hitBoardDrop(ev.clientX, ev.clientY);
      if (hit.slotId) fillSlot(hit.slotId, drag.pieceId);
      else if (hit.palette) returnPiece(drag.pieceId);
    };
    pieceDragListeners.current = { move: onMove, up: onUp };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const dragGhostPiece = pieceDragPos ? byId.get(pieceDragPos.pieceId) : null;

  return (
    <div className="workspace board-workspace">
      <header className="board-top">
        <div className="board-top-copy">
          {spec?.kicker && <p className="board-kicker">{spec.kicker}</p>}
          <h1 className="board-title">{challenge?.title || 'Board'}</h1>
        </div>
        <div className="board-top-actions">
          {saveError && <span className="board-save-error">{saveError}</span>}
          {grade?.passed && grade.stars != null && (
            <span className="board-stars" title={`${grade.stars} of 3 stars`}>
              {'★'.repeat(grade.stars)}{'☆'.repeat(3 - grade.stars)}
            </span>
          )}
          {mode === 'unlock' && game && !grade?.boardPassed && (
            <span className="board-score">
              Step {Math.min(game.step + 1, requiredSlots.length)} of {requiredSlots.length}
            </span>
          )}
          <button
            type="button"
            className="board-reset-btn"
            title="Reset to an empty board"
            onClick={resetBoard}
            disabled={submitting || (usedIds.size === 0 && !grade && !game?.claims && !gameOver)}
          >
            Reset
          </button>
          {mode !== 'unlock' && !claimsPending && (
            <button
              type="button"
              className="board-submit-btn"
              onClick={() => void handleSubmit()}
              disabled={submitting || gameOver}
            >
              <IconSubmit color="currentColor" />
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          )}
        </div>
      </header>

      {loadError && <div className="alert">{loadError}</div>}

      {gameOver && (
        <div className="board-flash bad">
          <strong>Out of lives.</strong> Reset the board to try again. A reset caps this board at one star.
        </div>
      )}
      {!gameOver && flash && (
        <div className={`board-flash${flash.ok ? ' ok' : ' bad'}`}>
          <span>{flash.text}</span>
          <button type="button" className="board-place-btn" onClick={() => setFlash(null)}>Dismiss</button>
        </div>
      )}

      {finale && grade?.needsFinale && !gameOver && (
        <section className="board-finale" aria-label="Final question">
          <h2>{finale.prompt}</h2>
          <div className="board-finale-options">
            {finale.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="board-finale-btn"
                disabled={busy}
                onClick={() => void submitFinale(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {finaleFeedback && !finaleFeedback.ok && (
            <p className="board-finale-feedback">{finaleFeedback.text}</p>
          )}
        </section>
      )}

      <div className={`board-body${storyOpen ? '' : ' board-body--story-closed'}`}>
        <div className={`board-story-rail${storyOpen ? '' : ' is-collapsed'}`}>
          {storyOpen ? (
            <section className="board-story" aria-label="Story">
              {storyTabs.length > 0 ? (
                <div className="board-story-tabs" role="tablist" aria-label="Story sections">
                  {storyTabs.map((tab) => (
                    tab.href ? (
                      <a
                        key={tab.id}
                        className="board-story-tab"
                        href={tab.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {tab.label}
                        <span aria-hidden> ↗</span>
                      </a>
                    ) : (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`board-story-tab-${tab.id}`}
                      className={`board-story-tab${activeStoryTab === tab.id ? ' is-on' : ''}`}
                      aria-selected={activeStoryTab === tab.id}
                      onClick={() => setStoryTab(tab.id)}
                        >
                          {tab.label}
                          {tab.id === 'submissions' && submissions.length > 0 && (
                            <span className="board-story-tab-count">{submissions.length}</span>
                          )}
                        </button>
                    )
                  ))}
                </div>
              ) : (
                <header className="board-rail-head">
                  <h2>Story</h2>
                  <button
                    type="button"
                    className="board-place-btn"
                    onClick={() => setStoryOpen(false)}
                  >
                    Hide
                  </button>
                </header>
              )}
              <div className="board-story-body">
                {storyTabs.length > 0 ? (
                  <div
                    className="board-story-tabpanel"
                    role="tabpanel"
                    aria-labelledby={`board-story-tab-${activeStoryTab}`}
                  >
                      {activeStoryTab === 'crawler' && (
                        <MarkdownProse text={story.briefing} className="markdown-prose board-story-prose" />
                      )}
                      {activeStoryTab === 'incident' && (
                        <div className="board-story-incident">
                          <MarkdownProse text={story.incident} className="markdown-prose board-story-prose" />
                        </div>
                      )}
                      {activeStoryTab === 'brief' && (
                        <MarkdownProse text={story.overview} className="markdown-prose board-story-prose" />
                      )}
                      {activeStoryTab === 'task' && (
                        <section className="board-story-task">
                          {story.yourTask && <p>{story.yourTask}</p>}
                          {story.steps.length > 0 && (
                            <ol>
                              {story.steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          )}
                        </section>
                      )}
                      {activeStoryTab === 'submissions' && (
                        <div className="k8s-submission-table board-submission-table">
                          {submissions.length === 0 ? (
                            <p className="k8s-submission-empty">
                              No submissions yet. Submit grades the board. The verdict is Accepted or Wrong Answer.
                            </p>
                          ) : (
                            <>
                              <div className="k8s-submission-head">
                                <span>#</span>
                                <span>ID</span>
                                <span>Verdict</span>
                                <span>Submitted</span>
                              </div>
                              {submissions.map((sub, index) => {
                                const attempt = submissions.length - index;
                                const when = sub.submittedAt
                                  ? new Date(sub.submittedAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                  : '';
                                const verdict = sub.passed ? 'Accepted' : 'Wrong Answer';
                                return (
                                  <div
                                    key={sub.id}
                                    className={`k8s-submission-row${sub.passed ? ' is-pass' : ' is-fail'}`}
                                  >
                                    <span className="k8s-submission-num">{attempt}</span>
                                    <span className="k8s-submission-sid" title={sub.id}>
                                      {sub.id.replace(/-/g, '').slice(0, 8)}
                                    </span>
                                    <span className="k8s-submission-verdict">{verdict}</span>
                                    <span className="k8s-submission-time">{when}</span>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                      {activeStoryTab === 'clues' && (
                        <section className="board-story-clues">
                          <h3>Clues found · {game?.clues.length ?? 0}</h3>
                          {game && game.clues.length > 0 ? (
                            <ol>
                              {game.clues.map((clue) => (
                                <li key={clue}>{clue}</li>
                              ))}
                            </ol>
                          ) : (
                            <p>Lock in the first step to get your first clue.</p>
                          )}
                        </section>
                      )}
                  </div>
                ) : (
                  <>
                    {story.overview && (
                      <MarkdownProse text={story.overview} className="markdown-prose board-story-prose" />
                    )}
                    {mode === 'unlock' && (
                      <section className="board-story-clues">
                        <h3>Clues found · {game?.clues.length ?? 0}</h3>
                        {game && game.clues.length > 0 ? (
                          <ol>
                            {game.clues.map((clue) => (
                              <li key={clue}>{clue}</li>
                            ))}
                          </ol>
                        ) : (
                          <p>Lock in the first step to get your first clue.</p>
                        )}
                      </section>
                    )}
                    {(story.yourTask || story.steps.length > 0) && (
                      <section className="board-story-task">
                        <h3>Your task</h3>
                        {story.yourTask && <p>{story.yourTask}</p>}
                        {story.steps.length > 0 && (
                          <ol>
                            {story.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        )}
                      </section>
                    )}
                    {story.hints.length > 0 && (
                      <details className="board-story-hints">
                        <summary>Hints</summary>
                        <ul>
                          {story.hints.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>
            </section>
          ) : (
            <button
              type="button"
              className="board-story-reopen"
              onClick={() => setStoryOpen(true)}
            >
              Story
            </button>
          )}
        </div>

        {(claimsPending || showClaimResults) && (
          <section className="board-claims" aria-label="Claims">
            <header className="board-claims-head">
              <h2>{claimsPending ? 'Who’s right?' : 'How did you call it?'}</h2>
              <p>
                {claimsPending
                  ? `Mark every claim True or False before you touch the board.${game?.livesMax != null ? ' Each wrong call costs a life.' : ''}`
                  : 'False claims are off the table. Build the board from the true ones.'}
              </p>
            </header>
            <ul className="board-claims-list">
              {[...pieces]
                .sort((a, b) => trayOrder.indexOf(a.id) - trayOrder.indexOf(b.id))
                .map((p) => {
                  const result = game?.claims?.[p.id];
                  const verdict = result ? result.verdict : verdicts[p.id];
                  return (
                    <li
                      key={p.id}
                      className={`board-claim${result ? (result.correct ? ' is-right' : ' is-wrong') : ''}`}
                    >
                      <div className="board-claim-copy">
                        {p.speaker && <span className="board-claim-speaker">{p.speaker}</span>}
                        <strong>“{p.title}”</strong>
                        <p>{p.blurb}</p>
                        {result && (
                          <p className="board-claim-verdict">
                            {result.correct ? 'You called it. ' : 'Missed. '}
                            {result.explanation ? `False: ${result.explanation}` : 'True: this belongs on the board.'}
                          </p>
                        )}
                      </div>
                      <div className="board-claim-actions">
                        {[true, false].map((v) => (
                          <button
                            key={String(v)}
                            type="button"
                            className={`board-claim-btn${verdict === v ? ' is-on' : ''}`}
                            disabled={Boolean(result) || busy}
                            onClick={() => setVerdicts((cur) => ({ ...cur, [p.id]: v }))}
                          >
                            {v ? 'True' : 'False'}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
            </ul>
            <footer className="board-claims-foot">
              {claimsPending ? (
                <button
                  type="button"
                  className="board-submit-btn"
                  disabled={busy || gameOver || Object.keys(verdicts).length < pieces.length}
                  onClick={() => void submitClaims()}
                >
                  Submit verdicts ({Object.keys(verdicts).length}/{pieces.length})
                </button>
              ) : (
                <button type="button" className="board-submit-btn" onClick={() => setShowClaimResults(false)}>
                  Go to the whiteboard →
                </button>
              )}
            </footer>
          </section>
        )}

        <div
          ref={canvasRef}
          className="board-canvas"
          style={claimsPending || showClaimResults ? { display: 'none' } : undefined}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onWheel={(e) => {
            e.preventDefault();
            userZoomed.current = true;
            const next = Math.min(1.6, Math.max(0.45, zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
            setZoom(next);
          }}
          role="application"
          aria-label="Board"
        >
          <div
            className="board-world"
            style={{
              width: world.w,
              height: world.h,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <svg className="board-edges" width={world.w} height={world.h} aria-hidden>
              <defs>
                <marker
                  id="board-arrow"
                  viewBox="0 0 10 8"
                  refX="9"
                  refY="4"
                  markerWidth="8"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(52, 211, 153, 0.55)" />
                </marker>
                <marker
                  id="board-arrow-optional"
                  viewBox="0 0 10 8"
                  refX="9"
                  refY="4"
                  markerWidth="8"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(251, 191, 36, 0.7)" />
                </marker>
              </defs>
              {spine && (
                <rect
                  className="board-spine"
                  x={spine.x}
                  y={spine.y}
                  width={spine.w}
                  height={spine.h}
                  rx="18"
                />
              )}
              {shadowEdges.map((e) => {
                const a = slotById.get(e.from);
                const b = slotById.get(e.to);
                if (!a || !b) return null;
                const optional = a.optional || b.optional;
                return (
                  <path
                    key={`${e.from}-${e.to}`}
                    className={`board-edge${optional ? ' is-optional' : ' is-shadow'}`}
                    d={edgePath(a, b)}
                    markerEnd={optional ? 'url(#board-arrow-optional)' : 'url(#board-arrow)'}
                  />
                );
              })}
            </svg>
            {slots.map((slot) => {
              const pieceId = fills[slot.id];
              const piece = pieceId ? byId.get(pieceId) : null;
              const step = stepIndex.get(slot.id);
              return (
                <div
                  key={slot.id}
                  className={slotClass(slot)}
                  data-kind={piece?.kind}
                  data-slot-id={slot.id}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    piece
                      ? piece.title
                      : slot.optional
                        ? 'Optional empty block'
                        : `Step ${step ?? ''} empty block`
                  }
                  style={{ left: slot.x, top: slot.y, width: SLOT_W, height: SLOT_H }}
                  onPointerDown={(e) => {
                    if (piece) onFilledPointerDown(e, slot, piece);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropSlot(slot.id);
                  }}
                  onDragLeave={() => setDropSlot((cur) => (cur === slot.id ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropSlot(null);
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) fillSlot(slot.id, id);
                  }}
                  onClick={() => {
                    if (pieceDrag.current?.active) return;
                    if (!piece) tryPlaceSelected(slot.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      tryPlaceSelected(slot.id);
                    }
                  }}
                >
                  <span className="board-slot-index">
                    {slot.optional ? 'opt' : step}
                  </span>
                  {piece ? (
                    <>
                      <span className="board-node-kind">{slot.prompt || piece.kind}</span>
                      <span className="board-node-title">{piece.title}</span>
                    </>
                  ) : (
                    <>
                      <span className="board-slot-kicker">
                        {slot.optional ? 'Optional' : `Step ${step}`}
                      </span>
                      <span className="board-slot-label">{slot.prompt || 'Drop a card'}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className={`board-side${dropPalette ? ' is-drop' : ''}`} aria-label="Widgets" data-board-return>
          <div className="board-inspector">
            <header className="board-rail-head">
              <h2>
                {selectedSlot && selectedFillId ? 'Block' : selectedPiece ? 'Card' : 'Board'}
              </h2>
            </header>
            {selectedSlot && selectedPiece && selectedFillId ? (
              <>
                <p className="board-node-kind" data-kind={selectedPiece.kind}>{selectedPiece.kind}</p>
                <h3 className="board-inspector-title">{selectedPiece.title}</h3>
                <p className="board-inspector-blurb">{selectedPiece.blurb}</p>
                <div className="board-inspector-places">
                  <button
                    type="button"
                    className="board-place-btn board-place-btn--off"
                    onClick={() => clearSlot(selectedSlot.id)}
                  >
                    Return to unused
                  </button>
                </div>
              </>
            ) : selectedSlot && !selectedFillId ? (
              <>
                {selectedSlot.prompt && (
                  <h3 className="board-inspector-title">{selectedSlot.prompt}</h3>
                )}
                <p className="board-rail-hint">
                  {selectedSlot.optional
                    ? 'Optional step — fill it from Unused, or leave it empty.'
                    : 'Empty step on the board. Drop a card here from Unused.'}
                </p>
              </>
            ) : selectedPiece ? (
              <>
                <p className="board-node-kind" data-kind={selectedPiece.kind}>{selectedPiece.kind}</p>
                <h3 className="board-inspector-title">{selectedPiece.title}</h3>
                <p className="board-inspector-blurb">{selectedPiece.blurb}</p>
                <p className="board-rail-hint">Click an empty step to place this card.</p>
              </>
            ) : (
              <p className="board-rail-hint">
                Fill each numbered step from Unused. The dashed block is optional.
              </p>
            )}
          </div>
          <aside
            className={`board-palette${dropPalette ? ' is-drop' : ''}`}
            aria-label="Unused cards"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropPalette(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDropPalette(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDropPalette(false);
              const id = e.dataTransfer.getData('text/plain');
              if (id) returnPiece(id);
            }}
          >
            <header className="board-rail-head">
              <h2>{trayLabel}</h2>
              <span>{trayPieces.length}</span>
            </header>
            <p className="board-rail-hint">
              Drag onto a step. Drag a placed card back here to remove it.
            </p>
            <div className="board-palette-list">
              {trayPieces.length === 0 && (
                <p className="board-empty">Every card is on the board.</p>
              )}
              {trayPieces.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`board-chip${selectedPieceId === p.id ? ' is-selected' : ''}`}
                  data-kind={p.kind}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', p.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setSelectedPieceId(p.id);
                  }}
                  onClick={() => {
                    if (selectedSlotId && !fills[selectedSlotId]) {
                      fillSlot(selectedSlotId, p.id);
                      return;
                    }
                    setSelectedPieceId(p.id);
                    setSelectedSlotId(null);
                  }}
                  title={p.blurb}
                >
                  <span className="board-node-kind">{p.kind}</span>
                  <span className="board-chip-title">{p.title}</span>
                </button>
              ))}
            </div>
          </aside>
        </aside>
      </div>
      {dragGhostPiece && pieceDragPos && (
        <div
          className="board-drag-ghost"
          data-kind={dragGhostPiece.kind}
          style={{ left: pieceDragPos.x, top: pieceDragPos.y }}
          aria-hidden
        >
          <span className="board-node-kind">{dragGhostPiece.kind}</span>
          <span className="board-chip-title">{dragGhostPiece.title}</span>
        </div>
      )}
      {gradeModal && (
        <SubmitReaction phase={gradeModal} onClose={() => setGradeModal(null)} />
      )}
    </div>
  );
}

export function isBoardChallenge(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): boolean {
  return (challenge?.sandboxType || '') === 'board';
}
