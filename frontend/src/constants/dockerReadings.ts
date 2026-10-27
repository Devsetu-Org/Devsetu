/** Docker track readings (blogs) interleaved with labs. Same shape as the Kubernetes readings. */

import { PLAY_DOMAINS } from './playCatalog';
import type { K8sReading, K8sTrackItem } from './k8sReadings';

export const DOCKER_LABS_PATH = '/track/devops-engineer/docker';
export const DOCKER_READINGS_BASE = `${DOCKER_LABS_PATH}/read`;

export function dockerReadingPath(slug: string): string {
  return `${DOCKER_READINGS_BASE}/${slug}`;
}

export const DOCKER_READINGS: K8sReading[] = [
  {
    id: 'what-a-container-really-is',
    slug: 'what-a-container-really-is',
    trackId: 'B0',
    eyebrow: '',
    title: 'What a Container Really Is',
    showBlogStamp: true,
    gatedByChallengeId: 'docker-00-first-container-on-the-order-box',
    lede:
      'One way to ship an app is to install it directly on the machine. That is a real deployment model today — and it works until you need copies, upgrades, or clean rollbacks. This post is why teams reach for containers, what a **container** is in plain terms, what it is **not**, and the three pieces Docker is built from.',
    sections: [
      {
        id: 'why-not-keep-installing',
        title: 'Why not keep installing apps the old way?',
        body: [
          'One way to run an application is to install the runtime on the machine, drop the code under **`/opt`**, point a service unit at it, and tune a config by hand. That is part of how systems are deployed today, including long-lived and **legacy** services.',
          'On a **single** server that rarely changes, that model is fine. The pain shows up when the same app must exist in more than one place, or when two apps share one host.',
          'A staging copy. A newer language runtime for another service beside the first. A rollback after a bad release. Each of those means repeating the install steps — or discovering that this machine’s packages, paths, and “small fixes” no longer match what anyone wrote down.',
        ],
        bullets: [
          '**“Works on my machine”** — the laptop, the test box, and production each drift a little.',
          '**Shared host fights** — two apps want different library versions; one upgrade breaks the other.',
          '**Slow, risky copies** — cloning a working server means cloning its accidents too.',
          '**Painful rollbacks** — there is no clean “previous version” artifact, only whatever is left on disk.',
        ],
        after: [
          'Containers answer that pressure. Package the app **together with what it needs** into one artifact, run that artifact in its own space, and ship the **same** thing to every environment. The next section is what that artifact and that space actually are — without the kernel jargon yet.',
        ],
      },
      {
        id: 'what-is-a-container',
        title: 'What a container is',
        body: [
          'A **container** is your app running in its **own small world** on a shared Linux machine. Inside that world it has its own files and its own network view. Outside, the machine is still the same **host** — nothing like a second computer was booted.',
          'The world is built from an **image**: a ready-made bundle of the app and its dependencies, like a frozen template. Start the template and you get a container. Start it again and you get another container from the same image. Change the image, start fresh containers, and every environment sees the same contents.',
          'You do not need the kernel details on day one. What matters is the deal: **one image, many identical runs**, isolated enough that apps on the same host stop stepping on each other.',
        ],
        callout: {
          kind: 'idea',
          title: 'The short version',
          body: [
            'Install-by-hand puts the app **onto** the machine. A container brings a **portable copy** of the app’s world **with** it, then runs that copy.',
          ],
        },
      },
      {
        id: 'containers-in-the-wild',
        title: 'Containers in the wild: examples',
        body: [
          'You already depend on this idea even if you have never typed **`docker`**.',
        ],
        table: {
          headers: ['Example', 'What the container is doing', 'What you usually see'],
          rows: [
            [
              '**A web API in the cloud**',
              'Each replica is a container from the same image, behind a load balancer.',
              'The website or app — not the container name.',
            ],
            [
              '**CI that builds and tests your repo**',
              'A fresh container per job, with the toolchain baked into the image.',
              'A green or red check on the pull request.',
            ],
            [
              '**Kubernetes / ECS / Cloud Run**',
              'Schedulers that place and restart containers across machines.',
              'A dashboard of services and versions.',
            ],
            [
              '**Your laptop (maybe)**',
              'Docker Desktop or Colima runs a small Linux VM so Linux containers can start.',
              'A whale icon or a terminal — the containers still need a Linux kernel underneath.',
            ],
          ],
        },
        after: [
          'On this track the machine is a Linux **order box** with Docker already installed. You reach it at a text prompt, the same way you reached Linux.',
        ],
      },
      {
        id: 'not-a-vm',
        title: 'Not a virtual machine',
        body: [
          'A **virtual machine** emulates hardware and boots its **own kernel**. A container does neither. That difference is why containers start in milliseconds and why dozens fit on one host.',
        ],
        table: {
          headers: ['Idea', 'Virtual machine', 'Container'],
          rows: [
            ['Kernel', 'Its own kernel inside the guest', 'The **host** kernel'],
            ['What starts', 'A full guest OS, then your app', 'Your app as a process'],
            ['Isolation', 'Strong hardware boundary', 'Separate view of files and network on one kernel'],
            ['Startup', 'Seconds to minutes', 'Milliseconds'],
            ['Density', 'Few VMs per host', 'Many containers per host'],
            ['On a Mac or Windows laptop', 'The VM **is** the machine you SSH into', 'Docker runs a small Linux VM so containers have a Linux kernel'],
          ],
        },
        after: [
          'If someone says “we shipped a container,” they mean a process from an image — not a tiny cloud VM, even when a VM is quietly underneath on a developer laptop.',
        ],
      },
      {
        id: 'three-pieces',
        title: 'Three pieces: image, container, engine',
        body: [
          'Everything you type with Docker comes back to three layers. From the outside in: you talk to a **client**, the **engine** does the work, and what you create is a **container** from an **image**.',
        ],
        subsections: [
          {
            id: 'image',
            title: 'Image: the frozen template',
            body: [
              'An **image** is a read-only mini filesystem plus metadata: the default command, environment, and ports the publisher documented. Names look like **`alpine:3.20`** or **`devsetu/order-processor:v1.1`**. Think of a class in code: you do not run the class; you construct instances from it.',
            ],
          },
          {
            id: 'container-piece',
            title: 'Container: a running (or stopped) instance',
            body: [
              'A **container** is one instance of an image. Docker adds a thin **writable layer** on top of the read-only image, starts the command as a process, and tracks state and logs. Many containers can share one image. When the main process exits, the container **stops** — it does not idle in the background.',
            ],
          },
          {
            id: 'engine',
            title: 'Engine: the program that does the work',
            body: [
              '**`dockerd`** is the background **engine**. It pulls images, creates containers, and wires networks. The **`docker`** command you type is only a **client**. It sends requests over a socket, usually **`/var/run/docker.sock`**.',
            ],
          },
        ],
        after: [
          '**`docker version`** prints two sections — **Client** and **Server** — because they are separate programs. Being in the **`docker`** group lets you use the socket without **`sudo`**. That access is as powerful as root on the machine.',
        ],
        code: {
          language: 'bash',
          code: `docker version
docker version -f '{{.Server.Version}}'
docker info
# storage driver, container/image counts, where data lives`,
        },
        tableAfter: {
          headers: ['Piece', 'Role', 'Analogy'],
          rows: [
            ['Image', 'Read-only template', 'A class, or a baked AMI you instantiate'],
            ['Container', 'Instance with a writable layer', 'A running (or stopped) object'],
            ['Engine (`dockerd`)', 'Creates and manages containers', 'The service behind the CLI'],
            ['`docker` CLI', 'Client over the socket', 'How you talk to the engine'],
          ],
        },
      },
      {
        id: 'lifecycle',
        title: 'The lifecycle every container walks',
        body: [
          'A container lives exactly as long as its **main process**. **`docker run`** is **create** plus **start**. When the process exits — or you **`docker stop`** it — the container is **exited**. It still has a name, a writable layer, and logs until you **`docker rm`** it.',
        ],
        flows: [
          {
            title: 'States',
            steps: ['created', 'running', 'exited', 'removed'],
          },
        ],
        subsections: [
          {
            id: 'stay-up',
            title: 'Stay running: a named background process',
            body: [
              '**`-d`** detaches so the prompt returns while the process keeps running. **`--name`** chooses a stable name instead of a random one. Anything after the image replaces the image’s default command. **`alpine:3.20`**’s default is a shell with no input — it exits at once — so a long-lived scratchpad needs a command that does not exit.',
            ],
            code: {
              language: 'bash',
              code: `docker run -d --name scratchpad alpine:3.20 sleep infinity
docker ps
# STATUS: Up ...`,
            },
          },
          {
            id: 'one-shot',
            title: 'Run once: print and exit',
            body: [
              'A one-shot container does its job and stops with an exit code. **`docker ps`** lists only running containers. **`docker ps -a`** includes **Exited**. The stopped container is still on the machine until you remove it.',
            ],
            code: {
              language: 'bash',
              code: `docker run --name hello-once alpine:3.20 echo "order box ready"
docker ps                 # not listed: not running
docker ps -a              # STATUS: Exited (0) ...`,
            },
          },
          {
            id: 'logs-outlive',
            title: 'Logs outlive the process',
            body: [
              '**`docker logs`** works on stopped containers. When something finished or crashed, read the evidence before you clean up. **`docker rm`** deletes the container and those logs with it. **`docker rm -f`** stops and removes in one step. A name stays taken until **`rm`** — even a container that was only **created** and never started.',
            ],
            code: {
              language: 'bash',
              code: `docker ps -a --filter name=old-batch
docker logs old-batch
# ... BATCH-ID: B-…. ...
docker rm old-batch`,
            },
          },
        ],
        callout: {
          kind: 'warn',
          title: 'No main process, no running container',
          body: [
            '**`docker run alpine:3.20`** with no command looks like “nothing happened” because the default shell exits immediately. The container did start — then it exited. Check **`docker ps -a`**.',
          ],
        },
      },
      {
        id: 'names-and-tags',
        title: 'Image names and tags',
        body: [
          'Images live in **registries**. Docker Hub is the default: **`alpine:3.20`** means **`docker.io/library/alpine:3.20`**. **`devsetu/order-processor:v1.1`** is the **`devsetu`** account on Hub. Companies run private registries, and lab machines often pull through a **mirror** that caches Hub inside the network.',
          'The part after the colon is the **tag** — a movable label chosen by whoever published the image. **`latest`** is only the default tag name, not a promise of “newest.” Pin real tags (**`3.20`**, **`v1.1`**) so the same command means the same bits next month.',
        ],
        code: {
          language: 'bash',
          code: `docker images
docker pull alpine:3.20`,
        },
        tableAfter: {
          headers: ['Name shape', 'Meaning'],
          rows: [
            ['`alpine:3.20`', 'Official library image on Docker Hub, tag `3.20`'],
            ['`devsetu/order-processor:v1.1`', 'Account `devsetu`, repository `order-processor`, tag `v1.1`'],
            ['`latest`', 'Default tag name only — not “always newest”'],
          ],
        },
      },
    ],
    takeaways: [
      'Hand installs drift across machines. Containers package the app **with what it needs** so every environment runs the same thing.',
      'A **container** is the app in its own small world on a shared host — not a small VM.',
      'An **image** is the frozen template; a **container** is one running (or stopped) instance of it.',
      'The **`docker`** CLI is a **client**; **`dockerd`** is the **engine**. Socket access is root-equivalent on that host.',
      'A container lives as long as its **main process**. Stopped containers keep **logs** and **names** until **`docker rm`**. Pin image **tags**.',
    ],
    relatedLabsIntro:
      'The first lab walks this map on the order box: client and engine, a container that stays up, one that exits, and logs from a stopped container. The next lab runs order-processor itself from an image.',
    relatedLabs: [
      {
        challengeId: 'docker-00-first-container-on-the-order-box',
        label: 'First Container on the Order Box',
      },
      {
        challengeId: 'docker-01-run-order-processor-in-a-container',
        label: 'Run Order Processor in a Container',
      },
    ],
  },
  {
    id: 'images-and-dockerfiles',
    slug: 'images-and-dockerfiles',
    trackId: 'B1',
    eyebrow: '',
    title: 'Images and Dockerfiles',
    showBlogStamp: true,
    gatedByChallengeId: 'docker-03-write-a-dockerfile-for-order-processor',
    lede:
      'A Dockerfile is a recipe that turns your source code into an image, one layer per step. Learn the instructions you will use in nearly every Dockerfile, how layers and the build cache decide whether a rebuild takes one second or five minutes, and the small choices (exec-form CMD, health checks, labels) that make an image pleasant to run.',
    sections: [
      {
        id: 'why-dockerfiles',
        title: 'What problem are we solving?',
        body: [
          'Running other people’s images is half the job. The other half is packaging **your** app: the order service, the payment worker, the nightly export. You could start a container, install things by hand and `docker commit` the result, but then nobody knows what is inside or how to rebuild it.',
          'A **Dockerfile** writes the packaging down as code. It lives next to the source, gets reviewed like code, and `docker build` produces the same image from it every time.',
        ],
      },
      {
        id: 'instructions',
        title: 'The instructions you will actually use',
        body: [
          'A typical Python service needs only a handful:',
        ],
        code: {
          language: 'dockerfile',
          code: [
            'FROM python:3.12-slim              # start from this image',
            'WORKDIR /app                       # cd into /app (created if missing)',
            'COPY requirements.txt .            # files from the build context into the image',
            'RUN pip install --no-cache-dir -r requirements.txt   # run a command at build time',
            'COPY app.py .',
            'ENV APP_VERSION=v1.3               # environment baked into the image',
            'EXPOSE 8000                        # documents the port (does not publish it)',
            'USER 1000                          # stop running as root',
            'CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]   # default command',
          ].join('\n'),
        },
        table: {
          headers: ['Instruction', 'Runs at', 'Notes'],
          rows: [
            ['`FROM`', 'build', 'Every image starts from another one. `-slim` and `alpine` variants are much smaller'],
            ['`COPY`', 'build', 'Paths on the left are relative to the **build context**, the folder you pass to `docker build`'],
            ['`RUN`', 'build', 'Each `RUN` creates a layer. Chain related commands with `&&` and clean up in the same step'],
            ['`ENV`', 'build + run', 'Defaults that `docker run -e` can override'],
            ['`CMD` / `ENTRYPOINT`', 'run', 'What starts when a container starts. `docker run IMAGE cmd...` replaces `CMD`'],
          ],
        },
      },
      {
        id: 'layers-and-cache',
        title: 'Layers and the build cache',
        body: [
          'Each instruction produces a layer, and Docker caches it. On the next build, Docker reuses a cached layer as long as the instruction **and everything before it** are unchanged. The first changed step, and every step after it, runs again.',
          'That is why order matters. Copy the file that rarely changes (`requirements.txt`) and install dependencies **before** copying the code that changes all the time. Then editing `app.py` re-runs only the last `COPY`, and a rebuild takes a second instead of reinstalling every package.',
        ],
        flows: [
          {
            title: 'Edit app.py, rebuild',
            steps: ['FROM (cached)', 'COPY requirements.txt (cached)', 'RUN pip install (cached)', 'COPY app.py (runs)'],
          },
        ],
        callout: {
          kind: 'tip',
          title: 'Offline builds',
          body: [
            'Your lab machine has no internet: images come through a registry mirror, Python packages don’t. Building from a folder of pre-downloaded wheels (`pip install --no-index --find-links=wheels`) is how teams make builds reproducible and independent of PyPI being up.',
          ],
        },
      },
      {
        id: 'exec-form',
        title: 'Exec form vs shell form',
        body: [
          '`CMD ["gunicorn", "app:app"]` (exec form, a JSON list) starts gunicorn directly as PID 1. `CMD gunicorn app:app` (shell form) starts `/bin/sh -c "gunicorn app:app"`, so the shell is PID 1 and gunicorn is its child.',
          'The difference shows up on `docker stop`: Docker sends SIGTERM to PID 1. With exec form, gunicorn receives it and shuts down cleanly. With shell form, `sh` usually ignores it, Docker waits 10 seconds, then SIGKILLs everything, mid-request. Use exec form for `CMD` and `ENTRYPOINT`.',
        ],
      },
      {
        id: 'healthchecks-and-labels',
        title: 'Health checks and labels',
        body: [
          'Docker knows whether the main process is alive, not whether the app works. A `HEALTHCHECK` runs a small command inside the container on a schedule; exit code 0 means healthy. `docker ps` then shows `(healthy)` or `(unhealthy)`, and Compose can wait for a dependency to be healthy before starting the next service.',
        ],
        code: {
          language: 'dockerfile',
          code: [
            'HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \\',
            '  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen(\'http://127.0.0.1:8000/health\', timeout=2)"]',
            '',
            'LABEL org.opencontainers.image.title="order-processor" \\',
            '      org.opencontainers.image.version="1.4"',
          ].join('\n'),
        },
        after: [
          'Slim images often lack `curl`, so probe with what the image already has. **Labels** are free-form metadata (owner, version, source repo); the `org.opencontainers.image.*` keys are the standard ones that registries and scanners understand.',
        ],
      },
      {
        id: 'build-run-replace',
        title: 'Build, run, replace',
        body: [
          'Images are immutable, and a container keeps the image it was started from. Shipping a change is always the same loop:',
        ],
        code: {
          language: 'bash',
          code: [
            'docker build -t quickbyte/order-processor:1.3 ~/order-processor',
            'docker rm -f op-13',
            'docker run -d --name op-13 -p 8081:8000 quickbyte/order-processor:1.3',
            'docker history quickbyte/order-processor:1.3    # one line per layer',
          ].join('\n'),
        },
      },
    ],
    takeaways: [
      'A Dockerfile is the reviewed, repeatable recipe for an image; every instruction adds a layer.',
      'Order steps from least to most frequently changed so the build cache does the work.',
      'Use exec-form `CMD` so the app receives signals and stops cleanly.',
      'A `HEALTHCHECK` tells Docker whether the app works, not just whether the process runs.',
      'Rebuilding doesn’t change running containers; replace them.',
    ],
    relatedLabs: [
      {
        challengeId: 'docker-03-write-a-dockerfile-for-order-processor',
        label: 'Write a Dockerfile for Order Processor',
      },
      {
        challengeId: 'docker-07-health-check-for-order-processor',
        label: 'Health Check for Order Processor',
      },
    ],
  },
];

