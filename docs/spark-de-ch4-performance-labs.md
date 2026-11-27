# Chapter 4 — Performance Optimization (problem statements)

Data Engineer → Spark. **AQE off** for every lab in this chapter.  
Theme matches existing DE packs: a named desk asks for a correct overnight file; the file may already be *right* — the window is what is broken. Investigation is required before the fix counts.

Runners / packs / grade scripts: later. This doc is the brief + scenario contract.

**Shared chapter rules**

- Cluster is already up. You write the job (or repair the planted job + conf).
- `spark.sql.adaptive.enabled=false` for the lasting path. Turning AQE on fails the lab.
- Do not drop rows, `sample`, or shrink input to “make it fast.”
- Do not add executors / cores beyond the planted shape unless a lab explicitly allows it (none of these do).

---

## Lab 4.1 — The Store That Ate the Shuffle

**Catalog title:** One Key Owns the Shuffle — Investigate and Salt  
**Difficulty:** L2  
**Kind:** Investigation + fix

### Who is asking

**District** (Vesper regional store-ops). They own the overnight store rollup that joins orders to the store directory and sums revenue by `store_id`.

### Situation

The join job finishes with the right totals on a quiet night. On a busy night it burns most of the batch window. Someone already said “add executors.” Someone else said “the SQL is wrong.”

Setup leaves you a planted job that joins a large orders fact to a small store dimension on `store_id`, then aggregates. **AQE is off.** When you open the slow shuffle/join stage, one task owns almost all of the wall clock. The other tasks are short.

That is not “the cluster is slow.” One key owns the shuffle.

### Your task

1. Open the Spark UI for the planted run (or re-run once to reproduce).
2. In Investigation, record: stage id, max vs median (or typical) task duration, and which `store_id` is the hot key (prove it — e.g. a count by `store_id`, not a guess).
3. Fix the join with **salting**: salt the large side, explode/replicate the small side across salt buckets, join on `(store_id, salt)`, then aggregate so totals match the unsalted semantics.
4. Re-run. Prove the stage no longer has a single dominant task and the job finishes inside the time budget.
5. Write the rollup to `OUTPUT_PATH`. Totals must match the golden contract.

### Rules

- Keep every order row that the original job would have kept. No filter-away of the hot store.
- Salt is the graded path for this lab. Broadcast-only or isolate+union without salting is a different lab (4.2).
- Do not enable AQE. Do not raise executor count.
- Output: one row per `store_id` with the contracted metrics (revenue / order count — exact columns in pack later).

### Scenario plant (for implementers)

| Piece | Intent |
|-------|--------|
| Dataset | `orders_skewed` — Zipf on `store_id` (e.g. one store ~90% of rows); `stores` — small dim, unique `store_id` |
| Job | Join + `groupBy(store_id).agg(...)` |
| Conf | AQE false; shuffle partitions moderate (e.g. 20) so the fat partition is obvious |
| Symptom | 1 task ≫ others; job minutes instead of seconds |
| Pass | Checksum + max task duration under budget + Investigation names the hot key |

### Investigation (story order)

1. What did the stage look like before the fix (max vs other tasks)?
2. Which `store_id` held the mass of rows?
3. What did you change (salt width / how the small side was expanded)?
4. After the fix, did task times flatten?

### Done when

Correct rollup on disk, Investigation complete, no single task owning the stage, wall clock under budget.

### Common mistakes

- Adding executors and calling it fixed while one task is still fat.
- Filtering out the hot store.
- Enabling AQE to hide the skew.
- Salting only one side and getting wrong totals / Cartesian blow-ups.

---

## Lab 4.2 — Split the Hot Aisle

**Catalog title:** Isolate the Hot Key and Broadcast  
**Difficulty:** L2  
**Kind:** Investigation + fix (technique locked)

### Who is asking

**District** again. Same overnight join shape as 4.1. After the salt lab, platform policy for *this* ticket says: **do not salt.** The hot store is a known VIP flagship; treat it as its own path.

### Situation

Same class of skew: one `store_id` owns the shuffle. The planted job is again a naive join + rollup with AQE off. This time the graded repair is **isolate → broadcast the hot dimension row(s) → normal join on the cold keys → union → aggregate**.

Salting will make the job fast and the totals right. It still **fails** this lab. The point is a second production tool, not a second chance to paste 4.1.

### Your task

1. Reproduce and confirm skew in the UI (even task spread is *not* the story — one hot task is).
2. Identify the hot `store_id` (same discipline as 4.1).
3. Split orders into hot and cold. Broadcast-join the hot slice to the matching store row(s). Join cold orders to the remaining stores without relying on salt.
4. Union, aggregate, write `OUTPUT_PATH`.
5. Investigation must describe the split and which branch was broadcast.

