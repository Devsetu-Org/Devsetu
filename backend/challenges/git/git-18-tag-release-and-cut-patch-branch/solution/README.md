# Solution — Tag 2.2.0 and Cut a 2.1 Patch Branch

Two independent jobs. Order does not matter.

## 1. Annotate and push today's 2.2.0 tip

```bash
cd ~/sprint-service
git tag -a v2.2.0 -m "sprint-service 2.2.0"
git show v2.2.0
git push origin v2.2.0
```

Use `-a` (annotated). Plain `git push` does **not** send tags.

## 2. Cut hotfix/2.1.1 from v2.1.0 and land the patch

```bash
git switch -c hotfix/2.1.1 v2.1.0
```

On that branch (still 2.1 — no 2.2 files):

- `config/app.conf`: set `check_interval_seconds = 60`
- `VERSION`: set to `2.1.1`

```bash
git add config/app.conf VERSION
git commit -m "Fix health check interval for 2.1.1"
git push -u origin hotfix/2.1.1
```

## 3. Leave main alone

```bash
git switch main
git status
```

Do not push new commits to `main`. The hotfix must stay based on `v2.1.0`, not on today's tip.