export function getDockerReading(slug: string | null | undefined): K8sReading | null {
  if (!slug) return null;
  return DOCKER_READINGS.find((r) => r.slug === slug || r.id === slug) || null;
}

/** Readings inserted at the start of the Docker track (before lab 0). */
const DOCKER_READINGS_BEFORE_LABS = ['what-a-container-really-is'] as const;

/** Readings inserted immediately after a given challenge id. */
const DOCKER_READINGS_AFTER_CHALLENGE: Record<string, string[]> = {
  'docker-01-run-order-processor-in-a-container': ['images-and-dockerfiles'],
};

/** Ordered mixed roadmap for the DevOps Docker panel: readings + challenges. */
export function listDockerTrackItems(): K8sTrackItem[] {
  const panel = PLAY_DOMAINS.find((d) => d.id === 'devops-engineer')?.panels.find(
    (p) => p.id === 'docker',
  );
  const items: K8sTrackItem[] = DOCKER_READINGS_BEFORE_LABS.map((readingId) => ({
    type: 'reading',
    id: `reading:${readingId}`,
    readingId,
  }));
  for (const challengeId of panel?.challengeIds ?? []) {
    items.push({ type: 'challenge', id: `challenge:${challengeId}`, challengeId });
    for (const readingId of DOCKER_READINGS_AFTER_CHALLENGE[challengeId] ?? []) {
      items.push({ type: 'reading', id: `reading:${readingId}`, readingId });
    }
  }
  return items;
}
