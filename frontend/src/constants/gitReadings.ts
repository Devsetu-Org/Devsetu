import type { K8sReading, K8sTrackItem } from './k8sReadings';
import { PLAY_DOMAINS } from './playCatalog';

export const GIT_LABS_PATH = '/track/software-engineer/git';
export const GIT_READINGS_BASE = `${GIT_LABS_PATH}/read`;

export function gitReadingPath(slug: string): string {
  return `${GIT_READINGS_BASE}/${slug}`;
}

export const GIT_READINGS: K8sReading[] = [
  {
    id: 'why-git',
    slug: 'why-git',
    trackId: 'B0',
    eyebrow: '',
    title: 'Why Git exists: the problem, the spark, the design',
    showBlogStamp: true,
    gatedByChallengeId: 'git-01-first-commit-on-sprint-service',
    lede: 'Before learning any commands, there is a simpler question: why does Git exist at all? This blog tells that story — the everyday problems that made version control necessary, where Git came from, and the simple ideas behind how software teams still use it today.',
    sections: [
      {
        id: 'the-problem',
        title: 'Why you need history in the first place',
        body: [
          'Building software means people edit the same set of files over weeks and months. Without a clear record of past changes, simple everyday questions become hard to answer: what changed since yesterday? Who made that edit? Can we undo just one mistake? And how can two people work on the same project without accidentally overwriting each other?',
          'Copying folders and naming them `project-final-v3-REALLY` does not solve this. Folder copies do not tell you who changed what or why, they cannot combine two people\'s edits to the same file, and it is easy to lose track of which copy actually works. **Version control** solves this by turning your project into a timeline of **saved versions** — each with an author, a short note, and a way to jump back anytime.',
        ],
      },
      {
        id: 'before-git',
        title: 'Centralized vs distributed: what came before Git',
        body: [
          'Git was not the first version control tool. Earlier tools solved the history problem in a **centralized** way, while Git was built around a **distributed** way. Understanding the difference between these two setups makes the rest of Git much easier to grasp.',
        ],
        bullets: [
          '**Centralized tools (like CVS and Subversion/SVN)** stored the entire project history in **one place** — a central server. Your laptop only held the latest files you were editing right now. To save a new version, check what changed last week, or undo a mistake, your computer had to connect to that server. If you were offline or the server went down, work stalled.',
          '**Distributed tools (like BitKeeper, and later Git)** flipped that setup. When you copy a project onto your laptop, you get the **entire project and its full history** (`v1`, `v2`, `v3`) right on your machine. You can save a new version (`v4`) or check old ones even without internet access. Teams still keep a shared remote (like GitHub) to sync up, and you simply send your changes when you are ready.',
        ],
        figure: {
          animation: 'git-origin',
          animate: false,
          imageAlt:
            'Left: Centralized setup where only the Central Server stores versions v1, v2, and v3, while your laptop and your teammate only have the latest files and must stay online. Right: Distributed Git setup where a Shared Remote syncs the team, and both your laptop and your teammate hold the full history v1, v2, and v3 locally — letting you save v4 offline and sync later.',
          caption:
            'Centralized vs distributed: in a centralized tool, only the server holds past versions; in Git, every laptop holds the full history and syncs with the team when ready.',
          flush: true,
        },
        after: [
          'Picture what happens if your Wi-Fi drops or the server goes down for an hour. In the centralized setup, you cannot save new versions or inspect the past because the history lives only on the server. In Git\'s distributed setup, every developer already has the full timeline on their laptop — you can keep saving changes locally (`v4`) and share them with the team once you are back online.',
        ],
      },
      {
        id: 'the-spark',
        title: 'Where Git started',
        body: [
          'The Linux operating system had thousands of developers around the world editing code at the same time. For a few years, they used a paid distributed tool called **BitKeeper**, which gave Linux contributors free access. Then, in 2005, a disagreement ended that free license.',
          'Linus Torvalds — the creator of Linux — needed a replacement fast, and he refused to go back to a slow centralized tool. Over a couple of weeks in April 2005, he built the first version of **Git**. His goal was clear: build a free, fast, distributed tool that could handle a massive project where thousands of people work side by side every day.',
        ],
        quote:
          'Git was built from day one for lots of people working in parallel. Giving every developer a full copy of the history was not an add-on — it was the starting idea.',
      },
      {
        id: 'intentions',
        title: 'What Git was designed to do',
        body: [
          'Because Git was built for a huge team working in parallel, five simple ideas were baked into it from the start. You do not need to memorize commands yet — just knowing these ideas will make Git feel logical as you learn it:',
        ],
        bullets: [
          '**Works offline by default** — copying a project gives you its full history. You can save changes and look through old versions on a plane with no Wi-Fi, then share your updates whenever you are back online.',
          '**Built-in safety check for history** — Git creates a unique fingerprint (a short code) for every saved version based on its exact contents. If even a single letter changes by accident or tampering, the fingerprint changes too, so you can always trust your history.',
          '**Full snapshots, not just a list of edits** — every time you save a version in Git, think of it like taking a complete photo of your project at that moment. That makes it easy to jump to any past version or compare two versions directly.',
          '**Easy parallel work** — trying out a new idea or fixing a bug on the side is quick and safe. Two teammates can work on separate tasks at the same time and combine their work smoothly afterward.',
          '**Fast on your own machine** — because almost everything runs locally on your laptop instead of waiting on a distant server, checking history, saving versions, and switching tasks feel instant.',
        ],
        callout: {
          kind: 'tip',
          title: 'Why this still matters on a team',
          body: [
            'When you fix a quick bug while a teammate builds a new feature, you are using the same idea Git was built around: working side by side should feel normal.',
            'Combining that work later should be routine — not a stressful weekend of copying folders and guessing which zip file was the good one.',
          ],
        },
      },
      {
        id: 'what-next',
        title: 'What to learn next',
        body: [
          'Git does not automatically save every single keystroke — you choose when to take a snapshot and what goes into it. In the next blog, we will walk through the everyday Git workflow step by step: copying a shared project to your laptop, making a small change, saving it, and sharing it back with your team.',
        ],
      },
    ],
    takeaways: [
      'Version control keeps a clear timeline of saved versions so teams can work together, see who changed what, and undo mistakes safely.',
      'Centralized tools kept all history on one server; distributed tools like Git give every developer the full history right on their laptop.',
      'Linus Torvalds created Git in 2005 when the Linux team lost free access to BitKeeper and needed a fast, free, distributed replacement.',
      'Git was designed to work offline, protect history with content fingerprints, store full snapshots, make parallel work easy, and stay fast locally.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-01-first-commit-on-sprint-service',
        label: 'Clone, commit, and push',
      },
    ],
  },
  {
    id: 'ship-your-first-change',
    slug: 'ship-your-first-change',
    trackId: 'B2',
    eyebrow: '',
    title: 'Ship your first change: copy, save, share',
    showBlogStamp: true,
    gatedByChallengeId: 'git-01-first-commit-on-sprint-service',
    lede: 'Most team work with Git follows the same everyday loop: copy a shared project onto your laptop, make a small change, save a new version under your name, and share it so teammates can see it. This post walks through that loop — where your files live while you work, and how a change gets back to the shared copy.',
    sections: [
      {
        id: 'the-loop',
        title: 'The everyday loop',
        body: [
          'A shared project usually lives on a **remote** — a host your team uses, often GitHub or a similar service. Git remembers that place under a short name like `origin`. Your laptop holds a **clone**: a full copy of the project and its history that you can edit offline.',
          'You do not need every Git command on day one. The useful first skill is finishing **one small change end to end**: get the code, edit, save a version, share it. When that version shows up on the remote — not only on your laptop — the team can use it.',
        ],
      },
      {
        id: 'clone-from-host',
        title: 'Copy the project onto your laptop',
        body: [
          'Git gives every developer a full history on their machine (that is the distributed idea from the previous blog). Teams still agree on one shared remote as the place everyone syncs with. Your first step is to **clone** — copy that shared project and its history onto your laptop.',
          'After a clone, `origin` points at the remote. Your local `main` matches remote `main` until you save a new version and share it.',
        ],
        figure: {
          animation: 'git-clone-push',
          imageAlt:
            'Left: Shared Remote (for example GitHub) holding versions v1 and v2. Right: Your laptop after clone. Clone copies history down; push sends your new version back up.',
          caption:
            'Clone copies the shared history onto your laptop; push sends your new saved version back to the remote so the team can see it.',
          flush: true,
        },
        after: [
          'Think of clone as “download the whole timeline once.” Later, when you finish a change, push is “upload the new version so everyone else’s remote tip can catch up.”',
          'The address after `git clone` is simply **where the shared project lives**. In the example below, `alice@git.example.com:/srv/git/my-project.git` means: connect as user **`alice`**, on the server **`git.example.com`**, to the project folder **`/srv/git/my-project.git`**. The last part, **`~/my-project`**, is the new folder Git creates on *your* laptop for that copy.',
          'On GitHub or GitLab you usually see the same idea written differently — an HTTPS link like `https://github.com/acme/my-project.git`, or an SSH link like `git@github.com:acme/my-project.git`. Different spelling, same job: point Git at the shared project so it can copy it onto your laptop.',
        ],
        code: {
          language: 'bash',
          code: `git clone alice@git.example.com:/srv/git/my-project.git ~/my-project
cd ~/my-project
git remote -v
git log --oneline`,
          filename: 'clone',
        },
      },
      {
        id: 'three-places',
        title: 'Three places your change lives',
        body: [
          'Git does not save a new version on every keystroke. While you edit, a change moves through **three places**. Almost every everyday command either moves data between them or compares them.',
          '**Your files on disk** (the working tree) are what you see in your editor. The **staging area** (also called the index) is the draft of the next saved version — only what you choose to include. **HEAD** is the last saved version on your current branch.',
        ],
        table: {
          headers: ['Place', 'What it holds', 'How you change it'],
          rows: [
            ['Working tree', 'Files as you edit them right now', 'Your editor; `git restore` to undo edits'],
            [
              'Staging area (index)',
              'The exact set of changes the next save will include',
              '`git add`; `git restore --staged` to unstage',
            ],
            ['HEAD', 'The last saved version on this branch', '`git commit`'],
          ],
        },
        figure: {
          animation: 'git-three-trees',
          imageAlt:
            'A file moving from Your files (working tree), to Staging area via git add, to Last saved version (HEAD) via git commit',
          caption:
            'One change takes three stops: edit your files → stage with `git add` → save with `git commit`.',
          flush: true,
        },
        after: [
          'Staging exists so you can save a clean story. You might edit three files, then stage only the two that belong to this change — and leave the third for later.',
        ],
      },
      {
        id: 'status-diff',
        title: 'Check what changed',
        body: [
          '`git status` is your map of the three places: what is edited, what is staged, and what is already saved. To see the actual line-by-line differences: `git diff` compares your files on disk to the staging area; `git diff --staged` compares the staging area to HEAD (the last saved version).',
          'Once you know which pair each command compares, the output is much easier to read.',
        ],
        code: {
          language: 'bash',
          code: `git status
git diff            # your files vs staging area
git diff --staged   # staging area vs last saved version
git log --oneline -5`,
          filename: 'inspect',
        },
        callout: {
          kind: 'tip',
          title: 'Two diffs, two questions',
          body: [
            'If `git diff` looks empty but you just edited a file, you probably already staged it — that command only compares your files on disk to the staging area.',
            'Run `git diff --staged` next. That shows what is ready to save compared with the last saved version (HEAD).',
          ],
        },
      },
      {
        id: 'identity',
        title: 'Tell Git who you are',
        body: [
          'Every saved version is stamped with an author name and email. If you skip this setup, Git guesses from your computer — and the team may see commits from something like `you@MacBook-Pro.local`. That makes “who changed this?” hard to answer.',
          'Set your name and email once for your whole machine before you save your first version. Using a personal project on a work laptop? Run the same `git config` commands **without** `--global` inside that project folder so only that repo uses the other name and email.',
        ],
        code: {
          language: 'bash',
          code: `git config --global user.name "Alice Learner"
git config --global user.email "alice@example.com"
git config --global init.defaultBranch main
git config --list --show-origin | grep user`,
          filename: 'identity',
        },
      },
      {
        id: 'stage-commit-push',
        title: 'Stage, save, and share',
        body: [
          'Avoid `git add .` as a habit. Staging is your last look at what you are about to save forever. Add only the files that belong to this change.',
          'Write a short message that says what this saved version does — like a note for a teammate (for example, “Enable preview mode for pilot customers”). Then push to the **same branch** you cloned (often `main`) so the shared remote moves forward with you.',
        ],
        code: {
          language: 'bash',
          code: `git add settings/flags.toml
git diff --staged
git commit -m "Enable preview mode for pilot customers"
git push origin main
git status
git log --oneline`,
          filename: 'ship',
        },
        callout: {
          kind: 'warn',
          title: 'Saved on your laptop ≠ shared with the team',
          body: [
            'A version that exists only on your laptop is invisible to everyone else — teammates cloning the remote will not see it.',
            'Sharing means `git push`. Until the remote tip matches your latest save, the team does not have your work.',
          ],
        },
      },
      {
        id: 'mental-model',
        title: 'The model to keep',
        body: [
          'A saved version in Git is a **full snapshot** of the project at that moment — not a vague list of edits you have to replay in your head. HEAD points at the latest snapshot on your branch; the staging area is the draft of the next one; your working tree is the scratchpad; **push** publishes the tip to the remote everyone else clones from.',
          'Once that clicks, later topics (undoing a change, switching branches, parking unfinished work) are usually the same question: which of the three places am I moving, and in which direction?',
          'Practice this loop in the next lab: copy a shared project, make a small change, save it, and share it until the remote matches your laptop.',
        ],
      },
    ],
    takeaways: [
      'Start from a clone of the shared remote — that is the copy your team syncs with.',
      'A change moves through three places: your files on disk, the staging area, then a saved version (HEAD).',
      'Set your name and email before the first save so history has a real author.',
      'Saving locally is not enough — push so the remote (and your teammates) get the new version.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-01-first-commit-on-sprint-service',
        label: 'Clone, commit, and push',
      },
    ],
  },
  {
    id: 'branches-atomic-amend',
    slug: 'branches-atomic-amend',
    trackId: 'B3',
    eyebrow: '',
    title: 'Branches, atomic commits, and amend',
    showBlogStamp: true,
    gatedByChallengeId: 'git-02-branch-for-the-flag-fix',
    lede: 'Teams usually keep `main` ready to ship. When you need to fix something without dumping messy edits onto that shared line — and without blocking a teammate — you open a short-lived branch, save one clear idea per version, and only rewrite the very latest save when a forgotten file still belongs in that last story. This post is that craft.',
    sections: [
      {
        id: 'why-branch',
        title: 'Why branches exist',
        body: [
          'Imagine a bad setting landed on `main`, and you need to fix it. You do not want to pile half-finished edits onto the branch everyone deploys from — and you do not want to block a teammate who is finishing another feature.',
          'A **branch** is a private lane for your work — a **name pointing at a saved version**, more like a sticky note than a duplicated folder. Creating one is nearly free. New saved versions move that lane forward; `main` stays where it is until the team is ready to bring your work in.',
        ],
      },
      {
        id: 'pointer',
        title: 'What a branch actually is',
        body: [
          'Git usually points HEAD at a branch name, so `git status` can say you are on `main` or on `fix/rollout-guard`. When you save a new version, that branch name moves to the new save automatically — other branch names stay put.',
          'Name the lane for the work: `fix/rollout-guard` tells a teammate what it is for; `my-branch` does not. Prefer a short prefix like `feat/`, `fix/`, or `chore/` plus a clear topic.',
        ],
        figure: {
          animation: 'git-branch-pointer',
          imageAlt:
            'Saved versions v1 through v4 in a line. The main label stays on an earlier version while fix/rollout-guard points at the newest version v4.',
          caption:
            'A branch is just a name pointing at a saved version. Saving a new version moves only the branch you are on.',
          flush: true,
        },
        after: [
          '`git switch -c fix/rollout-guard` means: create a new branch named `fix/rollout-guard` and switch onto it. The `-c` is short for “create.” From then on, new saves move that name forward.',
        ],
        code: {
          language: 'bash',
          code: `git switch -c fix/rollout-guard
git branch --show-current
git log --oneline --graph --all`,
          filename: 'branch',
        },
      },
      {
        id: 'atomic',
        title: 'Atomic commits: one story each',
        body: [
          'An **atomic** saved version does **one clear thing** and leaves the project in a working state. That does not mean “one file only” — it means one idea a reviewer can understand quickly.',
          'If your folder has a config fix, README notes, and a version banner change all mixed together, that is three stories. Saving them as one vague message like `stuff` hides the three stories inside one bag. A quick check: if your message needs the word “and,” you likely have two saves — stage one idea at a time instead of `git add .` as a habit.',
        ],
        table: {
          headers: ['Task', 'With one idea per save', 'With one giant save'],
          rows: [
            ['Review', 'Read one idea at a time', 'Hold the whole change in your head'],
            ['Undo later', 'Undo just that one save cleanly', 'Manually cut out the bad part'],
            ['Find a bug later', 'Lands near the exact cause', 'Lands on a huge mixed change'],
          ],
        },
        code: {
          language: 'bash',
          code: `git add settings/flags.toml
git diff --staged
git commit -m "Keep default rollout mode on safe"

git add README.md
git commit -m "Document how to run the app locally"`,
          filename: 'atomic',
        },
      },
      {
        id: 'push-branch',
        title: 'Share the fix branch, leave main alone',
        body: [
          'When your history looks clean, publish the **fix branch**, not `main`. Remote `main` should still match what the team already trusts. Teammates review your branch; bringing it into `main` comes later.',
          '`git log --oneline main..HEAD` lists the saves that are on your branch but not on `main` — a quick check before you share. `git push -u origin fix/rollout-guard` uploads that branch to the remote and remembers it for next time (`-u` sets the upstream).',
        ],
        code: {
          language: 'bash',
          code: `git log --oneline main..HEAD
git push -u origin fix/rollout-guard
git status`,
          filename: 'push-branch',
        },
        callout: {
          kind: 'warn',
          title: 'Unsaved edits can travel with you',
          body: [
            'If you switch branches while you still have unsaved edits, Git may carry those edits along when it is safe — which can surprise you on the other branch.',
            'If moving them would conflict, Git refuses. Save or stash first so you always know which lane your unfinished work lives on.',
          ],
        },
      },
      {
        id: 'amend-tip',
        title: 'Amend: fix only the latest save',
        body: [
          'You already saved three clean versions, then noticed a doc file that still belongs in the **last** story — not as a fourth “forgot the doc” save. Amend is for that moment.',
          'Amend does **not** edit the old save in place (saved versions are fixed once created). It builds a **new** latest save with the same parent as the old one, using what you staged and the message you choose, then moves the branch tip to that new save. The old tip is no longer on the branch.',
        ],
        figure: {
          animation: 'git-amend',
          imageAlt:
            'Amend replaces tip version v4 with a new tip v4-prime that has the same parent; the old v4 is left off the branch.',
          caption:
            'Amend builds a new tip with the same parent as the old tip, then moves the branch to the new tip.',
          flush: true,
        },
        after: [
          '`git commit --amend` means: take what is staged, rebuild the latest save, and point the current branch at that new tip. Use it only for the tip — not for older saves further back.',
          '`git show --stat HEAD` means: open the latest save and list which files it touched (full `git show` without `--stat` also prints the diff — covered later with blame).',
        ],
        code: {
          language: 'bash',
          code: `git add docs/rollout-policy.md
git commit --amend -m "Document rollout policy and print the startup banner"
git log --oneline main..HEAD
git show --stat HEAD`,
          filename: 'amend',
        },
      },
      {
        id: 'amend-remote',
        title: 'When that tip was already on the remote',
        body: [
          'Amend is safe when **nobody else has built on that tip**. Once the old tip is already on the remote, a normal push is rejected — your rewritten tip and the remote’s old tip have diverged.',
          'Amending only on your laptop is unfinished until you **update the remote** so `origin/<your-fix-branch>` matches your new tip. On shared `main`, do not rewrite history — add a new save instead (or use revert, covered later).',
        ],
        callout: {
          kind: 'warn',
          title: 'Do not rewrite shared history',
          body: [
            'Never rewrite saves teammates may already have pulled — their laptops still point at the old tip, and a rewritten history forces a painful recovery for everyone.',
            'A private fix branch only you use is different from shared `main`. On `main`, add a new save (or use revert later) instead of amending.',
          ],
        },
      },
      {
        id: 'when-not-amend',
        title: 'When amend is not enough',
        body: [
          'Amend only touches the latest save. For a mistake a few saves back, you will need interactive rebase (later in the track). For a bad save already on shared history, you will need `revert`.',
          'Practice next: open a fix branch, land one idea per save, share the branch, then fold a forgotten file into the tip — leaving `main` untouched.',
        ],
      },
    ],
    takeaways: [
      'A branch is a movable name pointing at a saved version; new saves move only the branch you are on.',
      'One save should equal one clear idea — stage on purpose and name the message clearly.',
      'Amend replaces the latest tip with a new save; it does not edit the old tip in place.',
      'If that tip was already on the remote, update the remote to match — never rewrite shared `main`.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-02-branch-for-the-flag-fix',
        label: 'Open a fix branch with atomic commits',
      },
      {
        challengeId: 'git-03-untrack-the-leaked-env',
        label: 'Stop tracking a local secrets file',
      },
      {
        challengeId: 'git-04-amend-the-last-commit',
        label: 'Amend the tip on a fix branch',
      },
    ],
  },
  {
    id: 'merging',
    slug: 'merging',
    trackId: 'B4',
    eyebrow: '',
    title: 'Merging: bringing branches together',
    showBlogStamp: true,
    gatedByChallengeId: 'git-05-merge-without-conflict',
    lede: 'Your feature branch and `main` have both moved. Your work still lives only on the feature line; `main` already has a fix someone else shared. **Merging** is how Git combines two lines of history into one. Day to day you sync **on your feature** first, share that feature branch, and land onto shared `main` through review — you do not push `main` yourself. When edits do not overlap, Git combines them automatically. When they do, that is a conflict — not a failure, just a question Git cannot answer alone.',
    sections: [
      {
        id: 'what',
        title: 'What a merge does',
        body: [
          'Start on the branch that should **receive** the other line of work. That receiving branch is the one whose tip will move forward. Then `git merge <other-branch>` asks three plain questions: where did these two lines last share history, what changed on each side since then, and can those changes sit together in one project snapshot?',
          'The shared starting point is the **merge base** — the newest saved version that already belongs to both lines (labeled **B** in the figure). Git compares each tip against that base: saves unique to `main` (toward **C**), saves unique to your feature (toward **F**). Edits that do not touch the same lines are combined automatically into one new snapshot.',
          'When **both** sides moved and nothing collides, Git does not just slide a name forward — it writes a **merge commit** (**M**). That save is one project snapshot with **two parents**: the **first parent** is the tip you were on when you ran the merge; the **second parent** is the tip you brought in. The diamond shape in `git log --graph` is that join made visible for later readers.',
        ],
        figure: {
          animation: 'git-merge-commit',
          imageAlt:
            'Two branches diverge from a shared base B, then join in a merge commit M with first parent C on main and second parent F on feature',
          caption:
            'Shared history ends at B. C is main-only work; F is feature-only work. M joins them: 1st parent = C, 2nd parent = F.',
          flush: true,
        },
        after: [
          'Picture you on `feature/digest-settings` while a teammate already pushed a fix to `main`. Merging `main` into your feature picks up their fix and keeps your feature work — as one joined history.',
        ],
      },
      {
        id: 'two-step',
        title: 'Two steps: sync on the feature, then land via review',
        body: [
          'While you still own the feature, merge **`main` into your branch** so you pick up what already shipped and resolve any conflicts where you can still change freely. Then push the feature branch.',
          'Landing onto shared `main` is a separate step — usually a pull request that a teammate (or automation) merges. Healthy teams do not casually push `main` from a laptop. If there is no pull-request UI yet, the practical finish line is still: **push the feature**.',
          '`git switch feature/digest-settings` moves you onto that branch. `git merge main` means: bring `main`’s work into the branch you are on right now.',
        ],
        code: {
          language: 'bash',
          code: `# 1) Sync while coding (on the feature)
git switch feature/digest-settings
git merge main                 # or: git merge origin/main
# resolve if needed, then:
git push -u origin feature/digest-settings

# 2) Land later via PR / review — not by pushing main yourself`,
          filename: 'sync-then-pr',
        },
        callout: {
          kind: 'tip',
          title: 'Same tool, different receiver',
          body: [
            '`git merge main` on a feature and `git merge feature` on `main` use the same engine — both combine two lines of history into the branch you are on.',
            'The difference is **which branch moves**. On a healthy team, you sync on the feature yourself; shared `main` usually moves only through review, not a casual push from your laptop.',
          ],
        },
      },
      {
        id: 'parents',
        title: 'Merge commits and parents',
        body: [
          'A normal saved version has one parent (the previous tip). A merge commit has two (or more): the first parent is usually the branch you were on; the second parent is the tip you merged in.',
          '`git log --oneline --graph` draws that diamond. The graph is the point — future readers can see **when** the two lines joined, not only what the files look like now.',
        ],
        code: {
          language: 'bash',
          code: `git switch feature/digest-settings
git merge main
git log --oneline --graph -8
git cat-file -p HEAD   # look for two parent lines`,
          filename: 'merge-commit',
        },
      },
      {
        id: 'ff',
        title: 'Fast-forward versus a true merge',
        body: [
          'If the branch you are updating has **not** moved since the other tip branched off, Git can simply slide the name forward. That is a **fast-forward**: no new merge save, history stays a straight line, and the old branch boundary disappears.',
          'If **both** branches moved, fast-forward is impossible. Git creates a real merge commit. Some teams always record a merge commit even when fast-forward is possible (`--no-ff`) so every join stays visible in the graph.',
        ],
        figure: {
          animation: 'git-fast-forward',
          imageAlt:
            'Left: fast-forward slides a branch name forward when only one side moved. Right: both sides moved, so a merge commit joins the tips.',
          caption:
            'Left: only one side moved — the branch name slides forward (fast-forward). Right: both moved — a merge commit joins them.',
          flush: true,
        },
        after: [
          '`git merge --no-ff main` means: even if Git could fast-forward, still create a merge commit so the join stays visible in history. Fast-forward and a merge commit can leave you with the same file contents — they disagree about whether history should show that two lines intentionally met.',
        ],
        code: {
          language: 'bash',
          code: `git switch feature/digest-settings
git merge main
# optional: always record the join
git merge --no-ff main`,
          filename: 'ff-vs-merge',
        },
      },
      {
        id: 'conflict',
        title: 'When Git needs your help',
        body: [
          'A **conflict** happens when both branches changed the **same lines** in different ways. Git stops and marks the file — it will not guess which value is right. Changes that do not overlap in that same file still combine on their own.',
          'You edit the file to the final content you want, delete every marker line, stage the file, and finish the merge save.',
        ],
        figure: {
          animation: 'git-merge-conflict',
          imageAlt:
            'Main and feature disagree on the same config line; conflict markers appear; the resolved file keeps one clear final value',
          caption:
            'Conflict = same lines, two answers. Keep what you need from each side, remove every marker, then finish the merge.',
          flush: true,
        },
        after: [
          'In the marker block below, `<<<<<<< HEAD` is “your side” (the branch you are on). The lines after `=======` are “their side” (the branch you merged in). `>>>>>>> main` ends their side. Your job is to leave only the final lines — no markers.',
        ],
        code: {
          language: 'bash',
          code: `<<<<<<< HEAD
delivery = webhook
=======
delivery = smtp
>>>>>>> main`,
          filename: 'conflict-markers',
        },
        callout: {
          kind: 'warn',
          title: 'Never save the markers',
          body: [
            'Search for `<<<<<<<` before you finish the merge. Those lines are temporary instructions for you, not real project content.',
            'Leaving markers in a shared file breaks builds and confuses everyone who opens the project later — strip them completely, then stage and finish.',
          ],
        },
      },
      {
        id: 'resolve',
        title: 'Resolve, stage, finish — or abort',
        body: [
          'After you choose the right lines, stage the file and run `git commit` to finish the merge. If you are not ready, you can back out entirely.',
          '`git merge --abort` means: cancel this merge and return the project to how it looked before you started. Knowing that escape hatch makes conflicts far less scary.',
        ],
        code: {
          language: 'bash',
          code: `git status                 # lists conflicted files
# edit file, remove <<<<<<< ======= >>>>>>>
git add settings/delivery.toml
git commit                 # concludes the merge
git merge --abort          # or return to pre-merge state`,
          filename: 'resolve',
        },
      },
      {
        id: 'when',
        title: 'When to use merge (and when not to)',
        body: [
          'Merge is the default for **bringing shared work together**: catching your feature up with `main`, landing a reviewed feature onto `main` (usually via pull request), joining two long-lived lines, or recording that two histories intentionally met.',
          'Prefer merge when other people may already have the saves you are joining — merge does not rewrite their history. Prefer a straight-line cleanup (**rebase**) on a **private** branch before review; that story is the next blog.',
          'Practice next: merge `main` into a feature branch, resolve any same-line conflict if one appears, finish the merge save, and push the **feature** — leaving shared `main` alone.',
        ],
        table: {
          headers: ['Situation', 'Prefer'],
          rows: [
            ['Catching your feature up with moved `main`', 'Merge main into feature'],
            ['Landing a reviewed feature onto shared `main`', 'Merge (usually via pull request)'],
            ['Recording that two team branches joined', 'Merge'],
            ['Cleaning your private branch before anyone else builds on it', 'Rebase (next)'],
            ['You need a straight line and nobody else has your saves', 'Rebase (next)'],
          ],
        },
        figure: {
          animation: 'git-merge-vs-rebase',
          imageAlt: 'Merge keeps a diamond join; rebase replays work as a straight line',
          caption:
            'Same work, two shapes: merge keeps the join visible; rebase (next blog) straightens a private line.',
          flush: true,
        },
      },
    ],
    takeaways: [
      'Merge brings another branch into the one you are on; a merge commit has two parents.',
      'Sync on the feature (`git merge main`), push the feature; land onto shared `main` via review — do not push `main` yourself.',
      'Fast-forward only slides a branch name; a true merge records the join.',
      'Conflicts mean the same lines changed on both sides — resolve, stage, finish (or abort).',
    ],
    relatedLabs: [
      {
        challengeId: 'git-05-merge-without-conflict',
        label: 'Sync a feature branch with main',
      },
    ],
  },
  {
    id: 'rebase',
    slug: 'rebase',
    trackId: 'B5',
    eyebrow: '',
    title: 'Rebase: replay your work on a new base',
    showBlogStamp: true,
    gatedByChallengeId: 'git-07-rebase-onto-main',
    lede: 'Your feature branch has a few saved versions, and `main` moved on without you. Merge would work — and leave a join knot in the history. **Rebase** takes your saves and replays them on top of today’s `main`, so the story reads as a straight line. The same idea later folds noisy “work in progress” saves into clean ones before review.',
    sections: [
      {
        id: 'idea',
        title: 'The idea in one picture',
        body: [
          'Rebase says: set my saves aside for a moment, move my branch base to the tip of `main`, then reapply my changes one by one. The **content** of each change can stay the same; the **parent** of each save changes — so every replayed save gets a **new ID** (a new SHA).',
          'That is the whole trick and the whole danger: you are **rewriting** history, not joining it the way merge does.',
        ],
        figure: {
          animation: 'git-rebase-replay',
          imageAlt:
            'Feature saves hopping from an old base onto the tip of main as new saves with new IDs',
          caption:
            'Replay: your saves leave the old base and land as new saves on top of current main.',
          flush: true,
        },
        after: [
          'Think of it like moving sticky notes from an old corkboard onto a newer one: the notes still say the same things, but they are new stickers in a new place.',
        ],
      },
      {
        id: 'command',
        title: 'Running a basic rebase',
        body: [
          'Switch to your feature branch, then rebase onto `main`. `git rebase main` means: replay my unique saves on top of `main`’s tip.',
          'If a save conflicts, Git pauses. Fix the file, stage it, and continue — or abort to return to how things looked before the rebase started.',
        ],
        code: {
          language: 'bash',
          code: `git switch feature/report-export
git rebase main
# on conflict: edit, git add, then
git rebase --continue
git rebase --abort   # to back out`,
          filename: 'rebase',
        },
        callout: {
          kind: 'warn',
          title: 'New IDs mean rewritten history',
          body: [
            'Anyone who based work on your old saves now has a different history from yours — their laptop still expects the old IDs.',
            'Rebase branches **only you** own. Never rebase shared `main`, and never rebase a branch teammates have already pulled and built on.',
          ],
        },
      },
      {
        id: 'vs-merge',
        title: 'Merge vs rebase — pick the shape',
        body: [
          'Neither is wrong. They answer different questions about what history should show. Merge **records a join** without rewriting. Rebase **replays** your private saves onto a new base.',
          'A simple rule: bring work onto shared `main` with merge. Clean up **your** unmerged branch with rebase. Do not mix those instincts.',
        ],
        table: {
          headers: ['', 'Merge', 'Rebase'],
          rows: [
            ['History shape', 'Diamond / join visible', 'Straight line'],
            ['Rewrites saves', 'No', 'Yes — new IDs'],
            [
              'Best for',
              'Shared branches, landing reviewed work',
              'Private branch before review',
            ],
          ],
        },
        figure: {
          animation: 'git-merge-vs-rebase',
          imageAlt: 'Merge keeps a diamond join; rebase replays work as a straight line',
          caption: 'Same work, two shapes: merge keeps the join visible; rebase straightens it.',
          flush: true,
        },
      },
      {
        id: 'squash',
        title: 'Interactive rebase: squash the noise',
        body: [
          'After a day of work your branch may have messages like `wip`, `fix typo`, or `oops`. Before review, fold them into meaningful saves.',
          '`git rebase -i main` opens a todo list in your editor. Common verbs: **`pick`** keeps a save, **`squash`** (or **`fixup`**) folds it into the one above, **`reword`** changes the message, **`drop`** removes it. The result is still a rebase — rewritten saves get new IDs.',
        ],
        figure: {
          animation: 'git-rebase-squash',
          imageAlt: 'Several noisy work-in-progress saves collapsing into two clean saves',
          caption:
            'Interactive rebase: five noisy saves collapse into two reviewable stories.',
          flush: true,
        },
        after: [
          'In the editor list, each line is one save. Changing `pick` to `squash` on a line means “melt this into the save above it.”',
        ],
        code: {
          language: 'bash',
          code: `git rebase -i main
# in the editor:
# pick   a1b2c3 Add report export scaffold
# squash d4e5f6 fix typo
# squash 7a8b9c wip
# pick   1d2e3f Wire export into the settings menu
# squash 9c8b7a oops`,
          filename: 'rebase-i',
        },
      },
      {
        id: 'when',
        title: 'When to use rebase (and when not to)',
        body: [
          'Use rebase to catch a private feature up with `main`, or to edit the story of saves **nobody else has**. After a rebase, your local tip may no longer be a simple fast-forward of the remote — updating the remote is a different kind of publish than the first push.',
          'Do **not** rebase saves on shared branches. If the history is already public and others depend on it, merge or revert instead.',
        ],
        table: {
          headers: ['Situation', 'Prefer'],
          rows: [
            ['Private feature behind `main`', 'Rebase onto main'],
            ['Noisy WIP on your branch before review', 'Interactive rebase'],
            ['Landing reviewed work onto shared `main`', 'Merge'],
            ['Undoing a bad save others already pulled', 'Revert (later)'],
          ],
        },
        callout: {
          kind: 'tip',
          title: 'Bookmark before you leap',
          body: [
            'Before a big rebase, create a backup name: `git branch backup/feature-report-export`. That sticky note still points at the old tip if the rebase goes wrong.',
            'You can return in one switch. The reflog also remembers where HEAD was — recovery comes later in the track — but a named backup is the fastest undo.',
          ],
        },
      },
      {
        id: 'practice',
        title: 'What to practice next',
        body: [
          'First catch a feature up so history is a straight line on current `main`. Then take a noisy branch and leave exactly the saves a reviewer should see — same project files, clearer story. Practice that loop in the next labs without rewriting anything teammates already built on.',
        ],
      },
    ],
    takeaways: [
      'Rebase replays your saves on a new base — content can match, IDs change.',
      'Use it on private branches only; never on history others build on.',
      '`git rebase -i` lets you pick, squash, reword, and drop before review.',
      'Merge joins shared history; rebase rewrites private history — pick on purpose.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-07-rebase-onto-main',
        label: 'Rebase a feature onto main',
      },
      {
        challengeId: 'git-08-interactive-rebase-squash-the-noise',
        label: 'Squash noisy WIP commits',
      },
    ],
  },
  {
    id: 'cherry-pick',
    slug: 'cherry-pick',
    trackId: 'B6',
    eyebrow: '',
    title: 'Cherry-pick: lift one commit',
    showBlogStamp: true,
    gatedByChallengeId: 'git-09-cherry-pick-the-hotfix',
    lede: 'A release branch is what production runs. A teammate fixed a crash on `main` — but that tip also sits on unfinished feature work that must not ship yet. Merging all of `main` into the release would drag those unfinished saves along. **Cherry-pick** copies **one** save’s change onto the branch you are on, as a new save with a new ID. The rest of `main` stays behind.',
    sections: [
      {
        id: 'scenario',
        title: 'One fix, not the whole line',
        body: [
          'Imagine production runs from `release/3.4`. The crash fix landed on `main` as save **H**. Between the release tip and **H** sit unfinished feature saves that are not ready. You need the fix on the release line — and **only** that fix.',
          'That is the cherry-pick job: lift one change across branches without taking its neighbors.',
        ],
      },
      {
        id: 'how',
        title: 'What cherry-pick does',
        body: [
          'Cherry-pick takes the **change** introduced by one save and reapplies it as a **new** save on your current branch. The patch (what changed in the files) can match; the **ID** differs, because the parent is different.',
          'You are **copying** a change, not moving a branch name. The original save stays where it was on `main`.',
        ],
        figure: {
          animation: 'git-cherry-pick',
          imageAlt:
            'Fix save H on main copied onto release/3.4 as H prime while unfinished feature saves stay on main',
          caption:
            'Same change, new save: H lands on the release as H′. Unfinished work on main stays put.',
          flush: true,
        },
        after: [
          'If merge is “bring the whole other line,” cherry-pick is “bring just this one sticky note.”',
        ],
      },
      {
        id: 'run',
        title: 'Running it',
        body: [
          'Switch to the branch that should receive the fix. Find the fix’s ID with `git log`. Then cherry-pick it.',
          '`git cherry-pick -x 9f3c2ab` means: copy that save’s change onto the branch I am on now. The `-x` flag adds a note in the new message saying which original save it came from — future readers will thank you. Need several? `git cherry-pick A B C` picks them in order; `A..B` picks a range, excluding A itself.',
        ],
        code: {
          language: 'bash',
          code: `git log main --oneline -8
git switch release/3.4
git cherry-pick -x 9f3c2ab   # the fix save
git log --oneline -3`,
          filename: 'cherry-pick',
        },
      },
      {
        id: 'conflicts',
        title: 'When the pick conflicts',
        body: [
          'If the release line already changed the same lines, cherry-pick pauses the way a merge does. Resolve the file, stage it, and continue — or abort to return to how things looked before the pick.',
        ],
        code: {
          language: 'bash',
          code: `# edit the conflicted file, then:
git add src/handlers.py
git cherry-pick --continue
git cherry-pick --abort   # or back out entirely`,
          filename: 'cherry-conflict',
        },
        callout: {
          kind: 'warn',
          title: 'Same markers, same rule',
          body: [
            'Conflict markers from a cherry-pick look identical to a merge — `<<<<<<<`, `=======`, and `>>>>>>>` are temporary guides for you.',
            'Never leave them in the files. Search before you finish; shipping markers breaks the project for everyone who opens it next.',
          ],
        },
      },
      {
        id: 'when',
        title: 'When to cherry-pick (and when not to)',
        body: [
          'Cherry-pick **duplicates** a change under a new ID. Later merges usually cope, but picking everything creates twin histories that are hard to reason about.',
          'Reach for it for hotfixes and backports. For ordinary feature landing, merge or rebase so the same work is not copied into many places.',
        ],
        table: {
          headers: ['Situation', 'Prefer'],
          rows: [
            ['One fix must land on a release without unreleased neighbors', 'Cherry-pick'],
            ['Backport a single fix to an older maintained line', 'Cherry-pick'],
            ['Landing a reviewed feature onto shared `main`', 'Merge'],
            ['Cleaning a private branch before review', 'Rebase'],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'Same change, different story',
          body: [
            'Merge and rebase move whole lines of history — they keep a connected story of how branches met or were replayed.',
            'Cherry-pick copies **one** change onto another line. Use it on purpose for a single fix; do not treat it as the everyday way to land features.',
          ],
        },
      },
      {
        id: 'publish',
        title: 'Share the release branch',
        body: [
          'A cherry-pick only exists on your laptop until you push. After the new save is on `release/3.4`, publish that tip so the shared remote has the fix.',
          'Practice next: copy only one needed fix onto a release branch (without unfinished work from `main`), then push that release tip.',
        ],
        code: {
          language: 'bash',
          code: `git push origin release/3.4
git log --oneline origin/release/3.4 -3`,
          filename: 'push-release',
        },
      },
    ],
    takeaways: [
      'Cherry-pick copies one save’s change onto the current branch as a new save.',
      'Use `-x` to record the original ID in the message.',
      'Conflicts resolve like merges — stage, `--continue`, or `--abort`.',
      'Use it for hotfixes and backports; prefer merge/rebase for ordinary feature flow.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-09-cherry-pick-the-hotfix',
        label: 'Cherry-pick a hotfix onto a release branch',
      },
    ],
  },
  {
    id: 'undo-and-recover',
    slug: 'undo-and-recover',
    trackId: 'B7',
    eyebrow: '',
    title: 'Undo and recover: revert, reset, reflog',
    showBlogStamp: true,
    gatedByChallengeId: 'git-10-undo-the-bad-commit',
    lede: 'On shared `main`, someone landed a bad change under an otherwise good save — you cannot delete that ID without rewriting what teammates already pulled. Separately, a hard reset on your **private feature tip** can make an afternoon of local work vanish from that branch. Git is more forgiving than it looks, but only if you pick the right undo: **revert** cancels shared mistakes with a new save (usually on a fix branch for review), **reset** moves a private tip, and **reflog** remembers where `HEAD` used to be.',
    sections: [
      {
        id: 'choose',
        title: 'Pick the right undo',
        body: [
          '“Undo” means different things depending on whether the save is already shared. Choosing wrong either breaks teammates or leaves the bug in place.',
        ],
        table: {
          headers: ['Situation', 'Tool', 'What it does'],
          rows: [
            [
              'Bad save already pushed or shared',
              '`git revert`',
              'Adds a new save that cancels the old one',
            ],
            ['Local saves you want gone', '`git reset`', 'Moves the branch name backward'],
            ['Lost work after a reset or rebase', '`git reflog`', 'Shows where HEAD used to be'],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'One question first',
          body: [
            'Ask: has anyone else built on this save? If yes, use **revert** so you cancel it with a new save instead of rewriting shared history.',
            'If no, **reset** can move your private tip. If you already reset and panic, open the **reflog** — it still remembers where HEAD used to be.',
          ],
        },
      },
      {
        id: 'revert',
        title: 'Revert: safe for shared history',
        body: [
          'Revert never erases anything. It writes a **new** save that applies the opposite change. History stays honest, so teammates who already pulled keep the same parent chain — they just get a cancel on top.',
          'In most teams the bad tip is on shared `main`, but you still do not push straight to `main`. Open a short fix branch, revert there, push for review, and merge back. Until that lands, only your branch has the cancel.',
          '`git revert 7c1d4e2` means: create a new save that undoes the changes from that ID. Reverting a merge save needs `git revert -m 1 <id>` so Git knows which parent line to treat as “ours.”',
        ],
        figure: {
          animation: 'git-revert',
          imageAlt:
            'Bad save B on main followed by a revert save R that cancels B without rewriting history',
          caption:
            'Revert adds R — the opposite of B — so shared main can move forward cleanly once the fix branch merges.',
          flush: true,
        },
        code: {
          language: 'bash',
          code: `git switch -c fix/undo-settings-toggle
git log --oneline -5
git revert 7c1d4e2
git push -u origin fix/undo-settings-toggle`,
          filename: 'revert',
        },
      },
      {
        id: 'reset',
        title: 'Reset: three flavors',
        body: [
          'Reset moves the current branch tip to another save. The flag decides how far that reaches across the three places from earlier: branch tip, staging area, and your files on disk.',
          'Use it on **private** history — almost always your feature tip, never shared `main`. Once others have those saves, rewriting them with reset forces everyone into a recovery dance.',
          '`HEAD~1` means “the save just before the current tip.”',
        ],
        table: {
          headers: ['Flag', 'Branch tip', 'Staging area', 'Your files'],
          rows: [
            ['`--soft`', 'Moves', 'Kept', 'Kept'],
            ['`--mixed` (default)', 'Moves', 'Reset', 'Kept'],
            ['`--hard`', 'Moves', 'Reset', 'Reset (edits discarded)'],
          ],
        },
        code: {
          language: 'bash',
          code: `git reset --soft HEAD~1   # undo save, keep staged
git reset HEAD~1          # undo save, keep edits
git reset --hard HEAD~1   # discard everything`,
          filename: 'reset',
        },
        callout: {
          kind: 'warn',
          title: 'Hard means hard',
          body: [
            '`--hard` throws away unsaved edits with **no** undo from Git — check `git status` before you run it.',
            'Saved work may still be recoverable from the reflog. Edits you never saved as a commit will not come back.',
          ],
        },
      },
      {
        id: 'reflog',
        title: 'Reflog: the safety net',
        body: [
          'Git records every move of `HEAD` in the **reflog** for weeks. Saves you reset away or rebased off a branch tip are usually still in Git’s storage — just not pointed at by any branch name.',
          'Find the save from before the mistake and point a branch at it. That is recovery in two commands.',
        ],
        figure: {
          animation: 'git-reflog',
          imageAlt:
            'After a hard reset, an older tip is detached from the branch name but still listed in the reflog for rescue',
          caption:
            'Hard reset moves the tip; the reflog still names the old HEAD so you can rescue it.',
          flush: true,
        },
        after: [
          '`git branch rescue 9e8f7a6` creates a new branch name pointing at that old tip. Then `git switch rescue` puts you there.',
        ],
        code: {
          language: 'bash',
          code: `git reflog
# a1b2c3d HEAD@{0}: reset: moving to HEAD~2
# 9e8f7a6 HEAD@{1}: commit: Add receipt email
git branch rescue 9e8f7a6
git switch rescue`,
          filename: 'reflog',
        },
      },
      {
        id: 'habit',
        title: 'Build the habit',
        body: [
          'Before anything destructive, create a quick bookmark branch. After anything scary, check `git reflog`. Those two habits make experimentation cheap.',
          'The only truly lost work is work that was **never saved** as a commit.',
          'Practice next: revert a bad save that already landed on shared `main` (via a fix branch), then recover a private feature tip after a hard reset.',
        ],
        table: {
          headers: ['Situation', 'Prefer'],
          rows: [
            ['Bad change already on shared main', 'Fix branch → revert → push for review'],
            ['Private feature tip you want to rewind', 'Reset (soft/mixed/hard on purpose)'],
            ['Feature tip vanished after a hard reset', 'Reflog → restore that feature tip'],
            ['Edits never saved', 'Gone — stage or stash next time'],
          ],
        },
      },
    ],
    takeaways: [
      'Use `revert` when the mistake is already shared; do the work on a fix branch for review.',
      'Use `reset` only on private tips (your feature), never to rewrite shared `main`.',
      '`git reflog` remembers where HEAD has been, so most saved mistakes are recoverable.',
      'Unsaved work is the one thing Git cannot rescue.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-10-undo-the-bad-commit',
        label: 'Revert a bad shared commit',
      },
      {
        challengeId: 'git-11-reset-and-reflog-recover-lost-work',
        label: 'Recover a lost private feature tip',
      },
    ],
  },
  {
    id: 'bisect-blame-stash',
    slug: 'bisect-blame-stash',
    trackId: 'B8',
    eyebrow: '',
    title: 'Bisect, blame, stash: Git as a detective',
    showBlogStamp: true,
    gatedByChallengeId: 'git-12-bisect-find-the-breaking-commit',
    lede: 'Something broke somewhere in the last many saves, nobody is sure who last changed an important line, and an urgent fix arrives while your feature work is only half done. Three small tools turn those moments from chaos into routine: **bisect** finds when, **blame** finds who and why, **stash** buys you time.',
    sections: [
      {
        id: 'bisect-why',
        title: 'Bisect: search history by halves',
        body: [
          'When something that used to work is now broken, and you know one older save that was good and a newer one that is bad, `git bisect` finds the first bad save by cutting the range in half each step.',
          'Eighty saves take about seven checks instead of eighty. You mark each midpoint good or bad; Git picks the next probe until one save remains.',
        ],
        figure: {
          animation: 'git-bisect',
          imageAlt:
            'Bisect narrowing a range of saves from good to bad until a single first bad save is named',
          caption:
            'Halve the range at every step until Git names the first bad save.',
          flush: true,
        },
        after: [
          'It is the same idea as guessing a number between 1 and 100 by always asking “higher or lower?” — except Git is asking “good or bad?” about each midpoint.',
        ],
      },
      {
        id: 'bisect-manual',
        title: 'Manual walkthrough: mark good, mark bad, repeat',
        body: [
          'Before automating, walk the loop by hand once. You tell Git which tip is broken and which older save still worked. Git checks out a midpoint; you test that project state; you answer good or bad; Git picks the next midpoint until one save remains.',
        ],
        subsections: [
          {
            id: 'start',
            title: '1. Start, mark bad, mark good',
            body: [
              '`git bisect start` opens the search. `git bisect bad` marks the current tip (`HEAD`) as broken. `git bisect good v0.9.0` marks an older known-good save (here a tag). Git then prints how many revisions are left and checks out a midpoint for you to test.',
            ],
            code: {
              language: 'bash',
              code: `git bisect start
# status: waiting for both good and bad commits

git bisect bad
# marks the current tip (HEAD) as broken

git bisect good v0.9.0
# Bisecting: 39 revisions left to test after this (roughly 6 steps)
# [a1b2c3d4] Add invoice retry helper`,
              filename: 'bisect-start',
            },
          },
          {
            id: 'step',
            title: '2. Test the midpoint, answer, repeat',
            body: [
              'That checkout **is** the midpoint. Test the project there (run the app, hit the broken flow, or run a check).',
              'If it is still broken, run `git bisect bad`. If it works, run `git bisect good`. Git prints a shorter remaining range and checks out the next midpoint. Keep answering until only one save is left.',
            ],
            code: {
              language: 'bash',
              code: `# midpoint still broken:
git bisect bad
# Bisecting: 19 revisions left to test after this (roughly 5 steps)
# [d4e5f6a7] Tighten empty-invoice guard

# or midpoint works:
git bisect good
# Bisecting: 19 revisions left to test after this (roughly 5 steps)
# [e8f9a0b1] Adjust metrics timeout`,
              filename: 'bisect-step',
            },
          },
          {
            id: 'finish',
            title: '3. Read the culprit, then reset',
            body: [
              'When the search ends, Git prints **“X is the first bad commit”** plus author and message. Open that save with **`git show`**: it prints who wrote it, the message, and the full diff of what that one save changed. Then always leave bisect mode with `git bisect reset` so you return to your original branch.',
            ],
            code: {
              language: 'bash',
              code: `# a9f3c2b1 is the first bad commit
# commit a9f3c2b1
# Author: Alice Learner <alice@example.com>
# Date:   ...
#
#     Break totals when invoice is empty

git show a9f3c2b1
git bisect reset`,
              filename: 'bisect-done',
            },
          },
        ],
        callout: {
          kind: 'tip',
          title: 'What those printed lines mean',
          body: [
            '**“Bisecting: N revisions left…”** is Git estimating how many checks remain. The **`[hash] message`** line is the midpoint it just checked out for you to test.',
            'When you see **“X is the first bad commit”**, the search is finished — inspect that save with `git show`, then always run `git bisect reset` so you leave bisect mode and return to your original branch.',
          ],
        },
      },
      {
        id: 'bisect-run',
        title: 'Automate it',
        body: [
          'Once you understand that manual loop, you can let Git drive every midpoint for you. If a script can detect the bug, `git bisect run` checks out each midpoint, runs the script, and marks good or bad from the exit code: **0 means good**, any **non-zero means bad**.',
          '`git bisect start HEAD v0.9.0` is a shortcut for the same start you did by hand: current tip is bad, `v0.9.0` is good. Then `git bisect run ./scripts/smoke-check.sh` repeats the midpoint loop until the first bad save is found. Whether you bisect by hand or with `run`, finish with `git bisect reset` — leaving a bisect half-finished confuses later commands.',
        ],
        code: {
          language: 'bash',
          code: `git bisect start HEAD v0.9.0
git bisect run ./scripts/smoke-check.sh
git bisect reset`,
          filename: 'bisect-run',
        },
      },
      {
        id: 'blame',
        title: 'Blame: who changed this line, and why',
        body: [
          '`git blame` annotates each line with the save and author that last touched it. The point is not finger-pointing — it is finding the message that explains the reasoning.',
          '**`git show <hash>`** means: open that one save and read it whole — author, message, and every file that changed — not just the single line blame pointed at. Pair blame with show so you see the surrounding change and why the line moved (for example from a hard-coded value to a config setting).',
          '`git blame -L 12,20 src/rates.cfg` means: show who last changed lines 40 through 55 in that file. Formatting-only saves can hide the real author of the logic — `git blame -w` ignores whitespace-only changes.',
        ],
        code: {
          language: 'bash',
          code: `git blame -L 12,20 src/rates.cfg
git show 4b2e9f1`,
          filename: 'blame',
        },
      },
      {
        id: 'stash',
        title: 'Stash: park work in progress',
        body: [
          'You are halfway through a feature when an urgent fix request arrives. You are not ready to save a version, but you also cannot switch branches cleanly with a messy folder.',
          '**Stash** parks your edits on a shelf and leaves a clean working tree. Finish the urgent fix, switch back, and bring the shelf back.',
        ],
        figure: {
          animation: 'git-stash',
          imageAlt:
            'Unfinished feature edits park on a stash shelf, leaving a clean tree for an urgent fix',
          caption:
            'Stash parks unfinished edits so you can switch context with a clean tree.',
          flush: true,
        },
        after: [
          '`git stash push -m "dashboard wip"` means: shelf my current edits under that name. `git stash pop` means: bring the latest shelf back and remove it from the list.',
        ],
        code: {
          language: 'bash',
          code: `git stash push -m "dashboard wip"
git switch -c hotfix/metrics-drift
# ... fix, save, share...
git switch feature/dashboard-filters
git stash list
git stash pop`,
          filename: 'stash',
        },
      },
      {
        id: 'stash-care',
        title: 'Stash with care',
        body: [
          'Stashes are easy to forget. Name them with `-m`, check `git stash list` regularly, and prefer a temporary save on a private branch if the work will sit for days.',
          '`git stash pop` applies and removes; `git stash apply` applies and keeps a copy — safer when you are unsure.',
        ],
        callout: {
          kind: 'warn',
          title: 'New files need an extra flag',
          body: [
            'By default stash ignores **untracked** files — new files Git does not know yet. Your shelf can look empty even though those new files are still sitting in the folder.',
            'Add `-u` when you stash if you want those new files parked too: `git stash push -u -m "dashboard wip"`.',
          ],
        },
      },
      {
        id: 'capstone',
        title: 'Putting it together',
        body: [
          'Notice the pattern: bisect finds **when**, blame finds **who and why**, stash buys you **time**. Together they handle most real-world interruptions without drama.',
          'Practice next: find a breaking save with bisect, explain a line with blame, then stash unfinished work so you can land an urgent fix cleanly.',
        ],
      },
    ],
    takeaways: [
      '`git bisect` finds the first bad save by searching history in halves; automate with `bisect run`.',
      '`git blame` plus `git show` reveals the reasoning behind a line.',
      '`git stash` parks unfinished work so you can switch context cleanly.',
      'These detective tools pair with merge, rebase, and recovery when real repos get messy.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-12-bisect-find-the-breaking-commit',
        label: 'Bisect to the first bad commit',
      },
      {
        challengeId: 'git-13-blame-who-changed-this-line',
        label: 'Blame who changed a line',
      },
      {
        challengeId: 'git-14-stash-work-in-progress',
        label: 'Stash work in progress',
      },
      {
        challengeId: 'git-16-sync-shared-feature-after-rejected-push',
        label: 'Sync after a rejected feature push',
      },
      {
        challengeId: 'git-17-worktree-the-parallel-hotfix',
        label: 'Parallel webhook hotfix with a worktree',
      },
      {
        challengeId: 'git-21-restore-deleted-notify-helper',
        label: 'Restore a deleted helper from history',
      },
    ],
  },
  {
    id: 'tags-remotes-hooks',
    slug: 'tags-remotes-hooks',
    trackId: 'B9',
    eyebrow: '',
    title: 'Tags, remotes, and hooks: releases beyond main',
    showBlogStamp: true,
    gatedByChallengeId: 'git-18-tag-release-and-cut-patch-branch',
    lede: 'Branches keep moving forward. A shipped release needs a name that stays put. This post covers three small tools for that: **tags** (label a shipped version), **remotes** (your copy vs the team copy), and **hooks** (a local check before a save is created).',
    sections: [
      {
        id: 'tags',
        title: 'Tags: a sticky label on a shipped version',
        body: [
          'A **tag** is a sticky label on one saved version. Branches move when you save new work. A release name like `v4.0.0` should keep pointing at the exact version you shipped — even after `main` moves on.',
          'For releases, use an **annotated** tag (`git tag -a`). It stores a short message plus who created it and when. A normal `git push` does **not** send tags — you push the tag name on purpose.',
        ],
        figure: {
          animation: 'git-tag',
          animate: false,
          imageAlt:
            'main moves forward to a newer save while the release tag v4.0.0 stays fixed on the shipped version',
          caption:
            'Branches slide forward. A release tag stays on the shipped save so you can always find that exact version.',
          flush: true,
        },
      },
      {
        id: 'tag-create',
        title: 'Create the tag and share it',
        body: [
          '`git tag -a v4.0.0 -m "Release 4.0.0"` means: put an annotated label named `v4.0.0` on the current tip. Then push **that tag name** to the remote so the team can see it.',
        ],
        code: {
          language: 'bash',
          code: `# Create an annotated tag on the current tip
git tag -a v4.0.0 -m "Release 4.0.0"

# Share the tag (normal git push does not send tags)
git push origin v4.0.0`,
          filename: 'tag-create',
        },
      },
      {
        id: 'tag-hotfix',
        title: 'Start a patch from an old tag',
        body: [
          'Need a fix for an older release? Start the patch branch from that old tag — not from today’s `main`. Otherwise you drag in every newer change that never shipped on that release.',
        ],
        code: {
          language: 'bash',
          code: `# New branch starting at the old release tag
git switch -c hotfix/3.9.1 v3.9.0

# Share the patch branch
git push -u origin hotfix/3.9.1`,
          filename: 'tag-hotfix',
        },
        callout: {
          kind: 'tip',
          title: 'Why start from the old tag?',
          body: [
            'The tag is the frozen starting point for that release line. Cutting `hotfix/3.9.1` from `v3.9.0` keeps the patch small and true to what customers already run.',
            'Branching from current `main` would pull in unfinished or unrelated work that was never part of 3.9.',
          ],
        },
      },
      {
        id: 'remotes',
        title: 'Remotes: your copy vs the team copy',
        body: [
          'A **remote** is just a nickname for “a shared project location on the network.” After a normal clone you usually have one: **`origin`** — often *your* fork, or the team repo you push to.',
          'On many teams you also add **`upstream`**: the organization copy you **fetch** new work from, and almost never push to. Everyday direction: fetch from upstream, push to origin.',
        ],
        figure: {
          animation: 'git-remotes',
          animate: false,
          imageAlt:
            'Your laptop in the middle: fetch from upstream (org), push to origin (your fork)',
          caption:
            'Fetch new work from upstream (the org). Push your work to origin (your copy).',
          flush: true,
        },
      },
      {
        id: 'remote-add',
        title: 'Point at the org remote',
        body: [
          'The address after `git remote add` is the same kind of location you used with clone: `user@host:path/to/repo.git` or an HTTPS URL. `git fetch upstream` downloads their latest history without changing your files yet.',
        ],
        code: {
          language: 'bash',
          code: `# Remember the org repo as "upstream"
git remote add upstream git@lab.example.com:acme/invoice-api.git

# Download their latest history
git fetch upstream`,
          filename: 'remote-add',
        },
      },
      {
        id: 'remote-sync',
        title: 'Update your main, then push your fork',
        body: [
          '`git merge --ff-only upstream/main` means: move my local `main` forward to match upstream, but only if that is a simple fast-forward (no messy join). Then push that updated `main` to **your** `origin`.',
          'When a branch is deleted on the remote, your laptop can still show `origin/old-branch` until you prune. Prune cleans leftover **names** — it does not delete local saves you still need.',
        ],
        code: {
          language: 'bash',
          code: `# Fast-forward local main to match the org
git merge --ff-only upstream/main

# Publish that update on your fork
git push origin main

# Optional: drop stale origin/* names
git fetch --prune origin`,
          filename: 'remote-sync',
        },
      },
      {
        id: 'hooks',
        title: 'Hooks: a check before the save is created',
        body: [
          'A **hook** is a small script Git runs around an event. A common one is `commit-msg`: it can reject a message that is missing a ticket id **before** the save exists.',
          'That check lives on **your laptop**. Teammates need the same hook (or a shared setup) for the rule to apply everywhere. Server-side rules can still protect the shared remote even if someone’s laptop has no hook.',
        ],
        figure: {
          animation: 'git-hook',
          animate: false,
          imageAlt:
            'A bad commit message is blocked by a commit-msg hook; a message with a ticket prefix is allowed',
          caption:
            'A commit-msg hook checks the subject first. Bad message → blocked. Good message → save is created.',
          flush: true,
        },
      },
      {
        id: 'hook-script',
        title: 'What the hook checks',
        body: [
          'This script reads the first line of the commit message. If it does not start with something like `TKT-42`, the script exits with an error and Git refuses to create the save.',
        ],
        code: {
          language: 'bash',
          code: `#!/bin/bash
# Read the subject line from the message file Git passes in
subject="$(head -n 1 "$1")"

# Require subjects like TKT-42 Adjust cache default
echo "$subject" | grep -Eq '^TKT-[0-9]+' || exit 1`,
          filename: '.git/hooks/commit-msg',
        },
      },
      {
        id: 'hook-try',
        title: 'Make it runnable and try it',
        body: [
          'Git only runs hooks that are executable. After `chmod +x`, try a vague message (should fail) and a ticket-prefixed message (should succeed).',
        ],
        code: {
          language: 'bash',
          code: `# Allow Git to run the hook
chmod +x .git/hooks/commit-msg

# Should fail — missing ticket prefix
git commit -m "tweak cache"

# Should succeed — starts with TKT-42
git commit -m "TKT-42 Adjust cache default"`,
          filename: 'hook-try',
        },
        callout: {
          kind: 'warn',
          title: 'Skipping hooks',
          body: [
            '`git commit --no-verify` skips local hooks entirely — the ticket check (or any other local rule) never runs.',
            'Use it only when you knowingly bypass policy. Do not treat it as the everyday escape hatch on a team that relies on the hook.',
          ],
        },
      },
      {
        id: 'habit',
        title: 'What to practice next',
        body: [
          'Label the tip you ship with a tag. Know which remote is your fork (`origin`) and which is the org (`upstream`). Add a cheap message check before a vague subject lands in history.',
          'Practice next: create and push a release tag, cut a patch branch from an older tag, sync a fork with upstream, then install a commit-msg hook that requires a ticket prefix.',
        ],
      },
    ],
    takeaways: [
      'A tag is a sticky label on a shipped save — push the tag name on purpose.',
      'Start old-release fixes from the old tag, not from today’s moving main.',
      'Fetch from upstream (org); push to origin (your copy).',
      'A local commit-msg hook can reject bad subjects before the save exists.',
    ],
    relatedLabs: [
      {
        challengeId: 'git-18-tag-release-and-cut-patch-branch',
        label: 'Tag a release and cut a patch branch',
      },
      {
        challengeId: 'git-19-sync-fork-with-upstream',
        label: 'Sync your fork with upstream',
      },
      {
        challengeId: 'git-20-block-bad-commits-with-a-hook',
        label: 'Block bad commits with a hook',
      },
      {
        challengeId: 'git-22-scrub-secret-from-unpushed-branch',
        label: 'Scrub a secret before first push',
      },
    ],
  },
  {
    id: 'git-hosting-today',
    slug: 'git-hosting-today',
    trackId: 'B1',
    eyebrow: '',
    title: 'Where teams host Git today',
    showBlogStamp: true,
    lede: 'Git itself does not require a website. Teams still use **hosting services** so everyone shares one remote, reviews changes in a browser, and ships with automation. This post is a plain map of the main hosts people use today — what each is known for, and how to choose — with no lab attached.',
    relatedLabsIntro: '',
    sections: [
      {
        id: 'what-a-host-is',
        title: 'What a Git host adds',
        body: [
          'On your laptop, Git already stores history. A **Git host** is a company or project that keeps a shared copy of that history online — the remote you clone from and push to — plus a website around it.',
          'The host is not a different kind of Git. It is Git **plus** extras most teams want: a place to browse files, open a review (pull request / merge request), control who can push, track issues, and often run tests when you push.',
        ],
        figure: {
          animation: 'git-hosts',
          animate: false,
          imageAlt:
            'Your laptop in the center connecting to three popular Git hosts: GitHub, GitLab, and Bitbucket',
          caption:
            'Same Git on your laptop. Different hosts provide the shared remote and the website around it.',
          flush: true,
        },
        after: [
          'You already met this idea as `origin` or “Shared Remote.” GitHub, GitLab, Bitbucket, and the others are brand names for that shared place — plus their own review and automation tools.',
        ],
      },
      {
        id: 'common-features',
        title: 'What almost every host gives you',
        body: [
          'The brand names differ. The everyday tools look familiar once you know the pattern:',
        ],
        table: {
          headers: ['Need', 'What you get on a host'],
          rows: [
            ['Shared remote', 'HTTPS or SSH clone URL; push and fetch over the network'],
            ['Browse & history', 'Web pages for files, commits, branches, and tags'],
            ['Code review', 'Pull request (GitHub/Bitbucket) or merge request (GitLab)'],
            ['Access control', 'Orgs, teams, permissions, protected branches'],
            ['Automation', 'CI/CD that runs on push or on a review (Actions, Pipelines, …)'],
            ['Planning extras', 'Issues, boards, wikis, release pages — amount varies by host'],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'Git stays portable',
          body: [
            'Your commits and branches are normal Git objects. You can clone the same project onto another host later.',
            'What does **not** move automatically: pull-request discussions, host-specific Actions/Pipelines config, and many permission settings. Plan for that if you ever switch.',
          ],
        },
      },
      {
        id: 'github',
        title: 'GitHub',
        body: [
          '**GitHub** (owned by Microsoft) is the largest public Git host and the default home for a huge share of open-source projects. Many developers already have an account, which makes outside contributions easier.',
          'Day to day you will hear **pull requests** for review, **Issues** for bugs and tasks, and **GitHub Actions** for automation. Companies can also run **GitHub Enterprise Server** on their own machines when they need self-hosting.',
          'Choose GitHub when you want the widest community, lots of integrations, and a workflow most newcomers already recognize.',
        ],
      },
      {
        id: 'gitlab',
        title: 'GitLab',
        body: [
          '**GitLab** positions itself as a full DevOps platform in one product: repos, review, planning, and CI/CD together. Reviews are called **merge requests**. Automation is built-in **GitLab CI/CD** (usually a `.gitlab-ci.yml` file).',
          'You can use hosted **GitLab.com** or run **self-managed** GitLab on your own servers. The core product is open source, with paid tiers unlocking more features.',
          'Choose GitLab when your team wants repositories and pipelines in the same place, or when self-hosting the whole stack matters.',
        ],
      },
      {
        id: 'bitbucket',
        title: 'Bitbucket',
        body: [
          '**Bitbucket** comes from Atlassian — the company behind **Jira** and Confluence. That is its main story: code hosting that links cleanly to work items your team already tracks in Jira.',
          'Cloud Bitbucket uses pull requests and **Bitbucket Pipelines** for CI/CD. Larger companies may run **Bitbucket Data Center** themselves.',
          'Choose Bitbucket when your company already lives in Jira and wants branches, commits, and reviews tied to those tickets.',
        ],
      },
      {
        id: 'others',
        title: 'Other hosts you will hear about',
        body: [
          'A few more names show up often in job postings and open-source communities:',
        ],
        bullets: [
          '**Azure Repos (Azure DevOps)** — Microsoft’s suite for repos, boards, and pipelines. Common inside Azure-heavy enterprises; reviews use pull requests and branch policies.',
          '**Codeberg** — a non-profit community host (runs **Forgejo**) focused on free and open-source projects. Smaller than GitHub; attractive if you want a non-commercial home for FOSS.',
          '**Gitea / Forgejo (self-hosted)** — lightweight software you install on your own server to get a GitHub-like UI without using a big SaaS vendor.',
          '**AWS CodeCommit** — Amazon’s managed Git repos inside AWS accounts; less “social coding,” more “repo next to your cloud resources.”',
        ],
      },
      {
        id: 'how-to-choose',
        title: 'How teams usually choose',
        body: [
          'There is rarely a single “best” host. Teams pick based on people and constraints:',
        ],
        table: {
          headers: ['If this matters most…', 'People often pick…'],
          rows: [
            ['Outside contributors already know the site', 'GitHub'],
            ['Repos + CI/CD + self-host in one product', 'GitLab'],
            ['Tight Jira / Atlassian workflow', 'Bitbucket'],
            ['Already deep in Azure DevOps', 'Azure Repos'],
            ['Non-profit / FOSS-first hosting', 'Codeberg'],
            ['Full control on your own servers', 'Self-hosted GitLab, Gitea, or Forgejo'],
          ],
        },
        callout: {
          kind: 'tip',
          title: 'Start from your team, not the logo',
          body: [
            'If your teammates already review on one host, learn that host’s clone URL, pull/merge request flow, and branch rules first — the Git commands stay the same.',
            'When you start a personal project, pick the place your future collaborators are most likely to have an account.',
          ],
        },
      },
      {
        id: 'urls',
        title: 'Clone URLs look different; the job is the same',
        body: [
          'Every host gives you a remote address. Spelling changes; meaning does not: “copy this project onto my laptop” or “point `origin` here.”',
        ],
        code: {
          language: 'bash',
          code: `# HTTPS-style examples (login via browser token / credential helper)
git clone https://github.com/acme/my-project.git

git clone https://gitlab.com/acme/my-project.git

# SSH-style examples (login via SSH key)
git clone git@bitbucket.org:acme/my-project.git`,
          filename: 'host-clone-urls',
        },
        after: [
          'Inside the product UI you will also create pull or merge requests, set branch protection, and wire CI. Those clicks are host-specific — your local `git commit` and `git push` skills still transfer.',
        ],
      },
      {
        id: 'what-next',
        title: 'What to keep in mind',
        body: [
          'Git is the tool on your machine. The host is the shared home plus the website and automation around it. Learn one host deeply for your team; remember the others exist so job postings and open-source READMEs make sense.',
          'This post is reference only — no related lab. When you practice remotes and pushes on the track, you are using the same ideas these products package for the web.',
          'A light note for our labs: instead of pointing at GitHub or Bitbucket, your shared remote is Git hosted on a practice machine. You get that machine’s remote URL and connect your laptop the same way you would to any host — clone, fetch, and push against that address.',
        ],
      },
    ],
    takeaways: [
      'A Git host is a shared remote plus a website for review, access control, and often CI/CD.',
      'GitHub leads for community and open source; GitLab for all-in-one DevOps / self-host; Bitbucket for Jira-centric teams.',
      'Also know Azure Repos, Codeberg, and self-hosted Gitea/Forgejo — same Git, different packaging.',
      'Clone URL spelling changes by host; your everyday Git commands stay the same.',
    ],
    relatedLabs: [],
  },
];


