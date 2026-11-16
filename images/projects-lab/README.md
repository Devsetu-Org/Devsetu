# `devsetu/projects-lab`

Shell image for **Projects** (minors / majors): Go 1.22, Python 3, g++/make/gdb.

- No systemd, no docker — `sleep infinity` as PID 1, user `learner` (uid 1000).
- Toolchains are **baked in**. Chapters are stdlib-first; do not `apt install` compilers at runtime.
- Runs on `devlabs.io/pool=projects` (`./deploy/eks/eks-projects.sh`).

Default tag: `devsetu/projects-lab:v0.1`

## Local build + smoke

```bash
# from repo root (native arch only — fine for laptop checks)
docker build -t devsetu/projects-lab:v0.1 images/projects-lab
./images/projects-lab/smoke-local.sh

# multi-arch publish (same as other lab images)
NO_PUSH=1 ./images/build-all.sh projects-lab   # build both arches, push nothing
./images/build-all.sh projects-lab             # build + push
```

Runtime override (once the backend box exists): `PROJECTS_LAB_IMAGE=devsetu/projects-lab:v0.1`
