# Solution — Blame the Notify Batch Multiplier

Ops is seeing ~9× notify batch sizes. Jordan handed you finding who last changed `NOTIFY_BATCH_MULTIPLIER` — line history, not whole-file history. Investigation only; do not edit the repo.

## 1. Blame the file

```bash
cd ~/sprint-service
git blame -e src/board_notify.py
```

```text
^a1b2c3d (<priya@forgeboard.internal> ... 1) """Sprint board notify batching…"""
...
5e6f7a8b (<someone@forgeboard.internal> ... 5) NOTIFY_BATCH_MULTIPLIER = 9.0  # peak board-load hours
```

Each line shows the commit that last changed **that line**.

## 2. Narrow it down

```bash
git blame -e -L '/^NOTIFY_BATCH_MULTIPLIER/,+1' src/board_notify.py
```

## 3. Confirm with the commit

```bash
git show <sha>
git log -L '/^NOTIFY_BATCH_MULTIPLIER/,+1:src/board_notify.py'
```

You will see the line go `1.0` → `1.2` → `9.0`; the last commit in that chain is your answer.

## 4. Write the answer

```bash
git log -1 --format=%ae <sha> > ~/answers/author-email
cat ~/answers/author-email
```

## Traps

- The author of the **first** commit created the file, not the bad value.
- Another person edited the **neighbouring** lines later — whole-file `git log` is misleading; line-level blame is precise.
