#!/usr/bin/env bash
# Kafka-04 (KRaft): healthy cluster; worksheet only — no faults.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"
create_live_topics

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/ticket/WORKSHEET.md\" <<'EOF'
# Worksheet — rider.dispatch map

Study \`rider.dispatch\` with --describe and --configs. Do not stop brokers.
Do not change min.ISR or unclean.leader.election.enable.

Preferred leader = first id in the Replicas list for that partition.
EOF
"

ok "KRaft live topics ready; worksheet planted"
