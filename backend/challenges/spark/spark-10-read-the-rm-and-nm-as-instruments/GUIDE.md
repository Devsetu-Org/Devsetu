# QuickBite on-call — an UNHEALTHY NodeManager and a starved probe

Same hosts as Lab 2.1. Roles unchanged.

| Host | Role |
|------|------|
| `ds-spark-01` | **ResourceManager** (UI `:8088`) |
| `ds-spark-02` | **NodeManager** (UI `:8042`) |
| `ds-spark-03` | **NodeManager** (UI `:8042`) |
| `shell` | Submit client (probe driver lives here) |

Setup already started YARN and submitted the morning probe:

- Name: `store-rollup-probe`
- Driver output: `~/lab/probe.out`
- Resubmit only if you lost the driver: `~/lab/submit-probe.sh`

When you arrive, expect **one** active NodeManager and a probe that is **RUNNING** but producing nothing.

## 1. RM first — what the UI claims

```bash
yarn node -list -all
yarn application -list
```

Record active count, which host is flagged, and the state the RM gave it. Open the application page (or `yarn application -status`) and see what containers the probe actually holds.

```bash
yarn node -status <node-id>    # health report text
```

## 2. On the flagged host — verify the claim

Open the health report (`yarn node -status <node-id>` or the RM Nodes panel). Whatever it names — paths, thresholds, services — check that claim on the host itself:

```bash
jps -l | grep -i NodeManager
df -h
# then the config the report is pointing at under /opt/hadoop/etc/hadoop/
```

If the JVM is still up and the host does not match the report, dig into the NodeManager config that produced it.

## 3. Lasting fix

Fix the real cause on the flagged host, then restart **that** NodeManager so the RM sees it healthy again:

```bash
# on the flagged host
yarn --daemon stop nodemanager
yarn --daemon start nodemanager
```

Wait until the RM lists **two** RUNNING nodes. The probe should get an executor and finish without a resubmit. Turning health checks off, or raising a limit so high it never fires, clears the symptom and fails the grade.

## 4. Investigation

Walk Symptom → Stuck probe → On the node → Fix & lesson. Submit grades the healthy cluster, a FINISHED probe, and your answers — forensics alone is not enough.
