import type { ChapterReading } from './types';

/** Fallacies chapter intro — reading only. Labs 1.1–1.4 are separate coding chapters. */
export const DS_FOUNDATIONS_FALLACIES_READING: ChapterReading = {
  eyebrow: 'DS Foundations · Chapter 1',
  title: 'The Eight Fallacies',
  lede:
    'Every distributed-systems bug starts with an assumption that was true on one machine and false on a network. This chapter makes the first ones concrete inside Fleetline — as four separate labs, each with its own starter.',
  showBlogStamp: true,
  sections: [
    {
      id: 'why-fallacies',
      title: 'Why this chapter',
      body: [
        'L. Peter Deutsch and others named eight assumptions that fail off one machine. Fleetline\'s rider and driver apps call a dispatch service over a city network. On a laptop the RPCs look fine. Across a flaky link they do not.',
        'There are no sockets in these labs. Both sides talk through an in-process simulated network (`netsim` in Lab 1.1). That is enough to break a naive client — and enough to prove a fix.',
      ],
    },
    {
      id: 'four-labs',
      title: 'Four independent labs',
      body: [
        '**1.1 Unreliable, slow network** — bounded retries when trip hops are dropped; feel serial latency.',
        '**1.2 Constrained network** — thin soft location spam so strong match RPCs are not starved.',
        '**1.3 Changing, untrusted network** — reject stale or replayed strong mutations.',
        '**1.4 Heterogeneous cluster** — different attempt budgets for rider, driver, and server.',
        'Each lab has its **own starter repo**. Solving 1.2 does not reveal 1.1\'s answer. Open them in any order from the Foundations shelf.',
      ],
    },
    {
      id: 'strong-soft',
      title: 'Strong vs soft (preview)',
      body: [
        'Trip ownership and lifecycle are **strong**. Location and ETA are **soft**. Lab 1.2 is about not letting soft traffic drown the strong path — a theme chapters 4–5 deepen.',
      ],
    },
  ],
  takeaways: [
    'Fallacies are assumptions, not bugs — until you ship them.',
    'Four labs, four starters: no shared scratch tree across 1.1–1.4.',
    'Retries, coalescing, fencing, and budgets are different tools for different fallacies.',
  ],
};
