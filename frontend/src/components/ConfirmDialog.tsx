import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  /** Omit for a single-button alert. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps): JSX.Element | null {
  // Ignore backdrop clicks from the same gesture that opened the dialog (e.g. Brief Back).
  const allowBackdrop = useRef(false);

  useEffect(() => {
    if (!open) {
      allowBackdrop.current = false;
      return undefined;
    }
    allowBackdrop.current = false;
    const timer = window.setTimeout(() => {
      allowBackdrop.current = true;
    }, 0);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="login-modal-overlay confirm-dialog-overlay"
      role="presentation"
      onClick={() => {
        if (!busy && allowBackdrop.current) onCancel();
      }}
    >
      <div
        className="login-modal confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-card login-modal-card confirm-dialog-card">
          <h2 id="confirm-dialog-title" className="confirm-dialog-title">
            {title}
          </h2>
          <div className="confirm-dialog-body">{children}</div>
          <div className="confirm-dialog-actions">
            {cancelLabel ? (
              <button type="button" className="ghost" onClick={onCancel} disabled={busy} autoFocus>
                {cancelLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="primary"
              onClick={onConfirm}
              disabled={busy}
              autoFocus={!cancelLabel}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
