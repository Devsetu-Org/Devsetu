# Solution — Branch the Flag Fix into Atomic Commits

## 1. Look around

```bash
cd ~/sprint-service
git status
git diff --stat
git remote -v
grep agentic_sprints_default config/app.conf
```

`main` still has the bug committed. Your working tree already holds three uncommitted edits (config → `beta`, README run notes, version banner). `origin` points at the team forge.

## 2. Branch first

```bash
git switch -c fix/agentic-default
git branch --show-current     # fix/agentic-default
```

(`git checkout -b fix/agentic-default` is the older spelling.) Dirty files travel with you.

## 3. One commit per file

```bash
git add config/app.conf
git diff --staged
git commit -m "Keep agentic sprints default on beta for tenant rollouts"

git add README.md
git commit -m "Document how to run sprint-service locally"

git add src/main.py
git commit -m "Add version constant and print it in the banner"
```

## 4. Push the fix branch (not main)

```bash
git push -u origin fix/agentic-default
git status
git log --stat --oneline --all --graph
git show main:config/app.conf | grep agentic_sprints_default    # still full
```

If a commit grabbed too much: `git reset --soft HEAD~1` (keeps staged) or `git reset HEAD~1` (keeps in the tree), then stage again more carefully.

**If you committed on `main` by accident:**

```bash
git branch fix/agentic-default
git reset --hard HEAD~1          # only if that tip commit is the one you just made
```
