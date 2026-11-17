import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../services/authApi';

/**
 * Draws the cluster's headless browser. The picture exists only while this
 * panel is mounted; leaving it closes the stream.
 */
export default function SparkClusterBrowser({ sessionId }: { sessionId: string }): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const editingRef = useRef(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Opening the browser…');
  const [note, setNote] = useState('');
  const [reopening, setReopening] = useState(false);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return undefined;
    let closed = false;
    let movePending: { x: number; y: number } | null = null;
    let moveFrame = 0;
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${wsProto}://${window.location.host}/api/session/${sessionId}/spark-browser/stream`);
    ws.binaryType = 'blob';
    wsRef.current = ws;

    const send = (payload: Record<string, unknown>): void => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    };
    const sendSize = (): void => {
      const width = Math.round(stage.clientWidth);
      const height = Math.round(stage.clientHeight);
      const scale = window.devicePixelRatio || 1;
      if (width > 0 && height > 0) send({ type: 'resize', width, height, scale });
    };
    let painting = false;
    let pendingFrame: Blob | null = null;
    let showedFrame = false;
    const paint = (blob: Blob): void => {
      if (painting) {
        pendingFrame = blob;
        return;
      }
      painting = true;
      void createImageBitmap(blob).then((bitmap) => {
        if (closed) {
          bitmap.close();
          return;
        }
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.style.width = `${stage.clientWidth}px`;
        canvas.style.height = `${stage.clientHeight}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
        if (!showedFrame) {
          showedFrame = true;
          setStatus('');
        }
      }).catch(() => undefined).finally(() => {
        painting = false;
        const next = pendingFrame;
        pendingFrame = null;
        if (next) paint(next);
      });
    };

    ws.onopen = () => sendSize();
    ws.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') {
        paint(ev.data as Blob);
        return;
      }
      let msg: { type?: string; url?: string; text?: string };
      try {
        msg = JSON.parse(ev.data) as { type?: string; url?: string; text?: string };
      } catch {
        return;
      }
      if (msg.type === 'url') {
        if (!editingRef.current) setDraft(msg.url || '');
        setNote('');
        return;
      }
      if (msg.type === 'note') {
        setNote(msg.text || '');
        return;
      }
      if (msg.type === 'status') setStatus(msg.text || '');
    };
    ws.onclose = () => {
      if (!closed) setStatus((current) => current || 'The browser stopped. Reopen it.');
    };

    let resizeTimer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(sendSize, 80);
    });
    observer.observe(stage);
    const flushMove = (): void => {
      moveFrame = 0;
      if (!movePending) return;
      send({ type: 'mouse', event: 'move', ...movePending });
      movePending = null;
    };
    const point = (ev: { clientX: number; clientY: number }): { x: number; y: number } => {
      const rect = stage.getBoundingClientRect();
      return {
        x: Math.round(ev.clientX - rect.left),
        y: Math.round(ev.clientY - rect.top),
      };
    };
    const onMove = (ev: MouseEvent): void => {
      if (ev.target !== canvas) return;
      movePending = point(ev);
      if (!moveFrame) moveFrame = window.requestAnimationFrame(flushMove);
    };
    const onDown = (ev: MouseEvent): void => {
      if (ev.target !== canvas) return;
      stage.focus();
      send({ type: 'mouse', event: 'down', button: ev.button, clickCount: ev.detail || 1, ...point(ev) });
    };
    const onUp = (ev: MouseEvent): void => {
      send({ type: 'mouse', event: 'up', button: ev.button, ...point(ev) });
    };
    let wheel = { x: 0, y: 0, deltaX: 0, deltaY: 0 };
    let wheelFrame = 0;
    const onWheel = (ev: WheelEvent): void => {
      if (ev.target !== canvas) return;
      ev.preventDefault();
      const line = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? stage.clientHeight : 1;
      const at = point(ev);
      wheel.x = at.x;
      wheel.y = at.y;
      wheel.deltaX += ev.deltaX * line;
      wheel.deltaY += ev.deltaY * line;
      if (wheelFrame) return;
      wheelFrame = window.requestAnimationFrame(() => {
        wheelFrame = 0;
        const shot = wheel;
        wheel = { x: 0, y: 0, deltaX: 0, deltaY: 0 };
        send({ type: 'mouse', event: 'wheel', ...shot });
      });
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.target !== stage) return;
      ev.preventDefault();
      send({
        type: 'key',
        down: ev.type === 'keydown',
        key: ev.key,
        code: ev.code,
        alt: ev.altKey,
        ctrl: ev.ctrlKey,
        meta: ev.metaKey,
        shift: ev.shiftKey,
        repeat: ev.repeat,
      });
    };
    stage.addEventListener('mousemove', onMove);
    stage.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('keydown', onKey);
    stage.addEventListener('keyup', onKey);

    return () => {
      closed = true;
      observer.disconnect();
      window.clearTimeout(resizeTimer);
      if (moveFrame) window.cancelAnimationFrame(moveFrame);
      if (wheelFrame) window.cancelAnimationFrame(wheelFrame);
      stage.removeEventListener('mousemove', onMove);
      stage.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('keydown', onKey);
      stage.removeEventListener('keyup', onKey);
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [sessionId, epoch]);

  const send = (payload: Record<string, unknown>): void => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  };

  const reopen = (): void => {
    if (reopening) return;
    setReopening(true);
    setStatus('Opening the browser…');
    void axios.post(
      `/api/session/${sessionId}/spark-browser/reopen`,
      {},
      { headers: getAuthHeader() },
    ).catch(() => {
      setStatus('The browser could not open. Reopen it.');
    }).finally(() => {
      setReopening(false);
      setEpoch((current) => current + 1);
    });
  };

  return (
    <div className="spark-browser-wrap">
      <form
        className="spark-browser-bar"
        onSubmit={(ev) => {
          ev.preventDefault();
          editingRef.current = false;
          send({ type: 'navigate', url: draft });
          stageRef.current?.focus();
        }}
      >
        <input
          value={draft}
          spellCheck={false}
          autoComplete="off"
          placeholder="host:port"
          aria-label="Address"
          onFocus={() => { editingRef.current = true; }}
          onBlur={() => { editingRef.current = false; }}
          onChange={(ev) => {
            setDraft(ev.target.value);
            setNote('');
          }}
        />
        <button type="submit" className="spark-browser-go">Open</button>
      </form>
      {note && <p className="spark-browser-note">{note}</p>}
      <div
        className="spark-browser-stage"
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-label="Cluster browser"
      >
        <canvas ref={canvasRef} />
        {status && (
          <div className="spark-browser-status" role="status">
            <span>{status}</span>
            {status.includes('Reopen') && (
              <button type="button" onClick={reopen} disabled={reopening}>
                {reopening ? 'Opening…' : 'Reopen browser'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
