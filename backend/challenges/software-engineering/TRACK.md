# Software Engineering track

Software Engineer domain. Shelf: `frontend/src/constants/playCatalog.ts` → `software-engineer`.

**North star.** You build backend services. The infrastructure is up. You write the code — APIs, database queries, async workers, caching logic, auth flows. This is the application layer.

**Story.** Forgeboard — a multi-tenant project tracker (Linear/Jira-shaped). Core services include `issue-service`, `sprint-service`, `webhook-dispatcher`, `search-indexer`, `billing-meter`, `audit-export`. The learner is a backend engineer (starting as an intern) who builds and maintains these services.

**Distinction from other tracks.**
- DevOps runs the box and the container
- Platforms runs the cluster  
- Data Engineer writes batch pipelines
- Distributed Systems builds protocols
- **Software Engineering writes the services**

---

## Subtrack Overview

| # | Subtrack | Labs | Focus |
| --- | --- | --- | --- |
| 1 | **Git** | 13 | Version control, branching, merging, collaboration |
| 2 | **Databases** | 18 | SQL fundamentals, joins, transactions, NoSQL patterns |
| 3 | **APIs** | 16 | REST, WebSockets, gRPC — building service interfaces |
| 4 | **Async** | 14 | Message queues, background workers, scheduled jobs |
| 5 | **Caching** | 12 | Redis, caching patterns, sessions, rate limiting |
| 6 | **Auth** | 12 | Sessions, JWTs, OAuth, identity patterns |
| 7 | **Testing** | 14 | Unit, integration, e2e — testing all the above |
| **Total** | | **99** | |

```text
Git → Databases → APIs → Async → Caching → Auth → Testing
```

---

## Subtrack 1 — Git

**Job.** You share code with your team. Branches, commits, merges, and recovering from mistakes.

