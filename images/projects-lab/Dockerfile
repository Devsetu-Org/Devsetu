# Learner shell for Projects (minors/majors): Go + Python + C++ toolchains, no systemd.
# Pods run `sleep infinity` as PID 1 under a `learner` user (same shape as unprivileged
# Linux boxes). Toolchains are baked in — chapters stay stdlib-first; package mirrors
# (later) are for rare non-stdlib deps, not for installing compilers at runtime.
#
# Tag: devsetu/projects-lab:v0.1
FROM ubuntu:24.04

ARG TARGETARCH
ARG GO_VERSION=1.22.10

ENV DEBIAN_FRONTEND=noninteractive \
    GOPATH=/home/learner/go \
    PATH=/usr/local/go/bin:/home/learner/go/bin:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash-completion ca-certificates curl wget \
    less nano vim file tree \
    procps psmisc htop lsof \
    tar gzip zip unzip xz-utils \
    git make \
    python3 python3-venv python3-pip \
    g++ gdb \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Official Go toolchain (arm64 on labs-projects / Graviton; amd64 for local Intel / CI).
RUN arch="$TARGETARCH" \
  && case "$arch" in amd64|arm64) ;; *) echo "unsupported TARGETARCH=$arch" >&2; exit 1 ;; esac \
  && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${arch}.tar.gz" \
    | tar -C /usr/local -xz \
  && go version

COPY prompt.sh /etc/devsetu/prompt.sh
RUN for rc in /etc/skel/.bashrc /root/.bashrc; do \
      printf '\n. /etc/devsetu/prompt.sh\n' >> "$rc"; \
    done

RUN userdel -r ubuntu 2>/dev/null || true \
  && useradd -m -u 1000 -s /bin/bash learner \
  && mkdir -p /home/learner/work /home/learner/go \
  && chown -R learner:learner /home/learner \
  && printf '\n. /etc/devsetu/prompt.sh\n' >> /home/learner/.bashrc

WORKDIR /home/learner/work
USER learner

# Keep the container alive for kubectl exec / local docker smoke.
CMD ["sleep", "infinity"]
