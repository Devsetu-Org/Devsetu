# Pricing proposal — Platform membership + practice credits

**Status:** Proposal (not implemented). Replaces the per-track SKUs on the pricing page as the *primary* story.  
**Date:** 2026-11-16  
**Goal:** Four membership tiers + practice credits weighted by resource class. Builder serves projects-only buyers; Starter / Member / Pro are all-access.

---

## 1. Why change

Today (`frontend/src/constants/pricing.ts`, `backend/billing/plans.ts`):

| Plan | ₹/mo | Unlocks |
| --- | --- | --- |
| Linux | 199 | Linux only |
| Docker | 249 | Docker only |
| Kubernetes | 399 | K8s (DevOps) only |
| DevOps Engineer | 699 | Linux + Docker + K8s |

That model underprices dense Platforms Engineer labs (Spark / Kafka) and over-fragments access. Real machines do not cost the same: a Linux box packs ~43-wide on a `t4g.medium`; a Spark `spark-2` / `yarn-2` session is effectively **one learner per node**.

---

## 2. Cost basis (ap-south-1 / Mumbai)

`t4g.medium` on-demand ≈ **$0.0224/hr** ≈ **₹1.90/hr** (₹85/USD).  
Packing from `deploy/eks/env.sh`, `deploy/eks/kafka/README.md`, and workspace resource requests:

| Lab class | Typical request footprint | Concurrent / `t4g.medium` | Raw EC2 ₹/session-hr |
| --- | ---: | ---: | ---: |
| Linux shell | 64 Mi | ~43 | ~₹0.04 |
| Projects shell | 256 Mi on `t4g.small` | ~5 / small | ~₹0.19 |
| Docker host | 256 Mi | ~12 | ~₹0.16 |
| K8s tenant (shared `labs-k8s`) | ~64 Mi slot + cluster share | ~20–38 | ~₹0.05–0.10 |
| Kafka `kafka-3` | 832 Mi | **3** | ~₹0.63 |
| Spark `spark-2` | ~1.7 Gi requests (M+2W+shell) | **~1** | ~₹1.90 |
| Spark `yarn-2` | ~2.8 Gi requests | **1** | ~₹1.90 |

Ratios vs Linux (same wall-clock hour): Docker ~4×, Kafka-3 ~15×, Spark ~40×+ on raw EC2.  
We do **not** pass a 40× sticker to students. We compress into **three credit classes** and recover the rest in the membership floor + idle auto-stop.

EKS control plane, system node, and idle warm pools are **fixed** — paid by membership, not by the per-hour credit.

---

## 3. Product rules

1. **Four tiers** (see §5). **Builder** unlocks Projects + Papers only. **Starter / Member / Pro** unlock the full catalog (DevOps tracks, Platforms Engineer, Projects, Papers). No per-lab or per-project SKUs.
2. Opening a workspace burns **practice credits** by wall-clock time × class weight (billed in whole minutes, rounded up to 1 minute).
3. Credits refresh each billing month; unused membership credits do **not** roll (keeps forecasting sane). Prepaid top-up packs **do** roll for 12 months.
4. **Hard stop** at 0 credits (soft warn at 80%). No open-ended postpaid invoice.
5. **Idle auto-stop** (product requirement before launch of this model): pause/delete lab after N minutes idle so overnight Spark / project shells do not wipe a month.
6. Max **one** concurrent workspace session per user at launch (raises later if needed).
7. Builder may buy top-ups, but credits only spend on allowed surfaces (`shell` for Projects). Starting a track/platform lab prompts an upgrade to Starter+.

---

## 4. Credit classes (internal rate card — FAQ only)

| Class id | Weight | Wall-clock | Examples |
| --- | ---: | --- | --- |
| `shell` | **1** | 1 credit / hour | Linux, Projects code shell |
| `host` | **3** | 3 credits / hour | Docker |
| `cluster` | **2** | 2 credits / hour | DevOps Kubernetes (shared tenant namespace) |
| `platform` | **10** | 10 credits / hour | Spark (all shapes), Kafka (`kafka-3` / dense), future k8s-platform dense shapes |

