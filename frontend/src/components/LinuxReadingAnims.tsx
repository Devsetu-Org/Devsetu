import React from 'react';
import type { ReadingFigureAnimation } from '../constants/k8sReadings';

/** Linux blog figures — same dark primer / brand-green language as Git; motion only when it teaches. */

function shell(id: string, animate: boolean, body: React.ReactNode): JSX.Element {
  return (
    <div
      className={`git-motion linux-motion linux-motion--${id}${animate ? '' : ' git-motion--still'}`}
      aria-hidden
    >
      {body}
    </div>
  );
}

/* —— B0 —— */

function TerminalShellKernelAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'stack',
    animate,
    <>
      <p className="git-motion-thesis">
        Three layers: <strong>terminal → shell → kernel</strong>
      </p>
      <div className="linux-motion-stack">
        <div className="linux-motion-layer" data-layer="1">
          <span className="git-motion-kicker">Terminal</span>
          <strong>the window</strong>
          <em>shows text · sends keystrokes</em>
        </div>
        <div className="linux-motion-bridge" data-bridge="1">
          <i />
          <span>you type</span>
        </div>
        <div className="linux-motion-layer" data-layer="2">
          <span className="git-motion-kicker">Shell</span>
          <strong>reads the line</strong>
          <em>prompt · parse · find program</em>
        </div>
        <div className="linux-motion-bridge" data-bridge="2">
          <i />
          <span>asks kernel</span>
        </div>
        <div className="linux-motion-layer" data-layer="3">
          <span className="git-motion-kicker">Kernel</span>
          <strong>does the work</strong>
          <em>CPU · files · network</em>
        </div>
        <span className="linux-motion-cmd-chip" data-chip="flow">
          ls
        </span>
      </div>
      <p className="git-motion-footnote">
        The panel beside this blog is a terminal. Bash (or zsh) is the shell inside it.
      </p>
    </>,
  );
}

const FS_NODES = [
  { path: '/etc', job: 'config' },
  { path: '/home', job: 'people' },
  { path: '/var', job: 'logs' },
  { path: '/opt', job: 'apps' },
  { path: '/tmp', job: 'temp' },
  { path: '/usr', job: 'commands' },
  { path: '/dev', job: 'devices' },
  { path: '/proc', job: 'live view' },
] as const;

function FilesystemTreeAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'fs-tree',
    animate,
    <>
      <p className="git-motion-thesis">
        One tree from <strong>/</strong> — every folder has a job
      </p>
      <div className="linux-motion-tree">
        <div className="linux-motion-tree-root">
          <span>/</span>
          <em>root</em>
        </div>
        <div className="linux-motion-tree-trunk" />
        <div className="linux-motion-tree-branches">
          {FS_NODES.map((node, i) => (
            <div
              key={node.path}
              className="linux-motion-tree-node"
              data-i={String(i + 1)}
              style={{ ['--i' as string]: i }}
            >
              <strong>{node.path}</strong>
              <em>{node.job}</em>
            </div>
          ))}
        </div>
      </div>
      <p className="git-motion-footnote">A second disk mounts inside this tree — you still see one hierarchy.</p>
    </>,
  );
}

function AbsoluteVsRelativeAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'paths',
    animate,
    <>
      <p className="git-motion-thesis">
        Same file, two routes: <strong>absolute from /</strong> · <strong>relative from where you stand</strong>
      </p>
      <div className="linux-motion-paths">
        <div className="linux-motion-path-panel" data-side="abs">
          <span className="git-motion-kicker">Absolute</span>
          <div className="linux-motion-path-trail" data-kind="abs">
            <span data-seg="1">/</span>
            <span data-seg="2">var</span>
            <span data-seg="3">log</span>
            <span className="linux-motion-path-file" data-seg="4">
              docks.log
            </span>
          </div>
          <code className="linux-motion-path-code">/var/log/docks.log</code>
          <p className="git-motion-footnote">Works from any folder</p>
        </div>
        <div className="linux-motion-path-pivot">
          <span className="git-motion-pivot-badge">same file</span>
        </div>
        <div className="linux-motion-path-panel" data-side="rel">
          <span className="git-motion-kicker">Relative · from /var/lib</span>
          <div className="linux-motion-path-trail" data-kind="rel">
            <span className="linux-motion-path-here" data-seg="1">
              /var/lib
            </span>
            <span data-seg="2">..</span>
            <span data-seg="3">log</span>
            <span className="linux-motion-path-file" data-seg="4">
              docks.log
            </span>
          </div>
          <code className="linux-motion-path-code">../log/docks.log</code>
          <p className="git-motion-footnote">Changes if you move</p>
        </div>
      </div>
    </>,
  );
}

