import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInView } from '../hooks/useInView';
import { useAppState } from '../context/AppStateContext';
import { CREDIT_RATE_ROWS, PRICING_PATH, PRICING_PLANS, pricingPlan } from '../constants/pricing';
import {
  apiErrorMessage,
  fetchBillingConfig,
  fetchBillingSummary,
  purchase,
  type BillingMode,
  type BillingSummary,
} from '../services/billingApi';

/** Latest paid-until per plan the user bought directly. */
function accessUntilByPlan(summary: BillingSummary): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of summary.subscriptions) {
    if (!s.entitled || !s.paidUntil) continue;
    out[s.planId] = Math.max(out[s.planId] || 0, s.paidUntil);
  }
  return out;
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Highest-rank entitled membership from sellable plans. */
function activeMembershipId(accessUntil: Record<string, number>): string | null {
  let bestId: string | null = null;
  let bestRank = -1;
  for (const [planId, until] of Object.entries(accessUntil)) {
    if (!until) continue;
    const plan = pricingPlan(planId);
    if (!plan || plan.free) continue;
    if (plan.rank > bestRank) {
      bestRank = plan.rank;
      bestId = plan.id;
    }
  }
  return bestId;
}

export default function PricingSection(): JSX.Element {
  const navigate = useNavigate();
  const { currentUser, onRequestLogin, refreshChallenges } = useAppState();
  const reveal = useInView<HTMLElement>();

  const [billingOpen, setBillingOpen] = useState(false);
  const [mode, setMode] = useState<BillingMode>('one_time');
  const oneTime = mode === 'one_time';
  const [accessUntil, setAccessUntil] = useState<Record<string, number>>({});
  const [credits, setCredits] = useState(0);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ planId: string; kind: 'ok' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetchBillingConfig()
      .then((cfg) => {
        if (cancelled) return;
        setBillingOpen(cfg.enabled);
        setMode(cfg.mode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!billingOpen || !currentUser) {
      setAccessUntil({});
      setCredits(0);
      return;
    }
    let cancelled = false;
    fetchBillingSummary()
      .then((s) => {
        if (cancelled) return;
        setAccessUntil(accessUntilByPlan(s));
        setCredits(s.credits || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [billingOpen, currentUser]);

  const activeId = useMemo(() => activeMembershipId(accessUntil), [accessUntil]);
  const activeRank = activeId ? pricingPlan(activeId)?.rank ?? -1 : -1;

  const onSubscribe = useCallback(
    async (planId: string, planName: string) => {
      if (!currentUser) {
        onRequestLogin(PRICING_PATH);
        return;
      }
      setBusyPlan(planId);
      setNotice(null);
      try {
        const extending = Boolean(accessUntil[planId]);
        const summary = await purchase(planId, mode);
        if (summary) {
          setAccessUntil(accessUntilByPlan(summary));
          setCredits(summary.credits || 0);
          void refreshChallenges();
          setNotice({
            planId,
            kind: 'ok',
            text: extending
              ? `Added another month of ${planName}.`
              : mode === 'one_time'
                ? `${planName} is unlocked for a month.`
                : `You're subscribed to ${planName}.`,
          });
        }
      } catch (e) {
        setNotice({ planId, kind: 'error', text: apiErrorMessage(e, 'Could not start checkout') });
      } finally {
        setBusyPlan(null);
      }
    },
    [currentUser, onRequestLogin, refreshChallenges, mode, accessUntil],
  );

  return (
    <section
      id="pricing"
      ref={reveal.ref}
      className={`pricing-plans${reveal.inView ? ' is-inview' : ''}`}
      aria-label="Pricing"
    >
      <h2 className="landing-section-title pricing-plans-title">Pricing</h2>
      <div className="pricing-credit-rates" aria-label="Lab credits per hour by track">
        <p className="pricing-credit-rates-lead">
          Lab credits burn by wall-clock hour and refresh each billing month. Free labs never burn
          credits.
        </p>
        <ul className="pricing-credit-rates-list">
          {CREDIT_RATE_ROWS.map((row) => (
            <li key={row.id} className="pricing-credit-rates-item">
              <span className="pricing-credit-rates-track">{row.label}</span>
              <span className="pricing-credit-rates-value">
                {row.rate} credit{row.rate === 1 ? '' : 's'}/hr
              </span>
            </li>
          ))}
        </ul>
      </div>
      {billingOpen && currentUser && credits > 0 ? (
        <p className="pricing-plans-credits" role="status">
          Your plan includes <strong>{credits}</strong> lab credits this month.
        </p>
      ) : null}
      <div className="pricing-plans-grid">
        {PRICING_PLANS.map((plan) => {
          const directOwned = Boolean(accessUntil[plan.id]);
          const includedInHigher = !plan.free && activeRank > plan.rank;
          const isActiveFree = plan.free && !activeId;
          const owned = plan.free ? isActiveFree : directOwned || includedInHigher;
          const ownedUntil = accessUntil[plan.id] || null;
          const busy = busyPlan === plan.id;
          const planNotice = notice?.planId === plan.id ? notice : null;
          return (
            <div
              key={plan.id}
              className={`landing-pricing-plan pricing-plan${plan.featured ? ' pricing-plan--featured' : ''}${owned ? ' pricing-plan--owned' : ''}`}
            >
              <div className="pricing-plan-topline">
                <p className="landing-pricing-plan-price">
                  {plan.free ? (
                    <span className="landing-pricing-plan-amount">Free</span>
                  ) : (
                    <>
                      <span className="landing-pricing-plan-amount">₹{plan.price}</span>
                      <span className="landing-pricing-plan-period">/ month</span>
                    </>
                  )}
                </p>
                {owned ? (
                  <p className="landing-pricing-plan-badge pricing-plan-badge--active">
                    <span className="pricing-plan-active-dot" aria-hidden />
                    {includedInHigher ? 'Included' : 'Active'}
                  </p>
                ) : null}
              </div>
              <h3 className="landing-pricing-plan-name">{plan.name}</h3>
              <ul className="landing-pricing-plan-includes">
                {plan.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {billingOpen ? (
                <>
                  {!plan.free && directOwned && ownedUntil ? (
                    <p className="pricing-plan-access">
                      {`${oneTime ? 'Unlocked' : 'Subscribed'} until ${formatDay(ownedUntil)}`}
                    </p>
                  ) : null}
                  {includedInHigher && activeId ? (
                    <p className="pricing-plan-access">
                      Included in your {pricingPlan(activeId)?.name} plan
                    </p>
                  ) : null}
                  {plan.free ? (
                    <button
                      type="button"
                      className="landing-cta-primary pricing-plan-owned"
                      onClick={() => navigate('/track')}
                    >
                      {isActiveFree ? 'Continue learning' : 'Explore tracks'}
                      <span className="landing-cta-arrow" aria-hidden>
                        →
                      </span>
                    </button>
                  ) : includedInHigher ? null : directOwned ? (
                    oneTime ? (
                      <button
                        type="button"
                        className="landing-cta-primary pricing-plan-owned"
                        disabled={busy || busyPlan !== null}
                        onClick={() => void onSubscribe(plan.id, plan.name)}
                      >
                        {busy ? 'Opening checkout…' : 'Add another month'}
                      </button>
                    ) : (
                      <Link to="/profile" className="landing-cta-primary pricing-plan-owned">
                        Manage subscription
                      </Link>
                    )
                  ) : (
                    <button
                      type="button"
                      className="landing-cta-primary"
                      disabled={busy || busyPlan !== null}
                      aria-label={busy ? undefined : `${oneTime ? 'Purchase' : 'Subscribe to'} ${plan.name}`}
                      onClick={() => void onSubscribe(plan.id, plan.name)}
                    >
                      {busy ? 'Opening checkout…' : oneTime ? 'Purchase' : 'Subscribe'}
                      {!busy && (
                        <span className="landing-cta-arrow" aria-hidden>
                          →
                        </span>
                      )}
                    </button>
                  )}
                  {planNotice && (
                    <p
                      className={`pricing-plan-notice pricing-plan-notice--${planNotice.kind}`}
                      role={planNotice.kind === 'error' ? 'alert' : 'status'}
                    >
                      {planNotice.text}
                    </p>
                  )}
                </>
              ) : plan.free ? (
                <button type="button" className="landing-cta-primary" onClick={() => navigate('/track')}>
                  Explore tracks
                  <span className="landing-cta-arrow" aria-hidden>
                    →
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="landing-cta-primary"
                  onClick={() => (currentUser ? navigate('/track') : onRequestLogin(PRICING_PATH))}
                >
                  Get started
                  <span className="landing-cta-arrow" aria-hidden>
                    →
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
