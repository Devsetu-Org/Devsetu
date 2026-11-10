/** Platforms Engineer → Spark. One blog per chapter, read before that chapter's labs. */

import type { K8sReading, K8sTrackItem } from './k8sReadings';

export const SPARK_PLATFORM_LABS_PATH = '/track/platforms-engineer/spark';
export const SPARK_READINGS_BASE = `${SPARK_PLATFORM_LABS_PATH}/read`;

export function sparkReadingPath(slug: string): string {
  return `${SPARK_READINGS_BASE}/${slug}`;
}

const NEXT = {
  foundations: sparkReadingPath('foundations-of-a-spark-cluster'),
  yarn: sparkReadingPath('spark-on-yarn'),
  kubernetes: sparkReadingPath('spark-on-kubernetes'),
  automations: sparkReadingPath('platform-automations'),
  observability: sparkReadingPath('observability-and-optimizations'),
  incidents: sparkReadingPath('incidents'),
};

export const SPARK_READINGS: K8sReading[] = [
  {
    id: 'foundations-of-a-spark-cluster',
    slug: 'foundations-of-a-spark-cluster',
    trackId: 'B1',
    eyebrow: 'Chapter 1',
    title: 'Foundations of a Spark cluster',
    summary:
      'Standalone Spark is a master, workers, a driver, and executors. Learn the files, the UIs, the memory map, and how a worker drain can quietly pile every executor onto one host.',
    showBlogStamp: true,
    lede:
      'QuickBite’s first Spark cluster has no YARN and no Kubernetes in the way. One **master**, two **workers**, and whatever job a team submits. Before you touch a queue or a pod, you have to know which process is which, which file it reads, and which screen is allowed to lie to you.',
    relatedLabsIntro:
      'Chapter 1 is this picture, practiced on a live standalone cluster. The labs ask you to find the paths, read the UIs, and diagnose the memory bugs yourself.',
    relatedLabs: [
      { challengeId: 'spark-01-stand-up-the-cluster-and-find-everything-on-disk', label: 'Stand up the cluster and find everything on disk' },
      { challengeId: 'spark-02-read-the-master-ui-and-a-worker-ui-as-instruments', label: 'Stabilize flaky Workers on the Master UI' },
      { challengeId: 'spark-03-trace-a-job-from-submission-to-last-task', label: 'Trace a job from submission to last task' },
      { challengeId: 'spark-04-find-where-the-data-actually-lives', label: 'Find where the data actually lives' },
      { challengeId: 'spark-05-the-executor-memory-map', label: 'The executor memory map' },
      { challengeId: 'spark-06-diagnose-an-executor-lost-to-memory-pressure', label: 'Diagnose an executor lost to memory pressure' },
      { challengeId: 'spark-07-the-capstone-bug-slow-then-dead', label: 'The capstone bug: slow, then dead' },
      { challengeId: 'spark-08-drain-a-worker-without-breaking-anything', label: 'Drain a worker without breaking anything' },
    ],
    followOn: {
      eyebrow: 'Next chapter',
      title: 'Spark on YARN',
      intro:
        'The same job, with a resource manager between the driver and the machines. Queues, containers, and the question of which host the driver is allowed to live on.',
      links: [{ label: 'Read Spark on YARN', href: NEXT.yarn }],
    },
    takeaways: [
      'The master hands out workers. The driver schedules tasks. The worker starts executor JVMs. Those are three different processes.',
      '**spark-env.sh** is the daemon’s environment. **spark-defaults.conf** is the application’s SparkConf. A default in the wrong file never reaches the process you meant.',
      'A UI panel is a claim. **ps**, the listen ports, and the tail of the daemon log are the check.',
      '**cache()** stores blocks in the unified region. A second action that is just as slow means those blocks were never there, or they were evicted.',
      '**spark.executor.memory** is the heap. Overhead and off-heap sit outside it. The worker must have room for heap plus overhead, or the executor never stays up.',
      'Stopping a worker relocates its executors onto whoever still has free cores. A drain that piles them onto the capped worker recreates the last outage.',
    ],
    sections: [
      {
        id: 'four-processes',
        title: 'Four processes, not one cluster',
        body: [
          'People say “the Spark cluster” as if it were one service. On standalone it is four kinds of process, and only two of them are daemons you start by hand.',
          'The **master** listens for workers and applications. Its RPC address looks like `spark://ds-spark-01:7077`. Its web UI is usually port **8080**. It does not run tasks. It does not decide which partition a task reads. It tracks who is alive and how many cores and how much memory each worker is offering.',
          'A **worker** is a daemon on a host. It registers with the master, sends heartbeats, and starts **executor** JVMs when an application is given room on that host. The worker UI (often **8081**) lists those executors. The worker process itself does not run your map or your join.',
          'The **driver** is the process that owns the SparkContext. `spark-submit` creates it. In client deploy mode the driver is the submit process, sitting on whatever host ran the command. The driver builds the plan, splits it into stages, and schedules tasks onto executors.',
          'An **executor** is a JVM the worker launches for one application. Tasks run there. Cached blocks live there. Shuffle files are written under the worker’s local directories, which the executor uses. When the executor dies, its tasks die with it, and so do the shuffle files that were only on that disk.',
        ],
        table: {
          headers: ['Process', 'Who starts it', 'What it owns'],
          rows: [
            ['Master', 'start-master.sh on one host', 'Worker registry, application registry, 7077 and the master UI'],
            ['Worker', 'start-worker.sh on each host', 'Heartbeats, executor launch, worker UI, work directory'],
            ['Driver', 'spark-submit', 'The plan, stages, task scheduler, application UI on 4040'],
            ['Executor', 'The worker, for one app', 'Tasks, cached blocks, shuffle files on local disk'],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'The master is not the scheduler',
          body: [
            'A task ends up on a core because the **driver** put it there. The master only agreed that this application may use N cores on that worker. When a stage is slow, the master UI can tell you the executor exists. The stage page on the driver UI tells you what the task was doing.',
          ],
        },
      },
      {
        id: 'on-disk',
        title: 'What is on disk before any job runs',
        body: [
          'Spark is installed under **SPARK_HOME**. The start scripts do not embed your settings. They hand off to `spark-daemon.sh`, which sources **conf/spark-env.sh** on the host where you ran the script, then starts the Java master or worker. Logs for that daemon land under the log directory the same script set up, almost always `$SPARK_HOME/logs`.',
          'That is why a worker setting must be present on the worker host. Sourcing `spark-env.sh` on the master does not change the worker you start five minutes later on another machine.',
          '**conf/spark-defaults.conf** is a different file with a different audience. Properties in it (`spark.executor.memory`, `spark.eventLog.enabled`, and the rest of the `spark.*` keys) become the application’s SparkConf when a driver starts. They do not decide whether the master process comes up.',
        ],
        table: {
          headers: ['Place', 'Who reads it', 'What you use it for'],
          rows: [
            ['conf/spark-env.sh', 'spark-daemon.sh, on that host', 'JAVA_HOME, master host and port, worker cores, worker memory'],
            ['conf/spark-defaults.conf', 'Every application’s SparkConf', 'Executor size, event log, shuffle, speculation'],
            ['logs/', 'You, and the daemon’s stdout', 'Why a process exited, heartbeat errors, failed executor launches'],
            ['work/', 'The worker, per application', 'Executor directories, copied jars, local shuffle and spill'],
          ],
        },
        bullets: [
          'Find the live process with `ps` or `jps`, then look at its cwd and open files. The log path and the work path are arguments or environment on that process, not a guess from a wiki.',
          'A master with zero workers is a process that is up and a cluster that cannot run anything. ALIVE is a master-side word. Confirm it in the master UI or its JSON, and confirm the worker process on the worker host.',
          'Two conf files, two jobs. Daemon environment in `spark-env.sh`. Application defaults in `spark-defaults.conf`.',
        ],
        callout: {
          kind: 'tip',
          title: 'The start path',
          body: [
            '`start-master.sh` and `start-worker.sh` call `spark-daemon.sh`. That script loads `spark-env.sh`, starts the JVM, and writes the logs. If the JVM is missing, you never get as far as a Spark error. If the JVM is up and the worker stays DEAD, you are in the log and on port 7077, not in a missing jar.',
          ],
        },
      },
      {
        id: 'uis',
        title: 'The UIs are instruments',
        body: [
          'The master UI has two panels you will live in. **Workers** lists each worker, whether it is ALIVE, the cores and memory it offered, and how much of that is in use. **Applications** lists running and completed apps, with a link to that app’s own UI while the driver is still up.',
          'The worker UI lists executors on that host: which application, how many cores, how much memory. It is the only screen that answers “is store-rollup’s executor on this box?”',
          'Both screens are reports from the daemons, refreshed on their own clock. A worker can still say ALIVE for about a heartbeat interval after the process is gone. A worker you just started can still say DEAD until the next registration lands. Treat the panel as a claim.',
        ],
        subsections: [
          {
            id: 'cross-check',
            title: 'Check the claim on the host',
            body: [
              'On the worker host, the process list shows whether `Worker` is actually running. The master RPC port **7077** has to be reachable from that host; a worker that cannot talk to it will not stay ALIVE. `nproc` and `free` tell you what the machine has, which is the number the UI’s “cores” and “memory” columns are supposed to match.',
              'The worker log is the third source. Heartbeat failures, “worker lost”, and executor launch errors are written there when the UI has already moved on to a red row.',
            ],
          },
        ],
        callout: {
          kind: 'warn',
          title: 'A green worker row can be a stale heartbeat',
          body: [
            'If the worker process is gone and the master still lists it ALIVE, wait out the timeout or read the master log. If the process is up and the row says DEAD, the worker is not reaching 7077, or it was started with the wrong master URL. Restarting a healthy worker because the UI looked old is how a quiet page becomes an incident.',
          ],
        },
      },
      {
        id: 'job-trace',
        title: 'From spark-submit to the last task',
        body: [
          'A join is a better first job than a one-line map. A map is one stage. A join shuffles, so you get more than one stage, and you can see the boundary.',
        ],
        flows: [
          {
            title: 'One application',
            steps: [
              'spark-submit starts the driver',
              'Driver registers an application with the master',
              'Master assigns cores on workers',
              'Workers launch executor JVMs',
              'Driver splits the job into stages at each shuffle',
              'Each stage is one task per partition',
              'A task runs on one core of one executor',
            ],
          },
        ],
        after: [
          'An **action** (`count`, `write`, `collect`) is what submits a job. Transforms are recorded and wait. “Nothing is running” is often a driver that has not hit an action yet.',
          'The application UI on the driver, port **4040**, is where the DAG becomes concrete. The Jobs tab is one row per action. Open a job and you get stages. Open a stage and you get tasks, with the executor id and the host for each task. That is the chain the master UI cannot show you: master knows the application, the driver knows the task.',
          'When the driver exits, port 4040 goes with it. The event log is the only record left, which is a Chapter 5 problem. In this chapter, trace the job while the driver is still up.',
        ],
        table: {
          headers: ['Word', 'What it counts'],
          rows: [
            ['Application', 'One SparkContext. Lives as long as the driver.'],
            ['Job', 'One action. A DAG of stages.'],
            ['Stage', 'Work between shuffles. Narrow transforms stay in the same stage.'],
            ['Task', 'One partition of one stage, on one core.'],
            ['Shuffle', 'The stage boundary. Map output is written locally and fetched by the next stage.'],
          ],
        },
      },
      {
        id: 'where-data-lives',
        title: 'Where the data actually lives',
        body: [
          '**cache()** and **persist()** are a promise: keep these partitions around so the next action does not recompute them. The promise is lazy. The blocks appear on the first action, in the storage level you asked for (`MEMORY_ONLY`, `MEMORY_AND_DISK`, `DISK_ONLY`, with or without a replica).',
          'The **Storage** tab is the inventory. For each cached dataset it shows the storage level, how many partitions are cached, the size in memory, and the size on disk. Zero cached partitions means the promise was never kept. A size that is almost all disk means memory refused the blocks and they spilled, or you asked for disk in the first place.',
          'The **Executors** tab is the budget those blocks are spending. Storage memory used against the storage max tells you whether the unified region is full. A second action that takes as long as the first, with an empty Storage tab, is a cache miss. The same slowness with a Storage tab that used to have rows is eviction: something else needed the unified region, and Spark dropped the blocks and recomputed them from lineage.',
          'The worker log is where eviction is a sentence rather than a smaller number. “Block evicted” next to a full storage region is the mechanism. The UI alone shows the hole. The log shows who dug it.',
        ],
        callout: {
          kind: 'takeaway',
          title: 'Slow twice is a location problem',
          body: [
            'Find the dataset in the Storage tab, then the executor’s storage memory, then the worker log. Config comes after those three agree. Raising executor memory before you know the blocks were evicted just gives the next dataset a bigger place to hide.',
          ],
        },
      },
      {
        id: 'memory-map',
        title: 'The executor memory map',
        body: [
          '**spark.executor.memory** is the JVM heap. It is not the whole bill. Inside the heap, Spark holds back **300 MB** of reserved memory. `spark.memory.fraction` (default **0.6**) takes its cut of what remains. That cut is the **unified region**, shared by execution and storage. The rest of the usable heap is **user memory**: your data structures, UDFs, and Spark metadata the memory manager does not track.',
          '`spark.memory.storageFraction` (default **0.5**) splits the unified region. It is the slice of storage that execution will not evict. The rest is the room tasks actually use for shuffles, sorts, and aggregations. Storage may borrow unused execution memory. Execution may evict cached blocks down to that storage floor when a task needs the room. A high storage fraction looks like a generous cache and a stage that spills.',
          'Outside the heap, two more buckets exist. **Overhead** (`spark.executor.memoryOverhead`, default about 10% of the heap with a **384 MB** floor) covers JVM and native cost. **Off-heap** (`spark.memory.offHeap.enabled` and `spark.memory.offHeap.size`) is Tungsten memory, off by default, and it is not subtracted from the heap. The worker and, later, YARN or Kubernetes must fit **heap + overhead + off-heap**. A 512 MB heap plus a 384 MB overhead floor does not fit in a 768 MB worker.',
        ],
        table: {
          headers: ['Bucket', 'Where it sits', 'Knob'],
          rows: [
            ['Heap', 'The JVM -Xmx', 'spark.executor.memory'],
            ['Reserved', 'Inside the heap, 300 MB', 'Fixed'],
            ['Unified region', '(heap − 300 MB) × fraction', 'spark.memory.fraction'],
            ['User memory', 'What fraction did not take', 'The complement of fraction'],
            ['Storage floor', 'storageFraction of the unified region', 'spark.memory.storageFraction'],
            ['Overhead', 'Outside the heap', 'spark.executor.memoryOverhead'],
            ['Off-heap', 'Outside the heap, usually off', 'spark.memory.offHeap.size'],
          ],
        },
        after: [
          'Work a 2 GB heap with the defaults before you trust a whiteboard. Reserved leaves 1748 MB. Fraction 0.6 makes a unified region of about 1049 MB, and user memory about 699 MB. Half of the unified region, about 524 MB, is the storage floor. Overhead is max(384 MB, ~205 MB) = 384 MB. The worker has to offer about 2.4 GB for an executor everyone will describe as “2 GB”.',
          'Room for actual task execution, roughly, is the unified region outside the storage floor. Execution can borrow above that when storage is empty. It cannot borrow user memory, and it cannot borrow overhead. Those are the mixes that spill while the Storage tab still looks fine.',
        ],
        callout: {
          kind: 'warn',
          title: 'Free storage is not free heap',
          body: [
            'The UI can show storage memory unused while the task is spilling, because the spill is execution memory inside the same unified region. It can also show a calm executor while the OS is about to kill the process for overhead that was never in the heap figure.',
          ],
        },
      },
      {
        id: 'executor-lost',
        title: 'An executor lost to memory pressure',
        body: [
          'The driver says **executor lost**, or that the RPC client disassociated. There is often no Java OutOfMemoryError in the driver output. The driver did not run out of memory. The executor process disappeared, and the driver noticed when the connection dropped.',
          'Two causes show up together on a small standalone worker. The executor’s heap-plus-overhead is large for the worker’s advertised memory, so the worker is already tight. A second application has an executor on the same host, spending the same RAM. The first job’s failure is the visible one. The second job is why a bigger heap on the first job still dies.',
          'Read it in order. The driver log names the executor id and the host. The master UI shows the executor gone and the worker’s remaining memory. The worker log, or the kernel log, says whether the process was killed. The Executors tab from before the death, or the event history if you have it, shows storage and execution climbing. A fix that only raises one job’s heap, and leaves the neighbor in place, fails again on the next wave.',
        ],
      },
      {
        id: 'slow-then-dead',
        title: 'Slow, then dead',
        body: [
          'The ugly incident in this chapter is a timeline. The job is fine, then stages stretch, then one executor disappears. Each source has a different frame of that timeline.',
          'The master UI knows the executor was there and then was not. It does not know that cached data had been growing for twenty minutes. The executor’s memory breakdown knows storage climbed and execution started spilling. It does not know the process was killed a minute later. The worker log knows the kill, or the heartbeat loss, and not which dataset was cached. The code knows someone cached a growing set and never unpersisted it.',
          'A leak-shaped cache is still a cache. Blocks accumulate in the unified region, GC time rises, tasks slow, eviction starts, and eventually the process or the node runs out of the memory that overhead and the neighbor were also using. You only get the story by putting the four sources on one clock.',
        ],
        quote:
          'No single pane has the incident. The page that looks calm is the one you have not opened yet.',
      },
      {
        id: 'drain',
        title: 'Draining a worker',
        body: [
          'Standalone Spark has no graceful “drain this worker” button in the sense an operator wants: a command that moves work off, waits, and leaves every application at its full executor count with zero failed tasks. `stop-worker.sh` stops the daemon. Executors on that host die. Running tasks fail. The driver retries them if the job is still alive, and it asks for replacement executors.',
          'Replacements land on workers that still have free cores and free memory. If one of the remaining workers is the only one with room, every relocated executor piles onto it. That is the same overcommit as the memory-pressure lab, created by the repair.',
          'A drain is finished when three things are true together. The worker you took out is stopped and the master agrees it is gone. Each application still has the executor count it was supposed to have. No surviving worker is holding a pile that exceeds what you already know that host can carry. “The process is stopped” is the first of those, and it is the one that hides the other two.',
          'Shuffle files and cached blocks that lived only on the drained host are gone with it, unless you have a shuffle service or a decommission path that copied them. A batch job can recompute. A streaming query should keep its checkpoint. The drain does not get to throw away the read position to make the move look clean.',
        ],
        callout: {
          kind: 'scope',
          title: 'What this chapter is for',
          body: [
            'You can stand a cluster up, read it, trace one job, account for memory, and take a worker out without quietly building the next outage. YARN and Kubernetes change who launches the containers. They do not change this picture.',
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
        { label: 'Chapter 1 — Foundations', href: NEXT.foundations },
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
