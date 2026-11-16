#!/usr/bin/env bash
# Kafka-03 (KRaft): live topics; ticket names the keyed produce into rider.dispatch.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

create_live_topics

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/ticket/PRODUCE.md\" <<'EOF'
# Ticket — one dispatch event

Produce exactly one record into \`rider.dispatch\`:

| Field | Value |
|-------|-------|
| key | \`ride-9917\` |
| value | \`{\"status\":\"assigned\"}\` |
| acks | **all** |

Bootstrap from the shell environment: \`\$BOOTSTRAP_SERVERS\`.

Then map: key → partition → leader broker id → ISR → log-end offset.
EOF
"

ok "KRaft live topics ready; produce ticket planted"
