import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import LinuxBlogPlayground from '../components/LinuxBlogPlayground';
import { useAppState } from '../context/AppStateContext';
import { useIsNarrowUi } from '../hooks/useMediaQuery';
import {
  K8S_BLOG_STAMP_SRC,
  type K8sReadingCodeBlock,
  type K8sReadingFlow,
  type K8sReadingSection,
  type K8sReadingTable,
} from '../constants/k8sReadings';
import { READING_TRACKS, type ReadingTrackId } from '../constants/readingTracks';
import { PRICING_PATH } from '../constants/pricing';
import ReadOnlyCodePane from '../components/ReadOnlyCodePane';
import type { ChallengePublic } from '../types/domain';

/** True when the loaded catalog shows this user can open paid Linux labs. */
function hasLinuxTrackAccess(challenges: ChallengePublic[]): boolean {
  const linux = challenges.filter((c) => c.paidTrack === 'linux');
  return linux.length > 0 && linux.every((c) => !c.locked);
}

function RichTextInline({ text }: { text: string }): JSX.Element {
  // Order matters: **`code`** / *`code`* before **bold** / *italic*, then `code`.
  const parts = text
    .split(/(\*\*`[^`]+`\*\*|\*`[^`]+`\*|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**`') && part.endsWith('`**') && part.length >= 6) {
          return (
            <strong key={i}>
              <code>{part.slice(3, -3)}</code>
            </strong>
          );
        }
        if (part.startsWith('*`') && part.endsWith('`*') && part.length >= 4) {
          return (
            <em key={i}>
              <code>{part.slice(2, -2)}</code>
            </em>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i}>
              {part
                .slice(2, -2)
                .split(/(`[^`]+`)/g)
                .filter(Boolean)
                .map((seg, j) =>
                  seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2
                    ? <code key={j}>{seg.slice(1, -1)}</code>
                    : <React.Fragment key={j}>{seg}</React.Fragment>,
                )}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (
          part.length >= 3 &&
          part.startsWith('*') &&
          part.endsWith('*') &&
          !part.startsWith('**')
        ) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/** Light inline **bold**, *italic*, `code`, and [label](url) links for reading copy. */
export function RichText({ text }: { text: string }): JSX.Element {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let linkIndex = 0;
  for (const match of text.matchAll(linkRe)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push(
        <RichTextInline key={`t-${last}`} text={text.slice(last, index)} />,
      );
    }
    const href = match[2].trim();
    nodes.push(
      <a
        key={`a-${linkIndex++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="spark-primer-inline-link"
      >
        {match[1]}
      </a>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(<RichTextInline key={`t-${last}`} text={text.slice(last)} />);
  }
  if (nodes.length === 0) {
    return <RichTextInline text={text} />;
  }
  return <>{nodes}</>;
}

function readingCodePath(language: string, filename?: string): string {
  if (filename) return filename;
  const lang = (language || 'plaintext').toLowerCase();
  if (lang === 'yaml' || lang === 'yml') return 'snippet.yaml';
  if (lang === 'shell' || lang === 'bash' || lang === 'sh') return 'snippet.sh';
  if (lang === 'json') return 'snippet.json';
  if (lang === 'csv') return 'snippet.csv';
  if (lang === 'text' || lang === 'plaintext') return 'snippet.txt';
  return `snippet.${lang}`;
}

function readingCodeLanguage(language: string): string {
  const lang = (language || 'plaintext').toLowerCase();
  if (lang === 'yml') return 'yaml';
  if (lang === 'text' || lang === 'plaintext') return 'plaintext';
  if (lang === 'sh' || lang === 'bash') return 'shell';
  return lang;
}

/** Column-align short CSV samples for readable IDE-style panes. */
function formatCsvLight(raw: string): string {
  const lines = raw.replace(/\n+$/g, '').split('\n');
  const rows = lines.map((line) => line.split(',').map((cell) => cell.trim()));
  const colCount = Math.max(0, ...rows.map((row) => row.length));
  const widths = Array.from({ length: colCount }, (_, i) =>
    Math.max(0, ...rows.map((row) => (row[i] ?? '').length)),
  );
  return rows
    .map((row) => row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(',  '))
    .join('\n');
}

/** Monaco-highlighted fence — same look as lab Solution / MarkdownProse. */
function ReadingCodeBlock({ block }: { block: K8sReadingCodeBlock }): JSX.Element {
  const langKey = (block.language || 'plaintext').toLowerCase();
  const language = readingCodeLanguage(block.language);
  const showToolbar = langKey === 'csv' || Boolean(block.filename);
  const toolbarLabel = block.filename ?? (langKey === 'csv' ? 'csv' : '');
  let content = block.code.replace(/\n+$/g, '');
  if (langKey === 'csv') {
    content = formatCsvLight(content);
  }
  return (
    <div
      className={`spark-primer-code-block markdown-code-block${showToolbar ? '' : ' markdown-code-block--no-toolbar'}`}
    >
      {showToolbar ? (
        <div className="markdown-code-toolbar">
          <span className="markdown-code-lang">{toolbarLabel}</span>
        </div>
      ) : null}
      <ReadOnlyCodePane
        path={readingCodePath(block.language, block.filename)}
        content={content}
        language={language}
        className="markdown-code-pane"
        expand
      />
    </div>
  );
}

function ReadingTable({ table }: { table: K8sReadingTable }): JSX.Element {
  return (
    <div className="spark-primer-table-wrap">
      <table className="spark-primer-table">
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th key={i}>
                <RichText text={h || '\u00a0'} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>
                  <RichText text={cell || '\u00a0'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadingFlow({ flow }: { flow: K8sReadingFlow }): JSX.Element {
  return (
    <div className="spark-primer-flow">
      <p className="spark-primer-flow-title">{flow.title}</p>
      <ol className="spark-primer-flow-steps">
        {flow.steps.map((step, i) => (
          <li key={`${flow.title}-${i}`} className="spark-primer-flow-step">
            <span className="spark-primer-flow-chip">
              <RichText text={step} />
            </span>
            {i < flow.steps.length - 1 ? (
              <span className="spark-primer-flow-arrow" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ReadingSection({
  section,
}: {
  section: K8sReadingSection;
}): JSX.Element | null {
  if (
    !section.title &&
    section.body.length === 0 &&
    !section.subsections?.length &&
    !section.code &&
    !section.codes?.length &&
    !section.flows?.length
  ) {
    return null;
  }

  const figureClass = [
    'spark-primer-figure',
    section.figure?.compact ? 'spark-primer-figure--compact' : '',
    section.figure?.flush ? 'spark-primer-figure--flush' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section id={section.id} className="spark-primer-section">
      {section.title ? <h2 className="spark-primer-section-title">{section.title}</h2> : null}
      {section.body.map((paragraph, bi) => (
        <p key={`${section.id}-body-${bi}`} className="spark-primer-copy">
          <RichText text={paragraph} />
        </p>
      ))}
      {section.subsections?.map((subsection) => {
        const subAnchor = `${section.id}--${subsection.id}`;
        return (
          <div key={subsection.id} id={subAnchor} className="spark-primer-subsection">
            <h3 className="spark-primer-subsection-title">{subsection.title}</h3>
            {subsection.body.map((paragraph, bi) => (
              <p key={`${subAnchor}-body-${bi}`} className="spark-primer-copy">
                <RichText text={paragraph} />
              </p>
            ))}
            {subsection.code ? <ReadingCodeBlock block={subsection.code} /> : null}
          </div>
        );
      })}
      {section.table ? <ReadingTable table={section.table} /> : null}
      {section.bullets && section.bullets.length > 0 ? (
        <ul className="spark-primer-example-list spark-primer-bullets">
          {section.bullets.map((item, bi) => (
            <li key={`${section.id}-bullet-${bi}`}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      ) : null}
      {section.quote ? (
        <blockquote className="spark-primer-quote">
          <RichText text={section.quote} />
        </blockquote>
      ) : null}
      {section.flows?.map((flow) => (
        <ReadingFlow key={flow.title} flow={flow} />
      ))}
      {section.codes?.map((block, ci) => (
        <ReadingCodeBlock key={block.code.slice(0, 40) + String(ci)} block={block} />
      ))}
      {section.figure ? (
        <figure className={figureClass}>
          <img src={section.figure.image} alt={section.figure.imageAlt} loading="lazy" />
          <figcaption>{section.figure.caption}</figcaption>
        </figure>
      ) : null}
      {section.after?.map((paragraph, ai) => (
        <p key={`${section.id}-after-${ai}`} className="spark-primer-copy">
          <RichText text={paragraph} />
        </p>
      ))}
      {section.code ? <ReadingCodeBlock block={section.code} /> : null}
      {section.tableAfter ? <ReadingTable table={section.tableAfter} /> : null}
      {section.callout ? (
        <aside
          className={`markdown-callout markdown-callout--${section.callout.kind} spark-primer-callout`}
          aria-label={section.callout.title}
        >
          <p className="markdown-callout-label">{section.callout.title}</p>
          {section.callout.body.map((paragraph) => (
            <p key={paragraph.slice(0, 56)}>
              <RichText text={paragraph} />
            </p>
          ))}
        </aside>
      ) : null}
    </section>
  );
}

const PLAYGROUND_PCT_KEY = 'devsetu.linuxBlog.playgroundPct.v2';
/** Blog share when the playground first opens. Matches a wide reading column and a terminal beside it. */
const DEFAULT_BLOG_PCT = 60;

function readPlaygroundPct(): number {
  try {
    const n = Number(sessionStorage.getItem(PLAYGROUND_PCT_KEY));
    if (Number.isFinite(n)) return Math.min(68, Math.max(32, n));
  } catch {
    /* private mode */
  }
  return DEFAULT_BLOG_PCT;
}

export default function K8sReadingPage({
  trackId = 'kubernetes',
}: {
  trackId?: ReadingTrackId;
}): JSX.Element {
  const { readingSlug } = useParams<{ readingSlug: string }>();
  const navigate = useNavigate();
  const { authMode, challenges, challengesError, onRequestLogin } = useAppState();
  const isNarrow = useIsNarrowUi();
  const track = READING_TRACKS[trackId];
  const reading = useMemo(() => track.getReading(readingSlug), [track, readingSlug]);
  const playgroundAvailable = trackId === 'linux' && !isNarrow;
  const linuxLabsKnown = challenges.some((c) => c.paidTrack === 'linux');
  const playgroundSubscribed = hasLinuxTrackAccess(challenges);
  const needsSubscription = authMode === 'interviewer' && linuxLabsKnown && !playgroundSubscribed;
  const checkingAccess = authMode === 'interviewer' && !linuxLabsKnown && !challengesError;
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [blogPct, setBlogPct] = useState(readPlaygroundPct);
  const splitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!playgroundAvailable || (linuxLabsKnown && !playgroundSubscribed)) setPlaygroundOpen(false);
  }, [playgroundAvailable, linuxLabsKnown, playgroundSubscribed]);

  const openPlayground = (): void => {
    if (authMode !== 'interviewer') {
      onRequestLogin(window.location.pathname, {
        title: 'Sign in to open the playground',
        body: 'The playground is a real Linux machine beside this blog. It opens for a Linux or DevOps Engineer subscription. Sign in, then open it again.',
      });
      return;
    }
    if (linuxLabsKnown && !playgroundSubscribed) {
      navigate(PRICING_PATH);
      return;
    }
    setPlaygroundOpen(true);
  };

  const onSplitPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const shell = splitRef.current;
    if (!shell) return;
    const move = (ev: PointerEvent): void => {
      const rect = shell.getBoundingClientRect();
      if (rect.width <= 0) return;
      const next = Math.min(68, Math.max(32, ((ev.clientX - rect.left) / rect.width) * 100));
      setBlogPct(next);
      try {
        sessionStorage.setItem(PLAYGROUND_PCT_KEY, String(Math.round(next)));
      } catch {
        /* private mode */
      }
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!reading || !readingSlug) {
    return <Navigate to={track.labsPath} replace />;
  }

  const tocSections = reading.sections.filter((s) => s.title);
  const split = playgroundAvailable && playgroundOpen;

  return (
    <div
      ref={splitRef}
      className={`app-page spark-primer-page${split ? ' spark-primer-page--playground' : ''}`}
    >
    <article
      className={`spark-primer-notebook${reading.showBlogStamp ? ' spark-primer-notebook--stamped' : ''}${split ? ' spark-primer-notebook--split' : ''}`}
      style={split ? { flexBasis: `${blogPct}%` } : undefined}
    >
      {reading.showBlogStamp ? (
        <img
          className="spark-primer-blog-stamp"
          src={K8S_BLOG_STAMP_SRC}
          alt="The DevSetu Blog"
          width={88}
          height={88}
          decoding="async"
        />
      ) : null}
      <header className="spark-primer-header">
        <p className="spark-primer-crumb">
          <Link to="/track">Tracks</Link>
          <span aria-hidden> / </span>
          <Link to="/track/devops-engineer">DevOps Engineer</Link>
          <span aria-hidden> / </span>
          <Link to={track.labsPath}>{track.label}</Link>
          <span aria-hidden> / </span>
          {reading.trackId}
        </p>
        {reading.eyebrow ? (
          <p className="spark-primer-eyebrow">{reading.eyebrow}</p>
        ) : null}
        <h1 className="spark-primer-title">{reading.title}</h1>
        <p className="spark-primer-lede">
          <RichText text={reading.lede} />
        </p>
        {playgroundAvailable && !split ? (
          <div className="linux-blog-playground-launch">
            <div>
              <p className="linux-blog-playground-launch-title">
                {needsSubscription ? 'Subscribe to try it while you read' : 'Try it while you read'}
              </p>
              <p>
                {needsSubscription
                  ? 'A Linux or DevOps Engineer subscription opens a terminal beside this blog.'
                  : 'Open a terminal beside this blog and try the commands as you read.'}
              </p>
            </div>
            <button type="button" onClick={openPlayground} disabled={checkingAccess}>
              {needsSubscription ? 'Subscribe' : 'Open playground'}
            </button>
          </div>
        ) : null}
      </header>

      <nav className="spark-primer-toc" aria-label="On this page">
        {tocSections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.title}
          </a>
        ))}
        <a href="#takeaways">Takeaways</a>
        {reading.relatedLabs.length > 0 ? <a href="#related">Related labs</a> : null}
        {reading.followOn ? <a href="#next">{reading.followOn.title}</a> : null}
      </nav>

      {reading.sections.map((section) => (
        <ReadingSection key={section.id} section={section} />
      ))}

      <section id="takeaways" className="spark-primer-section">
        <p className="spark-primer-section-eyebrow">Takeaways</p>
        <h2 className="spark-primer-section-title">What to keep</h2>
        <ul className="spark-primer-example-list spark-primer-bullets">
          {reading.takeaways.map((item) => (
            <li key={item}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      </section>

      {reading.relatedLabs.length > 0 ? (
        <section id="related" className="spark-primer-section spark-primer-next">
          <p className="spark-primer-section-eyebrow">On the track</p>
          <h2 className="spark-primer-section-title">Related labs</h2>
          {(() => {
            const relatedIntro =
              reading.relatedLabsIntro !== undefined
                ? reading.relatedLabsIntro
                : track.relatedLabsIntro;
            return relatedIntro.trim() ? (
              <p className="spark-primer-copy">
                <RichText text={relatedIntro} />
              </p>
            ) : null;
          })()}
          <ul className="spark-primer-links">
            {reading.relatedLabs.map((lab) => (
              <li key={lab.challengeId}>
                <Link to={`${track.labsPath}?start=${encodeURIComponent(lab.challengeId)}`}>
                  {lab.label}
                </Link>
              </li>
            ))}
            {track.primer ? (
              <li>
                <Link to={track.primer.path}>{track.primer.label}</Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
      {reading.followOn ? (
        <section id="next" className="spark-primer-section spark-primer-next">
          <p className="spark-primer-section-eyebrow">{reading.followOn.eyebrow}</p>
          <h2 className="spark-primer-section-title">{reading.followOn.title}</h2>
          <p className="spark-primer-copy">
            <RichText text={reading.followOn.intro} />
          </p>
          <ul className="spark-primer-links">
            {reading.followOn.links.map((link) => (
              <li key={link.href}>
                <Link to={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
    {split ? (
      <div
        className="linux-blog-split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize blog and playground"
        onPointerDown={onSplitPointerDown}
      />
    ) : null}
    {split ? (
      <LinuxBlogPlayground
        onClose={() => setPlaygroundOpen(false)}
        onSubscribe={() => {
          setPlaygroundOpen(false);
          navigate(PRICING_PATH);
        }}
      />
    ) : null}
    </div>
  );
}
