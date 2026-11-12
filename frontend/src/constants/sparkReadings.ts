/** Platforms Engineer → Spark. Chapter readings (blogs) before the labs that practice them. */

import type { K8sReading, K8sTrackItem } from './k8sReadings';
import sparkClusterModesImg from '../assets/spark-readings/what-is-spark/spark-cluster-modes.png';
import sparkStandaloneAnatomyImg from '../assets/spark-readings/what-is-spark/spark-standalone-anatomy.png';
import sparkHomeLayoutImg from '../assets/spark-readings/what-is-spark/spark-home-layout.png';

export const SPARK_PLATFORM_LABS_PATH = '/track/platforms-engineer/spark';
export const SPARK_READINGS_BASE = `${SPARK_PLATFORM_LABS_PATH}/read`;

export function sparkReadingPath(slug: string): string {
  return `${SPARK_READINGS_BASE}/${slug}`;
}

const NEXT = {
  whatIsSpark: sparkReadingPath('what-is-spark'),
  /** @deprecated alias while older chapter cards still point here */
  foundations: sparkReadingPath('what-is-spark'),
  yarn: sparkReadingPath('spark-on-yarn'),
  kubernetes: sparkReadingPath('spark-on-kubernetes'),
  automations: sparkReadingPath('platform-automations'),
  observability: sparkReadingPath('observability-and-optimizations'),
  incidents: sparkReadingPath('incidents'),
};