/* —— B1 —— */

function GlobExpansionAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'glob',
    animate,
    <>
      <p className="git-motion-thesis">
        You write a pattern. The <strong>shell</strong> writes the list. The command never sees the star.
      </p>
      <div className="linux-motion-flow">
        <div className="linux-motion-flow-step" data-step="1">
          <span className="git-motion-kicker">You type</span>
          <code className="linux-motion-path-code">cp *.jpg photos/</code>
          <em>pattern with a star</em>
        </div>
        <div className="linux-motion-flow-arrow">
          <i />
          <span>shell expands</span>
        </div>
        <div className="linux-motion-flow-step" data-step="2">
          <span className="git-motion-kicker">Shell expands</span>
          <div className="linux-motion-chip-row">
            <span className="git-motion-chip" data-f="1">
              fox.jpg
            </span>
            <span className="git-motion-chip" data-f="2">
              owl.jpg
            </span>
            <span className="git-motion-chip" data-f="3">
              deer.jpg
            </span>
          </div>
          <em>finished names</em>
        </div>
        <div className="linux-motion-flow-arrow">
          <i />
          <span>command runs</span>
        </div>
        <div className="linux-motion-flow-step" data-step="3">
          <span className="git-motion-kicker">cp sees</span>
          <code className="linux-motion-path-code">cp fox.jpg owl.jpg deer.jpg photos/</code>
          <em>no star left</em>
        </div>
      </div>
    </>,
  );
}

function FindFunnelAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'funnel',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>find</strong> walks a tree: every file is checked; only matches come out
      </p>
      <div className="linux-motion-funnel">
        <div className="linux-motion-funnel-in">
          <span className="git-motion-kicker">~/projects</span>
          <div className="linux-motion-chip-row">
            <span className="git-motion-chip" data-keep="0">
              tiny.txt
            </span>
            <span className="git-motion-chip" data-keep="1">
              big.bin
            </span>
            <span className="git-motion-chip" data-keep="0">
              notes.md
            </span>
            <span className="git-motion-chip" data-keep="1">
              dump.raw
            </span>
            <span className="git-motion-chip" data-keep="0">
              old/
            </span>
          </div>
        </div>
        <div className="linux-motion-funnel-filters">
          <span data-f="1">-type f</span>
          <span data-f="2">-size +1M</span>
          <span data-f="3">-mtime -7</span>
        </div>
        <div className="linux-motion-funnel-out">
          <span className="git-motion-kicker">matches</span>
          <div className="linux-motion-chip-row">
            <span className="git-motion-chip git-motion-chip--accent" data-out="1">
              big.bin
            </span>
            <span className="git-motion-chip git-motion-chip--accent" data-out="2">
              dump.raw
            </span>
          </div>
        </div>
      </div>
      <p className="git-motion-footnote">
        Example: find ~/projects -type f -size +1M -mtime -7
      </p>
    </>,
  );
}

function FindExecAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'find-exec',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>{'{}'}</strong> is replaced by each match — print first, act second
      </p>
      <div className="linux-motion-exec">
        <div className="linux-motion-exec-list">
          <span className="git-motion-kicker">find results</span>
          <span className="git-motion-chip" data-m="1">
            a.raw
          </span>
          <span className="git-motion-chip" data-m="2">
            b.raw
          </span>
          <span className="git-motion-chip" data-m="3">
            c.raw
          </span>
        </div>
        <div className="linux-motion-exec-mid">
          <span className="linux-motion-exec-template">mv {'{}'} rejects/</span>
          <span className="linux-motion-flow-arrow linux-motion-flow-arrow--solo">
            <i />
          </span>
        </div>
        <div className="linux-motion-exec-list linux-motion-exec-list--out">
          <span className="git-motion-kicker">one command each</span>
          <code data-r="1">mv a.raw rejects/</code>
          <code data-r="2">mv b.raw rejects/</code>
          <code data-r="3">mv c.raw rejects/</code>
        </div>
      </div>
    </>,
  );
}

/* —— B2 —— */

function LessWindowAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'less',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>less</strong> shows a window onto the file — it does not load or change the whole thing
      </p>
      <div className="linux-motion-less">
        <div className="linux-motion-less-file">
          <span className="git-motion-kicker">app.log · tall file</span>
          <div className="linux-motion-less-lines">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} data-line={i + 1}>
                L{String(i + 1).padStart(2, '0')} · …
              </span>
            ))}
            <div className="linux-motion-less-viewport">
              <em>Space / b · /search · G · F</em>
            </div>
          </div>
        </div>
      </div>
    </>,
  );
}

function ViModesAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'vi',
    animate,
    <>
      <p className="git-motion-thesis">
        Normal runs <strong>commands</strong>. Insert types <strong>text</strong>. Esc always gets you back.
      </p>
      <div className="linux-motion-vi">
        <div className="linux-motion-vi-panel" data-mode="normal">
          <span className="git-motion-kicker">Normal</span>
          <strong>keys are commands</strong>
          <div className="linux-motion-chip-row">
            <span className="git-motion-chip">j / k</span>
            <span className="git-motion-chip">dd</span>
            <span className="git-motion-chip">:wq</span>
          </div>
          <em>i or o → Insert</em>
        </div>
        <div className="linux-motion-path-pivot">
          <span className="git-motion-pivot-badge">Esc</span>
        </div>
        <div className="linux-motion-vi-panel" data-mode="insert">
          <span className="git-motion-kicker">Insert</span>
          <strong>keys are text</strong>
          <div className="linux-motion-chip-row">
            <span className="git-motion-chip git-motion-chip--accent">max_retries = 5</span>
          </div>
          <em>type freely · Esc back</em>
        </div>
      </div>
    </>,
  );
}

function GrepSieveAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'grep',
    animate,
    <>
      <p className="git-motion-thesis">
        Lines go in. Only the <strong>matching</strong> lines come out. The file is unchanged.
      </p>
      <div className="linux-motion-sieve">
        <div className="linux-motion-sieve-in">
          <span className="git-motion-kicker">app.log</span>
          <span data-hit="0">ok ready</span>
          <span data-hit="1">ERROR timeout</span>
          <span data-hit="0">ok retry</span>
          <span data-hit="1">ERROR disk</span>
          <span data-hit="0">ok done</span>
        </div>
        <div className="linux-motion-sieve-mid">
          <span className="git-motion-pivot-badge">grep ERROR</span>
        </div>
        <div className="linux-motion-sieve-out">
          <span className="git-motion-kicker">stdout</span>
          <span data-hit="1">ERROR timeout</span>
          <span data-hit="1">ERROR disk</span>
        </div>
      </div>
    </>,
  );
}

function RegexReadAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'regex',
    animate,
    <>
      <p className="git-motion-thesis">
        Read a pattern from the left. Each piece matches <strong>one part</strong> of the line.
      </p>
      <div className="linux-motion-regex">
        <code className="linux-motion-regex-pattern">
          <span data-p="1">^</span>
          <span data-p="2">2026</span>
          <span data-p="3">-</span>
          <span data-p="4">[0-9]{'{2}'}</span>
          <span data-p="5">-</span>
          <span data-p="6">[0-9]{'{2}'}</span>
        </code>
        <div className="linux-motion-regex-labels">
          <span data-p="1">start</span>
          <span data-p="2">literal</span>
          <span data-p="3">-</span>
          <span data-p="4">2 digits</span>
          <span data-p="5">-</span>
          <span data-p="6">2 digits</span>
        </div>
        <p className="git-motion-footnote">Example: lines that start with a date · grep -E &apos;^2026-…&apos;</p>
      </div>
    </>,
  );
}

/* —— B3 —— */

function PipeFlowAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'pipe',
    animate,
    <>
      <p className="git-motion-thesis">
        Normal output moves to the next command. <strong>Errors stay on the screen.</strong>
      </p>
      <div className="linux-motion-pipe">
        <div className="linux-motion-pipe-stage" data-s="1">
          <strong>grep</strong>
          <em>keep lines</em>
        </div>
        <div className="linux-motion-pipe-join">
          <span className="linux-motion-pipe-packet" />
          <span>|</span>
        </div>
        <div className="linux-motion-pipe-stage" data-s="2">
          <strong>cut</strong>
          <em>keep column</em>
        </div>
        <div className="linux-motion-pipe-join">
          <span className="linux-motion-pipe-packet" data-delay="1" />
          <span>|</span>
        </div>
        <div className="linux-motion-pipe-stage" data-s="3">
          <strong>sort</strong>
          <em>order lines</em>
        </div>
      </div>
      <div className="linux-motion-pipe-err">
        <span className="git-motion-kicker">stderr</span>
        <em>typos and warnings stay here — they do not enter the next command</em>
      </div>
    </>,
  );
}

