import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PlayChapter, PlayChapterLab } from '../constants/playCatalog';
import { MINORS_PATH } from '../constants/minors';
import type { ChallengePublic } from '../types/domain';
import { displayChallengeTitle } from '../utils/challengeTitle';
import { IconCoins, IconLock } from './ChromeIcons';
import { StatusBookIcon } from './TrackStatusIcons';

export interface ChapterReadingLink {
  href: string;
  title: string;
}

function isPlaceholderLab(
  lab: PlayChapterLab,
): lab is Extract<PlayChapterLab, { placeholder: true }> {
  return 'placeholder' in lab && lab.placeholder === true;
}

function isMinorLab(
  lab: PlayChapterLab,
): lab is Extract<PlayChapterLab, { minorId: string; chapterId: string }> {
  return 'minorId' in lab && 'chapterId' in lab;
}

function labTitle(lab: PlayChapterLab, challenge: ChallengePublic | null): string {
  if (isPlaceholderLab(lab) || isMinorLab(lab)) return lab.title;
  return displayChallengeTitle(lab.challengeId, challenge?.title);
}

function labTokens(challenge: ChallengePublic | null): number {
  if (typeof challenge?.tokens === 'number' && Number.isFinite(challenge.tokens)) {
    return challenge.tokens;
  }
  return 10;
}

function minorHref(lab: Extract<PlayChapterLab, { minorId: string; chapterId: string }>): string {
  const base = `${MINORS_PATH}/${lab.minorId}/${lab.chapterId}?lang=go`;
  return lab.taskId ? `${base}&task=${encodeURIComponent(lab.taskId)}` : base;
}

interface PlayChapterShelfProps {
  chapters: PlayChapter[];
  byId: Map<string, ChallengePublic>;
  search: string;
  onSelectChallenge: (challenge: ChallengePublic) => void | Promise<void>;
  /** @deprecated Visibility letters no longer show on chapter rows. */
  showVisibilityMarks?: boolean;
  readingFor?: (chapter: PlayChapter) => ChapterReadingLink | null;
}

export default function PlayChapterShelf({
  chapters,
  byId,
  search,
  onSelectChallenge,
  readingFor,
}: PlayChapterShelfProps): JSX.Element {
  const navigate = useNavigate();
  const q = search.trim().toLowerCase();

  const chapterViews = useMemo(() => {
    let index = 1;
    return chapters.map((chapter) => {
      const reading = readingFor?.(chapter) ?? null;
      const labs = chapter.labs.map((lab) => {
        if (isMinorLab(lab)) {
          const row = {
            key: `${lab.minorId}/${lab.chapterId}/${lab.taskId || lab.title}`,
            index,
            title: lab.title,
            free: Boolean(lab.free),
            challenge: null as ChallengePublic | null,
            placeholder: false,
            minorHref: minorHref(lab),
          };
          index += 1;
          return row;
        }
        const row = isPlaceholderLab(lab)
          ? {
              key: `${chapter.id}:${lab.title}`,
              index,
              title: lab.title,
              free: false,
              challenge: null as ChallengePublic | null,
              placeholder: true,
              minorHref: null as string | null,
            }
          : {
              key: lab.challengeId,
              index,
              title: labTitle(lab, byId.get(lab.challengeId) || null),
              free: Boolean(lab.free),
              challenge: byId.get(lab.challengeId) || null,
              placeholder: false,
              minorHref: null as string | null,
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
              lab.minorHref,
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
                const isMinor = Boolean(lab.minorHref);
                /* Pack labs open the brief even when not finalized (Start stays gated). */
                const openable =
                  isMinor || (Boolean(challenge) && !challenge?.locked && !lab.placeholder);
                const billingLocked = Boolean(challenge?.locked);
                const locked = !isMinor && (billingLocked || lab.placeholder || !challenge);
                const solved = Boolean(challenge?.solved);
                const showFree = lab.free && !billingLocked;
                const tokens = labTokens(challenge);

                return (
                  <li key={lab.key}>
                    <button
                      type="button"
                      className={`play-chapter-lab${openable ? '' : ' is-disabled'}${locked ? ' is-locked' : ''}${solved ? ' is-solved' : ''}`}
                      disabled={!openable}
                      title={
                        isMinor
                          ? 'Open in coding workspace'
                          : lab.placeholder || !challenge
                            ? 'Lab description coming soon'
                            : challenge.locked
                              ? 'Subscribe to unlock this lab'
                              : !challenge.finalized
                                ? 'Open the brief — live cluster start comes later'
                                : undefined
                      }
                      onClick={() => {
                        if (lab.minorHref) {
                          navigate(lab.minorHref);
                          return;
                        }
                        if (openable && challenge) void onSelectChallenge(challenge);
                      }}
                    >
                      {[
                        <span key="index" className="play-chapter-lab-index" aria-hidden>
                          {lab.index}
                        </span>,
                        <span key="title" className="play-chapter-lab-title">
                          <span className="play-chapter-lab-title-text" title={lab.title}>
                            {lab.title}
                          </span>
                          {locked ? (
                            <span className="play-chapter-lab-lock" aria-label="Locked">
                              <IconLock size={13} />
                            </span>
                          ) : null}
                        </span>,
                        <span
                          key="meta"
                          className={`play-chapter-lab-meta${showFree && !solved ? ' play-chapter-lab-meta--free' : ''}`}
                        >
                          {showFree && !solved ? (
                            <span className="play-chapter-lab-free">Free</span>
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
                        </span>,
                      ]}
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
