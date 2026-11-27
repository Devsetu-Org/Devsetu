import React from 'react';
import type { ReadingFigureAnimation } from '../constants/k8sReadings';
import { LINUX_ANIM_MAP } from './LinuxReadingAnims';

/** Git blog figures — shared visual language; motion only when it teaches a process. */

function shell(id: string, animate: boolean, body: React.ReactNode): JSX.Element {
  return (
    <div
      className={`git-motion git-motion--${id}${animate ? '' : ' git-motion--still'}`}
      aria-hidden
    >
      {body}
    </div>
  );
}

function OriginAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'origin',
    animate,
    <>
      <p className="git-motion-thesis">
        Centralized locks history on <strong>one server</strong>. Distributed (Git) puts{' '}
        <strong>the full history on every laptop</strong>.
      </p>
      <div className="git-motion-compare">
        <div className="git-motion-panel git-motion-panel--before">
          <span className="git-motion-kicker">Centralized (CVS / SVN)</span>
          <div className="git-motion-history git-motion-history--server">
            <span className="git-motion-history-label">Central Server</span>
            <span className="git-motion-history-sub">Only copy of project history</span>
            <div className="git-motion-commits">
              <i>v1</i>
              <i>v2</i>
              <i>v3</i>
            </div>
          </div>
          <div className="git-motion-conn git-motion-conn--required">
            <span className="git-motion-conn-line" />
            <span className="git-motion-conn-pill">must be online to save or view history</span>
            <span className="git-motion-conn-line" />
          </div>
          <div className="git-motion-devs">
            <div className="git-motion-dev">
              <span>Your laptop</span>
              <em>Latest files only</em>
              <small>no past versions</small>
            </div>
            <div className="git-motion-dev">
              <span>Teammate</span>
              <em>Latest files only</em>
              <small>no past versions</small>
            </div>
          </div>
          <p className="git-motion-footnote">
            Offline or server down? You cannot save changes or look up past versions.
          </p>
        </div>

        <div className="git-motion-pivot">
          <span className="git-motion-pivot-line" />
          <span className="git-motion-pivot-badge">VS</span>
          <span className="git-motion-pivot-line" />
        </div>

        <div className="git-motion-panel git-motion-panel--after">
          <span className="git-motion-kicker">Distributed (Git)</span>
          <div className="git-motion-history git-motion-history--remote">
            <span className="git-motion-history-label">Shared Remote (e.g. GitHub)</span>
            <span className="git-motion-history-sub">Team sync copy</span>
            <div className="git-motion-commits">
              <i>v1</i>
              <i>v2</i>
              <i>v3</i>
            </div>
          </div>
          <div className="git-motion-conn git-motion-conn--optional">
            <span className="git-motion-conn-line" />
            <span className="git-motion-conn-pill">sync only when ready to share</span>
            <span className="git-motion-conn-line" />
          </div>
          <div className="git-motion-devs git-motion-devs--dist">
            <div className="git-motion-dev git-motion-dev--full" data-i="1">
              <span>Your laptop</span>
              <div className="git-motion-commits">
                <i>v1</i>
                <i>v2</i>
                <i>v3</i>
                <i className="git-motion-commit--new">+v4</i>
              </div>
              <em>saved v4 offline</em>
            </div>
            <div className="git-motion-dev git-motion-dev--full" data-i="2">
              <span>Teammate</span>
              <div className="git-motion-commits">
                <i>v1</i>
                <i>v2</i>
                <i>v3</i>
              </div>
              <em>full history locally</em>
            </div>
          </div>
          <p className="git-motion-footnote">
            Every laptop holds the full timeline — work offline, sync with the team anytime.
          </p>
        </div>
      </div>
    </>,
  );
}

function ThreeTreesAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'trees',
    animate,
    <>
      <p className="git-motion-thesis">
        One change, three stops: <strong>edit → stage → save</strong>
      </p>
      <div className="git-motion-circles">
        <div className="git-motion-circle" data-stop="1">
          <strong>Your files</strong>
          <em>working tree</em>
          <span className="git-motion-chip git-motion-chip--file" data-at="1">
            app.conf
          </span>
        </div>
        <div className="git-motion-arrow" data-bridge="add">
          <i />
          <span>git add</span>
        </div>
        <div className="git-motion-circle" data-stop="2">
          <strong>Staging area</strong>
          <em>draft next save</em>
          <span className="git-motion-chip git-motion-chip--file" data-at="2">
            app.conf
          </span>
        </div>
        <div className="git-motion-arrow" data-bridge="commit">
          <i />
          <span>git commit</span>
        </div>
        <div className="git-motion-circle" data-stop="3">
          <strong>Last save</strong>
          <em>HEAD</em>
          <span className="git-motion-chip git-motion-chip--file" data-at="3">
            app.conf
          </span>
        </div>
      </div>
    </>,
  );
}

function ClonePushAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'clone-push',
    animate,
    <>
      <p className="git-motion-thesis">
        Everyday loop: <strong>copy the project → change → share</strong> so the
        team remote has your new version.
      </p>
      <div className="git-motion-forge">
        <div className="git-motion-forge-node" data-side="remote">
          <span className="git-motion-kicker">Shared Remote</span>
          <div className="git-motion-commits">
            <i data-c="1">v1</i>
            <i data-c="2">v2</i>
          </div>
          <em>e.g. GitHub</em>
        </div>
        <div className="git-motion-forge-path">
          <span className="git-motion-forge-flow" data-dir="clone">
            clone
          </span>
          <span className="git-motion-forge-wire" aria-hidden />
          <span className="git-motion-forge-packet" aria-hidden />
          <span className="git-motion-forge-flow" data-dir="push">
            push
          </span>
        </div>
        <div className="git-motion-forge-node" data-side="local">
          <span className="git-motion-kicker">Your laptop</span>
          <div className="git-motion-commits">
            <i data-c="1">v1</i>
            <i data-c="2">v2</i>
          </div>
          <em>~/my-project</em>
        </div>
      </div>
      <p className="git-motion-footnote">
        v1 was already on the remote — your v2 is the new version you push back
      </p>
    </>,
  );
}

function BranchPointerAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'branch',
    animate,
    <>
      <p className="git-motion-thesis">
        A branch is a <strong>name on a saved version</strong> — saving moves only that name.
      </p>
      <div className="git-motion-stage">
        <div className="git-motion-rail">
          <div className="git-motion-node" data-n="1">
            v1
          </div>
          <div className="git-motion-node" data-n="2">
            v2
          </div>
          <div className="git-motion-node" data-n="3">
            v3
          </div>
          <div className="git-motion-node git-motion-node--birth" data-n="4">
            v4
          </div>
        </div>
        <div className="git-motion-tag git-motion-tag--main">main</div>
        <div className="git-motion-tag git-motion-tag--feat">fix/rollout-guard</div>
      </div>
    </>,
  );
}

function AmendAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'amend',
    animate,
    <>
      <p className="git-motion-thesis">
        Amend builds a <strong>new tip</strong> with the same parent — the old tip leaves the branch.
      </p>
      <div className="git-motion-stage">
        <div className="git-motion-rail">
          <div className="git-motion-node" data-n="1">
            v3
          </div>
          <div className="git-motion-node git-motion-node--orphan" data-n="2">
            v4
          </div>
          <div className="git-motion-node git-motion-node--new" data-n="3">
            v4′
          </div>
        </div>
        <div className="git-motion-tag git-motion-tag--tip">branch tip</div>
        <div className="git-motion-cmd git-motion-cmd--center">git commit --amend</div>
      </div>
    </>,
  );
}

function MergeVsRebaseAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'merge-rebase',
    animate,
    <>
      <p className="git-motion-thesis">
        Same two pieces of work — <strong>merge keeps the join</strong>; rebase replays a straight
        line.
      </p>
      <div className="git-motion-compare git-motion-compare--merge-choice">
        <div className="git-motion-panel">
          <span className="git-motion-kicker">Merge · shared integration</span>
          <svg className="git-motion-svg" viewBox="0 0 220 110" role="img">
            <title>Merge keeps a diamond join</title>
            <line className="gm-edge" x1="28" y1="55" x2="78" y2="28" />
            <line className="gm-edge" x1="28" y1="55" x2="78" y2="82" />
            <line className="gm-edge gm-edge--join" x1="78" y1="28" x2="148" y2="55" />
            <line className="gm-edge gm-edge--join" x1="78" y1="82" x2="148" y2="55" />
            <circle className="gm-node" cx="28" cy="55" r="11" />
            <text className="gm-label" x="28" y="59">
              B
            </text>
            <circle className="gm-node" cx="78" cy="28" r="11" />
            <text className="gm-label" x="78" y="32">
              C
            </text>
            <circle className="gm-node" cx="78" cy="82" r="11" />
            <text className="gm-label" x="78" y="86">
              F
            </text>
            <circle className="gm-node gm-node--merge" cx="148" cy="55" r="12" />
            <text className="gm-label" x="148" y="59">
              M
            </text>
            <text className="gm-caption" x="28" y="104">
              main ← feature
            </text>
            <text className="gm-caption gm-caption--accent" x="148" y="104">
              2 parents
            </text>
          </svg>
          <p className="git-motion-footnote">Hashes stay put · join stays visible on shared main</p>
        </div>
        <div className="git-motion-panel">
          <span className="git-motion-kicker">Rebase · private cleanup</span>
          <svg className="git-motion-svg" viewBox="0 0 220 110" role="img">
            <title>Rebase replays onto a straight line</title>
            <line className="gm-edge" x1="24" y1="40" x2="64" y2="40" />
            <line className="gm-edge" x1="64" y1="40" x2="104" y2="40" />
            <line className="gm-edge gm-edge--new" x1="104" y1="40" x2="144" y2="40" />
            <line className="gm-edge gm-edge--new" x1="144" y1="40" x2="184" y2="40" />
            <circle className="gm-node" cx="24" cy="40" r="10" />
            <text className="gm-label" x="24" y="44">
              M0
            </text>
            <circle className="gm-node" cx="64" cy="40" r="10" />
            <text className="gm-label" x="64" y="44">
              M1
            </text>
            <circle className="gm-node" cx="104" cy="40" r="10" />
            <text className="gm-label" x="104" y="44">
              M2
            </text>
            <circle className="gm-node gm-node--new" cx="144" cy="40" r="10" />
            <text className="gm-label" x="144" y="44">
              A′
            </text>
            <circle className="gm-node gm-node--new" cx="184" cy="40" r="10" />
            <text className="gm-label" x="184" y="44">
              B′
            </text>
            <text className="gm-caption gm-caption--dim" x="110" y="78">
              old A, B abandoned
            </text>
            <text className="gm-caption gm-caption--accent" x="164" y="104">
              new SHAs
            </text>
          </svg>
          <p className="git-motion-footnote">Rewrites your commits · only on a branch nobody else built on</p>
        </div>
      </div>
      <div className="git-motion-choice-strip">
        <span>
          <strong>Shared main / teammates have the tip</strong> → merge
        </span>
        <span>
          <strong>Private feature before review</strong> → rebase
        </span>
      </div>
    </>,
  );
}

function MergeCommitAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'merge-commit',
    animate,
    <>
      <p className="git-motion-thesis">
        Shared base → both tips move → merge save <strong>M</strong> with{' '}
        <strong>two parents</strong>: first = tip you were on, second = tip you brought in.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Shared base</li>
        <li data-step="2">Both sides move</li>
        <li data-step="3">Merge commit M</li>
      </ol>
      <div className="git-motion-merge-scene">
        <svg className="git-motion-svg git-motion-svg--wide" viewBox="0 0 460 210" role="img">
          <title>Merge commit with two parents</title>
          {/* Phase 1 — shared base (always on; caption only in step 1) */}
          <g className="gm-phase-base">
            <line className="gm-edge" x1="48" y1="96" x2="140" y2="96" />
            <circle className="gm-node gm-node--base" cx="48" cy="96" r="14" />
            <text className="gm-label" x="48" y="101">
              A
            </text>
            <circle className="gm-node gm-node--base" cx="140" cy="96" r="14" />
            <text className="gm-label" x="140" y="101">
              B
            </text>
            <text className="gm-caption gm-phase-1-only" x="94" y="130">
              merge base
            </text>
          </g>
          {/* Phase 2 — diverge (steps 2–3) */}
          <g className="gm-phase-diverge">
            <line className="gm-edge gm-edge--main" x1="140" y1="96" x2="250" y2="42" />
            <line className="gm-edge gm-edge--feat" x1="140" y1="96" x2="250" y2="160" />
            <circle className="gm-node gm-node--main" cx="250" cy="42" r="14" />
            <text className="gm-label" x="250" y="47">
              C
            </text>
            <circle className="gm-node gm-node--feat" cx="250" cy="160" r="14" />
            <text className="gm-label" x="250" y="165">
              F
            </text>
            <text className="gm-tag" x="274" y="28">
              main
            </text>
            <text className="gm-tag gm-tag--feat" x="274" y="186">
              feature
            </text>
          </g>
          {/* Phase 3 — join (step 3) */}
          <g className="gm-phase-join">
            <line className="gm-edge gm-edge--join" x1="250" y1="42" x2="370" y2="102" />
            <line className="gm-edge gm-edge--join" x1="250" y1="160" x2="370" y2="102" />
            <circle className="gm-node gm-node--merge" cx="370" cy="102" r="16" />
            <text className="gm-label" x="370" y="107">
              M
            </text>
            <text className="gm-tag gm-tag--merge" x="396" y="78">
              HEAD
            </text>
            <text className="gm-parent-call" x="288" y="58">
              1st parent: C
            </text>
            <text className="gm-parent-call gm-parent-call--2" x="288" y="154">
              2nd parent: F
            </text>
          </g>
        </svg>
        <div className="git-motion-merge-legend">
          <span>
            <i className="gm-swatch gm-swatch--base" /> shared history
          </span>
          <span>
            <i className="gm-swatch gm-swatch--main" /> main tip C
          </span>
          <span>
            <i className="gm-swatch gm-swatch--feat" /> feature tip F
          </span>
          <span>
            <i className="gm-swatch gm-swatch--merge" /> M = merge commit
          </span>
        </div>
        <p className="git-motion-parent-note">
          <strong>1st parent</strong> is the tip you were on when you ran merge (here <strong>C</strong> on{' '}
          <code>main</code>). <strong>2nd parent</strong> is the tip you merged in (here <strong>F</strong> on{' '}
          <code>feature</code>).
        </p>
      </div>
    </>,
  );
}

function FastForwardAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'fast-forward',
    animate,
    <>
      <p className="git-motion-thesis">
        If only <strong>one side moved</strong>, Git can slide the pointer. If <strong>both
        moved</strong>, it must create a merge commit.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Main idle at base</li>
        <li data-step="2">Pointer slides</li>
        <li data-step="3">At tip · or true merge</li>
      </ol>
      <div className="git-motion-compare">
        <div className="git-motion-panel git-motion-panel--ff">
          <span className="git-motion-kicker">Fast-forward · main idle</span>
          <svg className="git-motion-svg" viewBox="0 0 260 130" role="img">
            <title>Fast-forward slides main to the tip</title>
            <line className="gm-edge" x1="36" y1="72" x2="92" y2="72" />
            <line className="gm-edge" x1="92" y1="72" x2="148" y2="72" />
            <line className="gm-edge" x1="148" y1="72" x2="204" y2="72" />
            <circle className="gm-node" cx="36" cy="72" r="12" />
            <text className="gm-label" x="36" y="76">
              B
            </text>
            <circle className="gm-node" cx="92" cy="72" r="12" />
            <text className="gm-label" x="92" y="76">
              F1
            </text>
            <circle className="gm-node" cx="148" cy="72" r="12" />
            <text className="gm-label" x="148" y="76">
              F2
            </text>
            <circle className="gm-node" cx="204" cy="72" r="12" />
            <text className="gm-label" x="204" y="76">
              F3
            </text>
            <text className="gm-tag gm-tag--feat" x="204" y="44">
              feature tip
            </text>
            <g className="gm-ff-pointer">
              <rect className="gm-ff-pill" x="0" y="0" width="44" height="18" rx="9" />
              <text className="gm-ff-pill-text" x="22" y="13">
                main
              </text>
            </g>
            <text className="gm-caption gm-phase-3-only" x="120" y="118">
              pointer slides · no new commit
            </text>
          </svg>
          <p className="git-motion-footnote">
            <code>main</code> catches up to F3. The branch boundary disappears.
          </p>
        </div>
        <div className="git-motion-panel git-motion-panel--true">
          <span className="git-motion-kicker">True merge · both moved</span>
          <svg className="git-motion-svg" viewBox="0 0 260 130" role="img">
            <title>True merge creates commit M</title>
            <line className="gm-edge" x1="32" y1="68" x2="88" y2="68" />
            <line className="gm-edge" x1="88" y1="68" x2="150" y2="28" />
            <line className="gm-edge" x1="88" y1="68" x2="150" y2="108" />
            <g className="gm-phase-join">
              <line className="gm-edge gm-edge--join" x1="150" y1="28" x2="220" y2="68" />
              <line className="gm-edge gm-edge--join" x1="150" y1="108" x2="220" y2="68" />
              <circle className="gm-node gm-node--merge" cx="220" cy="68" r="13" />
              <text className="gm-label" x="220" y="72">
                M
              </text>
            </g>
            <circle className="gm-node" cx="32" cy="68" r="11" />
            <text className="gm-label" x="32" y="72">
              B
            </text>
            <circle className="gm-node" cx="88" cy="68" r="11" />
            <text className="gm-label" x="88" y="72">
              A
            </text>
            <circle className="gm-node gm-node--main" cx="150" cy="28" r="11" />
            <text className="gm-label" x="150" y="32">
              C
            </text>
            <circle className="gm-node gm-node--feat" cx="150" cy="108" r="11" />
            <text className="gm-label" x="150" y="112">
              F
            </text>
            <text className="gm-tag" x="168" y="16">
              main
            </text>
            <text className="gm-tag gm-tag--feat" x="168" y="126">
              feature
            </text>
          </svg>
          <p className="git-motion-footnote">
            New commit <strong>M</strong> — two parents, join stays in the graph.
          </p>
        </div>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">
        git merge feature &nbsp;·&nbsp; git merge --no-ff feature
      </div>
    </>,
  );
}

function MergeConflictAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'merge-conflict',
    animate,
    <>
      <p className="git-motion-thesis">
        Same lines, different values — Git <strong>stops and asks</strong>. You choose, stage, finish.
      </p>
      <div className="git-motion-conflict">
        <div className="git-motion-conflict-col" data-side="ours">
          <span className="git-motion-kicker">HEAD · main</span>
          <pre className="git-motion-conflict-code">{`wip_limit = 5
workers = 4`}</pre>
        </div>
        <div className="git-motion-conflict-mid">
          <span className="git-motion-conflict-vs">same line</span>
          <div className="git-motion-conflict-markers">
            <code>{'<<<<<<<'}</code>
            <code>=======</code>
            <code>{'>>>>>>>'}</code>
          </div>
          <span className="git-motion-conflict-vs">you decide</span>
        </div>
        <div className="git-motion-conflict-col" data-side="theirs">
          <span className="git-motion-kicker">feature</span>
          <pre className="git-motion-conflict-code">{`wip_limit = 8
[wip] soft_cap`}</pre>
        </div>
      </div>
      <div className="git-motion-conflict-result">
        <span className="git-motion-kicker">resolved tip</span>
        <pre className="git-motion-conflict-code git-motion-conflict-code--ok">{`wip_limit = 5
workers = 4
[wip] soft_cap`}</pre>
        <small>keep production limit · keep feature section · no markers</small>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">
        edit → git add → git commit &nbsp;|&nbsp; git merge --abort
      </div>
    </>,
  );
}

function RebaseReplayAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'rebase-replay',
    animate,
    <>
      <p className="git-motion-thesis">
        Set your commits aside, move onto <strong>today&apos;s main</strong>, replay them — new
        parents, <strong>new SHAs</strong>.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Behind main</li>
        <li data-step="2">Replay onto tip</li>
        <li data-step="3">Linear · new hashes</li>
      </ol>
      <div className="git-motion-rebase-scene">
        <svg className="git-motion-svg git-motion-svg--wide" viewBox="0 0 460 210" role="img">
          <title>Rebase replays commits onto current main</title>
          {/* Always-on spine: older main + today's tip (the "behind" setup) */}
          <g className="gm-phase-base">
            <line className="gm-edge" x1="40" y1="52" x2="120" y2="52" />
            <line className="gm-edge gm-edge--main" x1="120" y1="52" x2="200" y2="52" />
            <line className="gm-edge gm-edge--main" x1="200" y1="52" x2="280" y2="52" />
            <circle className="gm-node gm-node--base" cx="40" cy="52" r="13" />
            <text className="gm-label" x="40" y="57">
              M0
            </text>
            <circle className="gm-node gm-node--base" cx="120" cy="52" r="13" />
            <text className="gm-label" x="120" y="57">
              M1
            </text>
            <circle className="gm-node gm-node--main" cx="200" cy="52" r="13" />
            <text className="gm-label" x="200" y="57">
              M2
            </text>
            <circle className="gm-node gm-node--main" cx="280" cy="52" r="13" />
            <text className="gm-label" x="280" y="57">
              M3
            </text>
            <text className="gm-tag" x="280" y="30">
              main tip
            </text>
          </g>
          {/* Step 1 — feature hanging off old tip (fades after replay) */}
          <g className="gm-phase-before">
            <line className="gm-edge gm-edge--feat" x1="120" y1="52" x2="200" y2="138" />
            <line className="gm-edge gm-edge--feat" x1="200" y1="138" x2="280" y2="138" />
            <circle className="gm-node gm-node--feat gm-node--old" cx="200" cy="138" r="13" />
            <text className="gm-label" x="200" y="143">
              A
            </text>
            <circle className="gm-node gm-node--feat gm-node--old" cx="280" cy="138" r="13" />
            <text className="gm-label" x="280" y="143">
              B
            </text>
            <text className="gm-tag gm-tag--feat" x="302" y="142">
              feature
            </text>
            <text className="gm-caption gm-phase-1-only" x="200" y="178">
              branched from M1 · main moved on
            </text>
          </g>
          {/* Step 2 — replay arcs (active while replaying) */}
          <g className="gm-phase-diverge">
            <path
              className="gm-replay-arc"
              d="M 280 138 C 320 110, 340 78, 360 52"
              fill="none"
            />
            <path
              className="gm-replay-arc gm-replay-arc--2"
              d="M 280 138 C 345 118, 395 78, 420 52"
              fill="none"
            />
            <text className="gm-caption gm-caption--accent gm-phase-2-only" x="340" y="108">
              replaying patches…
            </text>
          </g>
          {/* Steps 2–3 — new commits on tip; step-3 caption only */}
          <g className="gm-phase-join">
            <line className="gm-edge gm-edge--new" x1="280" y1="52" x2="360" y2="52" />
            <line className="gm-edge gm-edge--new" x1="360" y1="52" x2="420" y2="52" />
            <circle className="gm-node gm-node--new" cx="360" cy="52" r="13" />
            <text className="gm-label" x="360" y="57">
              A′
            </text>
            <circle className="gm-node gm-node--new" cx="420" cy="52" r="13" />
            <text className="gm-label" x="420" y="57">
              B′
            </text>
            <text className="gm-tag gm-tag--merge" x="360" y="30">
              feature HEAD
            </text>
            <text className="gm-caption gm-caption--accent gm-phase-3-only" x="390" y="82">
              new SHAs · same patches
            </text>
          </g>
        </svg>
        <div className="git-motion-merge-legend">
          <span>
            <i className="gm-swatch gm-swatch--base" /> main history
          </span>
          <span>
            <i className="gm-swatch gm-swatch--feat" /> old feature commits
          </span>
          <span>
            <i className="gm-swatch gm-swatch--merge" /> replayed A′ B′
          </span>
        </div>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">git rebase main</div>
    </>,
  );
}

function RebaseSquashAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'rebase-squash',
    animate,
    <>
      <p className="git-motion-thesis">
        Interactive rebase: <strong>fold noisy WIP</strong> into the commits a reviewer should see.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Noisy diary</li>
        <li data-step="2">pick / squash</li>
        <li data-step="3">Two clean stories</li>
      </ol>
      <div className="git-motion-squash">
        <div className="git-motion-squash-col gm-phase-before" data-side="before">
          <span className="git-motion-kicker">before · 5 commits</span>
          <div className="git-motion-squash-stack">
            <i data-i="1" data-verb="pick">
              wip
            </i>
            <i data-i="2" data-verb="squash">
              typo
            </i>
            <i data-i="3" data-verb="squash">
              skeleton
            </i>
            <i data-i="4" data-verb="pick">
              menu
            </i>
            <i data-i="5" data-verb="squash">
              oops
            </i>
          </div>
        </div>
        <div className="git-motion-squash-mid gm-phase-diverge">
          <span className="git-motion-squash-arrow">rebase -i</span>
          <small>pick keeps · squash folds</small>
        </div>
        <div className="git-motion-squash-col gm-phase-join" data-side="after">
          <span className="git-motion-kicker">after · 2 commits</span>
          <div className="git-motion-squash-stack git-motion-squash-stack--clean">
            <i data-i="a">Add report scaffold</i>
            <i data-i="b">Wire settings menu</i>
          </div>
        </div>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">git rebase -i main</div>
    </>,
  );
}

function CherryPickAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'cherry',
    animate,
    <>
      <p className="git-motion-thesis">
        Copy <strong>one hotfix</strong> onto the release line — leave capacity work on{' '}
        <code>main</code>.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">H on main</li>
        <li data-step="2">Pick the patch</li>
        <li data-step="3">H′ on release</li>
      </ol>
      <div className="git-motion-cherry-scene">
        <svg className="git-motion-svg git-motion-svg--wide" viewBox="0 0 460 200" role="img">
          <title>Cherry-pick copies H onto release as H prime</title>
          {/* Always-on: both branch spines */}
          <g className="gm-phase-base">
            <line className="gm-edge gm-edge--main" x1="40" y1="48" x2="140" y2="48" />
            <line className="gm-edge gm-edge--main" x1="140" y1="48" x2="240" y2="48" />
            <line className="gm-edge gm-edge--main" x1="240" y1="48" x2="340" y2="48" />
            <circle className="gm-node gm-node--base" cx="40" cy="48" r="13" />
            <text className="gm-label" x="40" y="53">
              M0
            </text>
            <circle className="gm-node gm-node--main" cx="140" cy="48" r="13" />
            <text className="gm-label" x="140" y="53">
              C1
            </text>
            <circle className="gm-node gm-node--main" cx="240" cy="48" r="13" />
            <text className="gm-label" x="240" y="53">
              C2
            </text>
            <circle className="gm-node gm-node--pick" cx="340" cy="48" r="14" />
            <text className="gm-label" x="340" y="53">
              H
            </text>
            <text className="gm-tag" x="340" y="26">
              main tip
            </text>
            <line className="gm-edge" x1="40" y1="48" x2="40" y2="148" />
            <line className="gm-edge gm-edge--feat" x1="40" y1="148" x2="160" y2="148" />
            <circle className="gm-node gm-node--feat" cx="160" cy="148" r="13" />
            <text className="gm-label" x="160" y="153">
              R1
            </text>
            <text className="gm-tag gm-tag--feat" x="40" y="128">
              release/3.4
            </text>
            <text className="gm-caption gm-phase-1-only" x="240" y="78">
              capacity · must not ship
            </text>
          </g>
          {/* Step 2 — copy arc */}
          <g className="gm-phase-diverge">
            <path
              className="gm-replay-arc gm-cherry-arc"
              d="M 340 48 C 360 90, 320 130, 280 148"
              fill="none"
            />
            <text className="gm-caption gm-caption--accent gm-phase-2-only" x="320" y="108">
              cherry-pick H…
            </text>
          </g>
          {/* Step 3 — H′ on release */}
          <g className="gm-phase-join">
            <line className="gm-edge gm-edge--new" x1="160" y1="148" x2="280" y2="148" />
            <circle className="gm-node gm-node--pick gm-node--new" cx="280" cy="148" r="14" />
            <text className="gm-label" x="280" y="153">
              H′
            </text>
            <text className="gm-tag gm-tag--merge" x="300" y="130">
              release HEAD
            </text>
            <text className="gm-caption gm-caption--accent gm-phase-3-only" x="280" y="182">
              same patch · new SHA · capacity stayed
            </text>
          </g>
        </svg>
        <div className="git-motion-merge-legend">
          <span>
            <i className="gm-swatch gm-swatch--main" /> main + capacity
          </span>
          <span>
            <i className="gm-swatch gm-swatch--feat" /> release/3.4
          </span>
          <span>
            <i className="gm-swatch gm-swatch--pick" /> hotfix H → H′
          </span>
        </div>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">
        git switch release/3.4 && git cherry-pick -x H
      </div>
    </>,
  );
}

function RevertAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'revert',
    animate,
    <>
      <p className="git-motion-thesis">
        Shared tip went bad — <strong>add a cancel commit</strong>, do not rewrite the past.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Bad tip B</li>
        <li data-step="2">git revert B</li>
        <li data-step="3">R cancels B</li>
      </ol>
      <div className="git-motion-revert-scene">
        <svg className="git-motion-svg git-motion-svg--wide" viewBox="0 0 420 170" role="img">
          <title>Revert adds a cancel commit on shared main</title>
          <g className="gm-phase-base">
            <line className="gm-edge" x1="48" y1="78" x2="140" y2="78" />
            <line className="gm-edge" x1="140" y1="78" x2="232" y2="78" />
            <circle className="gm-node gm-node--base" cx="48" cy="78" r="13" />
            <text className="gm-label" x="48" y="83">
              A
            </text>
            <circle className="gm-node gm-node--main" cx="140" cy="78" r="13" />
            <text className="gm-label" x="140" y="83">
              C
            </text>
            <circle className="gm-node gm-node--bad" cx="232" cy="78" r="14" />
            <text className="gm-label" x="232" y="83">
              B
            </text>
            <text className="gm-tag" x="232" y="54">
              main
            </text>
            <text className="gm-caption gm-phase-1-only" x="232" y="118">
              bad config · already pulled
            </text>
          </g>
          <g className="gm-phase-diverge">
            <text className="gm-caption gm-caption--accent gm-phase-2-only" x="300" y="48">
              writing opposite patch…
            </text>
          </g>
          <g className="gm-phase-join">
            <line className="gm-edge gm-edge--join" x1="232" y1="78" x2="340" y2="78" />
            <circle className="gm-node gm-node--merge" cx="340" cy="78" r="15" />
            <text className="gm-label" x="340" y="83">
              R
            </text>
            <text className="gm-tag gm-tag--merge" x="360" y="54">
              HEAD
            </text>
            <text className="gm-caption gm-caption--accent gm-phase-3-only" x="300" y="118">
              R undoes B · history stays honest
            </text>
            <text className="gm-parent-call" x="286" y="68">
              cancel
            </text>
          </g>
        </svg>
        <div className="git-motion-merge-legend">
          <span>
            <i className="gm-swatch gm-swatch--base" /> good history
          </span>
          <span>
            <i className="gm-swatch gm-swatch--bad" /> bad commit B
          </span>
          <span>
            <i className="gm-swatch gm-swatch--merge" /> revert R
          </span>
        </div>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">git revert B && git push</div>
    </>,
  );
}

function ReflogAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'reflog',
    animate,
    <>
      <p className="git-motion-thesis">
        After a hard reset the tip is gone from the branch — <strong>not from the reflog</strong>.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Tip at C3</li>
        <li data-step="2">Hard reset</li>
        <li data-step="3">Rescue via reflog</li>
      </ol>
      <div className="git-motion-reflog-scene">
        <svg className="git-motion-svg git-motion-svg--wide" viewBox="0 0 440 190" role="img">
          <title>Reflog remembers the tip after a hard reset</title>
          <g className="gm-phase-base">
            <line className="gm-edge" x1="48" y1="70" x2="150" y2="70" />
            <line className="gm-edge" x1="150" y1="70" x2="252" y2="70" />
            <circle className="gm-node gm-node--base" cx="48" cy="70" r="13" />
            <text className="gm-label" x="48" y="75">
              C1
            </text>
            <circle className="gm-node gm-node--main" cx="150" cy="70" r="13" />
            <text className="gm-label" x="150" y="75">
              C2
            </text>
            <circle className="gm-node gm-node--main gm-reflog-c3" cx="252" cy="70" r="14" />
            <text className="gm-label" x="252" y="75">
              C3
            </text>
            <text className="gm-tag gm-reflog-tip-tag gm-phase-1-only" x="252" y="46">
              HEAD
            </text>
            <text className="gm-caption gm-phase-1-only" x="200" y="108">
              afternoon of work · committed
            </text>
          </g>
          <g className="gm-phase-diverge">
            <text className="gm-tag gm-tag--feat" x="150" y="46">
              HEAD
            </text>
            <text className="gm-caption gm-caption--dim gm-phase-2-only" x="252" y="108">
              reset --hard · tip moved back
            </text>
          </g>
          <g className="gm-phase-join">
            <rect
              className="gm-reflog-net"
              x="120"
              y="128"
              width="200"
              height="42"
              rx="10"
            />
            <text className="gm-caption gm-caption--accent" x="220" y="146">
              reflog · HEAD@{'{'}1{'}'} → C3
            </text>
            <text className="gm-caption" x="220" y="162">
              git branch rescue C3
            </text>
          </g>
        </svg>
        <div className="git-motion-merge-legend">
          <span>
            <i className="gm-swatch gm-swatch--main" /> branch tip
          </span>
          <span>
            <i className="gm-swatch gm-swatch--bad" /> unreachable C3
          </span>
          <span>
            <i className="gm-swatch gm-swatch--merge" /> reflog rescue
          </span>
        </div>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">
        git reflog · git branch rescue HEAD@{'{'}1{'}'}
      </div>
    </>,
  );
}

function BisectAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'bisect',
    animate,
    <>
      <p className="git-motion-thesis">
        Known good → known bad: <strong>halve the range</strong> until one culprit remains.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Full range</li>
        <li data-step="2">Halve · probe</li>
        <li data-step="3">Culprit named</li>
      </ol>
      <div className="git-motion-bisect-scene">
        <svg className="git-motion-svg git-motion-svg--wide" viewBox="0 0 460 150" role="img">
          <title>Bisect narrows from good to the first bad commit</title>
          <g className="gm-phase-base">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const x = 40 + i * 52;
              const isGood = i === 0;
              const isBadTip = i === 7;
              return (
                <g key={i}>
                  {i < 7 ? (
                    <line
                      className="gm-edge"
                      x1={x + 14}
                      y1="70"
                      x2={x + 52 - 14}
                      y2="70"
                    />
                  ) : null}
                  <circle
                    className={`gm-node${isGood ? ' gm-node--main' : ''}${
                      isBadTip ? ' gm-node--bad' : ''
                    } gm-bisect-dot`}
                    data-i={i}
                    cx={x}
                    cy="70"
                    r="12"
                  />
                  <text className="gm-label" x={x} y="75">
                    {i + 1}
                  </text>
                </g>
              );
            })}
            <text className="gm-tag" x="40" y="46">
              good
            </text>
            <text className="gm-tag gm-tag--feat" x="404" y="46">
              bad
            </text>
            <text className="gm-caption gm-phase-1-only" x="230" y="110">
              8 commits · ~3 checks left
            </text>
          </g>
          <g className="gm-phase-diverge">
            <rect className="gm-bisect-window" x="144" y="48" width="220" height="44" rx="10" />
            <circle className="gm-bisect-probe" cx="248" cy="70" r="7" />
            <text className="gm-caption gm-caption--accent gm-phase-2-only" x="230" y="120">
              midpoint · mark good or bad
            </text>
          </g>
          <g className="gm-phase-join">
            <circle className="gm-node gm-node--bad gm-bisect-culprit" cx="300" cy="70" r="16" />
            <text className="gm-label" x="300" y="75">
              6
            </text>
            <text className="gm-caption gm-caption--accent gm-phase-3-only" x="300" y="120">
              first bad · git show
            </text>
          </g>
        </svg>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">
        git bisect start HEAD v0.9.0 · git bisect run ./scripts/smoke-check.sh
      </div>
    </>,
  );
}

function TagAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'tag',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>main</strong> keeps moving. The release tag stays on the shipped save.
      </p>
      <div className="git-motion-stage">
        <div className="git-motion-rail">
          <div className="git-motion-node" data-n="1">
            v1
          </div>
          <div className="git-motion-node" data-n="2">
            v2
          </div>
          <div className="git-motion-node git-motion-node--tagged" data-n="3">
            v3
          </div>
          <div className="git-motion-node git-motion-node--birth" data-n="4">
            v4
          </div>
        </div>
        <div className="git-motion-tag git-motion-tag--release">v4.0.0</div>
        <div className="git-motion-tag git-motion-tag--main">main</div>
      </div>
      <p className="git-motion-footnote">Tag = sticky label on v3 · main already moved to v4</p>
    </>,
  );
}

function RemotesAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'remotes',
    animate,
    <>
      <p className="git-motion-thesis">
        Fetch from the <strong>org</strong>. Push to <strong>your</strong> copy.
      </p>
      <div className="git-motion-remotes">
        <div className="git-motion-forge-node" data-side="upstream">
          <span className="git-motion-kicker">upstream</span>
          <div className="git-motion-commits">
            <i>v1</i>
            <i>v2</i>
            <i>v3</i>
          </div>
          <em>org / team repo</em>
        </div>
        <div className="git-motion-remotes-path" aria-hidden>
          <span className="git-motion-forge-flow" data-dir="clone">
            fetch
          </span>
          <span className="git-motion-forge-wire" />
        </div>
        <div className="git-motion-forge-node" data-side="local">
          <span className="git-motion-kicker">Your laptop</span>
          <div className="git-motion-commits">
            <i>v1</i>
            <i>v2</i>
            <i>v3</i>
          </div>
          <em>~/my-project</em>
        </div>
        <div className="git-motion-remotes-path" aria-hidden>
          <span className="git-motion-forge-wire" />
          <span className="git-motion-forge-flow" data-dir="push">
            push
          </span>
        </div>
        <div className="git-motion-forge-node" data-side="remote">
          <span className="git-motion-kicker">origin</span>
          <div className="git-motion-commits">
            <i>v1</i>
            <i>v2</i>
            <i>v3</i>
          </div>
          <em>your fork</em>
        </div>
      </div>
      <p className="git-motion-footnote">
        upstream → laptop (fetch) · laptop → origin (push)
      </p>
    </>,
  );
}

function HostsAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'hosts',
    animate,
    <>
      <p className="git-motion-thesis">
        Same Git on <strong>Your laptop</strong>. Different hosts for the shared remote + website.
      </p>
      <div className="git-motion-hosts">
        <div className="git-motion-hosts-laptop">
          <span className="git-motion-kicker">Your laptop</span>
          <div className="git-motion-commits">
            <i>v1</i>
            <i>v2</i>
            <i>v3</i>
          </div>
          <em>full history locally</em>
        </div>
        <div className="git-motion-hosts-grid">
          <div className="git-motion-hosts-card" data-host="github">
            <strong>GitHub</strong>
            <em>Community · PRs · Actions</em>
          </div>
          <div className="git-motion-hosts-card" data-host="gitlab">
            <strong>GitLab</strong>
            <em>DevOps suite · MRs · CI</em>
          </div>
          <div className="git-motion-hosts-card" data-host="bitbucket">
            <strong>Bitbucket</strong>
            <em>Atlassian · Jira links</em>
          </div>
        </div>
      </div>
      <p className="git-motion-footnote">
        Plus Azure Repos, Codeberg, self-hosted Gitea/Forgejo, and more
      </p>
    </>,
  );
}

function HookAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'hook',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>commit-msg</strong> checks the subject before the save is created.
      </p>
      <div className="git-motion-compare git-motion-compare--hook">
        <div className="git-motion-panel git-motion-panel--before">
          <span className="git-motion-kicker">Blocked</span>
          <code className="git-motion-hook-msg">tweak cache</code>
          <p className="git-motion-footnote">No ticket prefix → hook exits 1</p>
        </div>
        <div className="git-motion-pivot">
          <span className="git-motion-pivot-line" />
          <span className="git-motion-pivot-badge">hook</span>
          <span className="git-motion-pivot-line" />
        </div>
        <div className="git-motion-panel git-motion-panel--after">
          <span className="git-motion-kicker">Allowed</span>
          <code className="git-motion-hook-msg git-motion-hook-msg--ok">TKT-42 Adjust cache</code>
          <p className="git-motion-footnote">Matches TKT-42… → save is created</p>
        </div>
      </div>
    </>,
  );
}

function StashAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'stash',
    animate,
    <>
      <p className="git-motion-thesis">
        Park unfinished work, switch context, come back later — <strong>clean tree</strong> in between.
      </p>
      <ol className="git-motion-steps" aria-hidden>
        <li data-step="1">Messy WIP</li>
        <li data-step="2">Stash shelf</li>
        <li data-step="3">Clean for hotfix</li>
      </ol>
      <div className="git-motion-stash">
        <div className="git-motion-stash-col gm-phase-before" data-side="before">
          <span className="git-motion-kicker">working tree</span>
          <div className="git-motion-bin" data-bin="messy">
            <span>feat/coupons</span>
            <em className="git-motion-chip git-motion-chip--ghost">coupon wip</em>
            <small>dirty · cannot switch</small>
          </div>
        </div>
        <div className="git-motion-stash-mid gm-phase-diverge">
          <span className="git-motion-squash-arrow">stash push</span>
          <div className="git-motion-bin git-motion-bin--shelf" data-bin="shelf">
            <span>stash@{'{'}0{'}'}</span>
            <em className="git-motion-chip">coupon wip</em>
            <small>named shelf</small>
          </div>
        </div>
        <div className="git-motion-stash-col gm-phase-join" data-side="after">
          <span className="git-motion-kicker">after stash</span>
          <div className="git-motion-bin" data-bin="clean">
            <span>working tree</span>
            <em className="git-motion-empty">clean</em>
            <small>ready for hotfix</small>
          </div>
        </div>
      </div>
      <div className="git-motion-cmd git-motion-cmd--center">
        git stash push -m &quot;coupon wip&quot; · git stash pop
      </div>
    </>,
  );
}

const ANIM_MAP: Record<
  ReadingFigureAnimation,
  (props: { animate: boolean }) => JSX.Element
> = {
  'git-origin': OriginAnim,
  'git-three-trees': ThreeTreesAnim,
  'git-clone-push': ClonePushAnim,
  'git-branch-pointer': BranchPointerAnim,
  'git-amend': AmendAnim,
  'git-merge-vs-rebase': MergeVsRebaseAnim,
  'git-merge-commit': MergeCommitAnim,
  'git-fast-forward': FastForwardAnim,
  'git-merge-conflict': MergeConflictAnim,
  'git-rebase-replay': RebaseReplayAnim,
  'git-rebase-squash': RebaseSquashAnim,
  'git-reflog': ReflogAnim,
  'git-bisect': BisectAnim,
  'git-stash': StashAnim,
  'git-cherry-pick': CherryPickAnim,
  'git-revert': RevertAnim,
  'git-tag': TagAnim,
  'git-remotes': RemotesAnim,
  'git-hook': HookAnim,
  'git-hosts': HostsAnim,
  ...LINUX_ANIM_MAP,
};

export function ReadingFigureAnimationView({
  id,
  animate = true,
}: {
  id: ReadingFigureAnimation;
  animate?: boolean;
}): JSX.Element | null {
  const Comp = ANIM_MAP[id];
  if (!Comp) return null;
  return <Comp animate={animate} />;
}
