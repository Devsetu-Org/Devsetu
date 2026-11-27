import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PROJECTS, MAJORS_PATH, PROJECTS_PATH, getProject, type ProjectEntry } from '../constants/projects';
import { MinorsGrid } from './MinorsPage';
import { hasModuleContent } from '../fixtures/projectModules';
import NotifyButton from '../components/NotifyButton';
import ChapterList from '../components/ChapterList';

type ProjectsTab = 'minors' | 'majors';

function ProjectDetail({ project }: { project: ProjectEntry }): JSX.Element {
  return (
    <div className="app-page play-problems-page project-detail--list">
      <header className="project-detail-compact">
        <p className="play-papers-crumb">
          <Link to={PROJECTS_PATH}>Projects</Link>
          <span aria-hidden> / </span>
          <span>{project.name}</span>
        </p>
        <h1 className="project-detail-compact-title">
          {project.name}
          {project.status !== 'ready' && (
            <span className="playground-tile-soon project-soon-badge">Coming soon</span>
          )}
          {project.status !== 'ready' && (
            <NotifyButton kind="major" itemId={project.id} label={project.name} />
          )}
        </h1>
        <p className="project-detail-subtitle">{project.subtitle}</p>
      </header>

      <div className="project-about">
        {project.about.map((paragraph) => (
          <p key={paragraph.slice(0, 48)} className="project-about-body">
            {paragraph}
          </p>
        ))}
      </div>

      <ChapterList
        chapters={project.modules}
        isOpen={(module) =>
          project.status === 'ready' && module.status === 'ready' && hasModuleContent(project.id, module.id)
        }
        hrefFor={(module) => `${MAJORS_PATH}/${project.id}/${module.id}`}
      />
    </div>
  );
}

export default function ProjectsPage(): JSX.Element {
  const { projectId } = useParams<{ projectId?: string }>();

  if (projectId) {
    const project = getProject(projectId);
    if (!project || (project.status !== 'ready' && !project.previewable)) {
      return <Navigate to={PROJECTS_PATH} replace />;
    }
    return <ProjectDetail project={project} />;
  }

  return <Navigate to={PROJECTS_PATH} replace />;
}

/** Pilot: every major tile is Coming soon (ignore ready/previewable). */
export function MajorTiles(): JSX.Element {
  return (
    <section className="playgrounds-grid" aria-label="Majors">
      {PROJECTS.map((project) => (
        <div key={project.id} className="playground-tile playground-tile--soon">
          <strong className="playground-tile-title">
            {project.name}
            <span className="playground-tile-soon">Coming soon</span>
            <NotifyButton kind="major" itemId={project.id} label={project.name} />
          </strong>
          <p className="project-tile-subtitle">{project.subtitle}</p>
          <p className="playground-tile-blurb">{project.blurb}</p>
          <span className="playground-tile-cta">
            Start {project.name} here
            <span aria-hidden>→</span>
          </span>
        </div>
      ))}
    </section>
  );
}

export function ProjectsHub(): JSX.Element {
  const [tab, setTab] = useState<ProjectsTab>('minors');

  return (
    <div className="app-page play-problems-page app-page--no-scrollbar">
      <header className="play-problems-hero">
        <div className="play-problems-hero-copy">
          <h1 className="play-problems-title">Projects</h1>
          <p className="play-problems-lead">
            Builds you carry. A major runs for many chapters, from an empty repo to a system you
            can restart. A minor is a smaller program, finished on its own.
          </p>
        </div>
      </header>

      <div className="projects-tab-toggle-wrap">
        <div className="play-kind-toggle" role="group" aria-label="Project kind">
          <button
            type="button"
            className={`play-kind-toggle-btn${tab === 'minors' ? ' is-active' : ''}`}
            aria-pressed={tab === 'minors'}
            onClick={() => setTab('minors')}
          >
            Minors
          </button>
          <button
            type="button"
            className={`play-kind-toggle-btn${tab === 'majors' ? ' is-active' : ''}`}
            aria-pressed={tab === 'majors'}
            onClick={() => setTab('majors')}
          >
            Majors
          </button>
        </div>
      </div>

      <section className="projects-group" aria-label={tab === 'minors' ? 'Minors' : 'Majors'}>
        {tab === 'minors' ? <MinorsGrid /> : <MajorTiles />}
      </section>
    </div>
  );
}
