import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { PlayChapter, PlayChapterLab } from '../constants/playCatalog';
import type { ChallengePublic } from '../types/domain';
import { visibilityMark } from '../constants/roles';
import { IconCoins, IconLock } from './ChromeIcons';
import { StatusBookIcon, StatusCheckIcon } from './TrackStatusIcons';

export interface ChapterReadingLink {
  href: string;
  title: string;
}

function isPlaceholderLab(
  lab: PlayChapterLab,
): lab is Extract<PlayChapterLab, { placeholder: true }> {
  return 'placeholder' in lab && lab.placeholder;
}

function labTitle(lab: PlayChapterLab, challenge: ChallengePublic | null): string {
  if (isPlaceholderLab(lab)) return lab.title;
  return challenge?.title || lab.challengeId;
}

function labTokens(challenge: ChallengePublic | null): number {
  if (typeof challenge?.tokens === 'number' && Number.isFinite(challenge.tokens)) {
    return challenge.tokens;
  }
  return 10;
}

interface PlayChapterShelfProps {
  chapters: PlayChapter[];
  byId: Map<string, ChallengePublic>;
  search: string;
  onSelectChallenge: (challenge: ChallengePublic) => void | Promise<void>;
  showVisibilityMarks?: boolean;
  readingFor?: (chapter: PlayChapter) => ChapterReadingLink | null;
}

export default function PlayChapterShelf({
  chapters,
  byId,
  search,
  onSelectChallenge,
  showVisibilityMarks = false,
  readingFor,
}: PlayChapterShelfProps): JSX.Element {
  const q = search.trim().toLowerCase();

  const chapterViews = useMemo(() => {
    let index = 1;
    return chapters.map((chapter) => {
      const reading = readingFor?.(chapter) ?? null;
      const labs = chapter.labs.map((lab) => {
        const row =
          isPlaceholderLab(lab)
            ? {
                key: `${chapter.id}:${lab.title}`,
                index,
                title: lab.title,
                free: false,
                challenge: null as ChallengePublic | null,
                placeholder: true,
              }
            : {
                key: lab.challengeId,
                index,
                title: labTitle(lab, byId.get(lab.challengeId) || null),
                free: Boolean(lab.free),
                challenge: byId.get(lab.challengeId) || null,
                placeholder: false,
              };
        index += 1;
        return row;
      });
      const filtered = q
        ? labs.filter((lab) => {
            const hay = [
              String(lab.index),
              lab.title,
              chapter.title,
              chapter.kicker,
              reading?.title,
              lab.challenge?.id,
              ...(lab.challenge?.tags || []),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return hay.includes(q);
          })
        : labs;
      return { chapter, reading, labs: filtered, labCount: labs.length };
    });
  }, [chapters, byId, q, readingFor]);

  const visible = chapterViews.filter((c) => c.labs.length > 0);
  if (visible.length === 0) {
    return <div className="play-problems-empty">No labs match these filters.</div>;
  }

  return (
    <section className="play-chapter-shelf" aria-label="Spark chapters">
      <div className="play-chapter-grid">
        {visible.map(({ chapter, reading, labs, labCount }) => (
          <article key={chapter.id} className="play-chapter-card">
            <header className="play-chapter-card-head">
              <span className="play-chapter-kicker">{chapter.kicker}</span>
              <div className="play-chapter-title-row">
                <h3 className="play-chapter-title">{chapter.title}</h3>
                {reading ? (
                  <Link
                    className="play-chapter-read"
                    to={reading.href}
                    aria-label={reading.title}
                    title={reading.title}
                  >
                    <StatusBookIcon className="play-chapter-read-icon" title="" />
                  </Link>
                ) : null}
              </div>
              <p className="play-chapter-meta">
                {labCount} lab{labCount === 1 ? '' : 's'}
                {reading ? ' · 1 reading' : ''}
              </p>
            </header>
            <ol className="play-chapter-labs">
              {labs.map((lab) => {
                const challenge = lab.challenge;
                /* Pack labs open the brief even when not finalized (Start stays gated). */
                const openable = Boolean(challenge) && !challenge?.locked && !lab.placeholder;
                const billingLocked = Boolean(challenge?.locked);
                const locked = billingLocked || lab.placeholder || !challenge;
                const solved = Boolean(challenge?.solved);
                const showFree = lab.free && !billingLocked;
                const tokens = labTokens(challenge);
                const vis = challenge ? visibilityMark(challenge.visibleTo) : null;

                return (
                  <li key={lab.key}>
                    <button
                      type="button"
                      className={`play-chapter-lab${openable ? '' : ' is-disabled'}${locked ? ' is-locked' : ''}${solved ? ' is-solved' : ''}`}
                      disabled={!openable}
                      title={
                        lab.placeholder || !challenge
                          ? 'Lab description coming soon'
                          : challenge.locked
                            ? 'Subscribe to unlock this lab'
                            : !challenge.finalized
                              ? 'Open the brief — live cluster start comes later'
                              : undefined
                      }
                      onClick={() => {
                        if (openable && challenge) void onSelectChallenge(challenge);
                      }}
                    >
                      <span className="play-chapter-lab-index" aria-hidden>
                        {lab.index}
                      </span>
                      <span className="play-chapter-lab-title">
                        {lab.title}
                        {locked ? (
                          <span className="play-chapter-lab-lock" aria-label="Locked">
                            <IconLock size={13} />
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`play-chapter-lab-meta${showVisibilityMarks && vis ? ' play-chapter-lab-meta--staff' : ''}`}
                      >
                        {showFree && !solved ? (
                          <span className="play-chapter-lab-free">Free</span>
                        ) : solved ? (
                          <StatusCheckIcon className="play-chapter-lab-check" title="Solved" />
                        ) : (
                          <span className="play-chapter-lab-free-slot" aria-hidden />
                        )}
                        {showVisibilityMarks && vis ? (
                          <span
                            className={`play-visibility-badge play-visibility-badge--${vis.key}`}
                            title={vis.label}
                            aria-label={vis.label}
                          >
                            {vis.letter}
                          </span>
                        ) : null}
                        {challenge ? (
                          <span className="play-problem-tokens" title={`${tokens} tokens`}>
                            <span className="play-problem-tokens-coin">
                              <IconCoins size={14} />
                            </span>
                            {tokens}
                          </span>
                        ) : (
                          <span className="play-problem-tokens play-problem-tokens--empty" aria-hidden>
                            —
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