/* —— B4 —— */

function UserGroupsAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'groups',
    animate,
    <>
      <p className="git-motion-thesis">
        One login · <strong>one primary group</strong> · extra groups for the team
      </p>
      <div className="linux-motion-groups">
        <div className="linux-motion-groups-user">
          <span className="git-motion-kicker">Your login</span>
          <strong>you</strong>
          <em>one account</em>
        </div>
        <div className="linux-motion-groups-arrows" aria-hidden>
          <span data-a="1">primary</span>
          <span data-a="2">extra</span>
        </div>
        <div className="linux-motion-groups-cols">
          <div className="linux-motion-groups-card" data-kind="primary">
            <span className="git-motion-kicker">Primary</span>
            <strong>same-name group</strong>
            <em>from /etc/passwd</em>
          </div>
          <div className="linux-motion-groups-card" data-kind="extra">
            <span className="git-motion-kicker">Extra</span>
            <strong>team</strong>
            <em>added later</em>
          </div>
        </div>
        <div className="linux-motion-groups-sys">
          <span className="git-motion-kicker">Already on the box</span>
          <div className="linux-motion-chip-row">
            <span className="git-motion-chip">adm · read logs</span>
            <span className="git-motion-chip">sudo · any root command</span>
          </div>
        </div>
      </div>
      <p className="git-motion-footnote">Create a group for a team. adm and sudo are already there.</p>
    </>,
  );
}

function PermBitsAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'perms',
    animate,
    <>
      <p className="git-motion-thesis">
        Which three letters count? Linux picks <strong>one</strong> trio — it does not add them.
      </p>
      <div className="linux-motion-perms">
        <div className="linux-motion-perms-row" data-r="1">
          <span className="linux-motion-perms-who">the owner</span>
          <span className="linux-motion-flow-arrow">→</span>
          <code className="linux-motion-perms-bits">rw-</code>
          <em>owner trio</em>
        </div>
        <div className="linux-motion-perms-row" data-r="2">
          <span className="linux-motion-perms-who">in the group</span>
          <span className="linux-motion-flow-arrow">→</span>
          <code className="linux-motion-perms-bits">r--</code>
          <em>group trio</em>
        </div>
        <div className="linux-motion-perms-row" data-r="3">
          <span className="linux-motion-perms-who">everyone else</span>
          <span className="linux-motion-flow-arrow">→</span>
          <code className="linux-motion-perms-bits">---</code>
          <em>others trio</em>
        </div>
      </div>
      <p className="git-motion-footnote">Owner first · then group · then others. Only one set applies.</p>
    </>,
  );
}

/* —— B5 —— */

function ProcessPidAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'pid',
    animate,
    <>
      <p className="git-motion-thesis">
        A running program is a <strong>process</strong> with a number (PID) and a parent (PPID).
      </p>
      <div className="linux-motion-pid">
        <div className="linux-motion-pid-node" data-n="shell">
          <span className="git-motion-kicker">Your shell</span>
          <strong>PID 2401</strong>
          <em>prompt waiting</em>
        </div>
        <div className="linux-motion-pid-edge" aria-hidden>
          starts →
        </div>
        <div className="linux-motion-pid-node" data-n="job">
          <span className="git-motion-kicker">Background job</span>
          <strong>PID 2510</strong>
          <em>PPID 2401</em>
        </div>
      </div>
      <p className="git-motion-footnote">ps and top list these numbers so you can find or stop the right job.</p>
    </>,
  );
}

function SignalEscalationAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'signal',
    animate,
    <>
      <p className="git-motion-thesis">
        Ask first (<strong>TERM</strong>), force only if it ignores you (<strong>KILL</strong>).
      </p>
      <div className="linux-motion-signal">
        <div className="linux-motion-signal-step" data-s="1">
          <span className="git-motion-kicker">1 · polite</span>
          <code>kill PID</code>
          <em>SIGTERM · clean exit</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-signal-step" data-s="2">
          <span className="git-motion-kicker">2 · wait</span>
          <strong>check again</strong>
          <em>ps · still there?</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-signal-step" data-s="3">
          <span className="git-motion-kicker">3 · force</span>
          <code>kill -9 PID</code>
          <em>SIGKILL · no cleanup</em>
        </div>
      </div>
      <p className="git-motion-footnote">-9 cannot be caught. Prefer TERM so the process can flush and close files.</p>
    </>,
  );
}

