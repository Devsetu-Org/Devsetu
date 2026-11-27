# Solution — Amend the Tip on fix/agentic-default

## 1. Inspect

```bash
cd ~/sprint-service
git branch --show-current     # fix/agentic-default
git status                    # docs/agentic-default.md untracked
git log --oneline main..HEAD  # three commits, already on origin
git show --stat HEAD
```

## 2. Fold the writeup into the tip

```bash
git add docs/agentic-default.md
git commit --amend --no-edit
git log --oneline main..HEAD  # still three commits, new tip SHA
```

## 3. Push the amended tip (required)

Plain `git push` fails — the old tip is already on `origin`. Publish the rewrite:

```bash
git push --force-with-lease origin fix/agentic-default
git status
git log --oneline --all --graph
```

Leave `main` alone (local and remote).

## Rule of thumb

Amend rewrites the tip. After that tip was already pushed on **your** unmerged fix branch, update origin with `--force-with-lease`. Never plain `--force`, and never rewrite `main`.
