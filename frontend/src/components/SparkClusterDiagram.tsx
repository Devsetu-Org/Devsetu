import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SparkDiagramNode {
  id: string;
  label: string;
  ui: string;
  clusterUi: string;
  role?: 'master' | 'worker' | 'rm' | 'nm' | 'shell' | 'driver';
}

function PulseCore({
  tone,
  selected,
}: {
  tone: 'hub' | 'leaf';
  selected: boolean;
}): JSX.Element {
  // Hub = Master (bright + dual rings). Leaf = Worker (softer green, quieter pulse).
  const cls = [
    'spark-arch-pulse',
    tone === 'hub' ? 'is-hub' : 'is-leaf',
    selected ? 'is-on' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} aria-hidden="true">
      <span className="spark-arch-pulse-ring" />
      {tone === 'hub' ? <span className="spark-arch-pulse-ring spark-arch-pulse-ring--late" /> : null}
      <span className="spark-arch-pulse-core" />
    </span>
  );
}

/**
 * Chooser shown once a multi-node Spark lab is up. Abstract pulse map —
 * Master on top, Workers below, dashed links. Double-click opens a shell.
 */
export default function SparkClusterDiagram({
  nodes,
  onShell,
}: {
  nodes: SparkDiagramNode[];
  onShell: (id: string) => void;
}): JSX.Element {
  const archRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const played = useRef(false);
  const master = useMemo(
    () => nodes.find((node) => node.role === 'master' || node.role === 'rm') ?? nodes[0],
    [nodes],
  );
  const workers = useMemo(
    () => nodes.filter((node) => node.id !== master?.id),
    [nodes, master],
  );
  const [selected, setSelected] = useState(master?.id ?? '');
  const openHost = (id: string): void => {
    setSelected(id);
    onShell(id);
  };

  useEffect(() => {
    const arch = archRef.current;
    const svg = svgRef.current;
    if (!arch || !svg || !master) return undefined;
    const ns = 'http://www.w3.org/2000/svg';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const centerOf = (id: string): { x: number; y: number } | null => {
      const button = arch.querySelector<HTMLElement>(`[data-node="${id}"] .spark-arch-pulse-core`);
      if (!button) return null;
      const bounds = arch.getBoundingClientRect();
      const rect = button.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - bounds.left,
        y: rect.top + rect.height / 2 - bounds.top,
      };
    };

    const draw = (animate: boolean): void => {
      const w = arch.clientWidth;
      const h = arch.clientHeight;
      if (!w || !h) return;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const from = centerOf(master.id);
      if (!from) return;

      workers.forEach((worker, index) => {
        const to = centerOf(worker.id);
        if (!to) return;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', String(Math.round(from.x)));
        line.setAttribute('y1', String(Math.round(from.y)));
        line.setAttribute('x2', String(Math.round(to.x)));
        line.setAttribute('y2', String(Math.round(to.y)));
        line.setAttribute('stroke', '#5c6b64');
        line.setAttribute('stroke-width', '1.25');
        line.setAttribute('stroke-dasharray', '4 5');
        line.setAttribute('class', 'spark-arch-link');
        svg.appendChild(line);

        if (index < workers.length - 1) {
          const next = centerOf(workers[index + 1].id);
          if (next) {
            const base = document.createElementNS(ns, 'line');
            base.setAttribute('x1', String(Math.round(to.x)));
            base.setAttribute('y1', String(Math.round(to.y)));
            base.setAttribute('x2', String(Math.round(next.x)));
            base.setAttribute('y2', String(Math.round(next.y)));
            base.setAttribute('stroke', '#3d4843');
            base.setAttribute('stroke-width', '1');
            base.setAttribute('stroke-dasharray', '3 6');
            base.setAttribute('class', 'spark-arch-link spark-arch-link--peer');
            svg.appendChild(base);
          }
        }

        if (!animate || played.current || reduce) return;
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('r', '3');
        dot.setAttribute('fill', '#3ddb9a');
        dot.setAttribute('cx', '0');
        dot.setAttribute('cy', '0');
        svg.appendChild(dot);
        dot.animate(
          [
            { transform: `translate(${from.x}px, ${from.y}px)`, opacity: 1 },
            { transform: `translate(${to.x}px, ${to.y}px)`, opacity: 0.2 },
          ],
          { duration: 1100, delay: index * 180, easing: 'ease-in-out', fill: 'forwards' },
        );
      });
      if (animate) played.current = true;
    };

    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => draw(true)));
    const observer = new ResizeObserver(() => draw(false));
    observer.observe(arch);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [master, workers]);

  if (!master) return <div className="spark-cluster-diagram" />;

  const machine = (
    node: SparkDiagramNode,
    kind: string,
    className: string,
    tone: 'hub' | 'leaf',
  ): JSX.Element => (
    <button
      key={node.id}
      type="button"
      className={`spark-arch-machine ${className}${selected === node.id ? ' is-on' : ''}`}
      data-node={node.id}
      aria-pressed={selected === node.id}
      aria-label={`${kind} ${node.id}. Double-click to open a shell.`}
      title="Double-click to open a shell"
      onClick={() => setSelected(node.id)}
      onDoubleClick={() => openHost(node.id)}
    >
      <PulseCore tone={tone} selected={selected === node.id} />
      <span className="spark-arch-label">
        <span className="spark-arch-kind">{kind}</span>
        <span className="spark-arch-host">{node.id}</span>
      </span>
    </button>
  );

  const headKind =
    master.role === 'rm' ? 'ResourceManager' : master.role === 'nm' ? 'NodeManager' : 'Master';
  const leafKind = (role: SparkDiagramNode['role']): string => {
    if (role === 'shell') return 'Client';
    if (role === 'nm') return 'NodeManager';
    if (role === 'rm') return 'ResourceManager';
    if (role === 'master') return 'Master';
    return 'Worker';
  };
  const yarn = master.role === 'rm' || workers.some((node) => node.role === 'nm' || node.role === 'shell');
  const leafCount = workers.length;

  return (
    <div className="spark-cluster-diagram">
      <div
        className={`spark-arch spark-arch--pulse${leafCount === 2 ? ' is-pair' : ''}${leafCount >= 3 ? ' is-wide' : ''}`}
        ref={archRef}
      >
        <svg className="spark-arch-wires" ref={svgRef} aria-hidden="true" />
        {machine(master, headKind, 'spark-arch-master', 'hub')}
        {workers.map((worker, index) =>
          machine(worker, leafKind(worker.role), `spark-arch-w${index}`, 'leaf'),
        )}
      </div>
      <p className="spark-arch-status">
        {yarn
          ? 'Client mode submits from shell. Double-click a node to open a terminal.'
          : 'Double-click a node to open a shell on it.'}
      </p>
    </div>
  );
}
