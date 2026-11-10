import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PROJECTS, MAJORS_PATH, PROJECTS_PATH, getProject, type ProjectEntry } from '../constants/projects';
import { MinorsGrid } from './MinorsPage';
import { hasModuleContent } from '../fixtures/projectModules';
import NotifyButton from '../components/NotifyButton';
import ChapterList from '../components/ChapterList';

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

export function MajorTiles(): JSX.Element {
  return (
    <section className="playgrounds-grid" aria-label="Majors">
      {PROJECTS.map((project) => {
          if (project.status !== 'ready' && project.previewable) {
            return (
              <Link
                key={project.id}
                to={`${MAJORS_PATH}/${project.id}`}
                className="playground-tile playground-tile--soon playground-tile--preview"
              >
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
              </Link>
            );
          }
          if (project.status !== 'ready') {
            return (
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
            );
          }
          return (
            <Link key={project.id} to={`${MAJORS_PATH}/${project.id}`} className="playground-tile">
              <strong className="playground-tile-title">
                {project.name}
                {project.level && <span className="project-tile-level">{project.level}</span>}
              </strong>
              <p className="project-tile-subtitle">{project.subtitle}</p>
              <p className="playground-tile-blurb">{project.blurb}</p>
              <span className="playground-tile-cta">
                Start {project.name} here
                <span aria-hidden>→</span>
              </span>
            </Link>
          );
        })}
    </section>
  );
}

export function ProjectsHub(): JSX.Element {
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

      <section className="projects-group" aria-labelledby="projects-majors">
        <h2 id="projects-majors" className="projects-group-title">Majors</h2>
        <p className="projects-group-lead">
          Long builds. Each one starts empty and ends as a system you can run, break, and explain.
        </p>
        <MajorTiles />
      </section>

      <section className="projects-group" aria-labelledby="projects-minors">
        <h2 id="projects-minors" className="projects-group-title">Minors</h2>
        <p className="projects-group-lead">
          Smaller builds. A listener, a protocol, a storage engine — one program, sometimes a few
          chapters.
        </p>
        <MinorsGrid />
      </section>
    </div>
  );
}
