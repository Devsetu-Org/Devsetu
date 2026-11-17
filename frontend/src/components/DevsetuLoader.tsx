import React from 'react';
import BrandMark from './BrandMark';

type DevsetuLoaderProps = {
  /** Short status under the brand (optional). */
  message?: string;
  /** Dimmer line under message (optional). */
  detail?: string;
  /** Full-viewport overlay (default) vs inline block. */
  fullPage?: boolean;
};

/**
 * WhatsApp-style DevSetu loader — brand mark + green progress bar.
 * Same look as the index.html splash, for in-app waits (lab reopen, session restore).
 */
export default function DevsetuLoader({
  message,
  detail,
  fullPage = true,
}: DevsetuLoaderProps): JSX.Element {
  const body = (
    <div className="devsetu-loader" role="status" aria-live="polite" aria-busy="true">
      <BrandMark className="devsetu-loader-mark" title="" />
      <p className="devsetu-loader-name">DevSetu</p>
      <div className="devsetu-loader-progress" aria-hidden="true">
        <span />
      </div>
      {message ? <p className="devsetu-loader-message">{message}</p> : null}
      {detail ? <p className="devsetu-loader-detail">{detail}</p> : null}
    </div>
  );

  if (!fullPage) return body;
  return <div className="devsetu-loader-page">{body}</div>;
}
