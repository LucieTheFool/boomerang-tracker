import { useEffect, useRef, useState } from 'react';
import type { GuideStep } from './guide';
import { api } from './api';

/**
 * Guided first-run walkthrough. A spotlight sits over the target element and
 * the caption card beside it; both are re-measured every frame so they follow
 * scroll and re-layout. No motion (MOTION 1): the spotlight simply follows.
 */
export function GuideTour({ steps, onDone }: { steps: GuideStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  /** The updates opt-in checkbox: unticked by default; ticking it turns on check + auto-download. */
  const [optIn, setOptIn] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; ready: boolean }>({ x: 0, y: 0, ready: false });
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i + 1 === steps.length;

  // The updates opt-in is applied only when the user ticked it and left the step
  // (Next, "Got it", or Skip) — ticking it alone does nothing, so they can still change their mind.
  const applyOptIn = () => {
    if (step.id === 'updates' && optIn) void api.setUpdates({ check: true, autoDownload: true });
  };
  const finish = () => { applyOptIn(); onDone(); };

  // Follow the target element (scroll, resize, layout change).
  useEffect(() => {
    if (!step.target) { setRect(null); return; }
    let raf = 0;
    let prev: DOMRect | null = null;
    const same = (a: DOMRect, b: DOMRect) =>
      a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
    const loop = () => {
      const el = document.querySelector(`[data-guide="${step.target}"]`);
      const r = el ? el.getBoundingClientRect() : null;
      if (!r || !prev || !same(r, prev)) setRect(r);
      prev = r;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  // Keep the target within the visible area when its step starts.
  useEffect(() => {
    if (!step.target) return;
    document.querySelector(`[data-guide="${step.target}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [step.target]);

  // Place the caption beside the target, clamped to the viewport.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const m = 12;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    if (!rect) {
      setPos({ x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, ready: true });
      return;
    }
    const x = Math.min(Math.max(m, rect.left), Math.max(m, innerWidth - w - m));
    let y = rect.bottom + m;
    if (y + h > innerHeight - m) y = Math.max(m, rect.top - h - m);
    setPos({ x, y, ready: true });
  }, [rect, i]);

  // Escape ends the tour.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  useEffect(() => { nextRef.current?.focus(); }, []);

  const advance = () => {
    applyOptIn();
    if (last) { onDone(); return; }
    setPos(p => ({ ...p, ready: false }));
    setI(i + 1);
  };

  return (
    <div className="guide" role="dialog" aria-modal="true" aria-label="First-run guide">
      <div className="guide-bg" onPointerDown={finish} />
      {rect && (
        <div
          className="guide-spot"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div className="guide-card" ref={cardRef} style={{ left: pos.x, top: pos.y, opacity: pos.ready ? 1 : 0 }}>
        <div className="guide-step-n">Step {i + 1} of {steps.length}</div>
        <b>{step.title}</b>
        <p>{step.body}</p>
        {step.id === 'overlay' && <button className="show-overlay" onClick={() => void api.toggleOverlay()}>Show the overlay</button>}
        {step.id === 'updates' && (
          <label className="check">
            <input
              type="checkbox"
              checked={optIn}
              onChange={e => setOptIn(e.target.checked)}
            />
            Check for and download new versions automatically
          </label>
        )}
        <div className="guide-actions">
          <button className="link" onClick={finish}>Skip tour</button>
          <button className="primary" ref={nextRef} onClick={advance}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
