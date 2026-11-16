#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"
create_live_topics

for i in $(seq 1 40); do
  if in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic debug.dump --partitions 1 --replication-factor 3 --config min.insync.replicas=1 --config retention.ms=-1 --config retention.bytes=-1"; then
    break
  fi
  sleep 2
done

# Prefer kafka-1 as leader for as much as we can, then fill disk.
in_shell "
set +e
for i in \$(seq 1 250); do
  dd if=/dev/zero bs=256k count=1 2>/dev/null | base64 | tr -d '\\n' | \\
    kafka-console-producer.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --topic debug.dump \\
      --producer-property acks=1 >/dev/null 2>&1 || break
done
true
"

# Seed backlog for dispatch-desk without committing.
in_shell "
set +e
for i in \$(seq 1 30); do
  printf 'ride-%s:{\"status\":\"queued\"}\\n' \"\$i\" | \\
    kafka-console-producer.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --topic rider.dispatch \\
      --property parse.key=true --property key.separator=: --producer-property acks=1 >/dev/null 2>&1
done
# Commit nothing — create group at earliest by consuming 0 then killing is hard;
# plant offsets at beginning via reset after creating empty group:
kafka-consumer-groups.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" \\
  --group dispatch-desk --reset-offsets --to-earliest --topic rider.dispatch --execute >/dev/null 2>&1 || true
true
"

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" "$HOME/bin" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/bin/drain-dispatch-desk.sh\" <<'EOF'
#!/bin/bash
set -euo pipefail
# Consume until timeout with the desk group — lag drains by reading.
timeout 90 kafka-console-consumer.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" \\
  --topic rider.dispatch --group dispatch-desk --from-beginning \\
  --timeout-ms 80000 >/tmp/drain-desk.out 2>/tmp/drain-desk.err || true
echo \"drained (see /tmp/drain-desk.out)\"
EOF
chmod +x \"\$HOME/bin/drain-dispatch-desk.sh\"

cat > \"\$HOME/ticket/PAGE.md\" <<'EOF'
# Capstone page

kafka-1 disk full (debug.dump). Some rider.dispatch produces fail.
dispatch-desk is behind.

Wrong: min.ISR=1, unclean election, reset-offsets --to-latest.
Right: free disk, let the group read forward.
EOF
"

ok "capstone plant ready"
