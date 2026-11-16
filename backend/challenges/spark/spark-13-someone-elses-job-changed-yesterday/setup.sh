#!/usr/bin/env bash
# Spark-13: no analytics queue yet; plant broken draft + probe wrapper that targets it.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

yarn_seed_all
# Existing tenants only — analytics must be designed by the learner.
yarn_write_capacity_queues 10 70 20
yarn_start_cluster
yarn_seed_shell_helpers

echo "==> plant ticket notes, broken capacity draft, and analytics probe wrapper"
in_shell '
  set -euo pipefail
  mkdir -p "$HOME/lab"

  cat > "$HOME/lab/notes.txt" <<'"'"'EOF'"'"'
QuickBite — analytics onboarding ticket
=======================================
A new analytics team needs a dedicated YARN leaf queue named: analytics

Policy:
  - Do NOT submit analytics work into production or adhoc.
  - Do NOT inflate default capacity to paper over a missing leaf.
  - Give analytics at least 20% absolute capacity.
  - Set analytics maximum-capacity to 100 so it can burst when the
    cluster is idle.
  - Set analytics user-limit-factor to at least 2 (default is 1 — a single
    user is otherwise capped at the queue absolute share and the AM alone
    eats the lane).
  - Keep production at least 50% — other teams still run there.
  - Sibling capacities under root must sum to 100.
  - Apply with yarn rmadmin -refreshQueues on the ResourceManager
    (edit /opt/hadoop/etc/hadoop/capacity-scheduler.xml on ds-spark-01).

Someone left a draft at ~/lab/capacity-draft.xml. It names analytics but
the percentages are wrong — fix the math before you refresh. It also
omits user-limit-factor.

Lasting submit path: ~/lab/submit-analytics-probe.sh
EOF

  # Broken draft: adds analytics without rebalancing → sum 120. Teaching trap.
  cat > "$HOME/lab/capacity-draft.xml" <<'"'"'EOF'"'"'
<?xml version="1.0"?>
<configuration>
  <property>
    <name>yarn.scheduler.capacity.root.queues</name>
    <value>default,production,adhoc,analytics</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.capacity</name>
    <value>10</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.maximum-capacity</name>
    <value>10</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.production.capacity</name>
    <value>70</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.production.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.adhoc.capacity</name>
    <value>20</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.adhoc.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.analytics.capacity</name>
    <value>20</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.analytics.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.maximum-am-resource-percent</name>
    <value>0.5</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.resource-calculator</name>
    <value>org.apache.hadoop.yarn.util.resource.DefaultResourceCalculator</value>
  </property>
</configuration>
EOF

  cat > "$HOME/lab/submit-analytics-probe.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
set -euo pipefail
exec spark-submit \
  --master yarn \
  --deploy-mode client \
  --queue analytics \
  --name analytics-probe \
  --num-executors 1 \
  --executor-cores 1 \
  --executor-memory 512m \
  /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-analytics-probe.sh"
'

echo "==> first submit (expect queue-missing failure; keep the log)"
in_shell '
  set -euo pipefail
  set +e
  "$HOME/lab/submit-analytics-probe.sh" >"$HOME/lab/first_submit.out" 2>&1
  rc=$?
  set -e
  echo "first submit exit=$rc" >> "$HOME/lab/first_submit.out"
  # Queue should still be missing on the live scheduler.
  if yarn queue -status analytics >/dev/null 2>&1; then
    echo "analytics queue unexpectedly exists after first submit" >&2
    exit 1
  fi
  echo "analytics queue absent as expected"
'

in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf 'missing\\n' > /opt/lab/state/analytics_queue_at_start"
in_shell "printf 'missing\\n' > \"\$HOME/lab/analytics_queue_at_start\""

ok "planted missing analytics queue + broken draft + probe wrapper (first submit logged)"
