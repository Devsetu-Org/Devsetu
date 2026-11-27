import type { ChapterReading } from './types';

/** DS Foundations minor, chapter 00: why this track exists and the plan. */
export const DS_FOUNDATIONS_OVERVIEW: ChapterReading = {
  eyebrow: 'DS Foundations · Chapter 00',
  title: 'Foundations: why distributed systems break',
  lede:
    'Before you build a quorum store or Raft, you need the vocabulary of failure. This minor is the first subtrack of Distributed Systems — taught inside Fleetline, a rideshare dispatch system (ridernet) where trip ownership is strong and map/ETA are soft.',
  showBlogStamp: true,
  sections: [
    {
      id: 'why-foundations',
      title: 'Why start here',
      body: [
        'Platforms labs teach you to operate Kafka, Spark, and Kubernetes when they misbehave. This track is different: you learn **why** any multi-machine system can misbehave, and how to reason about it before you pick a product.',
        'Foundations is mostly small programs and analysis, not a cluster to SSH into. Across six chapters you break a naive Fleetline client on a simulated network, confront partial and gray failure, order trip events without a global clock, assign consistency models per field, choose CP vs AP under a city partition, and separate safety from liveness.',
      ],
    },
    {
      id: 'the-world',
      title: 'The Fleetline world',
      body: [
        '**Fleetline** is a fictional rideshare inspired by Uber/Lyft objectives: match exactly one driver, advance a trip lifecycle, keep map pins useful when the network is ugly.',
        '**Strong state** — trip owner and lifecycle — teaches linearizability, CP under partition, and safety ("never two drivers"). **Soft state** — location, ETA, nearby cars — teaches eventual consistency, AP + reconcile, and session reads after reconnect.',
        'All labs talk through an in-process network (`netsim`) in the **ridernet** substrate. No sockets, no payments checkout spine.',
      ],
    },
    {
      id: 'the-plan',
      title: 'The six chapters',
      body: [
        '**Fallacies.** The eight assumptions that fail off one machine — four **independent** labs (retries, coalesce, fencing, budgets), each with its own starter so free order cannot leak answers.',
        '**Partial failure.** Silent completes, wrong-answer matches, gray/asymmetric views, and a simple failure detector for "is the driver still there?"',
        '**Time and ordering.** Phone clocks lie; Lamport and vector clocks order the trip log.',
        '**Consistency models.** Linearizable ownership vs weaker/eventual map and ETA; pick a model per field.',
        '**CAP and PACELC.** Fail closed on match under partition; keep the map up and reconcile; trade latency vs consistency when healthy.',
        '**Safety vs liveness.** Never double-assign vs eventually match — and FLP intuition for why you cannot have every guarantee at once.',
      ],
    },
    {
      id: 'what-comes-next',
      title: 'After Foundations',
      body: [
        '**Simulation** builds the deterministic harness (ticks, seeded faults, history checkers). **Quorum**, **Consensus**, and **Transactions** are protocol families that run on that harness. Deep Raft build also lives at `/minors/consensus`.',
      ],
    },
  ],
  takeaways: [
    'Foundations is conceptual and code-small; Platforms owns product RCA.',
    'Fleetline / ridernet is the spine: strong trip ownership, soft map/ETA.',
    'Everything later in DS assumes this vocabulary.',
  ],
};
