# LSM tree minor: benchmark chapter and hosted runner (design)

Status: draft for review, 2026-10-15. Nothing here is built yet.

## Goal

Chapter 6 of the LSM tree minor. A learner submits the engine they built in chapters 1 to 5, changed however they like, and we run it on our infrastructure against a fixed workload, side by side with our reference engine. They get a report of how their design choices cost or pay off, and a place on a per-language leaderboard.

Decisions already made:

- **Any code may change**, as long as every chapter test and the durability checks pass. The benchmark driver and the tests are ours and are overwritten on upload.
- **Scores are ratios against the reference**, measured on the same node in the same job. Raw numbers are shown but never ranked.
- **One leaderboard per language.** Go first; Python and C++ when their chapters exist.

Non-goals for v1: multi-node engines, custom workloads, live progress streaming, and comparing languages.

## Learner flow

1. Chapter 6 opens like the others, on the learner's own code from chapters 1 to 5 (carry-forward). Its theory covers honest benchmarking: warm-up, percentiles over averages, the page cache, closed-loop latency, why we compare ratios.
2. `make bench` runs a small version of the official workload locally, with the same driver, so they can iterate on a laptop.
3. Optional work in the chapter: tune defaults (memtable size, block size, Bloom bits per key, compaction trigger) or go further (block cache, leveled compaction, key prefix compression, group commit, concurrent reads).
4. **Submit** uploads the workspace files. A results page shows the gates, each metric as "you vs reference", and the composite score. Every metric links to the chapter that controls it.
5. The best passing submission per user appears on the language's leaderboard.

## Architecture

```plaintext
 browser ──POST files──▶ backend API ──▶ bench_submissions (Postgres, queue)
                                               │ worker claims (SKIP LOCKED)
                                               ▼
                         ┌──────────── build pod (labs-bench pool) ────────────┐
                         │ overlay harness-owned files, go test, go build      │
                         │ → engine binary + test log to object store          │
                         └─────────────────────────────────────────────────────┘
                                               ▼
                         ┌──────── bench pod, exclusive node (NVMe) ───────────┐
                         │ harness container (ours, trusted)                   │
                         │   generates ops, times them, checks answers,        │
                         │   kills/restarts the engine, reads /proc counters   │
                         │ engine container (learner code, untrusted)          │
                         │   benchd ← unix socket → harness                    │
                         │ runs: ref, cand, ref, cand, ref, cand               │
                         └─────────────────────────────────────────────────────┘
                                               ▼
                         results JSON to object store, score to Postgres
```

### Why the engine runs out of process

The obvious design links the harness into the learner's binary and times calls in-process. With "any code may change", that lets the learner's code rewrite the timer or the histogram. So the engine runs as its own process, `benchd`, behind a small protocol. The harness, in a separate container, generates every operation, owns every clock, and checks every answer.

The cost is a fixed per-operation overhead from the Unix socket, a few microseconds. Candidate and reference pay it equally, so ratios stay fair, though it shrinks the gap on the fastest operations. The same protocol is how Python and C++ engines will plug in later: each language gets its own `benchd` driver and nothing else changes.

### The benchd protocol

`benchd` is harness-owned: we ship it, and the upload overlays our copy. It opens the store with the public API every chapter kept stable:

```go
d, err := db.Open(dir, db.Options{Sync: wal.SyncAlways})
d.Put(k, v); d.Get(k); d.Delete(k); d.Scan(start, end, fn); d.Close()
```

Every other option is left at zero, so tuning means changing the defaults in the learner's own code. Writes are always opened with `SyncAlways`; whether the engine honours it is checked by the durability gate, not trusted.

Framing over a Unix socket in a shared in-memory `emptyDir`. Each request is `op u8 | uvarint keyLen | key | uvarint valLen | value`. Each response is `status u8 | uvarint len | payload`. The ops are PUT, GET, DELETE, SCAN (start, end, limit; streamed pairs and a terminator), STATS and CLOSE. Each client connection is handled concurrently, so engines that allow parallel reads benefit.

## Workloads

Fixed generator code per workload version. The seed is drawn per submission, so an engine cannot be tuned to one key sequence; the reference runs with the same seed in the same job. Keys are 16 to 24 bytes and values 1 KiB. Key popularity follows a Zipfian distribution (θ 0.99), the YCSB default.

| Phase | Clients | Operations | What it stresses |
| --- | --- | --- | --- |
| Load | 1 | 1M puts, ascending-ish with 10% shuffle | flush, write amplification |
| A | 4 | 1M, 50% get / 50% update | mixed path, compaction under load |
| B | 4 | 1M, 95% get / 5% update | Bloom filters, block reads |
| C | 4 | 1M gets, 10% of them for absent keys | read path, filter false positives |
| E | 4 | 100k scans of up to 50 keys | merging iterator |
| Churn | 1 | delete 30% of keys, rewrite 20%, then 500k gets | tombstones, space reclaim |
| Trace | 4 | a fixed slice of real production traffic (see below) | everything, with real skew and sizes |
| Recovery | — | SIGKILL mid-write, reopen, verify | WAL replay time, durability |