**Simplify for the pricing page copy:** talk about three buckets — *Shell · Host/Cluster · Platform* — and fold `cluster` (2) into the middle tier verbally (“Kubernetes and Docker use more practice time than Linux”). Keep four ids in code if useful.

**Effective list value of 1 credit** (for top-ups): **₹5**.  
That implies sticker rates of ~₹5 / ₹15 / ₹10 / ₹50 per wall-hour by class — shown only in FAQ, never as the hero.

COGS check at those stickers: Linux still fat margin; Spark ~₹50 list vs ~₹2 EC2 — margin funds Karpenter spikes, failed sessions, and grading infra.

### Pack → class mapping (implementation hint)

| `sandboxType` / shape | Class |
| --- | --- |
| `linux` | `shell` |
| `projects` | `shell` |
| `docker` | `host` |
| `k8s` (DevOps tenant) | `cluster` |
| `spark` (any shape) | `platform` |
| `kafka` (`kafka-3`, `kafka-zk-3`) | `platform` |
| `kafka` (`kafka-1`) | `host` (lighter; optional) |
| `k8s-platform` | `platform` |

---

## 5. Recommended INR ladder (4 tiers)

Anchor against today’s DevOps bundle (₹699) and single Linux entry (₹199).

### Memberships

| Plan | ₹/mo | Credits | Unlocks | Rough envelope | Who it’s for |
| --- | ---: | ---: | --- | --- | --- |
| **Builder** | **249** | **40** | **Projects + Papers only** | ~40h project shell (B-tree, LSM, Raft, …) | Systems builders who don’t want ops labs |
| **Starter** | **399** | **40** | **All tracks + Projects + Papers** | ~40h Linux, ~13h Docker, or **4h Platform**, or a mix | Trying everything; light DevOps |
| **Member** (featured) | **699** | **100** | All of the above | Serious DevOps month + **~6–8h Platform**, or ~10h Platform alone | Default plan — same ₹ as today’s DevOps SKU |
| **Pro** | **1299** | **220** | All of the above | Heavy Platforms grind (~20h+ Platform) + everything else | Daily Spark / Kafka practice |

**Why Builder is not “Projects ₹SKU”:** one audience tier (builders), not per-project checkout. Same credit meter (`shell`); content gate is Projects + Papers only. Upgrade CTA on any track/lab start → Starter.

**Why Starter still exists:** same credit pool as Builder, but full catalog — the step for “I might touch Linux/Spark too.”

Launch offer: keep the existing **40% off first month** on **Member** (featured), time-boxed. Optional weaker % on Builder/Starter.

### Prepaid top-up packs (roll 12 months)

| Pack | Credits | ₹ | ₹/credit |
| --- | ---: | ---: | ---: |
| Small | 20 | 119 | 5.95 |
| Medium | 50 | 249 | 4.98 |
| Large | 120 | 499 | 4.16 |

Top-ups are purchasable only with an active membership (or within 30 days of expiry so leftover packs stay usable).

### Free tier (activation)

- Catalog + readings browsable.
- **One** free lab start forever (e.g. Linux first-shift or Spark-01 if pool is up) with a **30-minute** credit grant (`shell` or `platform` as appropriate) — enough to feel the product, not enough to farm.

---

## 6. What a normal study month looks like

| Path | Wall hours (est.) | Credits | Fits |
| --- | ---: | ---: | --- |
| One project chapter series (evenings) | 20–35h `shell` | 20–35 | **Builder** |
| Deep project month (daily) | 40h+ `shell` | 40+ | Builder + top-up, or rebuild next month |
| Finish Linux track seriously | 12–16h `shell` | 12–16 | **Starter** |
| + Docker | +8h `host` | +24 | |
| + DevOps K8s | +10h `cluster` | +20 | |
| **DevOps-heavy month** | | **~56–60** | **Member** |
| Spark Ch.1 grind (6 × 45m) | 4.5h `platform` | 45 | |
| + Kafka foundations | +3h `platform` | +30 | |
| **Platforms-heavy month** | | **~75–100** | **Member** tight, **Pro** comfortable |

