# QuickBite — design a queue, do not borrow one

Same hosts as Lab 2.1. Roles unchanged.

| Host | Role |
|------|------|
| `ds-spark-01` | **ResourceManager** (UI `:8088`) — owns live `capacity-scheduler.xml` |
| `ds-spark-02` / `ds-spark-03` | **NodeManagers** (UI `:8042`) |
| `shell` | Submit client + ticket notes / draft XML |

Queues on arrival: `default`, `production`, `adhoc`. There is **no** `analytics` leaf yet.

## 1. Reproduce the miss

```bash
sed -n '1,80p' ~/lab/submit-analytics-probe.sh
sed -n '1,120p' ~/lab/first_submit.out
yarn queue -status analytics || true
```

The lasting path already says `--queue analytics`. The scheduler does not have that leaf.

## 2. Read the ticket and the broken draft

```bash
cat ~/lab/notes.txt
sed -n '1,120p' ~/lab/capacity-draft.xml
```

The draft adds the queue **name** without making sibling capacities sum to 100. `yarn rmadmin -refreshQueues` will reject that math.

## 3. Design on the ResourceManager

Open a terminal on **`ds-spark-01`**. Edit:

```text
/opt/hadoop/etc/hadoop/capacity-scheduler.xml
```

Requirements from the ticket:

- Leaf `analytics` exists under `root`
- Sibling capacities sum to **100**
- `analytics` capacity ≥ **20**, `maximum-capacity` **100**, `user-limit-factor` ≥ **2**
- `production` stays ≥ **50** (do not gut the production lane to invent room)
- Do **not** inflate `default` as a shortcut
- Do **not** point the analytics probe at `production` / `adhoc`

`user-limit-factor` matters: with the default of 1, a single user is capped at the queue's absolute share. On a small lab cluster that share can be smaller than the ApplicationMaster ask plus an executor — the app sits RUNNING with no executors until you raise the factor (or the capacity).

Apply without restarting the RM:

```bash
yarn rmadmin -refreshQueues
yarn queue -status analytics
```

## 4. Prove it

Back on `shell`:

```bash
~/lab/submit-analytics-probe.sh
yarn application -list -appStates ALL
```

Capture the successful `application_…` in `analytics`.

## 5. Investigation

Failure → design math → apply method → proof. Submit grades the live scheduler shape and a successful analytics run — borrowing another team's queue fails the grade.
