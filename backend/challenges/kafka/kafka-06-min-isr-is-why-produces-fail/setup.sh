#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"
create_live_topics

# Broken topic: RF=2, min.ISR=2
for i in $(seq 1 40); do
  if in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic desk.alerts --partitions 3 --replication-factor 2 --config min.insync.replicas=2 --config retention.ms=604800000"; then
    break
  fi
  sleep 2
done

for _ in $(seq 1 30); do
  isr="$(topic_isr_sizes desk.alerts)"
  [[ "$isr" == "2,2,2" ]] && break
  sleep 2
done

stop_broker kafka-2

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/ticket/PAGE.md\" <<'EOF'
# Page — desk.alerts rejects writes

RF was left at 2. min.insync.replicas is still 2. kafka-2 is down.

Wrong shortcut: set min.insync.replicas=1 so produces go green.

Right move: start kafka-2, restore RF=3, leave min.ISR=2.
EOF
"

ok "desk.alerts RF=2 + kafka-2 down; produce should fail"
