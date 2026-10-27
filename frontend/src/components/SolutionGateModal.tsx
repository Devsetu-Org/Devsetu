import React, { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import {
  fetchSolutionStatus,
  recordSolutionView,
  type SolutionStatus,
} from '../services/challengeApi';

const ACK_KEY_PREFIX = 'devsetu.solutionGate.ack.';

export function hasAcknowledgedSolution(challengeId: string): boolean {
  if (!challengeId) return false;
  try {
    return sessionStorage.getItem(`${ACK_KEY_PREFIX}${challengeId}`) === '1';
  } catch {
    return false;
  }
}

function rememberAcknowledged(challengeId: string): void {
  if (!challengeId) return;
  try {
    sessionStorage.setItem(`${ACK_KEY_PREFIX}${challengeId}`, '1');
  } catch {
    /* quota */
  }
}

interface SolutionGateModalProps {
  open: boolean;
  challengeId: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function GateMessage({ status }: { status: SolutionStatus | null }): JSX.Element {
  if (status && !status.practice && status.solved && !status.penalized) {
    return (
      <p className="solution-gate-penalty is-free">
        You&apos;ve solved this lab, so the solution is free to open.
      </p>
    );
  }
  if (status && !status.practice && status.viewedAt != null) {
    return (
      <p className="solution-gate-penalty">
        You&apos;ve opened this before. Solving it now awards{' '}
        <strong>{status.tokensAfterPenalty}</strong> of {status.tokens} tokens.
      </p>
    );
  }
  if (status && !status.practice) {
    return (
      <p className="solution-gate-penalty">
        <strong>{status.penaltyPct}%</strong> of the tokens will be taken.
      </p>
    );
  }
  return <p>Re-read the spec and try one more idea before you peek.</p>;
}

export default function SolutionGateModal({
  open,
  challengeId,
  onCancel,
  onConfirm,
}: SolutionGateModalProps): JSX.Element | null {
  const [status, setStatus] = useState<SolutionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !challengeId) return undefined;
    let cancelled = false;
    setStatus(null);
    setError(null);
    fetchSolutionStatus(challengeId)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        /* the generic warning still shows */
      });
    return () => {
      cancelled = true;
    };
  }, [open, challengeId]);

  const willPenalize = Boolean(status && status.penalized && status.viewedAt == null);
  const alreadySolved = Boolean(status && status.solved && !status.penalized);

  return (
    <ConfirmDialog
      open={open}
      title={alreadySolved ? 'Open the solution' : 'Open the solution?'}
      confirmLabel={willPenalize ? `Show solution (−${status!.penaltyPct}% tokens)` : 'Show solution'}
      cancelLabel={alreadySolved ? 'Cancel' : 'Keep trying'}
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        setBusy(true);
        setError(null);
        recordSolutionView(challengeId)
          .then(() => {
            rememberAcknowledged(challengeId);
            onConfirm();
          })
          .catch(() => setError('Could not open the solution right now. Please try again.'))
          .finally(() => setBusy(false));
      }}
    >
      <GateMessage status={status} />
      {error ? <p className="solution-gate-error" role="alert">{error}</p> : null}
    </ConfirmDialog>
  );
}
