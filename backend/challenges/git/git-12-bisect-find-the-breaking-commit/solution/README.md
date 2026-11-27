# Solution — Bisect the Broken Board Status Check

`./check.sh` is the Sprint Service health check. It fails on today's `main` but still passed at tag `v1.0`. Jordan is sure exactly one commit spilled the break; find that first bad SHA with bisect instead of reading ~18 commits by hand.

## 1. Reproduce

```bash
cd ~/sprint-service
./check.sh                 # FAIL on today's main
git tag                    # v1.0 = last known good
```

## 2. Bisect (automated)

```bash
git bisect start
git bisect bad                 # HEAD is broken
git bisect good v1.0           # v1.0 was fine
git bisect run ./check.sh
```

After a few automatic checkouts Git prints `<sha> is the first bad commit`.

## Manual alternative

```bash
git bisect start
git bisect bad
git bisect good v1.0
./check.sh && git bisect good || git bisect bad   # repeat until Git announces the culprit
```

## 3. Record and clean up

```bash
git rev-parse refs/bisect/bad > ~/answers/bad-commit
git bisect reset
git branch --show-current    # main
```

## Why it is fast

With ~18 candidates and a single breaker, bisect needs at most a handful of `./check.sh` runs instead of reading every commit.
