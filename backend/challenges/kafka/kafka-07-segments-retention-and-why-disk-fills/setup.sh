#!/usr/bin/env bash
# Kafka-07: kafka-1 has 64Mi log dir; debug.dump + keep-forever order.status fill it.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"
create_live_topics

# order.status keep-forever
for i in $(seq 1 40); do
  if in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic order.status --partitions 3 --replication-factor 3 --config min.insync.replicas=2 --config retention.ms=-1 --config cleanup.policy=delete"; then
    break
  fi
  sleep 2
done

# debug.dump unbounded
for i in $(seq 1 40); do
  if in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic debug.dump --partitions 1 --replication-factor 3 --config min.insync.replicas=1 --config retention.ms=-1 --config retention.bytes=-1"; then
    break
  fi
  sleep 2
done

# Fill debug.dump until kafka-1 disk is under pressure (best-effort).
in_shell "
set +e
for i in \$(seq 1 200); do
  # ~256Ki payload
  dd if=/dev/zero bs=256k count=1 2>/dev/null | base64 | tr -d '\\n' | \\
    kafka-console-producer.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --topic debug.dump \\
      --producer-property acks=1 --producer-property linger.ms=0 >/dev/null 2>&1 || break
done
true
"

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/ticket/PAGE.md\" <<'EOF'
# Page — kafka-1 leaving ISR

Log dir on kafka-1 is full. debug.dump was left with retention off.
order.status is keep-forever. Leave rider.dispatch alone.
EOF
"

ok "disk pressure planted on kafka-1"
