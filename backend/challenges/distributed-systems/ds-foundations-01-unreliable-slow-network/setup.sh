#!/usr/bin/env bash
# Brief-first Fleetline lab. Full ridernet Go tree + graded Submit land next.
set -euo pipefail

TICKET="${HOME_DIR:-/home/learner}/ticket"
mkdir -p "$TICKET"

cat > "$TICKET/TASK.md" <<'EOF'
# Lab 1.1 — The Unreliable, Slow Network

Fleetline opens a trip with five hops over `netsim`:

request → match → confirm → en route → arrived

## Your job

Implement `Client.Call` with bounded retries (up to `maxAttempts`).

- Leave `CallOnce` unchanged. It is the naive control.
- On `Network.Call` → true, return nil.
- On false, retry.
- If every attempt fails, the error must mention retries, attempts, or exhausted.

`OpenTrip` already runs the five hops through `Call`. You do not rewrite it.

## Note

Graded Submit is not live yet. Use Run in the lab editor to verify.
EOF

if id learner >/dev/null 2>&1; then
  chown -R learner:learner "$TICKET" 2>/dev/null || true
fi
