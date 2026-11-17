#!/usr/bin/env node
/**
 * On-cluster sign-off for Kafka labs (labs-kafka pool).
 *
 * Usage (repo, with K8S_LAB_KUBECONFIG + AWS/SSO that can talk to the cluster):
 *   node backend/challenges/kafka/_lib/validate-on-cluster.mjs <challengeId> [--keep]
 *
 * Steps: wait for Ready kafka node → recreate cluster → setup.sh →
 * challenge solve (inline) → grade.sh → print SIGN_OFF or FAIL.
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../../..');

// Prefer lab kubeconfig; do not inherit app S3 keys over SSO when scaling.
process.chdir(backendRoot);
try {
  const fs = require('fs');
  const envPath = path.join(backendRoot, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
} catch {
  /* ignore */
}

if (process.env.K8S_LAB_KUBECONFIG) {
  process.env.KUBECONFIG = process.env.K8S_LAB_KUBECONFIG;
}

const challengeId = process.argv[2];
const keep = process.argv.includes('--keep');
if (!challengeId) {
  console.error('usage: validate-on-cluster.mjs <challengeId> [--keep]');
  process.exit(2);
}

const k8s = require(path.join(backendRoot, 'workspace/k8sCluster'));
const kafkaBox = require(path.join(backendRoot, 'workspace/kafkaBox'));
const { loadPackRows, seedManualCatalog } = require(
  path.join(backendRoot, 'challenges/seedManualCatalog'),
);

const NS = 'kf-agent-val';

