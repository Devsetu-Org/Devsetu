# Shared helpers for Kafka-lab setup.sh / grade.sh. Sourced, not run.
#
# Scripts run on the backend host with controller kubectl (never inside the
# shell pod), so the learner cannot alter the grader. Kafka commands
# run in the shell pod, where BOOTSTRAP_SERVERS and PATH are set.
#
# Env from the backend: LEARNER_NS (kf-<user>), KAFKA_POD (the shell pod),
# SHELL_CONTAINER, BOOTSTRAP_SERVERS (broker DNS names), CHALLENGE_ID.
set -euo pipefail

: "${LEARNER_NS:?LEARNER_NS is required}"
KAFKA_POD="${KAFKA_POD:-shell}"
SHELL_CONTAINER="${SHELL_CONTAINER:-shell}"
: "${BOOTSTRAP_SERVERS:?BOOTSTRAP_SERVERS is required}"

# in_shell '<shell command>' — run inside the shell container; prints its output.
in_shell() {
  kubectl -n "$LEARNER_NS" exec "$KAFKA_POD" -c "$SHELL_CONTAINER" -- \
    env PATH="/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
        BOOTSTRAP_SERVERS="$BOOTSTRAP_SERVERS" \
        KAFKA_HEAP_OPTS="-Xms64m -Xmx64m" \
    bash -c "$1"
}

# shell_script <<'EOF' ... EOF — run stdin as bash inside the shell container.
shell_script() {
  kubectl -n "$LEARNER_NS" exec -i "$KAFKA_POD" -c "$SHELL_CONTAINER" -- \
    env PATH="/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
        BOOTSTRAP_SERVERS="$BOOTSTRAP_SERVERS" \
        KAFKA_HEAP_OPTS="-Xms64m -Xmx64m" \
    bash -s
}

# Keep going after a miss so the result can list every task, not only the first one.
_grade_failures=0
_grade_miss=0
fail() {
  echo "FAIL: $*" >&2
  echo "fail: $*"
  _grade_failures=$((_grade_failures + 1))
  _grade_miss=1
}
pass() {
  if [[ "${_grade_failures}" -gt 0 ]]; then
    exit 1
  fi
  echo "PASS: $*"
  exit 0
}
_grade_finish() {
  if [[ "${_grade_failures}" -gt 0 ]]; then
    exit 1
  fi
}
trap _grade_finish EXIT

ok() {
  if [[ "${_grade_miss}" -eq 0 ]]; then
    echo "ok: $*"
  fi
  _grade_miss=0
}