The sizes are placeholders for the calibration spike (milestone 0). The constraint: the dataset (about 1 GiB) must be well above the engine's memory limit (256 MiB, page cache included under cgroup v2), so reads really hit the disk. One candidate run plus one reference run must also fit in about 6 minutes, so three pairs take under 20 minutes per submission.

`SyncAlways` makes the load phase one fsync per put. On local NVMe that is tens of microseconds, so 1M puts is roughly a minute. The calibration spike confirms or shrinks this.

### Real-world phase: replaying production traffic

The generated phases are deterministic and cover everything we want to test, but they are still a model. One phase replays real traffic instead, so a learner can say "my engine handled a slice of Twitter's production cache traffic at 1.3× the reference".

**Source.** Twitter's anonymized Twemcache traces ([twitter/cache-trace](https://github.com/twitter/cache-trace), from the OSDI '20 paper "A large scale analysis of hundreds of in-memory cache clusters at Twitter"). There is one CSV row per request: timestamp, anonymized key, key size, value size, client id, operation, TTL. The full set is 2.8 TB compressed across 54 clusters. [SNIA](http://iotta.snia.org/tracetypes/17) serves single parts of about 1.8 GB and 99M requests, which is all we need. The fallback is Meta's CacheLib KV traces ([CacheLib docs](https://cachelib.org/docs/Cache_Library_User_Guides/Cachebench_FB_HW_eval/), [CMU mirror](https://ftp.pdl.cmu.edu/pub/datasets/cacheDatasets/cacheDatasets/metaKV/)), which Meta's docs say are under CacheLib's license.

**Choosing the slice (milestone 0).** Pick one cluster whose mix is neither almost all reads nor almost all writes. The paper found many clusters far more write-heavy than earlier studies assumed, so there are options. Take a contiguous run of about 5M requests (sized by calibration) and note the cluster, file and offset in the workload version.

**Preparing it (offline, once per workload version).** A script in the repo (`bench/traces/prepare`) turns the raw slice into the harness's own binary op file and records its SHA-256:

| Trace operation | Becomes |
| --- | --- |
| `get`, `gets` | GET |
| `set`, `add`, `replace`, `cas`, `append`, `prepend`, `incr`, `decr` | PUT, with a value of the traced size |
| `delete` | DELETE |

- **Values.** The traces carry sizes, not contents. Each value is generated deterministically from `hash(key, request index)` at the traced size, so the harness can check every GET without storing the values.
- **Keys** are kept exactly as anonymized, which preserves real key lengths and real popularity skew.
- **Dropped:** TTL (our engine has no expiry) and timestamps. The replay runs as fast as the engine allows, in trace order.
- **Preload.** These are cache traces, so many GETs ask for keys the slice never wrote (cache misses upstream). Before timing starts, every distinct key in the slice is written once at its first traced size, so those GETs read real data instead of all being misses.
- **Order.** Each key is routed to one of the four clients by a hash of the key. Operations on the same key therefore stay in trace order, which keeps the answer check exact, while different keys run in parallel.

**Shipping it.** The op file lives in our object store under `bench/traces/<workload-version>/` and is baked into the harness image for that version, so runs never download it. A trace phase is fixed rather than seeded, so in theory an engine could be tuned to it; the answer check, the generated phases, and the admin review of top entries cover that. If it becomes a problem, cut three slices and pick one per submission.

**Locally.** `make bench` replays a small sample of about 200k operations, if the license allows us to redistribute it. If not, a `make trace` target downloads the part from SNIA and runs the same prepare script.

**License.** Not confirmed yet for the Twitter traces. Check it before we redistribute a slice or bake one into an image (milestone 0). If it does not allow that, use the Meta traces, which are under CacheLib's license.

## Gates (no score unless all pass)

1. **Tests.** The official tests for chapters 1 to 5 pass, with our test files overlaid (`go test ./...`, then `go vet`). Run in the build pod.
2. **Answers.** Every GET and SCAN result in every phase is checked against the harness's own model of what was written (a compact hash of key to value version). One wrong answer fails the run.
3. **Crash.** In the recovery phase every acknowledged write must be readable after a SIGKILL and reopen. This catches ordering and torn-write bugs, but not a skipped fsync: the OS page cache survives a killed process.
4. **Power loss.** A separate short phase runs the engine on [LazyFS](https://github.com/dsrhaslab/lazyfs), a FUSE filesystem that throws away every write not yet fsynced when told to. Write, drop unsynced data, reopen, verify every acknowledged write. This is what makes `SyncAlways` enforceable without trusting the code. See the security notes: FUSE needs extra privileges in the trusted container.
5. **Limits.** Under the time limit per phase, the memory limit, and the disk quota (the data directory may not exceed 4× the logical data size).

## Metrics

Everything that matters is measured outside the engine process. The harness container shares the pod's PID namespace and reads the engine's `/proc/<pid>/io` and `/proc/<pid>/status`.

| Metric | How | Direction |
| --- | --- | --- |
| Throughput per phase | operations / wall time, harness clock | higher |
| Latency p50, p99, p99.9 per phase | log-bucketed histogram in the harness (stdlib only) | lower |
| Write amplification | `write_bytes` from `/proc/<pid>/io` ÷ user bytes written | lower |
| Read amplification | `read_bytes` ÷ GET count, phase C | lower |
| Space amplification | data dir size after churn ÷ live logical bytes | lower |
| Recovery time | SIGKILL to first successful GET | lower |
| Peak memory | `VmHWM` of benchd | lower |

The engine runs closed-loop: each client waits for its reply before sending the next request. The reported latencies are therefore service times and miss queueing delay (coordinated omission). The theory says so plainly, and because the reference runs closed-loop too, the ratios stay fair.

## Scoring

For each metric, `ratio = reference / candidate` for lower-is-better metrics and `candidate / reference` for the others, so above 1 always means better than the reference. Each ratio is the median over the three candidate/reference pairs.

The composite is a weighted geometric mean of the ratios, times 1000, so the reference scores 1000 on any node. Initial weights: throughput 40% (spread across phases, with the trace phase counting double), p99 latency 25% (the same split), write amplification 15%, space amplification 10%, recovery time 5%, memory 5%. Weights are part of the workload version, so changing them never silently reorders an old leaderboard.

Noise guard: if the three reference runs in a job spread more than 10% on a scored metric, the job reruns once on a fresh node, then reports "noisy" without a score.

## Leaderboard

Per language and per workload version, one row per user (their best passing submission): composite score, top metric ratios, and a submitted date. Before the first public launch, an admin reviews the code of the top entries (the source tarball is kept) for anything that games the harness. Raw numbers appear on results pages, never on the board.

## Infrastructure

### Node pool `labs-bench`

A new Karpenter pool in the style of `nodepool-spark.yaml`:

- Instance types with local NVMe, so disk latency does not depend on EBS burst credits: `m7gd.large` (arm64, matching the Spark pool). Choose the final type in the calibration spike.
- `instanceStorePolicy: RAID0` on the EC2NodeClass, so `emptyDir` volumes land on the NVMe drive.
- Taint `devlabs.io/pool=bench`; the bench pod requests nearly the whole node, so it never shares one. That also rules out side channels between learners.
- On-demand only: a spot interruption would void a 20-minute run.
- `consolidationPolicy: WhenEmpty`, `consolidateAfter: 2m`, and a CPU limit that caps how many run at once (the cost ceiling).
- Same hardening as the other learner pools: io_uring off, IMDS hop limit 1.

The build pod can run on the same pool or a cheaper shared one; it is short and needs no NVMe.

### Pods

Created by the backend as YAML through `runKubectl`, like `linuxBox.ts`, in a per-submission namespace with a deny-all NetworkPolicy (egress included; the harness talks to the engine over the Unix socket, and the API reads results from the object store).

- **Build pod.** It downloads the source tarball, overlays the harness-owned files (`cmd/benchd`, `go.mod`, every `_test.go`), then runs `go vet`, `go test ./...` and `go build` with `GOFLAGS=-mod=mod GOPROXY=off`; the project is stdlib-only, so no network is needed. It uploads the binary and the test log. 3-minute deadline.
- **Bench pod.** `shareProcessNamespace: true`. Two containers:
  - `harness`: our image. It holds the reference binary for the workload version, drives the runs, and writes `results.json`.
  - `engine`: a small trusted loop that (re)starts whichever binary the harness selects (`reference` or `candidate`) on a fresh data directory. It runs as non-root, with all capabilities dropped, `seccompProfile: RuntimeDefault`, a read-only root filesystem, a pids limit, and memory limit 256 MiB.
- `activeDeadlineSeconds` 30 minutes on the bench pod, and `automountServiceAccountToken: false` on both pods.

Both binaries run in the same container, with the same limits, on the same drive. A fresh data directory per run and alternating order (ref, cand, ref, cand, …) spread out thermal and NVMe effects.

### Backend

New table, not `submissions`: that table is tied to Spark sessions.

```sql
CREATE TABLE IF NOT EXISTS bench_submissions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  minor_id         TEXT NOT NULL,          -- 'lsm-tree'
  language         TEXT NOT NULL,          -- 'go'
  workload_version TEXT NOT NULL,
  status           TEXT NOT NULL,          -- queued | building | running | done | failed | noisy
  gate_failures    JSONB,
  source_key       TEXT NOT NULL,          -- object store tarball
  results_key      TEXT,
  score            DOUBLE PRECISION,
  ratios           JSONB,
  node_type        TEXT,
  error            TEXT,
  submitted_at     BIGINT NOT NULL,
  started_at       BIGINT,
  finished_at      BIGINT
);
CREATE INDEX IF NOT EXISTS idx_bench_board
  ON bench_submissions (minor_id, language, workload_version, score DESC)
  WHERE status = 'done';
```

- `POST /api/minors/:minorId/bench` with `{ language, files }`. Only paths that exist in the chapter 6 starter are accepted, plus new `.go` files under `internal/`. Limits: 2 MiB total, 3 submissions per user per day, one in flight.
- `GET /api/minors/:minorId/bench/:id` returns the status, gates, ratios and raw metrics.
- `GET /api/minors/:minorId/bench/leaderboard?language=go`.
- A worker in the backend claims queued rows with `SELECT … FOR UPDATE SKIP LOCKED`, runs the build pod and then the bench pod, and polls pod status. Concurrency is capped to match the pool limit.
- Object store layout `bench/<userId>/<submissionId>/{source.tgz,build.log,results.json}`, pruned like `pruneWorkspaceJobArtifacts`: keep the latest 5 per user, plus anything on a leaderboard.

### Frontend

- Chapter 6 `benchmark` in `constants/minors.ts`, with theory, the `make bench` task, and optional tuning tasks that are not counted toward completion.
- A **Submit for benchmark** action in the workspace for chapters marked `benchmark: true`. It posts the current files, which already carry the learner's chapters 1 to 5.
- A results page `/minors/lsm-tree/bench/:id` with a gate checklist, a ratio bar per metric (1.0 marked), the raw numbers in a disclosure, and "why" links to chapters.
- A leaderboard tab on the minor page, per language.

## Security

This is untrusted code execution with a stopwatch attached, so it gets a full review (Hanuman) before launch. Specific concerns:

- **LazyFS needs FUSE.** That means `/dev/fuse` and `CAP_SYS_ADMIN` in the trusted harness container of the power-loss phase, with mount propagation to the engine container. Options, in order of preference:
  1. Run the power-loss phase as a separate pod whose only untrusted part is the engine, as a different uid, so a shared PID namespace cannot ptrace the privileged container.
  2. Run that phase in a Firecracker microVM.
  3. Skip power-loss for v1, rely on code review of top entries, and say so on the board.
- **Shared PID namespace.** It lets the engine see harness processes. It cannot signal or ptrace them across uids without capabilities; verify this in the review.
- **Resource abuse.** Disk fill (quota on `emptyDir` via `sizeLimit`), fork bombs (pids limit), CPU spinning (exclusive node; just a slow result).
- **Data exfiltration.** Nothing secret is on the node. IMDS is unreachable from pods (hop limit 1). There is no service-account token and no egress.

## Cost

One on-demand `m7gd.large`-class node for about 20 minutes per submission, plus a short build. At current on-demand prices that is a few cents per submission. With 3 submissions per user per day and a pool cap of a handful of nodes, worst-case spend is bounded by the pool limit. Confirm the exact prices for our region in the AWS calculator.

## Milestones

0. **Calibration spike.** Run the reference alone on two or three instance types and several nodes. Measure the spread between pairs and between nodes. Fix dataset sizes, phase lengths, the memory limit and the instance type. Pick the trace cluster and slice, confirm its license, and write `bench/traces/prepare`. Exit criterion: the reference's ratio against itself stays within ±5% on every scored metric, the trace phase included.
1. **Chapter 6, local.** `benchd`, the protocol, the harness with every phase but power-loss (the trace replay included), and `make bench` with a small workload and a trace sample. Theory and README. No infra.
2. **Hosted runner.** Node pool, build and bench pods, queue, API, results page; gates 1, 2, 3 and 5.
3. **Power-loss gate and security review.** LazyFS phase, then the Hanuman review and its fixes.
4. **Leaderboard** and shareable result cards. Admin review of top entries before the first public launch.
5. **Other languages.** `benchd` drivers for Python and C++ once their chapters 2 to 5 exist; separate boards.

## Open questions

- Dataset scale and time budget per submission (settled by milestone 0).
- Twitter or Meta traces for the real-world phase, depending on license and on which slice gives the most useful read/write/delete mix.
- arm64 or x86 for the bench pool. arm64 matches the Spark pool and is cheaper; the learner's laptop does not need to match.
- Public leaderboard from day one, or private reports first while we watch for gaming?
- Submission rate limit: is 3 per day right for iteration, given `make bench` exists locally?
- Should the leaderboard show the learner's GitHub link or a write-up of what they changed?
