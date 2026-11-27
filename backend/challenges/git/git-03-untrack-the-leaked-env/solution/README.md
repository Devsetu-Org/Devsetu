# Solution — Untrack the Leaked Local Env

`.env.local` is committed on `fix/agentic-default`; `.cache/` should never be added. Untrack, ignore, commit, push. Leave `main` alone.

## 1. See the leak

```bash
cd ~/sprint-service
git ls-files .env.local
ls -la .env.local .cache
```

## 2. Ignore

```bash
cat >> .gitignore <<'EOF'
.env.local
.cache/
EOF
```

## 3. Untrack without deleting

```bash
git rm --cached .env.local
```

## 4. Commit and push

```bash
git add .gitignore
git commit -m "Stop tracking local env used for agentic debug"
git push origin fix/agentic-default
```
