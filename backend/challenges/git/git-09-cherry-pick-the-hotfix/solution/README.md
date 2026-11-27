# Solution — Land the Nightly Crash Hotfix on Release 2.1

Production runs `release/2.1`. That line already has a temporary `digest_batch_size` with no empty-board guard. Priya's real fix is on `main` (`HOTFIX:` …) but two unreleased capacity commits sit under it — merge would drag those into 2.1. Cherry-pick **only** the hotfix onto the release tip; Git will stop on `src/sprints.py`. Keep her safe clamp, continue, then push `release/2.1` so Ops can pick it up. Leave `main` alone.

## 1. Find the hotfix

```bash
cd ~/sprint-service
git log --oneline main
```

Copy the SHA whose subject starts with `HOTFIX:`.

## 2. Cherry-pick onto the release branch

```bash
git switch release/2.1
git cherry-pick <hotfix-sha>
```

Git stops on `src/sprints.py` — release's temporary helper vs Priya's clamp.

## 3. Resolve the conflict

Keep **Priya's** production-safe empty-board clamp (`if card_count <= 0: return 1`, then `min(card_count, …)`). Drop the temporary `return card_count` helper. Delete every conflict marker.

```bash
nano src/sprints.py
grep -nE '^(<<<<<<<|=======|>>>>>>>)' src/sprints.py   # should print nothing
git add src/sprints.py
git cherry-pick --continue
ls src/   # no capacity.py
```

Exactly one new commit on the release tip beyond the pre-pick tip. New SHA is expected — that is normal for a cherry-pick.

## 4. Push the release tip

A local cherry-pick does not update the forge. Ops needs `release/2.1` on `origin` before tonight's deploy. Plain push — the tip only moved forward:

```bash
git push origin release/2.1
```

Do **not** push or rewrite `main`.

## 5. Optional

```bash
mkdir -p ~/answers
echo <hotfix-sha> > ~/answers/hotfix-sha
```

## Notes

- Merging `main` into `release/2.1` fails the lab — unreleased capacity lands with it.
- Keeping the release's temporary helper fails — the empty board still crashes.
- Leave `main` exactly as you found it.
- This lab has no pull-request UI; the push is the finish line.
