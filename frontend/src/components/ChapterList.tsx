import React from 'react';
import { Link } from 'react-router-dom';
import type { ProjectModule } from '../constants/projects';
import { IconClock, IconLock } from './ChromeIcons';
import { StatusCheckIcon } from './TrackStatusIcons';

export type ChapterListAccess = 'open' | 'locked' | 'soon';

export interface ChapterListProps {
  chapters: ProjectModule[];
  /** Whether a chapter can be opened right now (legacy; prefer accessFor). */
  isOpen?: (chapter: ProjectModule) => boolean;
  /**
   * open = linkable, locked = authored but previous chapter not cleared,
   * soon = not available yet.
   */
  accessFor?: (chapter: ProjectModule) => ChapterListAccess;
  /** Route of an open chapter. */
  hrefFor: (chapter: ProjectModule) => string;
  /** Replaces "Open" on a chapter the learner has started, e.g. "2/4" or "Done". */
  progressFor?: (chapter: ProjectModule) => string | null;
  /** Passed chapter — emerald mark like a solved track lab. */
  isDoneFor?: (chapter: ProjectModule) => boolean;
  /** Shown on locked rows, e.g. "Finish Memtable first". */
  lockReasonFor?: (chapter: ProjectModule) => string | null;
}

function accessOf(
  chapter: ProjectModule,
  isOpen: ChapterListProps['isOpen'],
  accessFor: ChapterListProps['accessFor'],
): ChapterListAccess {
  if (accessFor) return accessFor(chapter);
  return isOpen?.(chapter) ? 'open' : 'soon';
}

type StatusKind = 'done' | 'locked' | 'up-next' | null;

/** Map the existing text label to an icon; Open / Read / Soon show nothing. */
function statusKind(stateLabel: string, done: boolean, access: ChapterListAccess): StatusKind {
  if (done || stateLabel === 'Done') return 'done';
  if (access === 'locked' || stateLabel === 'Locked') return 'locked';
  if (stateLabel === 'Up next' || /^\d+\s*\/\s*\d+$/.test(stateLabel)) return 'up-next';
  return null;
}

function StatusIcon({ kind }: { kind: Exclude<StatusKind, null> }): JSX.Element {
  // Titles live on the wrapper (aria-label / title); icons are decorative.
  if (kind === 'done') return <StatusCheckIcon className="project-milestone-state-icon" title="" />;
  if (kind === 'locked') return <IconLock size={16} />;
  return <IconClock size={16} />;
}

/** Numbered chapter list shared by majors and chaptered minors. */
export default function ChapterList({
  chapters,
  isOpen,
  accessFor,
  hrefFor,
  progressFor,
  isDoneFor,
  lockReasonFor,
}: ChapterListProps): JSX.Element {
  const firstNumber = chapters[0]?.kind === 'reading' ? 0 : 1;
  return (
    <section className="project-milestones" aria-label="Chapters">
      <h2 className="project-milestones-heading">Chapters</h2>
      <ol className="project-milestones-list">
        {chapters.map((chapter, index) => {
          const access = accessOf(chapter, isOpen, accessFor);
          const done = Boolean(isDoneFor?.(chapter));
          const openLabel = chapter.kind === 'reading' ? 'Read' : 'Open';
          const stateLabel = done
            ? 'Done'
            : access === 'open'
              ? progressFor?.(chapter) ?? openLabel
              : access === 'locked'
                ? 'Locked'
                : 'Soon';
          const kind = statusKind(stateLabel, done, access);
          const upNext = kind === 'up-next';
          const reason = access === 'locked' ? lockReasonFor?.(chapter) : null;
          const body = (
            <>
              <span className="project-milestone-ord">
                {String(index + firstNumber).padStart(2, '0')}
              </span>
              <span className="project-milestone-copy">
                <span className="project-milestone-label">{chapter.label}</span>
                <span className="project-milestone-sub">
                  {reason || chapter.subtitle}
                </span>
              </span>
              {kind ? (
                <span
                  className={`project-milestone-state${
                    done ? ' is-done' : ''
                  }${upNext ? ' is-up-next' : ''}${
                    access === 'locked' ? ' is-locked' : ''
                  }`}
                  role="img"
                  aria-label={stateLabel}
                  title={stateLabel}
                >
                  <span className="project-milestone-state-glyph" aria-hidden="true">
                    <StatusIcon kind={kind} />
                  </span>
                </span>
              ) : (
                <span className="project-milestone-state is-empty" aria-hidden="true" />
              )}
            </>
          );
          const rowClass = `project-milestone${
            done ? ' is-done' : ''
          }${access === 'open' ? ' is-open' : ''}${
            access === 'locked' ? ' is-locked' : access === 'soon' ? ' is-planned' : ''
          }`;
          return (
            <li key={chapter.id}>
              {access === 'open' ? (
                <Link to={hrefFor(chapter)} className={rowClass}>
                  {body}
                </Link>
              ) : (
                <div className={rowClass} aria-disabled="true" title={reason || undefined}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