### Rules

- No salt column, no `rand()`-driven salt, no `explode` of salt buckets on the dimension for a salted join key.
- No dropping the hot store. No AQE. No extra executors.
- Totals must match the same semantic contract as an unsalted correct join.

### Scenario plant

| Piece | Intent |
|-------|--------|
| Dataset | Same skew family as 4.1 (may be a fresh night / different hot id on Submit) |
| Job | Naive join + agg |
| Grade | Static analysis rejects salt fingerprints; plan/event log expects broadcast on the hot path; checksum + time budget |

### Investigation (story order)

1. Hot key and evidence.
2. How you split hot vs cold.
3. Which side was broadcast and why that is safe for the hot path.
4. Why salt was not used on this ticket.

### Done when

Correct output, isolate+broadcast shape in code/plan, salt patterns absent, performance budget met.

### Common mistakes

- Submitting the 4.1 salted job unchanged.
- Broadcasting the entire large orders side.
- Filtering hot rows out to “fix” skew.

---

## Lab 4.3 — Every Cashier Has a Tiny Desk

**Catalog title:** Spill in the UI, Then Fix the Memory Shape  
**Difficulty:** L1–L2  
**Kind:** Investigation + config fix

### Who is asking

**Finance** (Vesper). They own a nightly store rollup on a **wide** orders extract (many string columns). Numbers have been right. The job is late. On-call suggested more executors.

### Situation

The planted job aggregates (and may order) a wide fact. Executors are intentionally small. **AQE is off.** Open the slow stage: task durations are **similar**. Shuffle spill (memory/disk) and often GC dominate. There is no single hot `store_id` owning the stage.

This is not Lab 4.1. More executors copy the same tight desk onto more machines.

### Your task

1. Run or open the planted job. Read stage metrics.
2. In Investigation: state that tasks are even (not skew), and record spill (and GC if visible).
3. Fix **memory shape only** within platform caps (e.g. executor memory ≤ 1g; fractions allowed). Same executor count.
4. Re-run. Spill drops; wall clock drops; rollup still matches golden.
5. Write to `OUTPUT_PATH` (or leave the planted output path — pack decides).

### Rules

- Config-only fix for v1 (no projecting columns required).
- Do not salt. Do not enable AQE. Do not add executors/cores. Do not sample/limit input.
- Do not raise memory above the published cap.

### Scenario plant

| Piece | Intent |
|-------|--------|
| Dataset | `wide_orders` — fat rows, **uniform** (or mild) `store_id` so skew is not the story |
| Conf | e.g. `executor.memory=512m`, storageFraction high enough to squeeze execution; shuffle partitions few so each task is heavy |
| Symptom | Even tasks + high spill |
| Pass | Checksum + spill under budget + duration under budget + caps honored |

### Investigation (story order)

1. Max vs typical task time — why this is not skew.
2. Spill (and GC) numbers you used as evidence.
3. What you changed in memory/fractions (and that executor count stayed put).
4. Spill/duration after the fix.

### Done when

Correct rollup, memory within cap, same parallelism, spill and time budgets met, Investigation distinguishes spill from skew.

### Common mistakes

- Treating it like 4.1 and salting a balanced key.
- Adding executors.
- Raising memory past the cap.
- Enabling AQE.

---

## Lab 4.4 — Two Hundred Tasks for a Quiet Night

**Catalog title:** Wrong Shuffle Partition Count  
**Difficulty:** L1  
**Kind:** Investigation + conf (or job-local) fix

### Who is asking

**Analytics** (Helix). They run a small overnight distinct/aggregate for a QA board. The logic is trivial. The stage graph looks “busy.” The clock disagrees with how little data there is.

### Situation

**Variant A (default plant):** `spark.sql.shuffle.partitions` is left at a large default (e.g. 200) on a **tiny** dataset. Hundreds of near-empty tasks; scheduling overhead dominates.

**Variant B (Submit or second ticket):** partitions set **too low** on a larger night so each task is huge (spill or long tasks). Same lab skill: **right-size shuffle partitions for the data**, not “always 200” or “always 8.”

Pack can ship A on Run and B on Submit, or one plant with a clear ticket note. Learner must not “fix” by deleting data.

### Your task

1. Run the planted aggregate. Open the shuffle stage.
2. Investigation: how many tasks, roughly how much data per task, whether the problem is too many or too few partitions.
3. Set a sane shuffle partition count for this workload (conf or job-local — lasting path preferred).
4. Re-run under time budget with correct output.