/* —— B6 —— */

function JobControlAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'jobs',
    animate,
    <>
      <p className="git-motion-thesis">
        Foreground holds the prompt. <strong>Background</strong> frees it — same shell still owns the job.
      </p>
      <div className="linux-motion-jobs">
        <div className="linux-motion-jobs-panel" data-side="fg">
          <span className="git-motion-kicker">Foreground</span>
          <code>./report.sh</code>
          <em>prompt waits</em>
        </div>
        <div className="linux-motion-path-pivot">
          <span className="git-motion-pivot-badge">Ctrl-Z · bg</span>
        </div>
        <div className="linux-motion-jobs-panel" data-side="bg">
          <span className="git-motion-kicker">Background</span>
          <code>./report.sh &amp;</code>
          <em>prompt returns · jobs lists it</em>
        </div>
      </div>
      <p className="git-motion-footnote">jobs / fg / bg only know jobs started in this shell.</p>
    </>,
  );
}

function NohupDetachAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'nohup',
    animate,
    <>
      <p className="git-motion-thesis">
        Logout sends hang-up. <strong>nohup</strong> (or tmux) keeps the work alive.
      </p>
      <div className="linux-motion-compare linux-motion-compare--nohup">
        <div className="git-motion-panel git-motion-panel--before">
          <span className="git-motion-kicker">Plain &amp;</span>
          <strong>dies on logout</strong>
          <em>SIGHUP stops the job</em>
        </div>
        <div className="git-motion-pivot">
          <span className="git-motion-pivot-line" />
          <span className="git-motion-pivot-badge">survive</span>
          <span className="git-motion-pivot-line" />
        </div>
        <div className="git-motion-panel git-motion-panel--after">
          <span className="git-motion-kicker">nohup · tmux</span>
          <strong>keeps running</strong>
          <em>log out · come back later</em>
        </div>
      </div>
      <p className="git-motion-footnote">nohup for fire-and-forget · tmux when you need the session back.</p>
    </>,
  );
}

/* —— B7 —— */

function SystemdUnitAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'systemd',
    animate,
    <>
      <p className="git-motion-thesis">
        A <strong>unit file</strong> tells systemd what to start, restart, and watch.
      </p>
      <div className="linux-motion-systemd">
        <div className="linux-motion-systemd-card" data-s="1">
          <span className="git-motion-kicker">Unit</span>
          <code>app.service</code>
          <em>ExecStart · Restart</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-systemd-card" data-s="2">
          <span className="git-motion-kicker">systemd</span>
          <strong>supervisor</strong>
          <em>start · stop · enable</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-systemd-card" data-s="3">
          <span className="git-motion-kicker">Process</span>
          <strong>your app</strong>
          <em>PID under the unit</em>
        </div>
      </div>
      <p className="git-motion-footnote">systemctl status shows Active and the main PID in one place.</p>
    </>,
  );
}

function JournalFlowAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'journal',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>journalctl</strong> reads the unit’s log stream — not a random text file you hunt for.
      </p>
      <div className="linux-motion-journal">
        <div className="linux-motion-journal-unit">
          <span className="git-motion-kicker">Unit</span>
          <code>app.service</code>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-journal-stream">
          <span className="git-motion-kicker">Journal</span>
          <div className="linux-motion-journal-lines">
            <i>started</i>
            <i>listening :8080</i>
            <i className="is-err">failed health check</i>
          </div>
        </div>
      </div>
      <p className="git-motion-footnote">journalctl -u app.service -f follows new lines as they appear.</p>
    </>,
  );
}

/* —— B8 —— */

function CronScheduleAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'cron',
    animate,
    <>
      <p className="git-motion-thesis">
        Five time fields · then the command. Cron fires when the clock matches.
      </p>
      <div className="linux-motion-cron">
        <div className="linux-motion-cron-fields">
          <span data-f="1">min</span>
          <span data-f="2">hour</span>
          <span data-f="3">dom</span>
          <span data-f="4">mon</span>
          <span data-f="5">dow</span>
        </div>
        <code className="linux-motion-path-code">15 2 * * * /opt/bin/nightly-report</code>
        <em>02:15 every day · run that path</em>
      </div>
      <p className="git-motion-footnote">* means every. Put the full path — cron’s PATH is short.</p>
    </>,
  );
}

function LogrotateAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'logrotate',
    animate,
    <>
      <p className="git-motion-thesis">
        Big logs get <strong>rotated</strong>: rename → compress → keep a few → delete old.
      </p>
      <div className="linux-motion-logrotate">
        <div className="linux-motion-logrotate-step" data-s="1">
          <strong>app.log</strong>
          <em>growing</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-logrotate-step" data-s="2">
          <strong>app.log.1</strong>
          <em>yesterday</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-logrotate-step" data-s="3">
          <strong>.gz</strong>
          <em>compressed</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-logrotate-step" data-s="4">
          <strong>drop</strong>
          <em>past retain</em>
        </div>
      </div>
      <p className="git-motion-footnote">logrotate runs on a schedule so disks do not fill with one endless file.</p>
    </>,
  );
}

/* —— B9 —— */

function PackageInstallAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'pkg',
    animate,
    <>
      <p className="git-motion-thesis">
        The package manager finds the package, pulls dependencies, then installs.
      </p>
      <div className="linux-motion-pkg">
        <div className="linux-motion-pkg-step" data-s="1">
          <span className="git-motion-kicker">Ask</span>
          <code>apt install …</code>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-pkg-step" data-s="2">
          <span className="git-motion-kicker">Resolve</span>
          <strong>deps</strong>
          <em>what else is needed</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-pkg-step" data-s="3">
          <span className="git-motion-kicker">Install</span>
          <strong>on disk</strong>
          <em>binaries · configs</em>
        </div>
      </div>
      <p className="git-motion-footnote">Update the index first so you are not installing yesterday’s catalog.</p>
    </>,
  );
}

function PinningAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'pin',
    animate,
    <>
      <p className="git-motion-thesis">
        A <strong>pin</strong> holds a version so a routine upgrade does not surprise you.
      </p>
      <div className="linux-motion-compare linux-motion-compare--pin">
        <div className="git-motion-panel git-motion-panel--before">
          <span className="git-motion-kicker">Unpinned</span>
          <strong>1.4 → 1.5</strong>
          <em>upgrade jumps ahead</em>
        </div>
        <div className="git-motion-pivot">
          <span className="git-motion-pivot-line" />
          <span className="git-motion-pivot-badge">hold</span>
          <span className="git-motion-pivot-line" />
        </div>
        <div className="git-motion-panel git-motion-panel--after">
          <span className="git-motion-kicker">Pinned</span>
          <strong>stay on 1.4</strong>
          <em>until you unpin</em>
        </div>
      </div>
      <p className="git-motion-footnote">Pin when production must stay on a known build.</p>
    </>,
  );
}

/* —— B10 —— */

function DfDuAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'disk',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>df</strong> asks the filesystem. <strong>du</strong> weighs a folder tree.
      </p>
      <div className="linux-motion-disk">
        <div className="linux-motion-disk-card" data-side="df">
          <span className="git-motion-kicker">df</span>
          <strong>/  72% full</strong>
          <em>whole mount</em>
        </div>
        <div className="linux-motion-path-pivot">
          <span className="git-motion-pivot-badge">vs</span>
        </div>
        <div className="linux-motion-disk-card" data-side="du">
          <span className="git-motion-kicker">du</span>
          <strong>/var/log  4.2G</strong>
          <em>this directory</em>
        </div>
      </div>
      <p className="git-motion-footnote">Disk full? df finds the mount · du finds which folder ate it.</p>
    </>,
  );
}

function TarFlowAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'tar',
    animate,
    <>
      <p className="git-motion-thesis">
        <strong>tar</strong> packs many files into one archive — and unpacks them again.
      </p>
      <div className="linux-motion-tar">
        <div className="linux-motion-chip-row">
          <span className="git-motion-chip">a.conf</span>
          <span className="git-motion-chip">b.py</span>
          <span className="git-motion-chip">notes/</span>
        </div>
        <div className="linux-motion-flow-arrow linux-motion-flow-arrow--solo">pack →</div>
        <code className="linux-motion-path-code">release.tgz</code>
        <div className="linux-motion-flow-arrow linux-motion-flow-arrow--solo">← extract</div>
        <div className="linux-motion-chip-row">
          <span className="git-motion-chip">same tree</span>
        </div>
      </div>
      <p className="git-motion-footnote">Create with cf / czf · list with tf · extract with xf.</p>
    </>,
  );
}

