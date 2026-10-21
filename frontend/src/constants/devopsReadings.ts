/** Track-level DevOps readings. The discipline, not a single shelf. */

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
    trackId: 'B0',
    eyebrow: 'The discipline',
    title: 'What DevOps is',
    showBlogStamp: true,
    summary:
      'The work of taking a change from a developer machine into production and keeping it running there.',
    lede:
      'DevOps is how a company gets a change off a laptop and into the running product, then keeps that product up. This reading defines the word, separates the practice from the job title, and names the kinds of work it covers. The tools come later. They are options for these jobs, and the list is wider than any one shelf.',
    sections: [
      {
        id: 'two-jobs',
        title: 'Two jobs, one product',
        body: [
          'Every software company has two jobs that used to sit on opposite sides of a wall. One job is **building**: write the feature, fix the bug, change the price calculation. The other job is **running**: install it somewhere customers can reach, keep it up on a Friday night, and restore it when a disk fills or a release goes bad.',
          'For a long time those jobs belonged to different teams. Developers finished a release and handed over a package, a date, and a document. Operations received it, ran it on servers they alone understood, and sent problems back days later. Each side held half the story. The customer held the outage.',
          '**DevOps** is the name for closing that gap. The people who change the system and the people who run it share one path, one set of signals, and one definition of done. Done means a customer can use the change, and someone can tell when it breaks.',
        ],
        callout: {
          kind: 'idea',
          title: 'A server, in one sentence',
          body: [
            'A **server** is a computer whose job is to serve other computers all day: a website, an API, a payment, a nightly report. It usually sits in a data center or a cloud account, with no screen on the desk in front of you. Someone reaches it over the network. Most of those machines run **Linux**. That is why the operating system shows up so early in this work.',
          ],
        },
      },
      {
        id: 'where-the-word-came-from',
        title: 'Where the word came from',
        body: [
          'The word took off around 2009, among engineers who were tired of release weekends. A release was an event. People stayed late, read from a runbook, and hoped. If the release was wrong, the old version was often hard to put back, so the bad one stayed until the next window.',
          'Conferences such as DevOpsDays gave that frustration a name and a set of habits: smaller changes, shared ownership, and automation in place of a handoff. The habits spread because software had become the business. A shop, a bank, a taxi app, a hospital system. The product is the running system, and it has to change every week without falling over.',
          'You will still meet the older split. Some companies have a development department and an operations department, and a ticket is how work crosses. DevOps is the argument that the ticket is an expensive way to ship.',
        ],
      },
      {
        id: 'practice-role-team',
        title: 'A practice, a role, and a team',
        body: [
          'People use the same word for three different things. All three are real. Mixing them up is how a newcomer ends up thinking DevOps means "the person who knows containers."',
        ],
        table: {
          headers: ['How the word is used', 'What it means', 'What to watch for'],
          rows: [
            [
              '**A practice**',
              'Shared ownership of the path from a change to production.',
              'Any team can work this way, including a team with nobody titled DevOps.',
            ],
            [
              '**A role**',
              'A person hired to build and run that path.',
              'Job posts pack many skills into one title. The title is the hiring label, not the whole discipline.',
            ],
            [
              '**A team**',
              'A group that owns the platform other teams ship on.',
              'The name on the door may be DevOps, Platform, Infrastructure, or SRE. The work is the path.',
            ],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'SRE sits in the same family',
          body: [
            '**Site Reliability Engineering** (SRE) is the name Google popularized for treating reliability as an engineering problem: how often the service may fail, how much repeated manual work to remove, and how an incident gets written down. Some companies fold that into the DevOps or platform group. Some keep a separate SRE team beside product teams.',
            'When you hear both words in one company, ask who carries the pager and who sets the reliability target. The underlying work is one family: make change safe, make failure visible, remove the steps a person should not repeat by hand.',
          ],
        },
      },
      {
        id: 'the-work',
        title: 'The work, whatever the tool is called',
        body: [
          'Day to day, the discipline is a set of jobs. Companies pick different products for each job. The jobs stay remarkably stable from a five-person startup to a bank.',
        ],
        bullets: [
          '**Keep the machines healthy.** Operating system, users, permissions, disk, processes, and the network between services.',
          '**Keep a source of truth.** Changes live in version control and get reviewed before they land. Git is the usual system. GitHub, GitLab, and Bitbucket are the usual places it is hosted.',
          '**Build and test every change the same way.** A pipeline, not a person\'s memory, compiles, tests, and packages. This is **CI/CD** (continuous integration, and continuous delivery or deployment). Jenkins, GitHub Actions, GitLab CI, CircleCI, Azure Pipelines, and Buildkite are common engines for it.',
          '**Describe machines and environments as code.** Configuration management (Ansible, Chef, Puppet, Salt) makes many servers match a declared state. Infrastructure as code (Terraform, OpenTofu, CloudFormation, Pulumi) does the same for networks, accounts, and cloud resources.',
          '**Ship a package, and be able to take it back.** The package might be a container image (Docker, Podman), a language artifact, or a versioned bundle in a registry. The running copies might be a few virtual machines, or an orchestrator such as Kubernetes, Amazon ECS, or Nomad.',
          '**Watch the running system.** Logs, metrics, and traces. Prometheus, Grafana, the Elastic stack, OpenSearch, Loki, and hosted products such as Datadog are ways to do this.',
          '**Respond when it breaks.** A person on call, an alert, a runbook, a way to restore service, and a short record of what happened.',
          '**Guard the path.** Who may deploy, where secrets live, and how a test credential is kept away from production data.',
        ],
        after: [
          'A later reading in this series walks those families one by one, including tools this track does not have a lab for yet. None of the product names above is DevOps. Each one is a choice for one row of the work.',
        ],
      },
      {
        id: 'mixed-up-names',
        title: 'Names that get mixed up',
        body: [
          'A few sentences that save a lot of confusion later:',
        ],
        bullets: [
          '**There is no DevOps product to install.** The word names the path and the ownership. A company can practice it with a small set of tools, or with a large estate built up over years.',
          '**Containers are one packaging choice.** Docker is common, and worth learning. A team that ships jars onto virtual machines, or functions onto a cloud, is still doing this work if the path from commit to production is shared and repeatable.',
          '**A certificate is a study plan.** It can structure what you practice. It does not run production, and it does not cover every row of the job.',
          '**Application code is a neighboring job.** The people who own checkout behavior are often a different group from the people who own the pipeline, the cluster, and the account. In smaller companies one person does both. The skills are still distinct.',
          '**The open labs are a slice, not the definition.** Linux, containers, and Kubernetes are three rows you can practice here today. Pipelines, Ansible and Chef, Terraform, cloud accounts, and observability are the same discipline.',
        ],
      },
    ],
    takeaways: [
      'DevOps closes the gap between changing software and running it.',
      'The word can mean a practice, a role, or a team. Ask which one a sentence is using.',
      'The work is a stable set of jobs: machines, source, pipelines, configuration, infrastructure, release, signals, and response.',
      'Tool names are choices inside those jobs. Ansible, Jenkins, Terraform, and Kubernetes each sit in a different job.',
      'SRE is the reliability-shaped cousin of the same work.',
    ],
    relatedLabs: [],
    followOn: {
      eyebrow: 'Next',
      title: 'Why companies pay for it',
      intro:
        'The next reading is the business reason: what breaks when this path is missing, and the few numbers teams use to see whether it is getting better.',
      links: [
        {
          label: 'Why companies need DevOps',
          href: devopsReadingPath('why-companies-need-devops'),
        },
      ],
    },
  },
  {
    id: 'why-companies-need-devops',
    slug: 'why-companies-need-devops',
    trackId: 'B1',
    eyebrow: 'Why it exists',
    title: 'Why companies need DevOps',
    showBlogStamp: true,
    summary:
      'Why a feature on a laptop is not a product, and how teams tell whether the path to production is getting safer.',
    lede:
      'Companies pay for this work because a feature that exists only on a laptop does not take an order, clear a payment, or serve a page. This reading is about the pressures that make a manual release process collapse, and the few numbers teams use to see whether the path is getting better.',
    sections: [
      {
        id: 'running-system',
        title: 'Customers meet the running system',
        body: [
          'A repository is not the product. Customers meet whatever is **running**: the site, the API, the app, the nightly job that sends the settlement file. A change earns its keep when it is in that running system and stays there. Until then it is unfinished work, however complete it looks on the author\'s machine.',
          'That sounds obvious, and companies still get it wrong in a specific way. They fund the writing of the change and treat the path into production as a later problem. The path is where the weeks go: waiting for a release window, repairing a server nobody can rebuild, finding out from a support ticket that errors have been climbing since Tuesday.',
        ],
      },
      {
        id: 'four-pressures',
        title: 'Four pressures, at the same time',
        body: [
          'The discipline exists because four pressures arrive together. Solving one of them by ignoring the others is how teams end up with either a frozen product or a fragile one.',
        ],
        table: {
          headers: ['Pressure', 'What it asks for', 'What goes wrong if you ignore it'],
          rows: [
            [
              '**Speed**',
              'Ship a small change this week, and learn whether it was the right change.',
              'A quarterly window means the business waits a quarter to find out. Competitors do not wait with you.',
            ],
            [
              '**Safety**',
              'A bad change can be undone, and a good change does not surprise production.',
              'The same speed, pointed at payments or health data, becomes an outage with a headline.',
            ],
            [
              '**Scale**',
              'Ten servers, then a hundred, then a traffic spike, without a person logging into each one.',
              'Hand-starting copies under load is already too late. So is SSH-ing through a spreadsheet of hostnames.',
            ],
            [
              '**Cost**',
              'People spend their time on the next change. Machines are the size the traffic needs.',
              'Repeated install steps are salary. Oversized "just in case" fleets are the cloud bill. Outages are refunds and lost orders.',
            ],
          ],
        },
        after: [
          'A shop that deploys once a year can survive on a careful document and a weekend. A shop that deploys most days, on more than a handful of machines, cannot. Most companies that hire for this work have already crossed that line, or they can see it coming.',
        ],
      },
      {
        id: 'when-the-path-is-missing',
        title: 'What it looks like when the path is missing',
        body: [
          'You can recognize a missing path without ever seeing the architecture diagram. The symptoms are ordinary, and expensive.',
        ],
        table: {
          headers: ['What you hear', 'What is actually happening', 'What it costs'],
          rows: [
            [
              '"Release weekend."',
              'A document, a bridge call, and a freeze on other changes.',
              'Features wait in a queue. People burn out. A miss waits until the next window.',
            ],
            [
              '"It only works on that box."',
              'Each server was fixed by hand, and no two match. These are called **snowflake** servers.',
              'The next person cannot rebuild the machine. The fix lives in someone\'s memory.',
            ],
            [
              '"Ask the one person who knows production."',
              'The expert is the documentation.',
              'Holidays, resignations, and sick days become incidents.',
            ],
            [
              '"We will fix it forward."',
              'The new version replaced the old one, and the old one cannot be put back cleanly.',
              'A bad change stays bad until someone reconstructs the previous setup.',
            ],
            [
              '"A customer wrote in."',
              'Nobody is watching error rate, latency, or disk. The user is the monitoring system.',
              'The failure is already widespread before the team hears about it.',
            ],
          ],
        },
        callout: {
          kind: 'warn',
          title: 'Drift is the quiet version',
          body: [
            '**Configuration drift** is what happens when the servers started out alike and then diverged. Someone edited one machine during an incident and did not record it. A package got upgraded on half the fleet. The next deploy assumes a file that exists on some hosts and not others.',
            'This is the problem configuration management is for. Ansible, Chef, Puppet, and Salt exist so the declared state can be applied again, and the hand edit stops being the source of truth.',
          ],
        },
      },
      {
        id: 'how-teams-measure',
        title: 'How teams tell whether it is working',
        body: [
          'A research program often called **DORA** (from the DevOps Research and Assessment group, later written up in the book *Accelerate*) gave engineering leaders four numbers. You do not need the study to use the questions. They are the questions a skeptical manager is already asking.',
        ],
        table: {
          headers: ['Number', 'The plain question'],
          rows: [
            [
              '**Deployment frequency**',
              'How often does a change actually reach production?',
            ],
            [
              '**Lead time for changes**',
              'How long from the moment the change is merged to the moment customers have it?',
            ],
            [
              '**Change failure rate**',
              'How often does a release need a fix, a rollback, or a hotfix?',
            ],
            [
              '**Recovery time**',
              'When a release or an outage hurts customers, how long until they are served again?',
            ],
          ],
        },
        after: [
          'These are not a scoreboard to game. A team that deploys hourly and breaks checkout every hour has not won. The point is to move all four together: more often, a shorter wait, fewer bad releases, faster recovery. Automation is valuable when it does that. A pipeline that deploys an untested change faster has only sped up the failure.',
        ],
        callout: {
          kind: 'idea',
          title: 'Reliability gets a budget',
          body: [
            'An **SLO** (service level objective) is a promise such as "checkout succeeds for 99.9% of requests this month." Perfection is not the promise. The gap between the promise and 100% is the **error budget**.',
            'When the budget is healthy, the team spends it on features. When the budget is gone, the team spends time on reliability until the promise holds again. That is how larger companies stop the endless argument between "ship faster" and "stop breaking it." SRE teams often own this number. A DevOps or platform team in a smaller company often owns it under a different title.',
          ],
        },
      },
      {
        id: 'who-feels-it',
        title: 'Who feels the gap',
        body: [
          'The bill does not land on one desk.',
        ],
        bullets: [
          '**Customers** feel a page that fails, a payment that double-charges, or a report that never arrives.',
          '**The person on call** feels it at night, with a laptop and a partial map of production.',
          '**Finance** feels it in the cloud bill, in refunds, and in the salary of people repeating manual installs.',
          '**Auditors and regulators** feel it anywhere a change to production must be traceable: banking, health, payments, and a growing list of other industries.',
          '**The rest of engineering** feels it when their own feature sits behind a queue of tickets to the only team allowed to deploy.',
        ],
      },
    ],
    takeaways: [
      'The product is the running system, not the repository.',
      'Speed, safety, scale, and cost arrive together. A release process has to serve all four.',
      'Release weekends, snowflake servers, a single expert, no rollback, and customer-as-monitor are the usual symptoms.',
      'Deployment frequency, lead time, change failure rate, and recovery time are the four questions teams use.',
      'An error budget is how a company decides when to ship features and when to stop and repair reliability.',
    ],
    relatedLabs: [],
    followOn: {
      eyebrow: 'Next',
      title: 'How a company actually runs it',
      intro:
        'The next reading walks the path one change takes inside a company, the environments it passes through, and the ways teams divide the pager.',
      links: [
        {
          label: 'How companies run DevOps',
          href: devopsReadingPath('how-companies-run-devops'),
        },
      ],
    },
  },
  {
    id: 'how-companies-run-devops',
    slug: 'how-companies-run-devops',
    trackId: 'B2',
    eyebrow: 'Inside a company',
    title: 'How companies run DevOps',
    showBlogStamp: true,
    summary:
      'The path a change takes from commit to production, who holds the pager, and the controls that sit on that path.',
    lede:
      'The tools differ from company to company. The shape of the work does not. This reading walks the path a change takes, the environments it passes through, and the ways teams divide ownership. Jenkins or GitHub Actions, Ansible or Chef, virtual machines or Kubernetes: those are choices along this path, not different jobs.',
    sections: [
      {
        id: 'path-of-a-change',
        title: 'The path of one change',
        body: [
          'Picture a small change to a service that takes orders. An engineer has already written it on their machine. Everything after that is the path DevOps is accountable for, whether the company uses that title or not.',
        ],
        flows: [
          {
            title: 'From merged change to a customer',
            steps: [
              'Review',
              'Build and test',
              'Package',
              'Publish',
              'Configure',
              'Deploy',
              'Watch',
              'Restore if needed',
            ],
          },
        ],
        after: [
          '**Review.** The change is proposed in a pull request (GitHub) or merge request (GitLab). Another person reads the diff. Automated checks often run before a human even looks: does it compile, do the tests pass, did a scanner flag a known-vulnerable dependency.',
          '**Build and test.** **Continuous integration (CI)** runs those checks on a machine that is not the author laptop, on every merge. "It worked for me" is checked by a clean environment. Jenkins, GitHub Actions, GitLab CI, CircleCI, Azure Pipelines, Buildkite, and TeamCity are engines that do this. A company usually standardizes on one.',
          '**Package.** The output is an **artifact**: a container image, a jar, a wheel, a zip with a version number. Production should run that artifact, not a fresh build made later from a slightly different source tree.',
          '**Publish.** The artifact goes to a **registry** or artifact store. Container images often live in Docker Hub, Amazon ECR, Google Artifact Registry, Azure Container Registry, GitHub Container Registry, or a self-hosted Harbor. Other packages often live in Artifactory or Nexus. The version that was tested is the version that can be deployed, and the previous version is still there for a rollback.',
          '**Configure.** Settings that differ between environments (the database address, the feature flag, the log level) are applied with the deploy. They are not edited live on a server and forgotten. This is where Ansible, Chef, Puppet, Helm, Kustomize, or plain environment files show up, depending on whether the target is a machine or a cluster.',
          '**Deploy.** **Continuous delivery** means the artifact is always in a state where a release is a deliberate, small step. **Continuous deployment** means a passing pipeline releases it on its own. Companies pick one. Some still have a person press the button, and the button runs the same script every time. **GitOps** is a habit on top of this: the desired state lives in Git, and a controller such as Argo CD or Flux makes the running system match that commit.',
          '**Watch.** Logs, metrics, and traces say whether the new version is healthy. An alert fires when a number crosses a line the team chose in advance. The customer inbox is the backup signal, not the primary one.',
          '**Restore.** If the change is bad, the previous artifact is put back, or traffic is pointed at the previous version. That only works because the previous artifact was published and kept. Rebuilding "whatever was on the box last month" from memory is the path this step replaces.',
        ],
      },
      {
        id: 'environments',
        title: 'Environments the change walks through',
        body: [
          'The same artifact is promoted through a series of **environments**. The code does not get rebuilt for production with a different recipe. The settings around it change. The artifact stays.',
        ],
        table: {
          headers: ['Environment', 'Who it is for', 'What "good" means'],
          rows: [
            [
              '**Local**',
              'The author.',
              'The change runs on their machine, with stand-in data.',
            ],
            [
              '**Dev or test**',
              'The team.',
              'It runs beside the other services, on data that is safe to break.',
            ],
            [
              '**Staging**',
              'The team, sometimes a QA group, sometimes a rehearsal of the real release.',
              'As close to production as the company is willing to pay for: same shape, fake or copied data, no real customers.',
            ],
            [
              '**Production**',
              'Customers.',
              'The real data, the real traffic, and the real pager.',
            ],
          ],
        },
        callout: {
          kind: 'scope',
          title: 'Production is where experiments stop',
          body: [
            'The earlier environments exist so that trying something happens before customers are involved. People still need access to production during an incident. That access is granted narrowly, logged, and removed when the incident is over. A shared password to the production database in a chat channel is the habit this control replaces.',
          ],
        },
      },
      {
        id: 'who-holds-it',
        title: 'Who holds the work',
        body: [
          'Org charts vary more than the path does. These are the shapes you will actually join. A company often moves from the bottom of the table toward the top as the number of services grows.',
        ],
        table: {
          headers: ['Shape', 'How the work is split', 'Where you meet it'],
          rows: [
            [
              '**One or two generalists**',
              'The same people write the service, the pipeline, and the server setup.',
              'Early-stage companies. Every job in the previous section still exists. There is just one name on all of them.',
            ],
            [
              '**A central platform, DevOps, or infrastructure team**',
              'One group builds the path: pipelines, accounts, base images, clusters, templates. Product teams use that path to ship their own services.',
              'Mid-size and large companies. The door may say DevOps, Platform, or Infrastructure.',
            ],
            [
              '**You build it, you run it**',
              'The team that writes the service also deploys it and carries the pager, on a platform they do not have to invent.',
              'Product companies that outgrew a single operations queue and do not want that queue back.',
            ],
            [
              '**SRE beside product**',
              'Product teams ship. A reliability group sets the error budget, removes toil, and shares incidents.',
              'Larger companies, often ones that adopted the Google SRE model on purpose.',
            ],
          ],
        },
        after: [
          'There is no correct row. The useful questions are: who is allowed to change production, and who is woken up when it breaks. A platform team that is the only group allowed to deploy has rebuilt the old wall, with a newer name. A product team that carries the pager with no logs, no rollback, and no paved path has been handed the outage without the tools.',
        ],
      },
      {
        id: 'a-week',
        title: 'What a week looks like',
        body: [
          'The title on the offer letter changes. The week is a mix of the same kinds of tasks.',
        ],
        bullets: [
          '**Extend the path.** Add a pipeline stage, a base image, a Terraform module, or an Ansible role that another team can reuse instead of inventing their own.',
          '**Review a service that is about to go out.** Does it have a health check, a resource limit, a secret that is not in the repository, and a way to roll back?',
          '**Tend the estate.** Certificates expiring, disks filling, a cloud bill that jumped, a cluster node that cannot schedule work.',
          '**Take an incident.** Restore service first. Then write the short record: what broke, how you knew, what you changed, what will make the next one smaller.',
          '**Remove one piece of toil.** A manual step that a script, a pipeline, or a template can do next time. Toil is the word SRE uses for that repeated work.',
          '**Show a new team the path.** The second time a team ships should be shorter than the first. That is the platform earning its keep.',
        ],
      },
      {
        id: 'controls',
        title: 'Controls that sit on the path',
        body: [
          'Companies that handle money, health data, or a large brand do not leave the path informal. The same controls are good practice everywhere else. Auditors are just the people who will ask to see them.',
        ],
        bullets: [
          '**Identity.** Who may merge, who may deploy, who may open a production shell. Usually the company directory, plus short-lived credentials rather than a key that lives on a laptop for a year.',
          '**Secrets.** Passwords, API keys, and certificates live in a secret store: HashiCorp Vault, or a cloud equivalent such as AWS Secrets Manager, Google Secret Manager, or Azure Key Vault. They do not live in the repository, and they do not live in a screenshot.',
          '**Change records.** What went out, who approved it, and how to undo it. The pipeline log is often that record, if the pipeline is the only way to production.',
          '**On-call.** A rotation, an alert route (PagerDuty, Opsgenie, and similar), and a runbook written for someone who was asleep ten minutes ago.',
          '**Separation.** A credential that works in test cannot read production data. A developer laptop is not a production admin console.',
        ],
        callout: {
          kind: 'tip',
          title: 'The estate you join is allowed to be mixed',
          body: [
            'One company runs this path with GitHub Actions, Ansible, and virtual machines on AWS. Another uses GitLab, Terraform, and Kubernetes on Google Cloud. A third still has Jenkins and Chef because that is what the estate was built with, and replacing it is a multi-year project.',
            'When you join, learn the path first and the brand names second. The next reading is the map of those brands, grouped by the job they do.',
          ],
        },
      },
    ],
    takeaways: [
      'A change is reviewed, built, packaged, published, configured, deployed, watched, and restored from a kept artifact.',
      'CI runs the checks. Delivery keeps a release ready. Deployment releases it. GitOps stores the desired state in Git.',
      'The same artifact moves through dev, test, staging, and production. Production is where experiments stop.',
      'Generalist, platform team, you-build-it-you-run-it, and SRE are org charts. The path underneath them is the same.',
      'Identity, secrets, change records, on-call, and separated environments are the controls on that path.',
    ],
    relatedLabs: [],
    followOn: {
      eyebrow: 'Next',
      title: 'The skills and the tools',
      intro:
        'The next reading is the map: each job, the tools companies actually pick for it, and an order you can learn them in.',
      links: [
        {
          label: 'Skills and tools in DevOps',
          href: devopsReadingPath('devops-skills-and-tools'),
        },
      ],
    },
  },
  {
    id: 'devops-skills-and-tools',
    slug: 'devops-skills-and-tools',
    trackId: 'B3',
    eyebrow: 'The map',
    title: 'Skills and tools in DevOps',
    showBlogStamp: true,
    summary:
      'A map of the jobs in DevOps and the tools companies pick for each one, from Ansible and CI to cloud and Kubernetes.',
    lede:
      'DevOps is a set of jobs. Each job has a family of tools, and a company picks one or two from the family. This reading is that map: what each family is for, the names you will see in job posts, and an order a newcomer can learn them in. It is wider than the shelves that currently have labs. Those shelves are three rows of this map, not the edges of it.',
    sections: [
      {
        id: 'how-to-read-the-list',
        title: 'How to read a tool list',
        body: [
          'Job posts read like a shopping list. Treat them as a map of an estate, with a few rules.',
        ],
        bullets: [
          '**Learn the job, then the tool the company uses for that job.** "Make a hundred servers match" is the job. Ansible, Chef, Puppet, or Salt is the tool. Depth in one of them beats a glossary of all four.',
          '**Names in the same row overlap.** You will rarely be asked to be the expert in both Chef and Ansible at once. You will be asked to know which problem that row solves.',
          '**New product names show up every year. The rows do not.** When a post names something you have not seen, find the row. You already know the problem it is there to solve.',
          '**A long post is often a history.** Five CI systems usually means the company changed tools, or the post was copied. Ask which one you would actually touch in the first month.',
        ],
      },
      {
        id: 'the-machine',
        title: 'The machine',
        body: [
          '**Linux** is the operating system on most servers. The skill is concrete: files and permissions, users and groups, processes, services that restart when they crash, disk space, and the network path from one service to another. **Bash** is how you automate the checks you would otherwise retype. A little **Python** covers the scripts that have outgrown a shell one-liner. **Go** shows up when teams write their own small operational tools.',
          'Networking at this layer is practical, not a protocol textbook. DNS names, ports, firewalls, and the question "why can this service not reach that one." When an incident is "it is down," a surprising amount of the time the answer is on this row: disk full, process dead, permission wrong, port closed, name not resolving.',
        ],
      },
      {
        id: 'source-control',
        title: 'Source control',
        body: [
          '**Git** is the standard way to record a change, branch it, and review it. **GitHub**, **GitLab**, and **Bitbucket** host the repositories and the review. The skill is commits, branches, pull requests, and reading a diff someone else wrote.',
          'Almost every later tool stores its own configuration in Git: the pipeline file, the Ansible playbook, the Terraform module, the Kubernetes manifests. If it is not in Git, the team cannot review it, and they cannot tell what production is supposed to look like.',
        ],
      },
      {
        id: 'cicd',
        title: 'CI/CD pipelines',
        body: [
          'A **pipeline** is the script the company trusts more than a person\'s memory. The same steps run every time, and they leave a log.',
          '**Continuous integration (CI)** builds and tests on every change. **Continuous delivery (CD)** keeps a versioned artifact ready to release. **Continuous deployment** releases that artifact when the checks pass. People say "CI/CD" for the whole path. When precision matters, ask which of the three they mean.',
        ],
        table: {
          headers: ['You will see', 'Where it tends to live'],
          rows: [
            ['**GitHub Actions**', 'Repositories already on GitHub. The pipeline file sits next to the code.'],
            ['**GitLab CI**', 'Companies on GitLab. Same idea: the pipeline is a file in the repository.'],
            ['**Jenkins**', 'Everywhere that automated builds before the newer hosted options. Still very common. Often the system a company means to leave, and has not left.'],
            ['**CircleCI, Buildkite, TeamCity, Azure Pipelines**', 'Hosted or self-hosted engines companies standardize on. Azure Pipelines shows up beside Azure. TeamCity shows up in older Java estates.'],
            ['**Argo CD, Flux**', 'Not the test runner. These are **GitOps** controllers: Git says what production should be, and they make the cluster match.'],
            ['**Spinnaker**', 'A deployment system you meet at larger scale, often with several clouds and a formal promotion between environments.'],
          ],
        },
        after: [
          'A first pipeline is allowed to be small: on every merge, run the tests, build the artifact, publish it with a version. Deploy comes after that is boring and reliable.',
        ],
      },
      {
        id: 'config-management',
        title: 'Configuration management',
        body: [
          'The problem is **drift**. Servers that began as copies of each other get hand-edited until nobody can say what "correct" is. Configuration management declares the state (this package is installed, this file has this content, this service is running) and applies that declaration again and again.',
        ],
        table: {
          headers: ['Tool', 'How to place it'],
          rows: [
            [
              '**Ansible**',
              'The one you will see most often in current posts. YAML playbooks, and it connects over SSH. No agent has to be installed on the target first. A common first tool after you are comfortable on Linux.',
            ],
            [
              '**Chef**',
              'Cookbooks written in a Ruby style. A client on each server checks in with a server. Common in estates that adopted it years ago and still run it in production.',
            ],
            [
              '**Puppet**',
              'Its own language, and an agent on each machine. Same generation of idea as Chef, still running in a lot of large, older fleets.',
            ],
            [
              '**Salt** (SaltStack)',
              'Less common in general job posts. You meet it where a team already chose it. The job it does is the same row.',
            ],
          ],
        },
        after: [
          'Ansible can also create cloud resources, and Terraform can copy a file onto a machine. Teams still tend to split the work: configuration management for what is **on** a machine, infrastructure as code for the machine and the network **around** it. When a company uses one tool for both, learn their boundary rather than arguing from a blog post.',
        ],
      },
      {
        id: 'infrastructure-as-code',
        title: 'Infrastructure as code',
        body: [
          'The problem is the account: networks, virtual machines, databases, load balancers, DNS, and permissions. Clicking through a cloud console does not review, does not repeat, and does not roll back as a set. **Infrastructure as code** puts that layout in files, reviews the diff, and applies it with a tool that knows what already exists.',
        ],
        table: {
          headers: ['Tool', 'How to place it'],
          rows: [
            [
              '**Terraform**',
              'The name you will meet most often, across AWS, Google Cloud, and Azure. You describe resources, and Terraform plans the difference between the file and the account.',
            ],
            [
              '**OpenTofu**',
              'An open-source fork of Terraform. Same shape. Some companies moved to it for licensing reasons. Reading Terraform and reading OpenTofu are the same skill.',
            ],
            [
              '**CloudFormation**',
              'AWS\'s own tool for the same job, inside AWS.',
            ],
            [
              '**Azure Bicep** and **ARM templates**',
              'The Azure-native versions.',
            ],
            [
              '**Pulumi**, **AWS CDK**, **CDKTF**',
              'The same idea written in a general-purpose language (TypeScript, Python, Go) instead of a dedicated template language.',
            ],
          ],
        },
      },
      {
        id: 'containers',
        title: 'Containers and registries',
        body: [
          'A **container** packages an application with the libraries it needs, so the same package runs on a laptop and on a server. That is the whole promise. It does not, by itself, restart a dead copy or spread traffic across machines. That is the next row.',
        ],
        bullets: [
          '**Docker** is the tool most people learn first: build an image from a Dockerfile, run it, publish it.',
          '**Podman** is a common alternative, especially on Linux servers that do not want a Docker daemon running as a service.',
          'A **registry** stores the images. Docker Hub, Amazon ECR, Google Artifact Registry, Azure Container Registry, GitHub Container Registry, and Harbor (often run by the company itself).',
          'The habit that matters: production runs a **pinned** image, the one the pipeline published, not whatever tag happens to mean "latest" today.',
        ],
      },
      {
        id: 'orchestration',
        title: 'Orchestration',
        body: [
          'Once there are many containers, something has to place them on machines, restart them, give them a stable address, and roll out a new version without dropping every request. That something is an **orchestrator**.',
        ],
        table: {
          headers: ['Orchestrator', 'How to place it'],
          rows: [
            [
              '**Kubernetes**',
              'The default in most new systems, and in most job posts that say "cloud native." You declare the desired state. The cluster tries to make the running state match.',
            ],
            [
              '**Amazon ECS**',
              'Common when a company is all-in on AWS and wants a smaller surface than Kubernetes.',
            ],
            [
              '**Nomad**',
              'HashiCorp scheduler. You meet it in estates that already chose the surrounding HashiCorp tools, or that wanted a single scheduler for containers and other workloads.',
            ],
            [
              '**Docker Swarm**',
              'An older, smaller option. Still running in places that adopted it and have not had a reason to move.',
            ],
          ],
        },
        after: [
          'On Kubernetes, **Helm** and **Kustomize** are how teams package the configuration (the manifests) so one service description can be reused across dev and production with different settings. Release patterns you will hear beside them: **canary** (a little traffic on the new version first) and **blue-green** (two full versions, and a switch). You do not need those patterns in week one. You need a release that can be undone.',
        ],
      },
      {
        id: 'cloud',
        title: 'Cloud platforms, and machines you still own',
        body: [
          '**AWS**, **Google Cloud**, and **Microsoft Azure** are the three platforms job posts name. The skill is not every service on the poster in the lobby. It is accounts, identity and access (**IAM**), networks, compute, storage, and how the bill is formed. A person who can read an IAM policy and a network path is more useful than a person who has clicked through fifty product pages.',
          'Some companies run their own machines in a data center. People say **on-prem** for that. Many run both: a cloud account for new work, and a data center for the systems that have not moved. The path from the earlier reading is the same in both places. The console you click, or the Terraform provider you name, is what changes.',
        ],
      },
      {
        id: 'observability',
        title: 'Observability',
        body: [
          '**Observability** is whether you can tell what the system is doing from the signals it emits, including a failure you have not seen before. Three signals cover most of the job.',
        ],
        table: {
          headers: ['Signal', 'What it answers', 'Names you will see'],
          rows: [
            [
              '**Logs**',
              'What did this program say, line by line?',
              'Elasticsearch with Kibana (the Elastic stack), OpenSearch, Grafana Loki, Splunk.',
            ],
            [
              '**Metrics**',
              'How is a number moving over time? Error rate, latency, CPU, disk.',
              'Prometheus for collection, Grafana for dashboards. Datadog and New Relic when the company buys this instead of running it.',
            ],
            [
              '**Traces**',
              'Where did this one request spend its time, across several services?',
              'Jaeger, Tempo, and the trace views inside Datadog or New Relic.',
            ],
          ],
        },
        after: [
          '**OpenTelemetry** is the shared way applications emit all three, so a team is not locked to one vendor library. The alerts on top of the metrics are what wake the on-call person. A dashboard nobody looks at is not observability. A page that fires when customers are already affected, with a runbook next to it, is.',
        ],
      },
      {
        id: 'secrets-and-security',
        title: 'Secrets, and security on the path',
        body: [
          '**DevSecOps** is the name for putting security checks on the same path, instead of a review that happens the week after the release. The checks are ordinary once you have seen them once.',
        ],
        bullets: [
          '**Secrets** live in Vault or a cloud secret manager, and the pipeline or the runtime fetches them. They are not baked into an image and they are not committed.',
          '**Scanning** looks at dependencies and container images for known vulnerabilities. Trivy, Grype, Snyk, and the scanners built into registries are the usual names.',
          '**Least privilege** means the deploy identity can deploy, and cannot read every bucket in the account. The same idea as file permissions, one layer up.',
          '**Policy as code** is a newer row: Open Policy Agent and, on Kubernetes, Kyverno, so a rule ("every container has a memory limit") is enforced by a machine at deploy time.',
        ],
      },
      {
        id: 'incidents',
        title: 'Incidents and reliability',
        body: [
          'Someone is on call. **PagerDuty**, **Opsgenie**, and **Splunk On-Call** (formerly VictorOps) are the products that route an alert to that person. A **status page** (Statuspage and others, or a simple one the company hosts) tells customers what you already know.',
          'During the incident the goal is to restore service. After it, the goal is a short written review: what broke, how you detected it, what you changed, and which piece of toil or missing signal made it worse. Blame is a poor source of the next fix. The SLO and the error budget, from the previous reading, are the vocabulary for deciding whether the follow-up is "ship the feature" or "pay down the failure."',
        ],
      },
      {
        id: 'beside-the-map',
        title: 'Names that sit beside the map',
        body: [
          'A few more rows, so a new term has somewhere to land. You do not start here.',
        ],
        bullets: [
          '**Service mesh** (Istio, Linkerd): extra control of traffic between services on a cluster, including encryption and retries. Teams adopt it after they already feel the pain of many services talking in unclear ways.',
          '**Feature flags** (LaunchDarkly, and plenty of in-house versions): turn a behavior on for some users without shipping a new artifact.',
          '**Tickets and chat** (Jira, Linear, Slack, Microsoft Teams): where the work is tracked and where the incident channel opens. The runbook should live in Git even if the conversation happens in chat.',
          '**Artifact stores for things that are not containers** (Artifactory, Nexus): the same "publish a version, deploy that version" idea for jars, packages, and generic files.',
        ],
      },
      {
        id: 'learning-order',
        title: 'An order that builds',
        body: [
          'You do not learn the map left to right in a month. This order is the one that makes each next tool explainable.',
        ],
        flows: [
          {
            title: 'A path through the rows',
            steps: [
              'Linux and a shell',
              'Git',
              'One pipeline',
              'One config tool',
              'One infrastructure tool',
              'Containers',
              'An orchestrator',
              'Logs, metrics, on-call',
            ],
          },
        ],
        after: [
          'Ansible is the usual first configuration tool, because it assumes you already understand the machine it is configuring. Terraform is the usual first infrastructure tool, because so many accounts are described with it. Kubernetes makes more sense after you have run one container on one machine and felt the limit of that.',
          'You can stop after the pipeline and already be useful on a small team. The later rows are how the work grows with the number of services. A post that lists fifteen products is listing an estate. Sort them into rows, and ask which row you would touch.',
        ],
        callout: {
          kind: 'scope',
          title: 'What you can practice on DevSetu today',
          body: [
            'The hands-on shelves that are open now are **Linux**, **Docker**, and **Kubernetes**. Those are the machine, the package, and the orchestrator. Each shelf has its own readings beside the labs, and those readings go deep on that row.',
            'Pipelines, Ansible, Chef, Puppet, Terraform, cloud accounts, and observability are the same discipline. They are on this map so you can place a tool when a lab, a teammate, or a job post names one, including tools that do not have a shelf yet.',
          ],
        },
      },
    ],
    takeaways: [
      'Sort every new tool into a job: machine, source, pipeline, configuration, infrastructure, containers, orchestration, cloud, signals, secrets, or incidents.',
      'Ansible, Chef, Puppet, and Salt are the configuration family. Ansible is the usual first one to learn.',
      'Terraform is the usual infrastructure-as-code choice. OpenTofu, CloudFormation, Bicep, and Pulumi sit in that same row.',
      'Jenkins, GitHub Actions, and GitLab CI are pipelines. Argo CD and Flux are GitOps on top of a deploy.',
      'Kubernetes is the usual orchestrator. It is one row of the role, not the definition of the role.',
      'Learn in an order: the machine, Git, one pipeline, one config tool, one infrastructure tool, containers, an orchestrator, then signals and on-call.',
    ],
    relatedLabs: [],
    followOn: {
      eyebrow: 'Practice',
      title: 'Shelves that are open now',
      intro:
        'Linux, Docker, and Kubernetes are the rows you can practice on this track today. Come back to this map when a name from another row shows up.',
      links: [
        { label: 'Linux', href: LINUX_LABS_PATH },
        { label: 'Docker', href: DOCKER_LABS_PATH },
        { label: 'Kubernetes', href: K8S_LABS_PATH },
        { label: 'Back to the start of this series', href: devopsReadingPath('what-devops-is') },
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
