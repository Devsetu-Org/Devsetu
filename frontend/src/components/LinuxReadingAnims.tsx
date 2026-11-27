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
};

export type LinuxReadingFigureAnimation = Extract<
  ReadingFigureAnimation,
  keyof typeof LINUX_ANIM_MAP
>;