/* —— B11 —— */

function ListenConnectAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'net',
    animate,
    <>
      <p className="git-motion-thesis">
        One side <strong>listens</strong> on a port. The other <strong>connects</strong> to that address.
      </p>
      <div className="linux-motion-net">
        <div className="linux-motion-net-node" data-side="server">
          <span className="git-motion-kicker">Server</span>
          <strong>:8080</strong>
          <em>LISTEN</em>
        </div>
        <div className="linux-motion-net-wire" aria-hidden>
          <span />
        </div>
        <div className="linux-motion-net-node" data-side="client">
          <span className="git-motion-kicker">Client</span>
          <strong>connect</strong>
          <em>open a session</em>
        </div>
      </div>
      <p className="git-motion-footnote">ss / netstat show who is listening before you blame the firewall.</p>
    </>,
  );
}

function DnsPathAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'dns',
    animate,
    <>
      <p className="git-motion-thesis">
        Name → address → path. DNS is only the first hop.
      </p>
      <div className="linux-motion-dns">
        <div className="linux-motion-dns-step" data-s="1">
          <strong>name</strong>
          <em>api.example</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-dns-step" data-s="2">
          <strong>IP</strong>
          <em>10.0.4.12</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-dns-step" data-s="3">
          <strong>route</strong>
          <em>which interface</em>
        </div>
      </div>
      <p className="git-motion-footnote">Wrong DNS looks like “down” even when the service is fine.</p>
    </>,
  );
}

/* —— B12 —— */

function SshKeysAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'sshkeys',
    animate,
    <>
      <p className="git-motion-thesis">
        A key pair: <strong>private stays home</strong> · public goes on the server.
      </p>
      <div className="linux-motion-sshkeys">
        <div className="linux-motion-sshkeys-card" data-side="local">
          <span className="git-motion-kicker">Your laptop</span>
          <code>id_ed25519</code>
          <em>private · never share</em>
        </div>
        <div className="linux-motion-flow-arrow">public →</div>
        <div className="linux-motion-sshkeys-card" data-side="remote">
          <span className="git-motion-kicker">Server</span>
          <code>authorized_keys</code>
          <em>who may log in</em>
        </div>
      </div>
      <p className="git-motion-footnote">ssh-keygen creates the pair · ssh-copy-id (or paste) installs the public half.</p>
    </>,
  );
}

function SshLoginAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'sshlogin',
    animate,
    <>
      <p className="git-motion-thesis">
        SSH proves you hold the private key — <strong>no password</strong> on the wire.
      </p>
      <div className="linux-motion-sshlogin">
        <div className="linux-motion-sshlogin-step" data-s="1">
          <strong>hello</strong>
          <em>client connects</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-sshlogin-step" data-s="2">
          <strong>challenge</strong>
          <em>server asks</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-sshlogin-step" data-s="3">
          <strong>signed</strong>
          <em>private key answers</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-sshlogin-step" data-s="4">
          <strong>shell</strong>
          <em>you’re in</em>
        </div>
      </div>
      <p className="git-motion-footnote">Wrong permissions on ~/.ssh often look like “key rejected.”</p>
    </>,
  );
}

/* —— B13 —— */

function ScriptFlowAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'script',
    animate,
    <>
      <p className="git-motion-thesis">
        A script is a file the shell runs top to bottom — shebang · steps · exit.
      </p>
      <div className="linux-motion-script">
        <div className="linux-motion-script-step" data-s="1">
          <code>#!/bin/bash</code>
          <em>which shell</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-script-step" data-s="2">
          <strong>commands</strong>
          <em>one after another</em>
        </div>
        <div className="linux-motion-flow-arrow">→</div>
        <div className="linux-motion-script-step" data-s="3">
          <strong>exit code</strong>
          <em>0 ok · else fail</em>
        </div>
      </div>
      <p className="git-motion-footnote">chmod +x so you can run ./script.sh · set -e stops on the first error.</p>
    </>,
  );
}