### Rules

- Do not change the business logic of the aggregate.
- Do not enable AQE (AQE coalesce would cheat the lesson).
- Do not add executors as the primary fix.
- Output schema/contract unchanged.

### Scenario plant

| Piece | Intent |
|-------|--------|
| Run | Tiny fact + partitions=200 → many empty tasks |
| Submit | Larger fact + partitions too small → heavy tasks / spill |
| Pass | Correct checksum + duration budget + partition count in an allowed band for that case |

### Investigation (story order)

1. Task count vs input size before the fix.
2. Too many or too few — one sentence.
3. Value you chose and why it fits this night.
4. Duration after the change.

### Done when

Correct aggregate, partitions appropriate to the planted night, time budget met.

### Common mistakes

- Leaving 200 on a toy file because “that’s the default.”
- Setting partitions=1 to make the UI look simple.
- Turning on AQE coalesce instead of choosing a number.

---

## Lab 4.5 — The Directory Was Small Until It Wasn’t

**Catalog title:** Broadcast Join vs Sort-Merge Join  
**Difficulty:** L1–L2  
**Kind:** Investigation + strategy choice

### Who is asking

**Registry** (Helix). They enrich overnight auths with a merchant directory. Some nights the directory is tiny. Some nights it is a full publish and no longer fits a casual broadcast.

### Situation

Two tickets (or Run vs Submit) share the same enrich job shape: fact ⋈ directory on a key (e.g. `merchant_id` or `mcc`).

- **Night A:** directory is small → **broadcast** is the right strategy (and sort-merge is wasteful).
- **Night B:** directory is large → broadcast is wrong or forbidden by threshold; **sort-merge** (or non-broadcast) is required.

AQE is off so the strategy does not quietly flip without the learner noticing. Platform may plant a wrong hint or a threshold that forces the bad plan until they fix it.

### Your task

1. For the planted night, explain the plan: broadcast hash join vs sort-merge (Exchange nodes).
2. Choose the strategy that matches the sizes (hint and/or `autoBroadcastJoinThreshold` / job conf — pack picks the allowed levers).
3. Write the enriched output with the same semantic rules as a correct enrich (keep grain, nulls for unmatched if left join, etc. — align with Chapter 3 enrich style).
4. Investigation: why broadcast was safe or unsafe on this night.

### Rules

- Correctness of the enrich first; strategy second — both graded.
- Do not enable AQE.
- Do not convert a required SMJ night into “success” by sampling the directory.
- Do not broadcast a side that exceeds the published size policy for that night.

### Scenario plant

| Piece | Intent |
|-------|--------|
| Run | Small dim → expect BroadcastHashJoin (or equivalent) in explain/event log |
| Submit | Large dim → expect sort-merge / no broadcast of the large side; time + correctness |
| Wrong plant | Optional: forced broadcast of a too-large side → OOM or pathological shuffle; learner must switch |

### Investigation (story order)

1. Approximate sizes of fact vs directory.
2. Plan before your change.
3. Strategy you chose and the lever (hint/conf).
4. Plan after; why the other strategy would be wrong tonight.

### Done when

Correct enriched file, plan matches the night’s size policy, time budget met.

### Common mistakes

- Always broadcasting because “dimensions are small.”
- Always SMJ because “broadcast is scary.”
- Fixing the plan by shrinking input.

---

## Chapter arc (how the five read as a sequence)

| Lab | UI story | Wrong instinct | Right move |
|-----|----------|----------------|------------|
| 4.1 | One fat task | More executors | Salt |
| 4.2 | One fat task | Paste salt again | Isolate + broadcast |
| 4.3 | Even tasks + spill | More executors / salt | Memory shape |
| 4.4 | Silly task count | Ignore defaults | Right-size partitions |
| 4.5 | Join type in plan | One strategy forever | Broadcast vs SMJ by size |

---

## Title mapping (shelf ↔ story)

| Shelf placeholder | Story title |
|-------------------|-------------|
| One Key Owns the Shuffle — Investigate and Salt | The Store That Ate the Shuffle |
| Isolate the Hot Key and Broadcast | Split the Hot Aisle |
| Spill in the UI, Then Fix the Memory Shape | Every Cashier Has a Tiny Desk |
| Wrong Shuffle Partition Count | Two Hundred Tasks for a Quiet Night |
| Broadcast Join vs Sort-Merge Join | The Directory Was Small Until It Wasn’t |

When packs land, prefer the **story titles** on the shelf (same pattern as “The Codes That Had No Name”).