Starter = full catalog, light hours. Builder = same hours, Projects-only gate.

---

## 7. Pricing page copy (spine)

> **Pick how you practice. Pay for the machines honestly.**  
> Build systems from scratch, run incident labs, or both. Every plan includes practice credits — a project shell and a Spark cluster don’t burn at the same rate. No surprise invoice past your balance.

**Four cards (left → right):** Builder · Starter · **Member** (featured) · Pro.

| Card | Checklist emphasis |
| --- | --- |
| Builder | Projects (B-tree, LSM, Raft…) · Paper of the Month · 40 practice credits · Upgrade anytime for labs |
| Starter | Everything unlocked · 40 credits · Best to try tracks + projects |
| Member | Everything unlocked · 100 credits · Serious DevOps + platform practice |
| Pro | Everything unlocked · 220 credits · Daily Spark / Kafka |

**Show big:** plan name · ₹/mo · **N practice credits** · unlock scope.  
**Hide in FAQ:** per-class credit weights and ₹/hr equivalents.  
**Must ship in product chrome:** credits remaining, burn rate for the open workspace, warn at 80%.

---

## 8. Migration from current SKUs

| Current holder | Move to |
| --- | --- |
| Linux / Docker / K8s monthly | **Starter** or **Member** for remaining paid days (prefer Member if ≥2 tracks paid), or credit grant = unused value ÷ ₹5 |
| DevOps Engineer ₹699 | Map 1:1 to **Member** (same price, now all-access + 100 credits) |
| One-time unlocks | Honor until `paid_until`; then pick a membership |
| New projects-only buyers | **Builder** (new) |

Do not yank cheap Linux ₹199 overnight without a grandfather path. Optional temporary “Linux only” at ₹199 with **20 `shell` credits** — migration bridge for ≤1–2 billing cycles, then retire in favor of Starter.

---

## 9. Implementation sketch (eng)

1. **Catalog:** `creditClass` on each pack JSON (or derived from `sandboxType` + shape).
2. **Entitlements:** `builder` → `projects` + `papers`; `starter` \| `member` \| `pro` → `*`.
3. **Billing plans:** Razorpay products for `builder` / `starter` / `member` / `pro` + top-up packs.
4. **Meter:** on workspace heartbeat / close, `credits += ceil(minutes/60 * weight)`; refuse start if balance &lt; minimum slice (e.g. 0.25 credit).
5. **UI:** four pricing cards, profile balance, lab/project chrome burn estimate (“~10 credits/hr — Platform”), Builder upgrade modal on gated start.
6. **Idle stop:** timer in workspace layer — **20 minutes** idle for `platform`, **30 minutes** for `shell` / `host` / `cluster` (project shells included).

---

## 10. Decisions to lock before build

| Decision | Proposal | Needs founder OK |
| --- | --- | --- |
| Four tiers | Builder 249 / Starter 399 / Member 699 / Pro 1299 | ☐ |
| Featured plan | Member ₹699 / 100 credits | ☐ |
| Builder unlock scope | Projects + Papers only | ☐ |
| Platform weight | 10× shell | ☐ |
| Kafka-1 class | `host` (3×) vs `platform` (10×) | ☐ |
| Credit expiry | Membership monthly reset; packs 12 mo | ☐ |
| Concurrent workspaces | 1 | ☐ |
| Idle auto-stop | 20m platform / 30m else | ☐ |
| Keep Linux-only bridge | Yes, 1–2 cycles then retire | ☐ |

---

## 11. Success metrics (first 30 days after switch)

1. Paid conversion rate (visit → membership).
2. % of Member users who hit **80%** credits (target band 25–40% — engaged, not furious).
3. Top-up attach rate among users who hit 80%.
4. “Surprise charge” / refund tickets (should stay ≈ 0 with hard stop).
5. Mix of credit burn: `shell` vs `platform` (validates Spark launch thesis).
