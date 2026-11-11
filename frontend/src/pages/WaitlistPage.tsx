import React from 'react';
import MarketingPageShell from '../components/MarketingPageShell';
import WaitlistForm from '../components/WaitlistForm';
import { PILOT } from '../constants/accessLock';

export default function WaitlistPage(): JSX.Element {
  return (
    <MarketingPageShell onSignIn={() => undefined} onGetStarted={() => undefined}>
      <section className="waitlist-page" aria-labelledby="waitlist-page-title">
        <div className="waitlist-page-copy">
          <h1 id="waitlist-page-title" className="landing-hero-title waitlist-page-title">
            <span className="landing-hero-line">Join the waitlist</span>
            <span className="landing-hero-line">for the</span>
            <span className="landing-hero-line landing-hero-line--accent">DevSetu pilot</span>
          </h1>
          <p className="waitlist-page-lead">
            Be first in when live labs open. Seats are limited for this window.
          </p>
          <p className="waitlist-page-window" aria-label="Pilot window">
            <span className="waitlist-page-window-dot" aria-hidden />
            <span>
              {PILOT.startsLabel}
              {' – '}
              {PILOT.endsLabel}
            </span>
          </p>
        </div>

        <div className="waitlist-page-panel">
          <div className="waitlist-page-panel-inner">
            <h2 className="waitlist-page-panel-title">Request a seat</h2>
            <p className="waitlist-page-panel-lead">
              We&rsquo;ll confirm by email before the pilot starts.
            </p>
            <WaitlistForm variant="pilot" />
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
