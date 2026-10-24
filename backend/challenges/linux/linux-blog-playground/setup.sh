#!/usr/bin/env bash
# Empty home for the blog playground. Does not source _lib/lab.sh: that file's
# grade trap would turn a failed kubectl into a successful setup.
set -euo pipefail

: "${LEARNER_NS:?LEARNER_NS is required}"
BOX_POD="${BOX_POD:-box}"
BOX_CONTAINER="${BOX_CONTAINER:-box}"

kubectl -n "$LEARNER_NS" exec -i "$BOX_POD" -c "$BOX_CONTAINER" -- bash -euo pipefail -s <<'EOF'
install -d -o learner -g learner -m 755 /home/learner/playground
if [ ! -f /home/learner/playground/scratch.sh ]; then
  cat > /home/learner/playground/scratch.sh <<'SH'
#!/bin/bash
# Try a command from the blog, then press Run.
echo "hello from $(whoami)"
pwd
ls
SH
  chown learner:learner /home/learner/playground/scratch.sh
fi
if [ ! -f /home/learner/playground/scratch.py ]; then
  printf '%s\n' '# Try a snippet from the blog, then press Run.' 'print("hello from the playground")' \
    > /home/learner/playground/scratch.py
  chown learner:learner /home/learner/playground/scratch.py
fi
EOF
echo "ok: playground home ready"
