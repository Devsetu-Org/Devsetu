#!/usr/bin/env bash
# Kafka-05: kafka-2 stopped; produces still OK under min.ISR=2; URP non-zero.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"
create_live_topics

# Wait for full ISR before stopping a broker.
for _ in $(seq 1 40); do
  isr="$(topic_isr_sizes rider.dispatch)"
  [[ "$isr" == "3,3,3,3,3,3" ]] && break
  sleep 2
done

stop_broker kafka-2

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/ticket/PAGE.md\" <<'EOF'
# Page — UnderReplicatedPartitions

kafka-2 is down. URP is red. Produces to rider.dispatch still look fine.

Wrong shortcuts (do not):
- kafka-leader-election / preferred replica election by hand
- min.insync.replicas=1
- unclean.leader.election.enable=true

Right move: start kafka-2, wait for ISR=3 on every partition.
EOF
"

ok "kafka-2 stopped; URP plant ready"
