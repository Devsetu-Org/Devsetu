# DevSetu

DevSetu is a hands-on technical learning platform, built for the way the software industry is moving. Language models have made code easy to produce, and writing code alone is no longer the hard part. The crucial thing now is systems understanding: how the software that holds data, traffic, and state actually behaves. Students and early developers still need a real understanding of those systems, and hands-on experience with them.

Lessons and videos are not enough for that. DevSetu puts the work in a sandbox. A learner reads, then does the thing on a live machine opened in the browser, and can fail without taking a production system down. The public app is [devsetu.io](https://devsetu.io). This repository is the platform.

## What the platform is

DevSetu offers three kinds of work.

**Tracks** are guided paths. A student reads a short lesson and then completes graded exercises on a live machine through the browser.

**Projects** are longer. A student builds a complex system in stages, with the explanation on one side and a live workspace on the other, and reaches a working system at the end.

**Research papers** are landmark papers on these systems, one curated each month. The student reads how a system was designed and the choices behind it, checks that reading with short questions, and then maps the system they just learned onto a real scenario.

The aim is to keep this practical and affordable. The learning environments are shared and kept efficient, so a student can work on a real machine without running their own cloud account.

## Repository layout

| Path | What lives there |
| --- | --- |
| `frontend/` | React app (Vite). Tracks, readings, projects, papers, and pricing. |
| `backend/` | Express API, auth, billing, sessions, and the challenge catalog. |
| `backend/challenges/packs/` | One JSON file per lab: situation, task, and spec. Loaded into Postgres when the API starts. |
| `backend/challenges/` | `setup.sh` and `grade.sh` for each lab, plus `solution/`. |
| `frontend/src/fixtures/projectModules/` | Starter repos and theory for projects. |
| `images/` | Container images the labs run. |
| `deploy/` | App host (EC2) and the lab cluster (`deploy/eks/`). |
| `docs/` | Host requirements, cluster setup, and security notes. |

## Local development

Node 18 or newer, and Docker.

```bash
cp backend/.env.example backend/.env
make install
make infra-up    # Postgres + Redis
make dev         # API on :4000, app on :5173
```

- App: http://localhost:5173
- API: http://localhost:4000

`make dev` starts both and stops them on Ctrl-C. `make backend` and `make frontend` run one tier each. `make help` lists the rest.

The API reads `backend/.env`. With SMTP unset, the login code is printed in the API log. `DEV_OTP` in `.env.example` is a local-only shortcut. Do not set it in production.

Labs that open a live machine need a kubeconfig for the lab cluster. Set `K8S_LAB_KUBECONFIG` (see `backend/.env.example`). Without it, the app still runs and the catalog still loads. Starting a lab does not. Cluster bring-up is `deploy/eks/` and [docs/mac-mini-server-setup.md](docs/mac-mini-server-setup.md).

Editing a pack JSON updates the catalog on the next API start. The in-memory catalog can be refreshed without a restart by `POST /api/admin/challenges/reload` with the `X-DevLabs-Reload-Token` header (`CHALLENGE_RELOAD_TOKEN`).

## Deploy

The app host is one EC2 instance: nginx, the API, Postgres, and Redis. See [deploy/README.md](deploy/README.md) and [docs/host-requirements.md](docs/host-requirements.md). Lab machines run on the EKS cluster in `deploy/eks/`.

## What we have today

### Tracks

**DevOps Engineer** is the open track. Labs run on a shared payments system (`order-processor`, `payment-handler`, `notification-service`). The ordered list is `frontend/src/constants/playCatalog.ts`.

| Path | What is open |
| --- | --- |
| Linux | Files, users, permissions, processes, systemd, disks, networking, and a short script, on a real Ubuntu machine with sudo. Readings sit beside the labs. A reading can open an ephemeral Linux playground. |
| Docker | Images, config, volumes, networks, Compose, and day-2 operations on a Docker host. |
| Kubernetes | CKAD-style labs on a shared cluster: pods, rollouts, config, probes, storage, scheduling, and a zero-downtime drain. |

Spark labs and a Spark playground are in the repo. The Data Engineer track is marked coming soon in the catalog, and a session needs MinIO plus the Spark platform API (`backend/.env.example`).

### Projects

The chaptered builds are in `frontend/src/fixtures/projectModules/`. They stay coming soon for learners until a project’s `status` is `ready`. Admins can open a minor that already has content, to review it.

| Project | What the chapters build |
| --- | --- |
| LSM tree | A log-structured merge engine. Go, Python, and C++. |
| B-tree | A B+ tree storage engine in Go: pager, tree, write-ahead log, buffer pool. |
| Consensus | Raft in Go: election, replication, commit, persistence, and a small client. |
| Query engine | A small SQL engine in Go: lexer, parser, catalog, and executor. |
| Cinder | A key-value store, planned as a major. `status` is `planned` in `frontend/src/constants/projects.ts`. |

### Research papers

Paper of the Month is live at `/monthly-paper`. The pool is the Google File System, MapReduce, Dynamo, Raft, and Bigtable. Each paper has short questions; the answers stay on the server until the learner submits their one attempt.

The design exercise that follows a paper, mapping the system onto a real scenario, is the Whiteboard. `WHITEBOARD_ENABLED` is off in `frontend/src/constants/whiteboard.ts`.