function BashQuotesAnim({ animate }: { animate: boolean }): JSX.Element {
  return shell(
    'quotes',
    animate,
    <>
      <p className="git-motion-thesis">
        Quotes decide whether the shell <strong>splits</strong> or keeps one word.
      </p>
      <div className="linux-motion-compare linux-motion-compare--quotes">
        <div className="git-motion-panel git-motion-panel--before">
          <span className="git-motion-kicker">Unquoted</span>
          <code>$name</code>
          <em>spaces split into many args</em>
        </div>
        <div className="git-motion-pivot">
          <span className="git-motion-pivot-line" />
          <span className="git-motion-pivot-badge">vs</span>
          <span className="git-motion-pivot-line" />
        </div>
        <div className="git-motion-panel git-motion-panel--after">
          <span className="git-motion-kicker">Quoted</span>
          <code>&quot;$name&quot;</code>
          <em>one argument · safe</em>
        </div>
      </div>
      <p className="git-motion-footnote">Always quote variables that might hold spaces or empty values.</p>
    </>,
  );
}

export const LINUX_ANIM_MAP: {
  'linux-terminal-shell-kernel': typeof TerminalShellKernelAnim;
  'linux-filesystem-tree': typeof FilesystemTreeAnim;
  'linux-absolute-vs-relative': typeof AbsoluteVsRelativeAnim;
  'linux-glob-expansion': typeof GlobExpansionAnim;
  'linux-find-funnel': typeof FindFunnelAnim;
  'linux-find-exec': typeof FindExecAnim;
  'linux-less-window': typeof LessWindowAnim;
  'linux-vi-modes': typeof ViModesAnim;
  'linux-grep-sieve': typeof GrepSieveAnim;
  'linux-regex-read': typeof RegexReadAnim;
  'linux-pipe-flow': typeof PipeFlowAnim;
  'linux-user-groups': typeof UserGroupsAnim;
  'linux-perm-bits': typeof PermBitsAnim;
  'linux-process-pid': typeof ProcessPidAnim;
  'linux-signal-escalation': typeof SignalEscalationAnim;
  'linux-job-control': typeof JobControlAnim;
  'linux-nohup-detach': typeof NohupDetachAnim;
  'linux-systemd-unit': typeof SystemdUnitAnim;
  'linux-journal-flow': typeof JournalFlowAnim;
  'linux-cron-schedule': typeof CronScheduleAnim;
  'linux-logrotate': typeof LogrotateAnim;
  'linux-package-install': typeof PackageInstallAnim;
  'linux-pinning': typeof PinningAnim;
  'linux-df-du': typeof DfDuAnim;
  'linux-tar-flow': typeof TarFlowAnim;
  'linux-listen-connect': typeof ListenConnectAnim;
  'linux-dns-path': typeof DnsPathAnim;
  'linux-ssh-keys': typeof SshKeysAnim;
  'linux-ssh-login': typeof SshLoginAnim;
  'linux-script-flow': typeof ScriptFlowAnim;
  'linux-bash-quotes': typeof BashQuotesAnim;
} = {
  'linux-terminal-shell-kernel': TerminalShellKernelAnim,
  'linux-filesystem-tree': FilesystemTreeAnim,
  'linux-absolute-vs-relative': AbsoluteVsRelativeAnim,
  'linux-glob-expansion': GlobExpansionAnim,
  'linux-find-funnel': FindFunnelAnim,
  'linux-find-exec': FindExecAnim,
  'linux-less-window': LessWindowAnim,
  'linux-vi-modes': ViModesAnim,
  'linux-grep-sieve': GrepSieveAnim,
  'linux-regex-read': RegexReadAnim,
  'linux-pipe-flow': PipeFlowAnim,
  'linux-user-groups': UserGroupsAnim,
  'linux-perm-bits': PermBitsAnim,
  'linux-process-pid': ProcessPidAnim,
  'linux-signal-escalation': SignalEscalationAnim,
  'linux-job-control': JobControlAnim,
  'linux-nohup-detach': NohupDetachAnim,
  'linux-systemd-unit': SystemdUnitAnim,
  'linux-journal-flow': JournalFlowAnim,
  'linux-cron-schedule': CronScheduleAnim,
  'linux-logrotate': LogrotateAnim,
  'linux-package-install': PackageInstallAnim,
  'linux-pinning': PinningAnim,
  'linux-df-du': DfDuAnim,
  'linux-tar-flow': TarFlowAnim,
  'linux-listen-connect': ListenConnectAnim,
  'linux-dns-path': DnsPathAnim,
  'linux-ssh-keys': SshKeysAnim,
  'linux-ssh-login': SshLoginAnim,
  'linux-script-flow': ScriptFlowAnim,
  'linux-bash-quotes': BashQuotesAnim,
};

export type LinuxReadingFigureAnimation = Extract<
  ReadingFigureAnimation,
  keyof typeof LINUX_ANIM_MAP
>;