export function getGitReading(slug: string | null | undefined): K8sReading | null {
  if (!slug) return null;
  // Retired / renamed slugs → current posts.
  const aliases: Record<string, string> = {
    'three-trees': 'ship-your-first-change',
    'first-commit': 'ship-your-first-change',
    branches: 'branches-atomic-amend',
    'atomic-commits': 'branches-atomic-amend',
    amend: 'branches-atomic-amend',
  };
  const resolved = aliases[slug] ?? slug;
  return GIT_READINGS.find((r) => r.slug === resolved || r.id === resolved) || null;
}

export function listGitReadings(): K8sReading[] {
  return GIT_READINGS;
}

/** Readings inserted at the start of the Git track (before the first lab). */
const GIT_READINGS_BEFORE_LABS = [
  'why-git',
  'git-hosting-today',
  'ship-your-first-change',
] as const;

/** Readings inserted immediately after a given challenge id. */
const GIT_READINGS_AFTER_CHALLENGE: Record<string, string[]> = {
  'git-01-first-commit-on-sprint-service': ['branches-atomic-amend'],
  'git-04-amend-the-last-commit': ['merging'],
  'git-05-merge-without-conflict': ['rebase'],
  'git-08-interactive-rebase-squash-the-noise': ['cherry-pick'],
  'git-09-cherry-pick-the-hotfix': ['undo-and-recover'],
  'git-11-reset-and-reflog-recover-lost-work': ['bisect-blame-stash'],
  'git-15-capstone-untangle-the-merge-mess': ['tags-remotes-hooks'],
};

/** Ordered mixed roadmap for the Software Engineer Git panel: readings + challenges. */
export function listGitTrackItems(): K8sTrackItem[] {
  const panel = PLAY_DOMAINS.find((d) => d.id === 'software-engineer')?.panels.find(
    (p) => p.id === 'git',
  );
  const challengeIds = panel?.challengeIds ?? [];
  const items: K8sTrackItem[] = [];

  for (const readingId of GIT_READINGS_BEFORE_LABS) {
    items.push({
      type: 'reading',
      id: `reading:${readingId}`,
      readingId,
    });
  }

  for (const challengeId of challengeIds) {
    items.push({ type: 'challenge', id: `challenge:${challengeId}`, challengeId });
    for (const readingId of GIT_READINGS_AFTER_CHALLENGE[challengeId] ?? []) {
      items.push({
        type: 'reading',
        id: `reading:${readingId}`,
        readingId,
      });
    }
  }

  return items;
}
