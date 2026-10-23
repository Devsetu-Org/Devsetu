/** Track-level DevOps readings. One starter, then the labs. */

import type { K8sReading, K8sTrackItem } from './k8sReadings';
import { LINUX_LABS_PATH } from './linuxReadings';
import { DOCKER_LABS_PATH } from './dockerReadings';
import { K8S_LABS_PATH } from './k8sPrimer';

export const DEVOPS_TRACK_PATH = '/track/devops-engineer';
export const DEVOPS_INTRO_PATH = `${DEVOPS_TRACK_PATH}/introduction`;
export const DEVOPS_READINGS_BASE = `${DEVOPS_TRACK_PATH}/read`;

export function devopsReadingPath(slug: string): string {
  return `${DEVOPS_READINGS_BASE}/${slug}`;
}

export const DEVOPS_READINGS: K8sReading[] = [
  {
    id: 'what-devops-is',
    slug: 'what-devops-is',
    trackId: 'Intro',
    eyebrow: '',
    title: 'DevOps, to start',
    showBlogStamp: true,
    summary:
      'A short start: why a company needs a DevOps engineer, the skills they carry, and the tools you will hear named.',
    lede:
      'This is a starter, not the whole subject. It says why a company needs a DevOps engineer, the skills that person carries, and which tool names are worth recognizing. Then you can open a lab.',
    sections: [
      {
        id: 'why-we-need-one',
        title: 'Why do we need a DevOps engineer',
        body: [
          'Software is written on one computer and used on another. The computer a customer uses has to stay on, serve the site or the app, and keep the previous version ready when a new release goes wrong.',
          'A company used to cross that distance in order. One group finished the writing and passed on a package. Another group installed that package and kept it running. When the package was wrong, the news came back days later. The skills of a DevOps engineer sit in that distance, between the computer where the software was written and the computer a customer is using.',
        ],
        subsections: [
          {
            id: 'two-jobs',
            title: 'Building and running',
            body: [
              'A company that ships software has two jobs. One job is **building**: write the software, add something new, fix something that is wrong. The other job is **running**: put that software on a computer customers can use, keep that computer working, and put the previous version back when a release goes wrong.',
              'For a long time those jobs belonged to different teams. Developers finished a release and handed over a package and a document. Operations installed it on machines they alone understood, and sent problems back days later. Each side held half the story. The customer held the outage.',
            ],
          },
          {
            id: 'handover',
            title: 'A handover stopped being enough',
            body: [
              'That split was bearable when a release happened a few times a year. A release was an event. People stayed late, read from a document, and hoped. When the release was wrong, the old version was often hard to put back, so the bad one stayed until the next window.',
              'Software then became the business. A shop, a bank, a taxi app, a hospital system. Customers meet whatever is **running**, not the files on someone\'s laptop. That running system has to change most weeks without falling over. A careful document and a weekend cannot carry a release that happens most days, on more than a handful of machines.',
            ],
          },
          {
            id: 'who-holds-them',
            title: 'Who holds the skills',
            body: [
              'An operations engineer already keeps the machines working, installs what arrives, and puts a broken release back. The part that got harder is the path between the two jobs. Each change has to leave the people who wrote it, be built and checked the same way every time, reach the running system, and stay undoable. On ten machines, then a hundred, those steps have to be written down and repeated.',
              'The skills serve that path. An operations engineer is often the person who has to hold them, because the running side is where a separate handover used to land. A developer holds the part that makes a change fit the path. A company may hire a **DevOps engineer** to carry the skills across both, or it may ask the operations team, or the development team, to hold them.',
              'The line between those titles is thin, and the company draws it. One company puts the skills in the team that writes the software. Another keeps a development team and an operations team, and the operations side practices the same skills as **site reliability engineering** (SRE), close to the live system. The title changes. The skills stay the path from a written change to a running one.',
              'A DevOps engineering skill set is what automates that path and carries an application from development through release into production, and companies expect this knowledge from individuals irrespective of their specific roles.',
            ],
          },
        ],
        callout: {
          kind: 'idea',
          title: 'A few facts',
          body: [
            'It became a common name in **2009**, the year of the first DevOpsDays conference. Before that, the two jobs were usually just called development and operations.',
            'There is no DevOps product to install. The skills are the path a change takes. The tools later in this reading are choices along that path.',
          ],
        },
      },
      {
        id: 'tools',
        title: 'The tools',
        body: [
          'A company usually picks one or two names from each row. You do not learn this list before you start. It is here so a name in a conversation, or on a job post, has a place to land.',
        ],
        table: {
          headers: ['What it is for', 'Names you will meet'],
          rows: [
            [
              'The change is saved, and someone else can read it before it goes further.',
              'Git. GitHub, GitLab, and Bitbucket are where teams host it.',
            ],
            [
              'Build, check, and release run as written steps, with a log. People call this **CI/CD**.',
              'Jenkins, GitHub Actions, GitLab CI, CircleCI, Azure Pipelines.',
            ],
            [
              'One package runs on a laptop and on a server. Many copies of it can be placed and updated together.',
              'Docker. Kubernetes, and Helm for reusing one description of a service.',
            ],
            [
              'The computer itself: files, users, permissions, processes, and the network. Servers match a written setup. The account around them is written down too. People call that **infrastructure as code**.',
              'Linux, Bash, and a little Python. Ansible, Chef, Puppet. Terraform, and CloudFormation. Amazon Web Services, Google Cloud, Microsoft Azure.',
            ],
            [
              'Graphs, a record of what the program said, and an alert when a number crosses a chosen line. The alert reaches the person responsible.',
              'Prometheus and Grafana. Datadog when a company buys this instead of running it. Elasticsearch and Kibana, or Splunk, for the logs. PagerDuty, Opsgenie.',
            ],
            [
              'The version that went out is kept, so the previous one can be put back. Keys and passwords stay in a store the path can read, out of the code, so that step can run.',
              'The pipeline and Kubernetes above. HashiCorp Vault, and the secret stores built into each cloud.',
            ],
          ],
        },
        after: [
          'Names that do the same job overlap. A company rarely needs a DevOps engineer to be the expert in both Chef and Ansible. It needs depth in the tool they already use. New product names show up every year. When a post names something unfamiliar, match it to the job in the row beside it.',
        ],
        callout: {
          kind: 'scope',
          title: 'What you can practice here',
          body: [
            'The shelves open on this track today are **Linux**, **Docker**, and **Kubernetes**: the machine, the package, and running many packages. Start with Linux. The command line is the skill the rest of the list assumes.',
            'Pipelines, Ansible, Terraform, and the cloud accounts are the same kind of skill. They are on the list so a DevOps engineer\'s skills are wider than the three shelves, and so you can place a name when you meet one.',
          ],
        },
      },
    ],
    takeaways: [
      'The skills serve the path from a written change to a running one: out the same way every time, visible when it is healthy, and undoable when it is wrong.',
      'An operations engineer often needs those skills. A developer needs the part that makes a change fit the path. DevOps engineer is one title a company uses for the same skills.',
      'The line between developer, operations, and DevOps engineer is thin and depends on the company. An operations team may practice the same skills as SRE.',
      'The tools are choices inside those skills: the machine, Git, a pipeline, server setup, the cloud account, Docker, Kubernetes, and a way to see when it breaks.',
    ],
    relatedLabs: [],
    followOn: {
      eyebrow: 'Practice',
      title: 'Start on a machine',
      intro:
        'Linux is the first shelf. Docker and Kubernetes come after you have been on a machine of your own.',
      links: [
        { label: 'Linux', href: LINUX_LABS_PATH },
        { label: 'Docker', href: DOCKER_LABS_PATH },
        { label: 'Kubernetes', href: K8S_LABS_PATH },
      ],
    },
  },
];

export function getDevopsReading(slug: string | null | undefined): K8sReading | null {
  if (!slug) return null;
  return DEVOPS_READINGS.find((reading) => reading.slug === slug || reading.id === slug) ?? null;
}

export function listDevopsIntroItems(): K8sTrackItem[] {
  return DEVOPS_READINGS.map((reading) => ({
    type: 'reading',
    id: reading.id,
    readingId: reading.id,
  }));
}