export const SPARK_READINGS: K8sReading[] = [
  {
    id: 'what-is-spark',
    slug: 'what-is-spark',
    trackId: 'B1',
    eyebrow: 'Chapter 1 · Blog 1',
    title: 'What Spark is',
    summary:
      'What Apache Spark is, why it existed after MapReduce, how standalone / YARN / Kubernetes host the same engine, and the Master, Workers, scripts, and folders you touch on a standalone cluster.',
    showBlogStamp: true,
    lede:
      'Before you start a Master or chase a Worker across three hosts, you need a clear picture of **what Spark is**, **why teams adopted it**, and **what a cluster looks like** when Spark runs the machines itself. Chapter 1 labs sit on **standalone**. YARN and Kubernetes come later — same engine, different landlord.',
    relatedLabsIntro:
      'Lab 1 is the bring-up. Read this first, then stand the Master and Workers up and find every path on disk yourself.',
    relatedLabs: [
      {
        challengeId: 'spark-01-stand-up-the-cluster-and-find-everything-on-disk',
        label: 'Stand up the cluster and find everything on disk',
      },
    ],
    followOn: {
      eyebrow: 'Still Chapter 1',
      title: 'Next blogs in this chapter',
      intro:
        'After the cluster is up: the UIs as instruments, tracing a job to a task, where cached data lives, the executor memory map, and how a drain can recreate an outage. Those blogs land beside the labs that practice them.',
      links: [{ label: 'Open the Spark shelf', href: SPARK_PLATFORM_LABS_PATH }],
    },
    takeaways: [
      'Spark is a distributed engine: one driver plans the work, executors run tasks on partitions across machines.',
      'It grew out of MapReduce’s limits — disk between stages, rigid two-step jobs — with in-memory reuse and a richer API.',
      'Standalone, YARN, and Kubernetes are cluster managers. They decide who starts processes. They do not change what a task is.',
      'On standalone, the **Master** tracks Workers and applications. A **Worker** daemon offers cores and memory and launches **executor** JVMs. The **driver** schedules tasks.',
      '**sbin/** starts and stops daemons. **bin/** submits work. **spark-env.sh** is daemon environment on that host. **spark-defaults.conf** is application SparkConf.',
      '**logs/** is what daemons write. **work/** is what applications leave on a Worker. Find both from the live process, not from memory.',
    ],
    sections: [
      {
        id: 'what-spark-is',
        title: 'What Apache Spark is',
        body: [
          '**Apache Spark** is an open-source engine for large-scale data processing. You write a program (Scala, Python, Java, R, or SQL). Spark splits the data into **partitions**, turns your work into a plan of **stages** and **tasks**, and runs those tasks across machines in parallel.',
          'Three words matter early. An **application** is one Spark program with one **driver** process that owns the SparkContext. An **executor** is a JVM on a worker host that runs tasks for that application. A **task** is “one partition of one stage” — the smallest unit of work the scheduler places on a core.',
          'Spark is not a database and not a message bus. It reads from storage and other systems (files, object stores, warehouses, streams), computes, and writes results. Platform engineers care about the processes underneath that story: who starts them, which host they land on, which files they read, and which logs they leave when something dies.',
        ],
        callout: {
          kind: 'idea',
          title: 'Engine vs cluster manager',
          body: [
            'Spark the **engine** plans and runs tasks. A **cluster manager** decides where the driver and executors get CPU and memory. Standalone, YARN, and Kubernetes are cluster managers. Confusing the two is how people “fix Spark” when they actually needed a queue, a namespace, or a Worker process.',
          ],
        },
      },
      {
        id: 'why-spark',
        title: 'Why Spark showed up',
        body: [
          'In the late 2000s, **Hadoop MapReduce** was the default for big batch jobs. It scaled, but every stage boundary wrote to disk, iterative algorithms (machine learning, graph) paid that cost over and over, and the programming model was a narrow map-then-reduce shape.',
          'Spark started at UC Berkeley’s AMPLab around **2009** (Matei Zaharia and colleagues), open-sourced soon after, and entered the Apache incubator in **2013**. The bet was simple: keep working data in memory across steps when you can, support a richer API than two rigid phases, and still run on the same kind of commodity clusters people already had.',
          'What stuck in production was not a slogan about “100× faster.” It was a **unified engine**: batch, interactive SQL, streaming, and libraries for ML and graphs on one runtime, with the same deployment and ops surface. Teams could stop standing up a separate stack for each workload shape.',
          'You will still hear MapReduce and HDFS in the room. Spark did not erase them overnight. It became the compute layer many platforms put on top of object storage, warehouses, and — in Chapter 2 — YARN.',
        ],
        quote:
          'Spark won on reuse and flexibility: keep data close when a job needs many passes, and stop rewriting the world for every new API.',
      },
      {
        id: 'cluster-modes',
        title: 'How a Spark cluster looks',
        body: [
          '“A Spark cluster” always means the same roles in spirit: something that accepts applications, hosts that offer resources, and executor processes that run tasks. Who **owns the machines** and who **starts the JVMs** changes by mode.',
        ],
        figure: {
          image: sparkClusterModesImg,
          imageAlt:
            'Hand-drawn comparison of Spark on standalone (Master and Workers), YARN (ResourceManager and NodeManagers with containers), and Kubernetes (API server and Nodes with executor Pods)',
          caption: 'Same Spark job — different who starts the processes.',
          flush: true,
        },
        table: {
          headers: ['Mode', 'Who places resources', 'What you operate day to day'],
          rows: [
            ['**Local**', 'One JVM on one machine', 'Laptop / unit tests. Not a cluster. Fine for learning APIs, useless for platform drills.'],
            ['**Standalone**', 'Spark’s own Master + Worker daemons', 'start-master / start-worker, spark-env, Master UI. Chapter 1.'],
            ['**YARN**', 'Hadoop ResourceManager + NodeManagers', 'Queues, containers, client vs cluster deploy. Chapter 2.'],
            ['**Kubernetes**', 'API server schedules Pods', 'Namespace, quota, image, driver/executor Pods. Chapter 3.'],
          ],
        },
        after: [
          'Older docs also mention **Apache Mesos**. Treat it as history for this track — production platforms you will meet here are standalone (for learning the bones), YARN, and Kubernetes.',
          'Chapter 1 stays on **standalone** on purpose. There is no ResourceManager and no kube-scheduler between you and the process list. When a Worker is DEAD, you are looking at a Spark daemon and a host — not a container state machine.',
        ],
        callout: {
          kind: 'scope',
          title: 'What this blog covers',
          body: [
            'From here down we stay in **standalone**: Master, Workers, how executors get launched, the scripts under `$SPARK_HOME`, and the folders that hold conf, logs, and work. Driver UI deep-dives, caching, and memory math are later blogs in this chapter.',
          ],
        },
      },
      {
        id: 'standalone-roles',
        title: 'Standalone: Master and Workers',
        body: [
          'In standalone mode Spark ships its own cluster manager. You start a **Master** on one host and a **Worker** on each host that should run tasks. Applications register with the Master. The Master grants cores and memory from the Workers that are alive. The Workers start the executor processes.',
        ],
        figure: {
          image: sparkStandaloneAnatomyImg,
          imageAlt:
            'Hand-drawn standalone Spark cluster: Master daemon on ds-spark-01, Worker daemons on ds-spark-02 and ds-spark-03 launching executor JVMs, spark-submit driver registering with the Master',
          caption: 'Master tracks workers. Worker starts executors. Driver schedules tasks.',
          flush: true,
        },
        table: {
          headers: ['Role', 'Process', 'Job'],
          rows: [
            ['**Master**', 'Long-lived daemon', 'Worker registry, application registry, RPC (often **7077**), Master UI (often **8080**). Does not run your map or join.'],
            ['**Worker**', 'Long-lived daemon per host', 'Heartbeats to the Master, advertises cores/memory, launches and supervises executor JVMs, Worker UI (often **8081**).'],
            ['**Driver**', 'Created by spark-submit', 'Owns the SparkContext, builds the plan, schedules tasks onto executors. In client mode it is the submit process.'],
            ['**Executor**', 'JVM per app on a Worker', 'Runs tasks, holds cached blocks, writes shuffle/spill under the Worker’s work directory.'],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'The Master is not the task scheduler',
          body: [
            'The Master answers “which Workers are alive, and how many cores may this application use?” The **driver** answers “which task runs on which executor core?” When a stage is slow, the Master UI can show the application and the executors. The driver’s application UI shows the tasks.',
          ],
        },
      },
      {
        id: 'daemons',
        title: 'Master and Worker daemons',
        body: [
          'A **daemon** here means a long-lived JVM you start with the sbin scripts and leave up across many applications. Drivers and executors come and go with jobs. Master and Worker are the furniture.',
        ],
        subsections: [
          {
            id: 'master-daemon',
            title: 'What the Master daemon does',
            body: [
              'Listens for Workers and for applications. Keeps the roster: which Workers are ALIVE, how many cores and how much memory each offered, which applications are running or completed. Hands out resource grants so Workers know how large an executor to launch. Serves the Master web UI.',
              'It does **not** execute your code. A Master with zero ALIVE Workers is a healthy process and a useless cluster.',
            ],
          },
          {
            id: 'worker-daemon',
            title: 'What the Worker daemon does',
            body: [
              'On startup it contacts the Master URL (for example `spark://ds-spark-01:7077`), registers, and begins heartbeats. It advertises a cores and memory budget from its environment (`SPARK_WORKER_CORES`, `SPARK_WORKER_MEMORY`, and friends in `spark-env.sh`).',
              'When the Master assigns an application a slice of that budget, the Worker **launches an executor JVM** with the requested heap and cores. The Worker supervises that process: if the executor dies, the Master and driver find out through the same registration/heartbeat path that keeps the Worker itself ALIVE or DEAD.',
            ],
          },
        ],
        after: [
          'Heartbeats are why a UI row can lag reality. A killed Worker process can still look ALIVE until the Master’s timeout. A brand-new Worker can look DEAD until the first registration lands. Later in this chapter you will treat every green row as a **claim** to check on the host. For bring-up, know that ALIVE is Master-side state, not a substitute for `ps` on the Worker.',
        ],
      },
      {
        id: 'executors-resources',
        title: 'How Workers launch executors (and what “resources” means)',
        body: [
          'Resource allocation on standalone is a conversation in three parts.',
        ],
        flows: [
          {
            title: 'From submit to executor JVM',
            steps: [
              'spark-submit starts the driver',
              'Driver registers the application with the Master',
              'Master reserves cores/memory on ALIVE Workers',
              'Each chosen Worker starts an executor JVM',
              'Driver schedules tasks onto those executors',
            ],
          },
        ],
        after: [
          '**Worker budget** — What the Worker daemon advertised: total cores and memory it is willing to give. Set on the Worker host (environment / `spark-env.sh`). A Worker that advertised `1` core and `768m` cannot honestly host two fat executors.',
          '**Application ask** — What the driver requested: executor memory, cores per executor, number of executors or total executor cores (`spark-submit` flags and `spark-defaults.conf`). The Master tries to place that ask onto Worker budgets that still have room.',
          '**Executor process** — The JVM the Worker actually forked. Inside it, Spark will later split heap into reserved, user, and unified execution/storage regions. That diagram is its own blog. For bring-up, remember only this: **heap is not the whole bill** — overhead sits outside `spark.executor.memory`, and the Worker must have room for both or the executor will not stay up.',
          'Multiple applications can share one Worker if the remaining cores and memory allow it. That sharing is useful and dangerous: one neighbor’s executor is how “we only raised our job’s memory” still dies. You will diagnose that later. First you need to see executors appear under a Worker at all.',
        ],
        callout: {
          kind: 'tip',
          title: 'Client mode on this track',
          body: [
            'Chapter 1 labs submit in **client** deploy mode: the driver is the `spark-submit` process on the shell host. The Master still places executors on Workers. Cluster deploy mode (driver inside the cluster) matters more once YARN or Kubernetes owns placement.',
          ],
        },
      },
      {
        id: 'scripts',
        title: 'Scripts that come with the install',
        body: [
          'Spark is installed under **`$SPARK_HOME`** (in the labs, `/opt/spark`). You rarely type Java class names by hand. You call scripts, and the scripts load conf and start JVMs.',
        ],
        table: {
          headers: ['Path', 'Examples', 'When you use it'],
          rows: [
            ['**bin/**', '`spark-submit`, `spark-shell`, `pyspark`', 'Run applications and REPLs against an already-up cluster (or local).'],
            ['**sbin/**', '`start-master.sh`, `start-worker.sh`, `stop-master.sh`, `stop-worker.sh`', 'Start and stop standalone daemons on a host.'],
            ['**sbin/spark-daemon.sh**', 'Called by the start/stop scripts', 'Sources env, launches the JVM, points logs at the log directory.'],
          ],
        },
        bullets: [
          '`start-master.sh` on the Master host → `spark-daemon.sh` → sources **`conf/spark-env.sh` on that host** → starts the Master JVM → writes under **`logs/`**.',
          '`start-worker.sh <master-url>` on each Worker host → same chain **on that Worker**. Env from the Master host does not travel with you.',
          '`spark-submit` reads **`conf/spark-defaults.conf`** (and your flags) into the application’s SparkConf. It does not start the Master.',
        ],
        callout: {
          kind: 'warn',
          title: 'Two conf files, two audiences',
          body: [
            '**spark-env.sh** — shell environment for daemons (and some tooling): `JAVA_HOME`, Master host/port, Worker cores and memory, log and work directories when you override them.',
            '**spark-defaults.conf** — `spark.*` properties for applications: executor memory, event log, shuffle, speculation, and the rest.',
            'A default in the wrong file never reaches the process you meant. Lab 1 makes you prove you know which is which.',
          ],
        },
        code: {
          language: 'bash',
          filename: 'bring-up sketch',
          code: `# on ds-spark-01
$SPARK_HOME/sbin/start-master.sh

# on ds-spark-02 and ds-spark-03
$SPARK_HOME/sbin/start-worker.sh "$SPARK_MASTER_URL"

# later, from the shell host
$SPARK_HOME/bin/spark-submit --master "$SPARK_MASTER_URL" ...`,
        },
      },
      {
        id: 'on-disk',
        title: 'What lives under SPARK_HOME',
        body: [
          'After the scripts, the disk layout is the other half of literacy. You will be asked to find these without a wiki open.',
        ],
        figure: {
          image: sparkHomeLayoutImg,
          imageAlt:
            'Hand-drawn SPARK_HOME layout showing bin, sbin, conf, logs, and work folders with what each contains',
          caption: 'Scripts start daemons. conf/ shapes them. logs/ and work/ are what they leave behind.',
          flush: true,
        },
        table: {
          headers: ['Place', 'Who cares', 'What you use it for'],
          rows: [
            ['**conf/spark-env.sh**', 'Daemon start on that host', 'JAVA_HOME, Master address, Worker cores/memory, optional log/work dirs.'],
            ['**conf/spark-defaults.conf**', 'Every application’s SparkConf', 'Executor size, event log, and other spark.* defaults.'],
            ['**logs/**', 'You, on-call', 'Why a Master or Worker exited, heartbeat errors, failed executor launches.'],
            ['**work/**', 'Worker + executors', 'Per-application directories, copied jars, local shuffle and spill.'],
            ['**bin/** / **sbin/**', 'You', 'Submit work vs start/stop daemons.'],
          ],
        },
        after: [
          'Defaults matter. If you do not override them, logs usually land under `$SPARK_HOME/logs`, and Workers use `$SPARK_HOME/work`. Confirm from the **live process** (`ps`, `jps`, open files, the paths in the daemon log header) — installs and images move directories, and guessing from a blog post is how Investigation fails.',
          'A Master that is up with zero Workers is only half the story. Confirm the Master process, confirm each Worker process on its host, then confirm the Master agrees they are **ALIVE**. Lab 1 is that loop, end to end.',
        ],
        callout: {
          kind: 'takeaway',
          title: 'Ready for Lab 1',
          body: [
            'You know what Spark is, why it exists, which cluster mode you are on, what Master and Worker daemons do, how executors get launched, which scripts to call, and which folders hold conf, logs, and work. Stand the cluster up and find every path on disk.',
          ],
        },
      },
    ],
  },
  {
    id: 'spark-on-yarn',
    slug: 'spark-on-yarn',
    trackId: 'B2',
    eyebrow: 'Chapter 2',
    title: 'Spark on YARN',
    summary:
      'YARN places the driver and the executors in containers. The queue, the deploy mode, and everyone else’s jobs decide whether your submit runs.',
    showBlogStamp: true,
    lede:
      'The join you traced on standalone is the same work. On YARN the machines belong to the **ResourceManager**. Spark asks for containers. Whether it gets them is a queue rule, a user limit, and a decision about where the driver lives.',
    relatedLabsIntro:
      'Chapter 2 starts with the same join you traced on standalone, submitted twice on YARN so the driver placement is visible.',
    relatedLabs: [
      {
        challengeId: 'spark-09-submit-the-same-workload-on-yarn',
        label: 'Submit the same workload on YARN',
      },
    ],
    followOn: {
      eyebrow: 'Next chapter',
      title: 'Spark on Kubernetes',
      intro:
        'The resource manager changes again. The worker becomes a pod, the queue becomes a namespace quota, and the classpath becomes an image.',
      links: [
        { label: 'Read Spark on Kubernetes', href: NEXT.kubernetes },
        { label: 'Back to the Spark shelf', href: SPARK_PLATFORM_LABS_PATH },
      ],
    },
    takeaways: [
      'The ResourceManager schedules containers. NodeManagers run them. Spark’s ApplicationMaster is just another container with a special job.',
      '**Client** mode leaves the driver on the host that ran spark-submit. **Cluster** mode puts the driver in a YARN container. An edge host that can disappear is a client-mode outage waiting to happen.',
      '**ACCEPTED** means the application is waiting for containers. The Spark UI often does not exist yet, so it cannot explain the wait.',
      'Queue placement is a platform rule. Raising the default queue to turn one job green takes that capacity from everyone else.',
      '“It worked yesterday” is often another tenant’s backfill hitting a user limit. Killing their ApplicationMaster is a last resort the ticket has to allow.',
    ],
    sections: [
      {
        id: 'yarn-picture',
        title: 'Who owns the machines',
        body: [
          'YARN has two daemons you operate, and one process Spark adds per application.',
          'The **ResourceManager** is the scheduler. It knows the queues, the capacity each queue is promised, and every application’s state. Its UI is the cluster-wide picture: applications, the scheduler page, and the nodes.',
          'A **NodeManager** runs on each host. It launches containers, watches their memory, and keeps the local log directories. The NM UI is the host picture: which containers, for which application, in which local dirs.',
          'The **ApplicationMaster** is Spark’s process inside YARN. In cluster deploy mode the AM **is** the driver. In client deploy mode the AM is a small standby and the driver is outside YARN, in the spark-submit JVM. Executors are containers either way. The NodeManager starts them. The driver schedules tasks onto them, exactly as it did on standalone.',
        ],
        table: {
          headers: ['Piece', 'Standalone equivalent', 'Where you look'],
          rows: [
            ['ResourceManager', 'Master, plus a scheduler', 'RM UI, yarn application -list'],
            ['NodeManager', 'Worker host', 'NM UI, the node’s local logs, ps'],
            ['ApplicationMaster', 'Driver, in cluster mode', 'The AM container, yarn logs'],
            ['Executor container', 'Executor JVM', 'NM UI, Spark UI Executors tab'],
          ],
        },
        flows: [
          {
            title: 'A submit',
            steps: [
              'spark-submit asks the RM',
              'RM allocates an AM container',
              'AM starts and asks for executor containers',
              'NMs launch those containers',
              'Driver schedules tasks',
              'Logs land on the NMs',
            ],
          },
        ],
      },
      {
        id: 'deploy-mode',
        title: 'Where the driver lives',
        body: [
          'Deploy mode is a placement decision, not a performance tweak.',
          '**Client mode.** The spark-submit process is the driver. You see the driver’s stdout in that terminal. The AM container exists so YARN has an application to track, but the brain is on the submitter. If that host is a laptop, a bastion, or an edge box that goes away at lunch, the RPC from the executors fails and the application dies. The executor containers can sit there until YARN times the AM out. The Spark UI, if you had it, was on the edge host too.',
          '**Cluster mode.** The driver runs inside the AM container on a NodeManager. spark-submit uploads the job and returns. The edge host can go away. Driver logs are on the cluster: `yarn logs -applicationId <id>` pulls them from the NodeManagers. The RM UI links to the Spark UI through the AM.',
          'QuickBite’s production shape for a job that must survive the submitter is cluster mode. Client mode is for a person who is sitting with the driver on purpose and will stay there for the whole run.',
        ],
        callout: {
          kind: 'warn',
          title: 'Containers still running is not a live job',
          body: [
            'After a client-mode driver disappears, executors often look healthy on the NM for a while. They have nowhere to send task results. The application is dead. Resubmitting in cluster mode, and showing the new run survive the edge host going away, is the repair. Restarting the executors on the same client driver puts the brain back on the same fragile host.',
          ],
        },
      },
      {
        id: 'read-rm-nm',
        title: 'Read the RM and the NM',
        body: [
          'With one known application running, the RM answers questions the Spark UI never sees, because they are about YARN rather than about stages.',
          'On the RM: which queue the app was submitted to, whether it is RUNNING or ACCEPTED, how much memory and how many cores it was allocated, and which node holds the AM. The scheduler page shows the queue’s used capacity against its guarantee and its max. That page is how you tell “the cluster is full” from “this queue is full”.',
          'On the NM: the containers for that application on that node, their memory, and the path to the local logs. Those local logs are the raw files `yarn logs` aggregates. If the aggregation has not caught up, the NM directory is the primary source.',
          'Check two of the UI’s claims from outside it. `yarn application -status` and `yarn node -list` are the CLI version of the RM. On the node, the container process and the log directory either exist or they do not. A UI row without a process is a stale report. A process without a UI row is an application the RM has lost track of, or a node that has not heartbeated.',
        ],
      },
      {
        id: 'queues',
        title: 'The capacity queue is the product',
        body: [
          'On a Capacity scheduler, a queue has a guaranteed share, a maximum, and a limit per user. Spark does not choose a queue by being a good job. The submit does, with a property such as `spark.yarn.queue`, or it falls into the default.',
          '**ACCEPTED** and sitting there, while another queue has spare capacity, is placement. The application has not been given its AM container, or it has an AM and cannot get executor containers inside the queue it landed in. The Spark UI is the wrong tool: there may be no driver yet, so there is no stage to inspect.',
          'The repair is to submit into the queue the platform assigned to that workload. Raising the default queue’s capacity until the job turns green takes the guarantee away from the queue that was supposed to have it. The next team’s job then sits ACCEPTED, and the platform has taught everyone to edit the scheduler when a submit is in the wrong place.',
        ],
        code: {
          language: 'shell',
          filename: 'queue.conf',
          code:
            '# Illustrative. The ticket names the queue. The default is not a suggestion.\n' +
            'spark.yarn.queue=production\n',
        },
        callout: {
          kind: 'idea',
          title: 'ACCEPTED is a scheduler sentence',
          body: [
            'RUNNING means containers exist and the AM is up. ACCEPTED means YARN has recorded the application and is not giving it the containers it needs. FAILED means it ran and died. The wait is almost always queue, user limit, or a container ask that is larger than any node’s free memory.',
          ],
        },
      },
      {
        id: 'someone-else',
        title: 'Someone else’s job changed yesterday',
        body: [
          'The same submit, the same queue, the same jar. Yesterday it ran. Today it sits ACCEPTED. Nothing in the Spark UI explains it, because the Spark UI is not where tenant limits live.',
          'Look at the scheduler page for that queue’s **user limit**, and at the applications already RUNNING in the queue. Another team’s backfill, started overnight, can hold the user or the queue at its cap. Your AM is queued behind a limit that did not exist yesterday afternoon. The cluster can have free nodes in other queues the whole time.',
          'Free enough capacity, or move your submit to the queue it should have used. The backfill’s ApplicationMaster stays up unless the ticket says to kill it. Killing a neighbor to make your job fit is how a one-team delay becomes a two-team incident, and it does not fix the placement that will fail again tomorrow.',
        ],
        bullets: [
          'Compare the queue’s used capacity with the list of running applications and their users.',
          'A container ask of heap plus overhead can exceed what the queue will still give, even when the queue looks “almost empty” in cores.',
          'Write down the other application id. The explanation for your wait is their allocation.',
        ],
      },
      {
        id: 'yarn-close',
        title: 'What you are practicing',
        body: [
          'This chapter’s labs take the Chapter 1 workload onto YARN and then break placement in the ways production breaks it. Same join, two deploy modes, and a written record of where the driver lived. Five questions that only the RM and NM can answer, checked against `yarn logs` and the node. A job stuck in the default queue while production has room. A client-mode driver on an edge host that disappears. A queue that filled up overnight because of somebody else’s backfill.',
        ],
        table: {
          headers: ['Lab', 'The shift'],
          rows: [
            ['Submit the same workload on YARN', 'Client mode and cluster mode, and which panels show containers and memory'],
            ['Read the RM and NM as instruments', 'Five UI questions, two of them checked from logs and the node'],
            ['Land in the right capacity queue', 'Leave the default queue. Leave its capacity alone'],
            ['Client mode driver is on the wrong host', 'Cluster mode, then the edge host goes away and the job stays'],
            ["Someone else's job changed yesterday", 'User limit and a backfill. Their AM stays unless the ticket allows it'],
          ],
        },
      },
    ],
  },
  {
    id: 'spark-on-kubernetes',
    slug: 'spark-on-kubernetes',
    trackId: 'B3',
    eyebrow: 'Chapter 3',
    title: 'Spark on Kubernetes',
    summary:
      'The driver and executors are pods. Pending, crashloops, and lost shuffle are namespace, quota, image, and the shuffle service.',
    showBlogStamp: true,
    lede:
      'On Kubernetes the worker is a **pod**. The driver pod is the application. Executor pods are the capacity. The questions that used to be “which queue?” become “which namespace, which quota, which image?”',
    relatedLabs: [],
    followOn: {
      eyebrow: 'Next chapter',
      title: 'Platform automations',
      intro:
        'Once you can place a job by hand, the next failure is a human applying that placement differently every time. Desired state, a receipt, and a tool that refuses a bad request.',
      links: [
        { label: 'Read Platform automations', href: NEXT.automations },
        { label: 'Back to the Spark shelf', href: SPARK_PLATFORM_LABS_PATH },
      ],
    },
    takeaways: [
      'The driver pod is the application. If it dies, the job dies. An executor pod can be replaced without a resubmit.',
      '**Pending** is often the namespace quota, or a leftover pod holding it. Raising the cluster-wide quota hides a leak in one namespace.',
      'The image is the classpath. A base Spark image that worked as a runtime still throws ClassNotFoundException for a library the standalone hosts had on disk.',
      'Dynamic allocation removes executor pods. Shuffle files that lived only on those pods disappear with them, unless a shuffle service or a real decommission kept the bytes.',
      'A compound failure is three small ones: wrong namespace, a quota already half spent, an image tag one build behind.',
    ],
    sections: [
      {
        id: 'pods',
        title: 'Driver pod, executor pods',
        body: [
          'Spark on Kubernetes submits to the API server (`k8s://…`). In cluster deploy mode the API server creates the **driver pod** first. The driver then asks the API server for **executor pods**. There is no long-lived worker daemon waiting on the node. The pod is the worker for as long as it runs.',
          'What you record for a running job: the namespace, the node each pod landed on, the container’s requests and limits, and the way you reach the Spark UI (a Service, an ingress, or a port-forward to the driver pod’s 4040). Requests and limits are the memory map from Chapter 1, expressed as Kubernetes numbers. The limit has to cover heap plus overhead, or the kubelet OOMKills the container and the driver reports another lost executor.',
          'Kill one executor pod and wait. The driver notices the loss, reschedules the failed tasks, and requests a replacement pod. You do not resubmit. Resubmitting starts a second driver and a second application id. If the pod you killed was the driver, there is nothing to request a replacement. That application is over.',
        ],
        flows: [
          {
            title: 'One executor disappears',
            steps: [
              'Executor pod is killed',
              'Driver sees the executor drop',
              'Tasks from that pod fail and retry',
              'Driver asks the API server for a new pod',
              'New pod registers',
              'Same application id',
            ],
          },
        ],
        callout: {
          kind: 'idea',
          title: 'Pod name is the new host name',
          body: [
            'On standalone you asked which worker. Here you ask which pod, on which node, in which namespace. The node still matters for disk and for noisy neighbors. The pod is the thing Spark knows as an executor.',
          ],
        },
      },
      {
        id: 'quota',
        title: 'Namespace and quota',
        body: [
          'A job that stays **Pending** with a SparkApplication (or a spark-submit) that looks well formed is usually the scheduler refusing the pod. `kubectl describe` the driver pod. The events line is the sentence: insufficient cpu, insufficient memory, or a **ResourceQuota** exceeded.',
          'Quota is per namespace. A leftover debug application — a driver pod somebody started on Friday and never deleted — holds CPU and memory in the quota until it is gone. The cluster can have a hundred free cores outside this namespace. Your pod still will not schedule.',
          'The repair is to free that leftover, or to submit into the team namespace the ticket names, which has its own quota. Raising the cluster-wide quota, or editing the LimitRange for everyone, makes this job green and makes the next forgotten debug pod more expensive. Pending is often an accounting problem. The jar can be fine.',
        ],
        table: {
          headers: ['What you see', 'What it usually is'],
          rows: [
            ['Pod Pending, quota exceeded', 'This namespace is out of requests. Look for leftover pods.'],
            ['Pod Pending, insufficient memory', 'No node has room for this pod’s request. The ask may be heap plus overhead, larger than you think.'],
            ['Pod OOMKilled', 'The limit is below what the JVM used. Overhead was inside the same limit.'],
            ['CrashLoopBackOff and ClassNotFoundException', 'The image, not the quota.'],
          ],
        },
      },
      {
        id: 'image',
        title: 'The image is the conf and the jars',
        body: [
          'On the standalone hosts, a library was on disk or passed with `--jars`. On Kubernetes the executor starts from a container image and sees what that image contains. The base Spark image runs Spark. It does not contain QuickBite’s connectors, the shaded jar, or the extra dependency a job imported.',
          '**ClassNotFoundException** or **NoClassDefFoundError** on the executors, for a class the same job resolved on standalone, is that gap. The driver might even get further than the executors if the two images differ. `spark.kubernetes.container.image` (and the driver image, if it is set separately) has to be the image the ticket names: the one the platform built with the team’s dependencies.',
          'Point the job at that image and let the stage finish. Installing the jar by hand into a running pod lasts until the next executor pod is created, which is the next scale-up or the next retry. The image is the durable classpath. A pod edit is drift.',
        ],
      },
      {
        id: 'shuffle',
        title: 'Dynamic allocation and the shuffle service',
        body: [
          'Dynamic allocation lets the driver ask for more executor pods when there is work and remove them when there is not. The scale-down is the dangerous half. A finished map task has written shuffle blocks on that executor’s local disk. The next stage’s tasks fetch those blocks by executor id.',
          'Remove the pod, and the fetch fails. The error is a missing map output, often **FetchFailedException**. Spark may retry the stage. If the map output is simply gone, the retry computes it again and the next scale-down deletes it again.',
          'Something has to keep the bytes after the executor leaves. That is an **external shuffle service**, or Spark’s own shuffle tracking with a decommission that migrates blocks before the pod is deleted. If neither is running, the platform default for this job is to leave dynamic allocation off. Starting the service, or turning the feature off for this submit, lets the job finish. Deleting a checkpoint does not bring map output back. A checkpoint is a streaming read position. This failure is a batch shuffle.',
        ],
        callout: {
          kind: 'warn',
          title: 'The master looks fine',
          body: [
            'On Kubernetes there may be no master UI at all. The driver is up, most tasks succeed, and a slice of the stage fails fetching shuffle from an executor that the API server already deleted. The healthy pods are not the evidence. The fetch error and the missing shuffle service are.',
          ],
        },
      },
      {
        id: 'three-questions',
        title: 'Namespace, quota, image',
        body: [
          'The compound lab stacks the three questions. The submit targets the wrong namespace. The right namespace has a quota that is already half used, so a full executor count will not fit until something leftover is removed or the ask matches the ticket. The image tag is one build behind, so the pods that do start are missing a class.',
          'Fixing one of them produces the next symptom. The right namespace with the old image crashloops. The right image in the wrong namespace stays Pending, or lands in a quota you were told not to expand. The job is done when it runs in the namespace from the ticket, on the image from the ticket, with the executor count from the ticket.',
          'That trio replaces “which queue?” from Chapter 2. Learn it as one checklist, because production incidents rarely arrive as a single mis-set field.',
        ],
        table: {
          headers: ['Lab', 'The shift'],
          rows: [
            ['Driver and executor pods', 'Trace namespace, node, requests, and limits. Replace one executor pod without resubmitting.'],
            ['Namespace and quota block the submit', 'Free the leftover or use the team namespace. Leave the cluster quota alone.'],
            ['Wrong image, missing dependency', 'The image named in the ticket. A pod-local jar copy will not survive the next pod.'],
            ['Dynamic allocation without the shuffle service', 'Start the service, or disable dynamic allocation when that is the platform default.'],
            ['Which namespace, which quota, which image', 'All three, and the executor count the ticket asked for.'],
          ],
        },
      },
    ],
  },
  {
    id: 'platform-automations',
    slug: 'platform-automations',
    trackId: 'B4',
    eyebrow: 'Chapter 4',
    title: 'Platform automations',
    summary:
      'Desired state, a provisioner that leaves a receipt, a guardrail that fails closed, drift before reconcile, and a request API other teams can call.',
    showBlogStamp: true,
    lede:
      'A cluster you can repair by hand is a cluster that drifts the moment a second person repairs it differently. This chapter is the small control plane around Spark: a file that describes the shape, a tool that applies it, and a refusal path that leaves the cluster untouched.',
    relatedLabs: [],
    followOn: {
      eyebrow: 'Next chapter',
      title: 'Observability and optimizations',
      intro:
        'The control plane can put event logs in a known place. Something still has to read them, notice one hot task, and tell you when a stream is behind.',
      links: [
        { label: 'Read Observability and optimizations', href: NEXT.observability },
        { label: 'Back to the Spark shelf', href: SPARK_PLATFORM_LABS_PATH },
      ],
    },
    takeaways: [
      'Apply is idempotent. A second run with no diff changes nothing: no restart, no second submit.',
      'The provisioner writes a **receipt**. The next step reads the receipt. A hand edit on a live worker is invisible to both.',
      'A guardrail **fails closed**. A bad executor size or a request for every core starts nothing and leaves the cluster as it was.',
      'Printing drift and repairing drift are two operations. The first one is not allowed to “help”.',
      'Other teams call an API. The API uses the same rules as the guardrail. A rejection writes an audit line, or the denial did not happen.',
    ],
    sections: [
      {
        id: 'desired-state',
        title: 'A file is the cluster shape',
        body: [
          'Infra-as-code here is deliberately small. A desired-state file names the things the platform is willing to guarantee: how many masters and workers, the spark-defaults that applications inherit, and the event-log directory. It does not hide a bash script that SSHes around and hopes.',
          '**Apply** moves a fresh sandbox to that file. The interesting test is the second apply, when the sandbox already matches. An idempotent apply reports no diff and does not restart the master, roll the workers, or resubmit a quiet job. A tool that restarts “just in case” will eventually restart a job that was fine, and nobody will trust the tool enough to run it.',
          'The file is the source. A setting you changed in the live `spark-defaults.conf` and forgot to put back in the file is drift, and the next apply will undo it. That is the point.',
        ],
        code: {
          language: 'yaml',
          filename: 'cluster.yaml',
          code:
            '# Shape, not a runbook.\n' +
            'workers: 2\n' +
            'defaults:\n' +
            '  spark.executor.memory: 512m\n' +
            '  spark.executor.cores: 1\n' +
            '  spark.eventLog.enabled: true\n' +
            '  spark.eventLog.dir: file:///var/log/spark-events\n',
        },
      },
      {
        id: 'provision',
        title: 'Provision the environment, leave a receipt',
        body: [
          'A team request asks for a Spark runtime with two extra jars and one environment variable. The provisioner builds or selects the image, or writes the conf, sets the env, and exits. It does not leave you logged into a worker with vim open.',
          'The **receipt** is the handoff. It records what was applied: image id or conf hash, the jars, the env key, when, and for which request. The next lab, and the next person, read the receipt instead of reverse-engineering a host. A hand edit on a running worker is not in the receipt, so the next reconcile will not preserve it, and the next incident will not see it.',
          '“Works on the worker I edited” is the failure mode of Chapter 3’s image problem, done by the platform team to themselves.',
        ],
      },
      {
        id: 'guardrail',
        title: 'Refuse the bad request',
        body: [
          'The same provisioner or checker receives a bad ask. A 2 GB executor when the platform shape is 512 MB. A request for every core on the cluster. A request that would consume the namespace quota. The tool refuses.',
          '**Fail closed** means the cluster after the refusal is the cluster before it. No partial submit, no application in ACCEPTED, no pod in Pending, no spark-defaults rewritten “for next time”. A warning on stdout followed by a submit is fail open, and it is how a typo becomes the incident in Chapter 6.',
          'The refusal should say which rule fired. “No” without a reason teaches people to bypass the tool and call spark-submit directly, which bypasses every rule the tool was built to hold.',
        ],
        callout: {
          kind: 'warn',
          title: 'The ticket template can be wrong',
          body: [
            'Teams paste a template that asks for 2 GB executors because a slide once said 2 GB. The platform shape for that workload is one core and 512 MB, with the event log on, and a cap so one job cannot take every core. The checker’s job is to prefer the shape over the template.',
          ],
        },
      },
      {
        id: 'drift',
        title: 'See the drift, then reconcile',
        body: [
          'Desired: two executors, 512 MB each, event log on. Running: one executor at 2 GB, event log off. Both statements can be true at the same time. The application is “up”. It is not the application the file describes.',
          'The first command **prints the difference** and changes nothing. No resubmit, no restart, no helpful correction. Seeing drift and fixing drift are separate because the diff is evidence. If the tool repairs while printing, you never get a clean look at what production actually was, and a bug in the repair runs during an inspection.',
          '**Reconcile** is the second command. It resubmits from the file and waits until both executors are running and the event log is on. Waiting is part of the contract. A tool that fires spark-submit and exits has not reconciled. It has hoped.',
        ],
        table: {
          headers: ['Step', 'Allowed to change the cluster', 'Done when'],
          rows: [
            ['Detect', 'No', 'The diff is printed and the process exits'],
            ['Reconcile', 'Yes, toward the file', 'The running app matches the file, including executor count'],
          ],
        },
      },
      {
        id: 'api',
        title: 'A job request API',
        body: [
          'Other teams should not need a raw spark-submit. Raw submit skips the queue, the image, the prefix, the budget, and the cap. The small local API is the front door. It uses the same rules as the bad-request guardrail.',
          'A bad body is rejected. The response says why. An **audit line** records the caller and the application name, because a denial the platform cannot find in a log is a denial you cannot defend at review. A good body submits the job and returns the application id.',
          'The API is not a second policy. If the guardrail refuses 2 GB and the API accepts 2 GB, you have two platforms, and everyone will find the loose one.',
        ],
        code: {
          language: 'json',
          filename: 'reject.json',
          code:
            '{\n' +
            '  "application": "sales.backfill",\n' +
            '  "executorMemory": "2g",\n' +
            '  "cores": "all"\n' +
            '}\n',
        },
        after: [
          'That body is a refusal: executor size outside the shape, and a core ask that means “the whole cluster”. The audit line exists after the 4xx. The cluster does not gain an application.',
        ],
      },
      {
        id: 'automations-labs',
        title: 'What you are practicing',
        body: [
          'Each lab adds one property of a control plane. Together they are the difference between a cluster the platform team operates and a cluster every tenant operates by shell.',
        ],
        table: {
          headers: ['Lab', 'The shift'],
          rows: [
            ['Infra-as-code for the cluster shape', 'Apply the file. Apply it again. The second run is a no-op.'],
            ['Automated environment and dependency provision', 'Jars and one env var, plus a receipt. No hand edit on a live worker.'],
            ['Guardrail: refuse the bad request', '2 GB or “every core” starts nothing. The cluster is unchanged.'],
            ['Detect drift, then reconcile', 'Print the diff with no writes. Then repair from the file and wait.'],
            ['Self-service job request API', 'Bad body rejected with an audit line. Good body submits.'],
          ],
        },
      },
    ],
  },
  {
    id: 'observability-and-optimizations',
    slug: 'observability-and-optimizations',
    trackId: 'B5',
    eyebrow: 'Chapter 5',
    title: 'Observability and optimizations',
    summary:
      'The history server reads event logs. A slow stage may be one task. Spill and GC come before more executors. Lag and the shuffle service are tools, not a memory of the UI.',
    showBlogStamp: true,
    lede:
      'A finished job leaves the driver UI behind. What remains is the **event log**, if someone turned it on and pointed the history server at the directory where it was written. This chapter is how you see a run after it is gone, and how you speed one up without adding machines to a memory problem.',
    relatedLabs: [],
    followOn: {
      eyebrow: 'Next chapter',
      title: 'Incidents',
      intro:
        'The same signals, stacked. A full disk, a checkpoint moved to the end of the input, and a worker that has to leave while a query is still behind.',
      links: [
        { label: 'Read Incidents', href: NEXT.incidents },
        { label: 'Back to the Spark shelf', href: SPARK_PLATFORM_LABS_PATH },
      ],
    },
    takeaways: [
      'The history server only shows runs whose event logs sit in the directory it was given. A blank UI can be the wrong directory.',
      'You cannot recreate an event log the cleaner already deleted. Resubmitting creates a new application id, not the old timeline.',
      'A stage that is one long task is either skew or a stuck task. Speculation copies a slow task. It does not shrink a heavy key.',
      'Spill and GC time are the case for a memory change. Adding executors copies the same shape.',
      'Lag is unread input. The on-call check is a command that exits non-zero, not a tab you remember from yesterday.',
      'Dynamic allocation without a reachable shuffle service drops map output. The checkpoint is not the thing that was lost.',
    ],
    sections: [
      {
        id: 'history',
        title: 'The history server reads event logs',
        body: [
          'While the driver is alive, its UI on port 4040 is the live story. When the driver exits, that port is gone. **spark.eventLog.enabled** writes a file per application under **spark.eventLog.dir**. The **history server** (usually port 18080) does nothing except read the directory in **spark.history.fs.logDirectory** and render those files.',
          'sales-nightly can have finished cleanly, with its event log sitting on disk, and still be missing from the UI. The history server is up. It is pointed at an empty directory, or at last quarter’s path. Point it at the real directory. The workers stay as they are. You do not resubmit the job to “put it back in the UI”. A new submit is a new application, with a new log, and the old run is still only in the old file.',
          'Two platform defaults belong next to that directory. The **cleaner** (`spark.history.fs.cleaner`) is retention. A max age of one hour deletes the nightly run before anyone opens it in the morning. Seven days is the retention this platform uses. **Rolling** (`spark.eventLog.rolling.enabled`) splits a long-running app’s log so one streaming job does not grow a single file without a bound, and so the cleaner can drop old segments. Rolling is a default you set for the next launch. It does not rebuild a file the cleaner already removed.',
        ],
        table: {
          headers: ['Symptom', 'Look here'],
          rows: [
            ['Live job, rich UI', 'Driver UI, port 4040'],
            ['Finished job, missing from history', 'Event log dir on disk, then history server’s log directory'],
            ['Finished job, no file on disk', 'Event log was off, or the cleaner already deleted it'],
            ['One enormous file for a streaming app', 'Rolling is off'],
          ],
        },
        callout: {
          kind: 'warn',
          title: 'A blank history page is a path',
          body: [
            'Confirm the file exists before you touch the job. If the file exists and the UI is empty, change the history server’s directory. If the file does not exist, the run is gone. Resubmitting does not restore the timeline you wanted to read.',
          ],
        },
      },
      {
        id: 'hot-task',
        title: 'Stage time is one hot task',
        body: [
          'Open a slow stage and sort tasks by duration. If the median task is short and one task is most of the stage, the stage is not “the cluster is slow”. One partition is.',
          'Two different mechanisms look the same in that sort. **Skew** means the partition is genuinely bigger: one key, one store, one file that holds most of the rows. A second copy of that task, on another executor, does the same heavy work. **A stuck task** means the partition is ordinary and the executor or the disk under it is not: GC, a slow volume, a fetch that is hung. A second copy can finish quickly because it lands somewhere else.',
          '**Speculation** (`spark.speculation`) is the tool for the second case. Spark launches a duplicate of tasks that are running long past the median and keeps the first result. It is a job setting, not a cluster-wide hope, and it costs extra cores while the copy runs. It is the wrong tool for skew. Skew is fixed in the plan: a salt, an AQE skew join, a filter the ticket allows. Dropping input to make the stage short deletes the rows the job was hired to process.',
        ],
        bullets: [
          'Read max task time against median task time before you read executor count.',
          'Speculation on, for that job, when the ticket says the task is stuck.',
          'A skew path when the ticket says the key is heavy. The input stays.',
        ],
      },
      {
        id: 'spill-gc',
        title: 'Spill and GC before you add executors',
        body: [
          'The stage metrics include shuffle spill (memory) and shuffle spill (disk), and the executor metrics include GC time. A job that looks CPU-bound in the aggregated “task time” line can still be a memory story: the CPU is in GC, or it is in compressing pages that are about to spill.',
          'Spill means the execution side of the unified region was too small for the sort, the aggregation, or the shuffle buffer. Chapter 1’s map is the diagnosis. A storage fraction that is too high leaves a thin execution slice. An executor heap that is too small leaves a thin unified region even with the default fraction. The task writes the overflow to local disk and reads it back. Wall clock goes up. Adding executors runs the same spill on more machines.',
          'The change the ticket asks for is memory fraction or executor memory, at the **same executor count**. Success is spill dropping and stage time falling. If spill drops and time does not, you have a different problem (skew, shuffle service, a slow disk) and more memory is no longer the lead.',
        ],
        callout: {
          kind: 'idea',
          title: 'Horizontal scale copies the shape',
          body: [
            'Two executors that spill become six executors that spill, plus a larger shuffle. Change the memory shape first. Add executors when the tasks are healthy and you still need more cores.',
          ],
        },
      },
      {
        id: 'lag-tool',
        title: 'Lag is a tool',
        body: [
          'For a streaming query, lag is how far the committed offset sits behind the latest input. The Streaming tab shows it as rates and batch durations, and as input rows the query has not processed. A person can read that tab. An on-call check cannot depend on someone remembering to.',
          'The lab ships a small command. It prints lag per query (or per stage SLA the ticket names) and exits **non-zero** when any value is over the limit. A healthy run prints nothing and exits zero, so it can sit in a timer or a pager without a human interpreting a paragraph.',
          'Lag falling because the query read forward is the result you want. Lag falling because the checkpoint was deleted, or because the query was started from `latest`, is a shorter number and a pile of unread input. The tool should still be pointed at the real committed offsets. A green exit after a skipped backlog is a broken tool.',
        ],
      },
      {
        id: 'shuffle-health',
        title: 'The shuffle service is on the critical path',
        body: [
          'This is the Chapter 3 failure, watched as an observability problem. Dynamic allocation is on. Tasks fail fetching shuffle from an executor that has already gone away. The driver is up. The workers that remain look idle and healthy. The shuffle service is not running, or it is not reachable from the executors.',
          'Start it, or fix the address the executors use. Leave the checkpoint alone. The checkpoint records how far a stream has read. The missing bytes are map output from a stage that already ran. Mixing those two stores is how a shuffle outage becomes a replay, or a silent skip, of days of input.',
        ],
        table: {
          headers: ['Lab', 'The shift'],
          rows: [
            ['History server reads the right event logs', 'Point it at the real directory. Cleaner at 7 days. Rolling on. No resubmit.'],
            ['Stage time is one hot task', 'Speculation or the skew path in the ticket. The input stays.'],
            ['Spill and GC before you add executors', 'Change memory. Same executor count. Spill and stage time fall.'],
            ['Lag report as a tool', 'Print lag. Exit non-zero over the limit. Healthy is silent.'],
            ['Shuffle service health on the critical path', 'The service is running and reachable. The checkpoint stays.'],
          ],
        },
      },
    ],
  },
  {
    id: 'incidents',
    slug: 'incidents',
    trackId: 'B6',
    eyebrow: 'Chapter 6',
    title: 'Incidents',
    summary:
      'A full disk and a stuck query arrive together. The checkpoint is the read position. A drain during the firefight can recreate the overcommit you just fixed.',
    showBlogStamp: true,
    lede:
      'An incident ticket names one symptom. The cluster has three. restaurant-prep is behind, the worker under its executor has a full disk, and somebody already “fixed” the stream by starting it at the end of the input. This chapter is how those failures stack, and which repairs make the next hour worse.',
    relatedLabs: [],
    followOn: {
      eyebrow: 'On the shelf',
      title: 'Start with the cluster',
      intro:
        'The incident labs assume the earlier chapters. If a step names a queue, a checkpoint, or a memory floor, the chapter that taught it is the reference. The work is still done on the live job.',
      links: [
        { label: 'Chapter 1 — What Spark is', href: NEXT.whatIsSpark },
        { label: 'Spark shelf', href: SPARK_PLATFORM_LABS_PATH },
      ],
    },
    takeaways: [
      'One ticket can be a full local disk and a stuck query at the same time. The other query on the same app can be fine.',
      'The checkpoint is the read position. **latest** skips the backlog. **earliest** replays days nobody asked for. The copy in the ticket is the position you put back.',
      'Free the scratch that filled the disk, or move the executor to a worker with room. The checkpoint stays. The executor count stays.',
      'Two causes of executor loss, an undersized executor and a neighbor on the same worker, both have to be fixed or the next wave repeats.',
      'A drain during an incident still has to respect the concentration limit. Stopping the sick worker is not permission to pile every executor onto the capped one.',
      'A cascading failure spans the resource manager, the checkpoint, and the node. Each shortcut in the ticket fixes the number on the screen and leaves the input unread or the quota worse.',
    ],
    sections: [
      {
        id: 'two-at-once',
        title: 'A full disk and a stuck query',
        body: [
          'dispatch-stream runs more than one query. rider-zone is caught up. restaurant-prep is behind, and the batches it does try are failing. The executor for that query sits on a worker whose local directory is full. Spark uses that directory for shuffle, spill, and the unpacked files of the application. When it fills, executors on that host die or cannot start, and only the query whose tasks land there falls behind.',
          'The bytes are often scratch left from an earlier incident, with worker cleanup left off so dead application directories were kept forever. Free that scratch. Leave the dispatch checkpoint and the warehouse output alone. Those are the job’s state and its result, not the garbage filling the disk.',
          'If you cannot free enough, stop that worker so the driver places the executor on a host with room. The query then has to **read forward**: continue from the last committed offset, through the backlog, until lag falls because the data was processed. Two shortcuts show up in the ticket and both cheat. Deleting the checkpoint drops the read position. Dropping the executor count to one makes the job look started on the remaining host, and the next worker loss stops it entirely, because there is no second executor to fail over to.',
        ],
        callout: {
          kind: 'warn',
          title: 'The healthy query is a clue',
          body: [
            'rider-zone being fine means the application, the driver, and the cluster are up. The failure is local to the prep query’s executor and the disk under it. Restarting the whole platform because one query is behind throws away that clue.',
          ],
        },
      },
      {
        id: 'checkpoint',
        title: 'The checkpoint is the read position',
        body: [
          'A Structured Streaming checkpoint stores source offsets and state. It is how the query knows what it has already committed. It is not a backup of the input. The input is still in Kafka or in the files. The checkpoint is the bookmark.',
          'During the last firefight someone started restaurant-prep from **latest**. That bookmark sits at the end. Lag looks small because the query is not counting the files it skipped. The unread input is still there. **earliest** is the opposite error: a new checkpoint at the beginning replays days that were already processed and that nobody asked to replay.',
          'The recovery is specific. Stop the app. Put the checkpoint back to the copy named in the ticket. Start the app again. That copy is a known bookmark, so the query reads forward through the backlog and does not reread the whole history. Starting “from the beginning” because it sounds thorough is the earliest mistake with a calmer name.',
        ],
        table: {
          headers: ['Start position', 'What the query does'],
          rows: [
            ['The ticket’s checkpoint copy', 'Reads from the last good commit, through the backlog'],
            ['latest', 'Starts at the end. The backlog is still on the source, unread'],
            ['earliest / a fresh checkpoint', 'Replays from the start of the source, including days already done'],
          ],
        },
      },
      {
        id: 'shared-pressure',
        title: 'Executors lost under a shared worker',
        body: [
          'This is the Chapter 1 memory incident with production traffic on it. Executors disappear one at a time. The driver log has no single exception that explains the pattern, because each death is a lost RPC after the process was already gone.',
          'An undersized executor is one cause: heap plus overhead that cannot hold the working set, so the process thrashes, spills, and eventually gets killed. A second job on the same worker is the other: its executor spends the RAM the first job’s sizing assumed was free. Either fix alone leaves the next wave the other cause.',
          'Find both before you call it repaired. The worker log and the node’s memory say who was killed and who else was resident. The application’s executor settings say the undersize. After the change, both jobs have to fit in the worker’s real budget, overhead included, with the executor count the ticket requires.',
        ],
      },
      {
        id: 'drain-incident',
        title: 'Drain during the firefight',
        body: [
          'A disk is failing. The worker has to leave. Everything from the Chapter 1 drain still applies, with less time and a query that is already behind.',
          'Relocating executors onto the remaining worker recreates the overcommit you just diagnosed, if that worker is the one that was already capped. The move can look successful: the sick host is stopped, the application still has executors, the UI is green. The next memory kill is scheduled. It is just not this minute.',
          'Done means the sick worker is out, in-flight work did not fail (tasks finished or were migrated, not killed and ignored), every application still has its full executor count, and the concentration limit still holds on the workers that remain. The checkpoint stays. Lowering the executor count to make the placement fit is the same cheat as in the disk incident, borrowed by the drain.',
        ],
        quote:
          'A drain that finishes in five minutes and piles every executor onto one host has scheduled the next page.',
      },
      {
        id: 'cascade',
        title: 'Queue, checkpoint, and disk',
        body: [
          'The last lab is the three failures in one ticket. A YARN queue or a Kubernetes namespace is saturated, so new executors sit pending. A checkpoint was bumped to latest during an earlier attempt, so the query’s lag number is a lie. One worker’s disk is full, so the executor that is running is failing its batches.',
          'Each shortcut repairs a dashboard and leaves the system wrong. Raising the global queue or the cluster quota makes this app fit and teaches the next tenant to page you for capacity that was a placement problem. Starting from latest, or from the beginning, changes the read position instead of restoring the copy. Deleting the checkpoint, or dropping to one executor, makes a chart move and makes the next failure fatal.',
          'The order that holds is the order of the data. Free the disk or evacuate that worker onto a host that has room and is allowed to take the load. Restore the checkpoint copy so the query reads the backlog. Free the queue or the namespace by the platform’s rule: the right queue, the leftover pods, the cap on the job that is holding every core. Wait until prep is reading forward and the executor count matches the ticket.',
          'You already have the pieces. Chapter 1 is the memory and the drain. Chapter 2 is the queue. Chapter 3 is the namespace, the quota, and the shuffle. Chapter 4 is the tool that should have refused the bad submit. Chapter 5 is the event log, the lag command, and the shuffle service. The incident is those chapters on one clock.',
        ],
        table: {
          headers: ['Lab', 'The shift'],
          rows: [
            ['Disk full and a stuck query at once', 'Free the disk or move the executor. Read forward. Checkpoint and executor count stay.'],
            ['Checkpoint restored wrong', 'Stop, restore the ticket’s copy, start. Skip latest and earliest.'],
            ['Executors lost under shared-worker pressure', 'Undersized executor and the neighbor. Fix both.'],
            ['Drain during an incident', 'Zero task failures, full executor count, concentration limit still true.'],
            ['Cascading failure across queue and namespace', 'Capacity, bookmark, and disk. Skip the three shortcuts in the ticket.'],
          ],
        },
      },
    ],
  },
];

const BY_KEY = new Map<string, K8sReading>();
for (const reading of SPARK_READINGS) {
  BY_KEY.set(reading.slug, reading);
  BY_KEY.set(reading.id, reading);
}
// Old Chapter 1 mega-blog slug → Blog 1
const whatIsSpark = BY_KEY.get('what-is-spark');
if (whatIsSpark) {
  BY_KEY.set('foundations-of-a-spark-cluster', whatIsSpark);
}

export function getSparkReading(slug: string | null | undefined): K8sReading | null {
  if (!slug) return null;
  return BY_KEY.get(slug) ?? null;
}

export function listSparkTrackItems(): K8sTrackItem[] {
  return SPARK_READINGS.map((reading) => ({
    type: 'reading' as const,
    id: `reading-${reading.id}`,
    readingId: reading.id,
  }));
}
