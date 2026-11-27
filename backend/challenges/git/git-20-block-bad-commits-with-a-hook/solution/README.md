# Solution — Block Bad Commits with a Hook

Core wants every commit subject to start with a ticket id like `FB-1842`. Install a local `commit-msg` hook, commit on a fix branch, and push.

## 1. Install the hook

```bash
cd ~/sprint-service
cat > .git/hooks/commit-msg <<'HOOK'
#!/bin/bash
msg_file="$1"
subject="$(head -n 1 "$msg_file")"
if ! echo "$subject" | grep -Eq '^FB-[0-9]+'; then
  echo "commit-msg hook: subject must start with FB-<number> (got: $subject)" >&2
  exit 1
fi
exit 0
HOOK
chmod +x .git/hooks/commit-msg
```

## 2. Smoke-test

```bash
echo "no ticket" > /tmp/bad
.git/hooks/commit-msg /tmp/bad; echo exit:$?

echo "FB-1842 Document invite hook policy in README" > /tmp/good
.git/hooks/commit-msg /tmp/good; echo exit:$?
```

## 3. Commit on the fix branch and push

```bash
git branch --show-current   # fix/hook-ticket-prefix
echo >> README.md
git add README.md
git commit -m "FB-1842 Document invite hook policy in README"
git push -u origin fix/hook-ticket-prefix
```

Leave `main` alone. `--no-verify` would bypass the hook — do not use it here.
