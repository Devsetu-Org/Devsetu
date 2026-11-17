#!/usr/bin/env bash
# Kafka-02 (KRaft): live topics up; order.status absent; wrong ticket + platform note.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

create_live_topics
delete_topic_if_exists order.status

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/ticket/TICKET.md\" <<'EOF'
# Ticket — create order.status

Requester: Dispatch desk
Priority: P3

Please open \`order.status\` with:

- partitions: **3**
- replication factor: **2**
- retention.ms: **604800000** (7 days)
- min.insync.replicas: **1**

(Copied from an old template — confirm against the platform note before applying.)
EOF

cat > \"\$HOME/ticket/PLATFORM.md\" <<'EOF'
# QuickBite platform — topic shape

## order.status (status changelog)

| Setting | Value |
|---------|-------|
| partitions | **6** |
| replication.factor | **3** (a replica on every broker) |
| retention.ms | **259200000** (3 days) |
| min.insync.replicas | **2** |
| cleanup.policy | **delete** |

Do not change topics already in service: \`orders\`, \`rider.dispatch\`,
\`restaurant.notifications\`.

## Control plane

This cluster is **KRaft** (combined broker + controller). There is no ZooKeeper.
EOF
"

ok "KRaft live topics ready; order.status absent; ticket + platform note planted"
