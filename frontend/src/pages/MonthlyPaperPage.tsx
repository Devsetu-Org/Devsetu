import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { isAdminUser } from '../services/authApi';
import { fetchChallenge } from '../services/challengeApi';
import { useMonthlyPaper } from '../hooks/useMonthlyPaper';
import { boardChallengeForPaper, monthLabel } from '../constants/monthlyPaper';
import { IconCoins } from '../components/ChromeIcons';
import { MonthlyPaperAdminPicker, MonthlyPaperQuizModal } from '../components/MonthlyPaperQuiz';
import type { MonthlyPaperMeta } from '../services/monthlyPaperApi';

function TokenBadge({ label, title }: { label: string; title: string }): JSX.Element {
  return (
    <span className="monthly-tile-tokens" title={title}>
      <IconCoins size={13} />
      {label}
    </span>
  );
}

function PaperTile({
  paper,
  month,
  current,
  badge,
  children,
}: {
  paper: MonthlyPaperMeta;
  month: string;
  current?: boolean;
  badge?: JSX.Element | null;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <article className={`monthly-tile${current ? ' is-current' : ''}`}>
      <header className="monthly-tile-top">
        <p className="monthly-paper-kicker">
          {month}
          {current && <span className="monthly-tile-now">This month</span>}
        </p>
        {badge}
      </header>
      <h2 className="monthly-tile-title">{paper.title}</h2>
      <p className="monthly-tile-meta" title={paper.authors}>
        {paper.venue} {paper.year} · {paper.authors}
      </p>
      <p className="monthly-tile-blurb">{paper.blurb}</p>
      <div className="monthly-tile-actions">
        <a className="monthly-tile-btn" href={paper.href} target="_blank" rel="noreferrer">
          Read paper <span aria-hidden>↗</span>
        </a>
        {children}
      </div>
    </article>
  );
}

export default function MonthlyPaperPage(): JSX.Element {
  const { authMode, currentUser, challenges, onRequestLogin, onSelectChallenge } = useAppState();
  const signedIn = authMode === 'interviewer';
  const { state, reload, setState } = useMonthlyPaper();
  const [quizOpen, setQuizOpen] = useState(false);
  const [openingBoard, setOpeningBoard] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  const openQuiz = (): void => {
    if (!signedIn) {
      onRequestLogin();
      return;
    }
    setQuizOpen(true);
  };

  const openBoard = async (challengeId: string): Promise<void> => {
    if (!signedIn) {
      onRequestLogin();
      return;
    }
    setBoardError(null);
    setOpeningBoard(true);
    try {
      const known = challenges.find((c) => c.id === challengeId);
      await onSelectChallenge(known || await fetchChallenge(challengeId));
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setBoardError(err.response?.data?.error || err.message || 'Could not open the board');
    } finally {
      setOpeningBoard(false);
    }
  };

  const attempt = state?.attempt;
  const quizOpenToUser = isAdminUser(currentUser);
  const currentBoardId = state ? boardChallengeForPaper(state.paper.id) : null;
  const showBoard = Boolean(currentBoardId && quizOpenToUser);

  const boardBadge = (challengeId: string): JSX.Element => {
    const board = challenges.find((c) => c.id === challengeId);
    if (board?.solved) {
      return <TokenBadge label={`+${board.earnedTokens ?? board.tokens ?? 0}`} title="Board solved" />;
    }
    const tokens = board?.tokens ?? 10;
    return <TokenBadge label={String(tokens)} title={`Earn up to ${tokens} tokens on the board`} />;
  };

  const boardButton = (challengeId: string): JSX.Element => (
    <button
      type="button"
      className="monthly-tile-btn"
      disabled={openingBoard}
      onClick={() => { void openBoard(challengeId); }}
    >
      {openingBoard ? 'Opening…' : 'Work the board'}
    </button>
  );

  return (
    <div className="app-page play-problems-page monthly-page">
      <header className="play-problems-hero">
        <div className="play-problems-hero-copy">
          <h1 className="play-problems-title">Paper of the Month</h1>
          <p className="play-problems-lead">
            {showBoard
              ? 'One landmark systems paper each month. Read it, then work the incident on the board.'
              : quizOpenToUser
                ? 'One landmark systems paper each month. Read it, answer five questions, and earn tokens for what you understood.'
                : 'One landmark systems paper each month. A short quiz on each paper is coming soon.'}
          </p>
        </div>
      </header>

      {boardError && <div className="alert app-page-alert">{boardError}</div>}

      {state && (
        <>
          <section className="monthly-grid" aria-label="Papers">
            <PaperTile
              paper={state.paper}
              month={monthLabel(state.pickedAt)}
              current
              badge={
                currentBoardId && quizOpenToUser
                  ? boardBadge(currentBoardId)
                  : !quizOpenToUser ? null : attempt ? (
                    <TokenBadge label={`+${attempt.tokens}`} title={`${attempt.correct}/${attempt.total} correct`} />
                  ) : (
                    <TokenBadge label={String(state.tokensPerPaper)} title={`Earn up to ${state.tokensPerPaper} tokens`} />
                  )
              }
            >
              {currentBoardId && quizOpenToUser ? (
                boardButton(currentBoardId)
              ) : quizOpenToUser ? (
                <button type="button" className="monthly-tile-btn" onClick={attempt ? () => setQuizOpen(true) : openQuiz}>
                  {attempt ? 'Review answers' : 'Test yourself'}
                </button>
              ) : (
                <button type="button" className="monthly-tile-btn" disabled title="The paper quiz is not open yet">
                  Quiz coming soon
                </button>
              )}
            </PaperTile>

            {state.earlier.map((p) => {
              const boardId = boardChallengeForPaper(p.id);
              return (
                <PaperTile
                  key={p.id}
                  paper={p}
                  month={monthLabel(p.pickedAt)}
                  badge={
                    boardId && quizOpenToUser
                      ? boardBadge(boardId)
                      : p.score ? (
                        <TokenBadge label={`+${p.score.tokens}`} title={`${p.score.correct}/${p.score.total} correct`} />
                      ) : null
                  }
                >
                  {boardId && quizOpenToUser ? boardButton(boardId) : null}
                </PaperTile>
              );
            })}
          </section>

          {isAdminUser(currentUser) && (
            <div className="monthly-admin">
              <MonthlyPaperAdminPicker currentId={state.paper.id} onPicked={reload} />
            </div>
          )}

          {quizOpen && quizOpenToUser && (
            <MonthlyPaperQuizModal
              state={state}
              onClose={() => setQuizOpen(false)}
              onAttempt={(a) => {
                setState((prev) => (prev ? { ...prev, attempt: a } : prev));
                reload();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
