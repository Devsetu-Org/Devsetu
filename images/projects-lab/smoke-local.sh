#!/usr/bin/env bash
# Smoke-test projects-lab on local Docker. Does not touch EKS.
#
# Usage (repo root):
#   docker build -t devsetu/projects-lab:v0.1 images/projects-lab
#   ./images/projects-lab/smoke-local.sh
#   IMAGE=devsetu/projects-lab:local ./images/projects-lab/smoke-local.sh
set -euo pipefail

IMAGE="${IMAGE:-devsetu/projects-lab:v0.1}"
NAME="projects-lab-smoke-$$"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> starting $IMAGE"
docker run -d --name "$NAME" "$IMAGE" >/dev/null

run() {
  docker exec -u learner -w /home/learner/work "$NAME" bash -lc "$1"
}

pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; exit 1; }

echo "==> toolchain versions"
run 'go version && python3 --version && g++ --version | head -1 && make --version | head -1'

echo "==> Go hello"
run 'mkdir -p /tmp/gohello && cd /tmp/gohello && go mod init smoke >/dev/null && printf "%s\n" "package main" "import \"fmt\"" "func main() { fmt.Println(\"go-ok\") }" > main.go && go run .' | grep -qx 'go-ok' \
  && pass 'go run' || fail 'go run'

echo "==> Python hello"
run 'python3 -c "print(\"py-ok\")"' | grep -qx 'py-ok' \
  && pass 'python3' || fail 'python3'

echo "==> C++ hello"
run 'mkdir -p /tmp/cpphello && printf "%s\n" "#include <iostream>" "int main(){ std::cout << \"cpp-ok\\n\"; }" > /tmp/cpphello/main.cc && g++ -std=c++17 -O2 -o /tmp/cpphello/a.out /tmp/cpphello/main.cc && /tmp/cpphello/a.out' \
  | grep -qx 'cpp-ok' && pass 'g++' || fail 'g++'

echo "==> make + unittest layout"
run 'mkdir -p /tmp/pytest/tests && printf "%s\n" "import unittest" "class T(unittest.TestCase):" "  def test_ok(self): self.assertEqual(1, 1)" > /tmp/pytest/tests/test_smoke.py && cd /tmp/pytest && python3 -m unittest discover -s tests -v' \
  >/dev/null && pass 'python3 -m unittest' || fail 'python3 -m unittest'

echo "==> all local smoke checks passed"