**Shape.** `sandboxType: linux` on a `dev-box`. Setup plants a **bare team remote** at `/srv/git/sprint-service.git` and exposes it over SSH as `learner@git.forgeboard.internal:...` (`/etc/hosts` maps that hostname to this pod's IP; sshd + planted learner keys). git-01 teaches **clone → commit → push** onto `main`; every later lab with a forge remote installs an `update` hook that **rejects direct pushes to `main`** (`seed_finish` → `protect_remote_main`; git-01 sets `ALLOW_PUSH_MAIN=1`; git-19 fork origin also allows main push). No Gitea UI. Graders read local and remote state via `in_box`. Helpers: `backend/challenges/git/_lib/lab.sh`. Lab numbers 600–619, 638–639 (605 retired into git-05; 620–637 are Databases); packs in `backend/challenges/packs/git-*.json`.

**Blogs.** Ten topic blogs (`frontend/src/constants/gitReadings.ts`, B0–B9) sit on the Git shelf like Kubernetes — not chapter books. Header icons: roadmap (blogs↔labs), blogs list, leaderboard. Figures are CSS/SVG animations in `GitReadingAnims.tsx` (not static JPGs). **B1** is an informative map of Git hosts (no related labs). Former ship/branches/merge/… posts are B2–B9 (slugs unchanged).

| Blog | Slug | Related labs |
| --- | --- | --- |
| B0 Why Git exists | `why-git` | git-01 |
| B1 Where teams host Git today | `git-hosting-today` | — (informative only; no lab gate) |
| B2 Ship your first change | `ship-your-first-change` | git-01 |
| B3 Branches, atomic commits, and amend | `branches-atomic-amend` | git-02, git-03, git-04 |
| B4 Merging | `merging` | git-05 |
| B5 Rebase | `rebase` | git-07, git-08 |
| B6 Cherry-pick | `cherry-pick` | git-09 |
| B7 Undo & recover | `undo-and-recover` | git-10, git-11 |
| B8 Bisect, blame, stash | `bisect-blame-stash` | git-12–14, git-16, git-17, git-21 (+ points to git-15) |
| B9 Tags, remotes & hooks | `tags-remotes-hooks` | git-18, git-19, git-20, git-22 |

### Chapter 1: Commits and Branches (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| git-01 | Clone, Commit, and Push | L0 | Open (`finalized: true`, #600) — intern on Core team; clone `learner@git.forgeboard.internal:/srv/git/sprint-service.git`; set identity; flip two early-access flags to `full`; commit; push `main`; remote matches HEAD. |
| git-02 | Branch the Flag Fix into Atomic Commits | L1 | Open (#601) — bad default on `main`; three-file dirty tree; open `fix/agentic-default`, land config/README/`main.py` as 3 atomic commits, push the branch; `main` tip unchanged. |
| git-03 | Untrack the Leaked Local Env | L1 | Open (#602) — on `fix/agentic-default`, committed `.env.local` + untracked `.cache/`; untrack, ignore, push; leave main alone. |
| git-04 | Amend the Tip on fix/agentic-default | L0 | Open (#603) — lab-2 world: `fix/agentic-default` already pushed with 3 commits; forgotten writeup; amend tip (no 4th commit); get rewritten tip onto origin; `main` untouched. |

### Chapter 2: Merging and Rebasing (4 labs)

New Forgeboard story (not the Ch1 `fix/agentic-default` thread): **board summary sync, filters, CSV export, and a nightly crash hotfix onto release/2.1** on `~/sprint-service`. No PR UI — labs end at push of the feature branch where that is the workflow.

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| git-05 | Sync Board Summary with Main | L1 | Open (#604) — start on outdated `main`; fetch Priya's remote-only `feature/board-summary` + advanced `main`; merge main into feature, resolve, push feature; leave `main` alone. |
| git-07 | Rebase Board Filters Onto Main | L1 | Open (#606) — start on `main`; fetch `feature/board-filters` from origin; rebase onto `main` (README conflict), `--force-with-lease` push; leave main alone. |
| git-08 | Squash CSV Export WIP Into Two Commits | L1 | Open (#607) — start on `main`; fetch noisy `feature/csv-export` from origin; squash → 2 clear commits; `--force-with-lease` push; leave main alone. |
| git-09 | Land the Nightly Crash Hotfix on Release 2.1 | L2 | Open (#608) — release already has a naive temporary `digest_batch_size`; Priya's empty-board HOTFIX on `main` (above unreleased capacity) → apply only that fix onto `release/2.1` (conflict in `src/sprints.py` — keep her safe clamp), push origin for Ops; leave main alone; optional `~/answers/hotfix-sha`. |

### Chapter 3: History and Recovery (5 labs)

New Forgeboard subplot (not Ch1 agentic-default or Ch2 board-summary / filters / CSV / cherry-pick): **board notifications, column auto-advance, and board status checks** on `~/sprint-service`. Same teaching mechanics (revert / reflog / bisect / blame / pickaxe restore); no PR UI. Forge rejects direct pushes to `main` (except git-01). git-10: fix branch + revert + push for review onto `main`.

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| git-10 | Revert the Silenced Board Notify | L1 | Open (#609) — notify-off on shared `main`; open `fix/reenable-board-notify`, `git revert` under Priya's card SLA helper (`src/card_sla.py`), push branch for merge onto `main`; leave main alone; forge denies direct main push. |
| git-11 | Recover Lost Column Auto-Advance | L2 | Open (#610) — Forgeboard column auto-advance committed on `feature/column-auto-advance`, lost to `reset --hard` before push; recover onto the feature, push for review; leave `main` alone. |
| git-12 | Bisect the Broken Board Status Check | L2 | Open (#611) — Sprint Service health check (`./check.sh`) fails on main but passed at `v1.0`; exactly one spilled commit among ~18; find first bad SHA → `~/answers/bad-commit`; grade 120s. |
| git-13 | Blame the Notify Batch Multiplier | L1 | Open (#612) — board-notify ~9×; Jordan needs who last changed `NOTIFY_BATCH_MULTIPLIER`; email → `~/answers/author-email`; investigation only. |
| git-21 | Restore the Deleted Notify Format Helper | L2 | Open (#638) — `format_notify_payload` gone after cleanup; restore only `src/notify_format.py` on `fix/restore-notify-format` (other tip files stay); push; leave main alone. |

### Chapter 4: Collaboration (4 labs)

Primary Forgeboard subplot: **workspace invites** on `~/sprint-service` — invite-link TTL, redeem codes, and docs (stash / per-developer branches / detached-HEAD capstone). **git-17** uses a separate **outbound webhooks** beat so worktree is not a second pass of the invite TTL hotfix. No PR UI. Hotfixes ride fix branches (forge denies direct `main` push).

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| git-14 | Stash Invite WIP for the TTL Hotfix | L1 | Open (#613) — dirty invite-banner WIP on `feature/workspace-invites`; set aside, land `fix/invite-ttl-72` (TTL 72), push, restore WIP; leave main alone. |
| git-16 | Bring Priya's Invite Branch Into Yours | L1 | Open (#615) — Priya finished `feature/workspace-invites-priya` (code + README) and left; fetch into `feature/workspace-invites-ada`; code merges clean, README keeps both notes; push your branch; leave main alone. |
| git-17 | Parallel Webhook Hotfix with a Worktree | L2 | Open (#616) — dirty backoff WIP on `feature/webhook-delivery`; second working copy for `fix/webhook-timeout-30` (timeout 30s), push, remove copy; WIP intact; leave main alone. |
| git-15 | Capstone: Untangle the Invite Merge Mess | L2 | Open (#614) — detached HEAD + orphan invites README + conflicting invites merge + `.orig/.rej`; end clean on `main` with Ops' TTL 168; grade 120s. |

### Chapter 5: Releases, Hooks & Remotes (4 labs)

Forgeboard release mechanics on the same forge: annotated tags, fork↔org remotes, local `commit-msg` hook, and scrubbing a secret from unpushed history. No PR UI.

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| git-18 | Tag 2.2.0 and Cut a 2.1 Patch Branch | L1 | Open (#617) — annotate+push `v2.2.0` on main tip; from `v2.1.0` cut `hotfix/2.1.1`, patch health interval=60 + VERSION 2.1.1, push; leave main tip alone. |
| git-19 | Sync Your Fork with Upstream | L1 | Open (#618) — add org `upstream`, ff-only sync `main`, push fork `origin` main; `fetch --prune` drops deleted `origin/feature/card-colors`. |
| git-20 | Block Bad Commits with a Hook | L2 | Open (#619) — executable `.git/hooks/commit-msg` requiring `FB-<digits>` subject; commit on `fix/hook-ticket-prefix`, push; leave main alone. |
| git-22 | Scrub the API Key Before First Push | L2 | Open (#639) — `FORGEBOARD_API_KEY` mid-stack on unpushed `feature/invite-redeem-docs`; rewrite so no commit contains it; keep invite work; push; leave main alone. |

---

## Subtrack 2 — Databases

**Job.** You read and write data. SQL queries, schema design, transactions, and when to use NoSQL.

**Shape.** `sandboxType: linux` on a `dev-box` (same as Git). **PostgreSQL runs locally on the box** (installed on demand by `ensure_postgres`); the `quickbite` database is seeded per session with `customers`, `orders`, `order_items` (plus `wallets`, `order_docs`, `payments` where a lab needs them). Thresholds, dates, and ids are random per session (`/root/.lab`) and shown in `~/ticket/TASK.md`. The learner writes SQL to `~/answers/` or works in `psql`; graders run it read-only and compare against a reference query or inspect database state. Helpers: `backend/challenges/databases/_lib/lab.sh`. The document lab uses Postgres `jsonb` (no MongoDB infra yet).

**Status.** All 18 labs are **Open** (`finalized: true`, `visibleTo: users`). Lab numbers 620–637. Free: db-01, db-02.

### Chapter 1: SQL Fundamentals (5 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| db-01 | Your First SELECT | L0 | Open — SELECT id, status, total for a seeded business date → `~/answers/query.sql`. |
| db-02 | WHERE with Multiple Conditions | L0 | Open — pending orders above a per-session ₹ threshold, newest first → `~/answers/query.sql`. |
| db-03 | JOIN Orders to Customers | L1 | Open — inner join orders to customers over a date window (order_id, name, email). |
| db-04 | LEFT JOIN: Find Orphan Records | L1 | Open — orders with a NULL or dangling customer_id. LEFT JOIN, WHERE customer IS NULL. |
| db-05 | Aggregations: Daily Revenue | L1 | Open — SUM(total) and COUNT per day over a window, cancelled excluded. |

### Chapter 2: Intermediate SQL (5 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| db-06 | GROUP BY and HAVING | L1 | Open — customers with more than N orders (N per session). GROUP BY + HAVING. |
| db-07 | Subquery: Orders Above Average | L1 | Open — orders above the window average. Subquery in WHERE. |
| db-08 | Window Functions: Running Total | L2 | Open — running spend for three seeded customers. SUM() OVER (PARTITION BY ... ORDER BY ...). |
| db-09 | CTE: Readable Complex Query | L1 | Open — per-customer settlement summary with ≥2 CTEs; avoid item fan-out. |
| db-10 | INSERT, UPDATE, DELETE Safely | L1 | Open — INSERT ... RETURNING id (→ `new_order_id.txt`), targeted UPDATE, soft-delete cancelled. Graded on DB state. |

### Chapter 3: Transactions and Performance (5 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| db-11 | Transactions: Transfer Money | L2 | Open — atomic wallet transfer in `~/answers/transfer.sql`; grader runs it with enough funds and with too little (rollback). |
| db-12 | Add an Index: Speed Up Search | L2 | Open — 300k orders, no index. Add `orders(customer_id)` index; grader checks catalog + live EXPLAIN. |
| db-13 | EXPLAIN: Read the Query Plan | L2 | Open — filter + ORDER BY + LIMIT query. Composite index so the plan has no Seq Scan or Sort; save EXPLAIN to `~/answers/plan.txt`. |
| db-14 | N+1: One Query Instead of Fifty | L2 | Open — legacy script issues 51 queries; replace with one LEFT JOIN statement (orders without items kept). |
| db-15 | Schema Migration: Add a Column | L1 | Open — `~/answers/migration.sql`: add `delivery_instructions TEXT` + backfill; grader drops the column and replays it twice (idempotent). |

### Chapter 4: NoSQL Patterns (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| db-16 | Document Store: Order as JSON | L1 | Open — `order_docs` jsonb (Postgres stand-in for MongoDB). Insert a nested order, query by nested fields. |
| db-17 | When SQL, When NoSQL | L2 | Open — `~/answers/recommendation.md`: relational vs document for two session-picked patterns; graded on structure, choices, and keywords. |
| db-18 | Capstone: Settlement Report | L2 | Open — daily report over customers, orders, order_items, payments with CTEs, running total, RANK; compared to reference, < 2 s. |

---

## Subtrack 3 — APIs

**Job.** You build service interfaces. REST endpoints, real-time WebSockets, and gRPC for service-to-service.

**Shape.** `api-lab` — Python (FastAPI) or TypeScript (Hono). Running services to extend.

### Chapter 1: REST Basics (5 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| api-01 | Your First GET Endpoint | L0 | `/orders/{id}` returns order JSON. Handle 404 for missing orders. |
| api-02 | POST: Create an Order | L0 | Accept JSON body, validate required fields, insert, return 201 with location. |
| api-03 | Request Validation | L1 | Reject invalid email, negative amounts, missing fields. Return 400 with details. |
| api-04 | List with Pagination | L1 | `/orders?page=2&limit=20`. Return items + total + next/prev links. |
| api-05 | Filtering and Sorting | L1 | `/orders?status=pending&sort=-created_at`. Query params to WHERE + ORDER BY. |

### Chapter 2: REST Advanced (5 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| api-06 | Nested Resources | L1 | `/orders/{id}/items` — list items for an order. POST to add item. |
| api-07 | Idempotency Keys | L2 | Payment endpoint. Same `Idempotency-Key` header → same response, no duplicate charge. |
| api-08 | Versioning: v1 and v2 | L2 | v1 returns `total_price`, v2 returns `amount_cents`. Both work. Route by header or path. |
| api-09 | Error Responses: Problem Details | L1 | Structured errors per RFC 7807. Type, title, status, detail, instance. |
| api-10 | Webhooks: Order Status Changed | L2 | When order status changes, POST to registered webhook URL. Retry on failure. |

### Chapter 3: WebSockets (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| api-11 | WebSocket: Live Order Status | L1 | Customer connects, gets real-time updates when their order status changes. |
| api-12 | Rooms: Rider Location Stream | L2 | Rider joins room for their deliveries. Location updates broadcast to room only. |
| api-13 | Heartbeat and Reconnection | L2 | Detect dead connections with ping/pong. Client reconnects and resyncs state. |

### Chapter 4: gRPC (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| api-14 | Your First gRPC Service | L1 | Define `OrderService` in proto. Implement `GetOrder`. Call from client. |
| api-15 | Server Streaming: Order Events | L2 | `StreamOrderEvents` returns stream of status changes. Client processes as they arrive. |
| api-16 | Capstone: Payment Service | L2 | gRPC service with `CreatePayment`, `GetPayment`, `RefundPayment`. Proper error codes. |

---

## Subtrack 4 — Async

**Job.** You handle work that doesn't need immediate response. Queues, workers, and scheduled jobs.

**Shape.** `async-lab` — Redis (or RabbitMQ) for queues. Pre-built worker framework.

### Chapter 1: Message Queues (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| async-01 | Publish Your First Message | L0 | Order created → publish to `orders.created` queue. See it in queue UI. |
| async-02 | Consume and Process | L0 | Worker reads from queue, sends notification email, acknowledges. |
| async-03 | Acknowledge After Success | L1 | Process, then ack. If worker dies mid-process, message redelivered. |
| async-04 | Reject and Dead Letter | L1 | Invalid message → reject → goes to DLQ. Alert on DLQ depth. |

### Chapter 2: Pub/Sub Patterns (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| async-05 | Fanout: Multiple Consumers | L1 | Order created → notification service AND analytics service both receive. |
| async-06 | Topic Routing | L2 | `orders.created.restaurant.123` → only workers subscribed to that restaurant. |
| async-07 | Request-Reply Pattern | L2 | Sync-over-async: send request, wait for correlated response on reply queue. |
| async-08 | Exactly-Once: Idempotent Consumer | L2 | Same message delivered twice. Consumer checks idempotency key, processes once. |

### Chapter 3: Background Workers (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| async-09 | Long-Running Job | L1 | Generate settlement report. Queue job, worker runs for 30s, stores result. |
| async-10 | Job Progress and Status | L1 | Update progress (10%, 50%, 100%). Client polls status endpoint. |
| async-11 | Retry with Backoff | L2 | External API fails. Retry 3 times with exponential backoff. Then DLQ. |

### Chapter 4: Scheduled Jobs (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| async-12 | Cron: Nightly Settlement | L1 | Run at 2am daily. Lock to prevent double-run. Log start/end. |
| async-13 | Distributed Lock | L2 | Multiple instances. Only one runs the cron job. Redis lock with TTL. |
| async-14 | Capstone: Order Reminder Pipeline | L2 | Order pending > 1 hour → queue reminder → worker sends push → record sent. |

---

## Subtrack 5 — Caching

**Job.** You make things fast. Redis for caching, sessions, and rate limiting.

**Shape.** `cache-lab` — Redis + application code. Slow endpoints to speed up.

### Chapter 1: Redis Fundamentals (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| cache-01 | SET and GET | L0 | Store restaurant menu in Redis. Retrieve it. See TTL. |
| cache-02 | Data Types: Hash and List | L0 | User cart as hash. Recent orders as list. HSET, HGET, LPUSH, LRANGE. |
| cache-03 | Expiration and TTL | L1 | Menu cache expires in 5 minutes. Check TTL, refresh before expiry. |

### Chapter 2: Caching Patterns (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| cache-04 | Cache-Aside: Restaurant Menu | L1 | Check cache → miss → query DB → populate cache → return. |
| cache-05 | Write-Through: Order Status | L1 | Update DB and cache together. Readers always get fresh from cache. |
| cache-06 | Cache Invalidation | L2 | Menu updated. Invalidate cache. Next read gets fresh. Test stale data scenarios. |
| cache-07 | Cache Stampede Prevention | L2 | Cache expires, 100 requests hit DB simultaneously. Lock or probabilistic refresh. |

### Chapter 3: Sessions and Rate Limiting (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| cache-08 | Session Store | L1 | Login creates session in Redis. Session ID in cookie. Logout deletes. |
| cache-09 | Rate Limiting: Sliding Window | L2 | 100 requests per minute per user. INCR with TTL. Return 429 when exceeded. |
| cache-10 | Distributed Rate Limiting | L2 | Multiple API instances share Redis. Consistent limits across instances. |

### Chapter 4: Capstone (2 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| cache-11 | Leaderboard: Top Restaurants | L2 | Sorted set by order count. ZADD on each order, ZREVRANGE for top 10. |
| cache-12 | Capstone: Speed Up Order History | L2 | Endpoint takes 2s. Add caching, invalidation on new order. Target < 50ms. |

---

## Subtrack 6 — Auth

**Job.** You know who's calling. Sessions, tokens, and OAuth flows.

**Shape.** `auth-lab` — Auth server + protected APIs. Real login/logout flows.

### Chapter 1: Sessions and Cookies (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| auth-01 | Login Creates Session | L0 | POST /login → validate credentials → create session → set cookie. |
| auth-02 | Protected Endpoint | L0 | GET /me requires valid session. No session → 401. |
| auth-03 | Logout Destroys Session | L1 | POST /logout → delete session from store → clear cookie. |

### Chapter 2: JWTs and Tokens (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| auth-04 | Issue a JWT | L1 | Login returns JWT with user_id, role, exp. Sign with secret. |
| auth-05 | Validate JWT on Request | L1 | Authorization: Bearer <token>. Verify signature, check expiry. |
| auth-06 | Refresh Tokens | L2 | Access token (15min) + refresh token (7d). Refresh endpoint issues new access. |
| auth-07 | Revoke a Token | L2 | User logs out everywhere. Blacklist or token versioning. |

### Chapter 3: OAuth Flows (3 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| auth-08 | OAuth: Redirect to Provider | L1 | "Login with Google" → redirect with client_id, scope, redirect_uri. |
| auth-09 | OAuth: Handle Callback | L2 | Receive code → exchange for token → fetch user info → create/link account. |
| auth-10 | OAuth: Secure the State | L2 | CSRF protection. State parameter, verify on callback. |

### Chapter 4: Capstone (2 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| auth-11 | Role-Based Access | L2 | Admin vs customer vs rider. Different endpoints allowed per role. |
| auth-12 | Capstone: Full Auth Flow | L2 | Register → login → protected routes → refresh → logout. All working together. |

---

## Subtrack 7 — Testing

**Job.** You prove it works. Unit tests, integration tests, and testing all the services you built.

**Shape.** `test-lab` — pytest or vitest. Pre-built services with partial coverage.

### Chapter 1: Unit Tests (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| test-01 | Your First Unit Test | L0 | Test `calculate_total()`. Assert expected output for known input. |
| test-02 | Test Multiple Cases | L0 | Same function, 5 cases: normal, zero, negative, large, edge. |
| test-03 | Test Error Conditions | L1 | Function should raise ValueError on invalid input. Assert exception. |
| test-04 | Parameterized Tests | L1 | 10 cases, one test function. `@pytest.mark.parametrize` or similar. |

### Chapter 2: Mocking (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| test-05 | Mock External HTTP Call | L1 | Function calls payment gateway. Mock the HTTP, test success/failure paths. |
| test-06 | Mock the Database | L1 | Repository calls DB. Mock the connection, test query logic. |
| test-07 | Mock Time | L2 | Function uses `now()`. Mock time to test expiration logic. |
| test-08 | Verify Mock Was Called | L1 | Assert the mock was called with expected arguments, expected times. |

### Chapter 3: Integration Tests (4 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| test-09 | Test API Endpoint | L1 | POST /orders, assert 201, assert response body, assert DB has record. |
| test-10 | Test with Real Database | L2 | Spin up test DB, run migrations, test, tear down. No mocks. |
| test-11 | Test Async Worker | L2 | Publish message, wait for worker to process, assert side effect. |
| test-12 | Test Auth Flow | L2 | Login → get token → call protected endpoint → assert 200. |

### Chapter 4: Capstone (2 labs)

| Lab | Title | Diff | Description |
| --- | --- | --- | --- |
| test-13 | Fix the Flaky Test | L2 | Test passes 9/10 times. Find the race condition, fix it. |
| test-14 | Capstone: Test Suite for Order Service | L2 | Write 10 tests covering create, list, update, cancel, edge cases. 80%+ coverage. |

---

## Summary

| Subtrack | Labs | Chapters |
| --- | --- | --- |
| Git | 13 | Commits & Branches → Merging & Rebasing → History & Recovery → Collaboration |
| Databases | 18 | SQL Fundamentals → Intermediate SQL → Transactions & Performance → NoSQL Patterns |
| APIs | 16 | REST Basics → REST Advanced → WebSockets → gRPC |
| Async | 14 | Message Queues → Pub/Sub Patterns → Background Workers → Scheduled Jobs |
| Caching | 12 | Redis Fundamentals → Caching Patterns → Sessions & Rate Limiting → Capstone |
| Auth | 12 | Sessions & Cookies → JWTs & Tokens → OAuth Flows → Capstone |
| Testing | 14 | Unit Tests → Mocking → Integration Tests → Capstone |
| **Total** | **99** | |

---

## Design Principles

1. **You build real things.** Every lab produces working code — not diagrams or descriptions.
2. **Progressive complexity.** L0 = "make it work", L1 = "make it right", L2 = "make it robust".
3. **Capstones integrate.** Final lab in each subtrack combines skills from all chapters.
4. **Forgeboard throughout.** Same services, same data, same story — different skills.
5. **Gradeable artifacts.** Tests pass, queries return correct data, endpoints respond correctly.

---

## Ship Order

```
1. Git         ← Foundation for collaboration
2. Databases   ← Every service needs data
3. APIs        ← Build the service interfaces
4. Async       ← Handle background work
5. Caching     ← Make it fast
6. Auth        ← Know who's calling
7. Testing     ← Prove it all works
```

---

## Runtime Shapes

| Subtrack | Shape | Stack |
| --- | --- | --- |
| Git | `linux` (`dev-box`) | Bare remote via `git.forgeboard.internal` (pod IP + sshd); clone/push over SSH (no Gitea UI) |
| Databases | `linux` (`dev-box`) | Local PostgreSQL on the box (`jsonb` for document labs); MongoDB later |
| APIs | `api-lab` | Python/FastAPI or TypeScript/Hono |
| Async | `async-lab` | Redis queues + worker framework |
| Caching | `cache-lab` | Redis + application |
| Auth | `auth-lab` | Auth server + protected APIs |
| Testing | `test-lab` | pytest or vitest + services |

---

## What This Track Is Not

- Not infrastructure (that's DevOps)
- Not cluster operations (that's Platforms)
- Not data pipelines (that's Data Engineer)
- Not protocol design (that's Distributed Systems)

**This is the application layer** — the services that run on all that infrastructure.