async function waitKafkaNode(timeoutMs = 15 * 60 * 1000) {
  const start = Date.now();
  for (;;) {
    const r = await k8s.runKubectl(
      ['get', 'nodes', '-l', 'devlabs.io/pool=kafka', '--no-headers'],
      { timeoutMs: 30_000 },
    );
    const lines = (r.stdout || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const ready = lines.some((l) => /\bReady\b/.test(l));
    if (ready) {
      console.log('==> kafka node Ready');
      console.log(lines.join('\n'));
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        'No Ready node with label devlabs.io/pool=kafka. Wake labs-kafka, then re-run.',
      );
    }
    console.log('==> waiting for labs-kafka Ready node…');
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

async function shell(cmd) {
  const args = [
    'exec',
    '-n',
    NS,
    'shell',
    '-c',
    'shell',
    '--',
    'bash',
    '-c',
    cmd,
  ];
  const r = await k8s.runKubectl(args, { timeoutMs: 120_000 });
  if (r.code !== 0) {
    throw new Error(`shell failed (${r.code}): ${r.stderr || r.stdout}`);
  }
  return (r.stdout || '').trim();
}

/** Per-challenge learner simulation after setup.sh. */
const SOLVES = {
  async 'kafka-02-open-a-topic-the-platform-way'() {
    // Wrong ticket shape must not be what we apply — use PLATFORM numbers.
    await shell(`
set -euo pipefail
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --delete --topic order.status >/dev/null 2>&1 || true
sleep 2
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --create --topic order.status \\
  --partitions 6 --replication-factor 3 \\
  --config retention.ms=259200000 \\
  --config min.insync.replicas=2 \\
  --config cleanup.policy=delete
for i in $(seq 1 30); do
  desc=$(kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic order.status 2>/dev/null || true)
  echo "$desc" | grep -q 'PartitionCount: 6' && break
  sleep 2
done
`);
    return {
      controlPlane: 'kraft',
      shapeSource: 'platform-note',
      orderStatusPartitions: '6',
      orderStatusRf: '3',
      orderStatusRetention: '259200000',
      orderStatusMinIsr: '2',
    };
  },

  async 'kafka-03-trace-a-produce-from-client-to-last-replica'() {
    await shell(`
set -euo pipefail
printf '%s\\n' 'ride-9917:{"status":"assigned"}' | \\
  kafka-console-producer.sh \\
    --bootstrap-server "\$BOOTSTRAP_SERVERS" \\
    --topic rider.dispatch \\
    --property parse.key=true \\
    --property key.separator=: \\
    --producer-property acks=all
sleep 3
`);
    const locate = await shell(`
set +e
kafka-console-consumer.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" \\
  --topic rider.dispatch --from-beginning \\
  --property print.key=true \\
  --property print.partition=true \\
  --property print.offset=true \\
  --property print.value=false \\
  --timeout-ms 20000 2>/dev/null \\
  | grep -F 'ride-9917' | head -1
true
`);
    console.log('  locate:', locate);
    const partMatch = locate.match(/Partition:\s*([0-9]+)/);
    const partition = partMatch ? partMatch[1] : (locate.match(/[0-9]+/) || [])[0];
    if (!partition) throw new Error(`could not parse partition from: ${locate}`);

    const desc = await shell(
      `kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --describe --topic rider.dispatch`,
    );
    let leader = '';
    let isr = '';
    for (const line of desc.split('\n')) {
      const p = (line.match(/Partition:\s*([0-9]+)/) || [])[1];
      if (p !== partition) continue;
      leader = (line.match(/Leader:\s*([0-9]+)/) || [])[1] || '';
      isr = (line.match(/Isr:\s*([0-9,]+)/) || [])[1] || '';
      break;
    }
    const endOut = await shell(
      `kafka-get-offsets.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --topic rider.dispatch --time -1`,
    );
    let logEnd = '';
    for (const line of endOut.split('\n')) {
      const m = line.match(new RegExp(`^rider\\.dispatch:${partition}:([0-9]+)`));
      if (m) {
        logEnd = m[1];
        break;
      }
    }
    if (!leader || !isr || !logEnd) {
      throw new Error(`map incomplete part=${partition} leader=${leader} isr=${isr} end=${logEnd} desc=${desc.slice(0, 200)}`);
    }
    return {
      bootstrapSource: 'env-bootstrap',
      produceKey: 'ride-9917',
      partition: String(partition),
      leaderId: String(leader),
      isr: String(isr),
      logEndOffset: String(logEnd),
    };
  },

  async 'kafka-04-the-partition-and-replica-map'() {
    const desc = await shell(
      `kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --describe --topic rider.dispatch`,
    );
    const cfg = await shell(
      `kafka-configs.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --describe --entity-type topics --entity-name rider.dispatch --all`,
    );
    const p0 = desc.split('\n').find((l) => /Partition:\s*0\b/.test(l)) || '';
    const leader = (p0.match(/Leader:\s*([0-9]+)/) || [])[1];
    const replicas = (p0.match(/Replicas:\s*([0-9,]+)/) || [])[1] || '';
    const preferred = replicas.split(',')[0];
    const isr = ((p0.match(/Isr:\s*([0-9,]+)/) || [])[1] || '')
      .split(',')
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b))
      .join(',');
    const minIsr = (cfg.match(/min\.insync\.replicas=([0-9]+)/) || [])[1] || '2';
    if (!leader || !preferred || !isr) throw new Error(`p0 map incomplete: ${p0}`);
    return {
      partitions: '6',
      rf: '3',
      minIsr: String(minIsr),
      uncleanElection: 'false',
      p0Leader: String(leader),
      p0Preferred: String(preferred),
      p0Isr: String(isr),
      predictRf3Min2: 'still-ok',
      predictRf3Min3: 'produces-fail',
      predictRf2Min2: 'produces-fail',
    };
  },

  async 'kafka-05-under-replicated-is-not-a-failed-write'() {
    // start kafka-2 from backend via state file
    await k8s.kubectlOk(
      ['exec', '-n', NS, 'kafka-2', '-c', 'kafka-2', '--', 'bash', '-c',
        'printf run > /tmp/.lab-broker-wanted; /tmp/lab-bin/qb-broker start 2>/dev/null || true'],
      { timeoutMs: 30_000 },
    );
    for (let i = 0; i < 60; i++) {
      const desc = await shell(
        `kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --describe --topic rider.dispatch`,
      );
      const sizes = [...desc.matchAll(/Isr:\s*([0-9,]+)/g)].map((m) => m[1].split(',').length);
      if (sizes.length >= 6 && sizes.every((n) => n === 3)) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    return {
      howFixed: 'start-broker-wait-isr',
      refusedShortcut: 'left-minisr',
    };
  },

  async 'kafka-06-min-isr-is-why-produces-fail'() {
    await k8s.kubectlOk(
      ['exec', '-n', NS, 'kafka-2', '-c', 'kafka-2', '--', 'bash', '-c',
        'printf run > /tmp/.lab-broker-wanted; /tmp/lab-bin/qb-broker start 2>/dev/null || true'],
      { timeoutMs: 30_000 },
    );
    // Wait broker up
    for (let i = 0; i < 45; i++) {
      try {
        await k8s.kubectlOk(
          ['exec', '-n', NS, 'kafka-2', '-c', 'kafka-2', '--', 'bash', '-c', 'echo >/dev/tcp/127.0.0.1/9092'],
          { timeoutMs: 10_000 },
        );
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    await shell(`
set -euo pipefail
kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --delete --topic desk.alerts >/dev/null 2>&1 || true
sleep 3
for i in \$(seq 1 30); do
  kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --describe --topic desk.alerts >/dev/null 2>&1 || break
  sleep 1
done
kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --create --topic desk.alerts \\
  --partitions 3 --replication-factor 3 \\
  --config min.insync.replicas=2 --config retention.ms=604800000
for i in \$(seq 1 40); do
  desc=\$(kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --describe --topic desk.alerts)
  echo "\$desc" | grep -q 'ReplicationFactor: 3' && break
  sleep 2
done
`);
    return {
      howFixed: 'restore-rf-and-broker',
      refusedShortcut: 'left-minisr',
    };
  },

  async 'kafka-07-segments-retention-and-why-disk-fills'() {
    await shell(`
set -euo pipefail
kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --delete --topic debug.dump >/dev/null 2>&1 || true
sleep 2
kafka-configs.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" \\
  --alter --entity-type topics --entity-name order.status \\
  --add-config retention.ms=604800000,cleanup.policy=delete
sleep 5
`);
    return { cleanupLesson: 'delete-vs-compact' };
  },

  async 'kafka-08-capstone-disk-isr-and-the-write-path'() {
    await shell(`
set -euo pipefail
kafka-topics.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" --delete --topic debug.dump >/dev/null 2>&1 || true
sleep 5
# Drain lag by reading as the desk group
timeout 100 kafka-console-consumer.sh --bootstrap-server "\$BOOTSTRAP_SERVERS" \\
  --topic rider.dispatch --group dispatch-desk --from-beginning \\
  --timeout-ms 90000 >/tmp/drain.out 2>/tmp/drain.err || true
`);
    return {
      howFixed: 'free-disk-read-forward',
      refusedShortcut: 'no-reset-latest',
    };
  },
};

async function main() {
  const packs = loadPackRows();
  const pack = packs.find((p) => p.id === challengeId);
  if (!pack) throw new Error(`pack not in catalog yet: ${challengeId} (seed first)`);

  await seedManualCatalog();

  console.log(`==> on-cluster validate ${challengeId}`);
  await waitKafkaNode();

  console.log(`==> recreate ${NS} shape=${pack.platformSpec?.shape || 'kafka-3'}`);
  await kafkaBox.recreate(NS, challengeId, (m) => console.log('  phase:', m));

  console.log('==> setup.sh');
  const setup = await k8s.runChallengeScript(NS, challengeId, 'setup.sh', {
    timeoutMs: 480_000,
    env: kafkaBox.scriptEnv(NS, challengeId),
  });
  if (setup.code !== 0) {
    console.error(setup.stdout);
    console.error(setup.stderr);
    throw new Error(`setup failed: ${setup.code}`);
  }
  console.log((setup.stdout || '').trim().split('\n').slice(-5).join('\n'));

  const solve = SOLVES[challengeId];
  if (!solve) {
    throw new Error(`no on-cluster solve registered for ${challengeId} yet`);
  }
  console.log('==> simulate learner solve');
  const investigation = await solve();

  if (investigation) {
    console.log('==> write Investigation answers');
    await kafkaBox.writeInvestigationAnswers(NS, investigation);
  }

  console.log('==> grade.sh');
  const grade = await k8s.runChallengeScript(NS, challengeId, 'grade.sh', {
    timeoutMs: 180_000,
    env: kafkaBox.scriptEnv(NS, challengeId),
  });
  const gout = (grade.stdout || '').trim();
  const gerr = (grade.stderr || '').trim();
  if (gout) console.log(gout);
  if (gerr) console.error(gerr);
  if (grade.code !== 0) {
    throw new Error(`grade failed: ${grade.code}`);
  }

  console.log(`SIGN_OFF ${challengeId} (on-cluster labs-kafka)`);

  if (!keep) {
    console.log('==> cleanup');
    await kafkaBox.deletePod(NS);
  } else {
    console.log(`==> kept namespace ${NS} (--keep)`);
  }
}

main().catch(async (err) => {
  console.error('FAIL:', err?.message || err);
  if (!keep) {
    try {
      await kafkaBox.deletePod(NS);
    } catch {
      /* ignore */
    }
  }
  process.exit(1);
});
