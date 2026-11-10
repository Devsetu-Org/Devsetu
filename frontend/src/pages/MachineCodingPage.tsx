import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import MarkdownProse from '../components/MarkdownProse';
import SparkProjectEditor from '../components/SparkProjectEditor';
import WorkspaceMobileSwitcher, {
  type WorkspaceMobilePane,
} from '../components/WorkspaceMobileSwitcher';
import DesktopOnlyNotice from '../components/DesktopOnlyNotice';
import {
  MACHINE_CODING_LANGUAGE_LABELS,
  MACHINE_CODING_LANGUAGES,
  MACHINE_CODING_PATH,
  MACHINE_CODING_PROBLEMS,
  getMachineCodingProblem,
  isMachineCodingLanguage,
  type MachineCodingLanguage,
  type MachineCodingProblem,
} from '../constants/machineCoding';
import { useIsNarrowUi } from '../hooks/useMediaQuery';
import { removeMigrating, writeMigrating } from '../utils/storageMigrate';
import { readSavedFiles, workspaceFilesKeys } from '../utils/workspaceFiles';

function languageStorageKey(problemId: string): string {
  return `devsetu.machine.${problemId}.language`;
}

function persistId(problemId: string, language: MachineCodingLanguage): string {
  return `machine.${problemId}.${language}`;
}

function starterFiles(problem: MachineCodingProblem, language: MachineCodingLanguage): Record<string, string> {
  const file = problem.files[language];
  return { [file.path]: file.source };
}

function loadFiles(
  problem: MachineCodingProblem,
  language: MachineCodingLanguage,
): Record<string, string> {
  const starter = starterFiles(problem, language);
  const saved = readSavedFiles(persistId(problem.id, language));
  if (!saved) return starter;
  const file = problem.files[language];
  return { ...starter, ...saved, [file.path]: saved[file.path] ?? starter[file.path] };
}

function MachineCodingWorkspace({ problem }: { problem: MachineCodingProblem }): JSX.Element {
  const isNarrow = useIsNarrowUi();
  const [params, setParams] = useSearchParams();
  const [mobilePane, setMobilePane] = useState<WorkspaceMobilePane>('brief');

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(languageStorageKey(problem.id));
  } catch {
    stored = null;
  }
  const fromUrl = params.get('lang');
  const language: MachineCodingLanguage = isMachineCodingLanguage(fromUrl)
    ? fromUrl
    : isMachineCodingLanguage(stored)
      ? stored
      : 'go';
  const entryFile = problem.files[language].path;
  const fileKey = `${problem.id}:${language}`;

  const [files, setFiles] = useState<Record<string, string>>(() => loadFiles(problem, language));
  const [loadedKey, setLoadedKey] = useState(fileKey);
  if (loadedKey !== fileKey) {
    setLoadedKey(fileKey);
    setFiles(loadFiles(problem, language));
  }

  useEffect(() => {
    if (!(entryFile in files)) return undefined;
    const id = persistId(problem.id, language);
    const timer = window.setTimeout(() => {
      try {
        const { next, legacy } = workspaceFilesKeys(id);
        writeMigrating(window.localStorage, next, legacy, JSON.stringify(files));
      } catch {
        // Quota or private mode.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [files, problem.id, language, entryFile]);

  const setLanguage = (next: MachineCodingLanguage): void => {
    try {
      window.localStorage.setItem(languageStorageKey(problem.id), next);
    } catch {
      // ignore
    }
    const query = new URLSearchParams(params);
    query.set('lang', next);
    setParams(query, { replace: true });
  };

  const showBrief = !isNarrow || mobilePane === 'brief';
  const showEditor = !isNarrow || mobilePane === 'workspace';

  const reset = (): void => {
    if (!window.confirm('Reset this language? Your edits in it are discarded.')) return;
    const id = persistId(problem.id, language);
    try {
      const { next, legacy } = workspaceFilesKeys(id);
      removeMigrating(window.localStorage, next, legacy);
    } catch {
      // ignore
    }
    setFiles(starterFiles(problem, language));
  };

  const brief = useMemo(
    () => `# ${problem.name}\n\n${problem.brief.trim()}`,
    [problem],
  );

  return (
    <div className="app-page project-module-page">
      <p className="play-papers-crumb project-module-crumb">
        <span>
          <Link to={MACHINE_CODING_PATH}>Machine coding</Link>
          <span aria-hidden> / </span>
          <span>{problem.name}</span>
        </span>
        <span className="project-module-crumb-action">
          <label className="minor-language-select">
            <span>Language</span>
            <select
              value={language}
              onChange={(event) => {
                if (isMachineCodingLanguage(event.target.value)) setLanguage(event.target.value);
              }}
            >
              {MACHINE_CODING_LANGUAGES.map((id) => (
                <option key={id} value={id}>
                  {MACHINE_CODING_LANGUAGE_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
        </span>
      </p>
      <div
        className={`workspace sandbox-workspace spark-platform-workspace project-module-shell${
          isNarrow ? ` workspace--mobile workspace--mobile-pane-${mobilePane}` : ''
        }`}
        style={
          isNarrow
            ? { gridTemplateColumns: 'minmax(0, 1fr)' }
            : { gridTemplateColumns: 'minmax(320px, 42%) minmax(0, 1fr)' }
        }
      >
        {isNarrow && (
          <WorkspaceMobileSwitcher
            pane={mobilePane}
            onChange={setMobilePane}
            briefLabel="Problem"
            workspaceLabel="Editor"
          />
        )}
        {showBrief && (
          <div className="col spark-brief-col">
            <div className="panel sandbox-brief-panel--solo spark-brief-panel--bare" style={{ flex: 1 }}>
              <div className="panel-body">
                <MarkdownProse text={brief} className="markdown-prose" />
              </div>
            </div>
          </div>
        )}
        {showEditor && isNarrow && (
          <DesktopOnlyNotice
            tools="the editor"
            briefLabel="Read the problem"
            onShowBrief={() => setMobilePane('brief')}
          />
        )}
        {showEditor && !isNarrow && (
          <div className="col col-main">
            <div className="panel spark-ide-panel" style={{ flex: 1 }}>
              <SparkProjectEditor
                key={fileKey}
                files={files}
                onChangeFiles={setFiles}
                entryFile={entryFile}
                onResetToStarter={reset}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MachineCodingPage(): JSX.Element {
  const { problemId } = useParams<{ problemId?: string }>();
  if (problemId) {
    const problem = getMachineCodingProblem(problemId);
    if (!problem || problem.status !== 'ready') return <Navigate to={MACHINE_CODING_PATH} replace />;
    return <MachineCodingWorkspace problem={problem} />;
  }
  return (
    <div className="app-page play-problems-page">
      <header className="play-problems-hero">
        <div className="play-problems-hero-copy">
          <h1 className="play-problems-title">Machine coding</h1>
          <p className="play-problems-lead">
            One spec, one sitting. You write the program in Go, Python, or Java, and tests you do
            not see decide if it holds.
          </p>
        </div>
      </header>
      <section className="playgrounds-grid" aria-label="Machine coding problems">
        {MACHINE_CODING_PROBLEMS.map((problem) => (
          <Link
            key={problem.id}
            to={`${MACHINE_CODING_PATH}/${problem.id}`}
            className="playground-tile"
          >
            <strong className="playground-tile-title">{problem.name}</strong>
            <p className="project-tile-subtitle">{problem.subtitle}</p>
            <p className="playground-tile-blurb">{problem.blurb}</p>
            <span className="playground-tile-cta">
              Start {problem.name} here
              <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
