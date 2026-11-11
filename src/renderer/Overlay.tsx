import { useEffect, useState } from 'react';
import type { AppState, TrackedCategory, OverlayMode } from '../shared/types';
import { api } from './api';
import { categoryColor } from './icons';
import { buildCards } from './view';

/** Compact always-on-top view. Locked = click-through; unlocked = drag/resize + controls. */
export function Overlay() {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => {
    document.body.classList.add('overlay-body');
    void api.getState().then(setState);
    return api.onState(setState);
  }, []);
  if (!state) return null;
  const s = state.summary;
  const o = state.overlay;

  return (
    <div className={`ov ${o.locked ? 'locked' : 'unlocked'}`}>
      {!o.locked && (
        <div className="ov-controls">
          <span className="ov-drag" title="Drag to move">⠿ drag</span>
          <select value={o.mode} onChange={e => void api.setOverlay({ mode: e.target.value as OverlayMode })}>
            <option value="counters">Counters</option>
            <option value="remaining">Remaining here</option>
            <option value="available">Can get now</option>
          </select>
          <input type="range" min={0.2} max={1} step={0.05} value={o.opacity} title="Opacity"
            onChange={e => void api.setOverlay({ opacity: Number(e.target.value) })} />
          <button onClick={() => void api.toggleOverlayLock()} title={`Lock (${state.hotkeys.lockOverlay})`}>Lock</button>
        </div>
      )}
      {state.status !== 'ok' || !s ? (
        <div className="ov-msg">{state.message ?? 'Waiting for a save…'}</div>
      ) : (
        <>
          <div className="ov-summary">
            <span><b style={{ color: '#ff3d5a' }}>♥</b> {s.hearts ?? '?'}{s.heartPiecesHeld ? <small> +{s.heartPiecesHeld}/4</small> : null}</span>
            <span><b style={{ color: '#e8b931' }}>✦</b> {s.tokens ?? '?'}</span>
            <span className="ov-pct">{s.percent.toFixed(1)}%</span>
          </div>
          {s.claimable.length > 0 && <div className="ov-claim">Claim: {s.claimable.map(c => c.reward).join(', ')}</div>}
          {state.identify.length > 0 && <div className="ov-claim">? {state.identify.length} to identify: open the tracker</div>}
          {o.mode === 'counters' ? <Counters cats={state.categories} /> : o.mode === 'available' ? <Available state={state} /> : <Remaining state={state} />}
        </>
      )}
      {state.toasts.slice(-2).map(t => <div key={t.id} className="ov-toast">{t.text}</div>)}
    </div>
  );
}

function Counters({ cats }: { cats: TrackedCategory[] }) {
  // Same merged cards as the main window (Hearts, Items, Equipment, Bosses...).
  return (
    <div className="ov-list">
      {buildCards(cats).filter(c => c.part === 'A').map(c => (
        <div key={c.id} className={`ov-row ${c.total && c.done === c.total ? 'full' : ''}`}>
          <span className="dot" style={{ background: categoryColor(c.colorCat) }} />
          <span className="ov-label">{c.label}</span>
          <span className="ov-num">{c.kind === 'counter' && c.value === null ? '?' : c.done}/{c.total}</span>
        </div>
      ))}
    </div>
  );
}

function Available({ state }: { state: AppState }) {
  let last = '';
  return (
    <div className="ov-list">
      {state.available.length === 0 && <div className="ov-row muted">Nothing obtainable right now</div>}
      {state.available.slice(0, 60).map(a => {
        const head = a.region !== last ? (last = a.region, <div key={'h' + a.region} className="ov-area">{a.here ? '▶ ' : ''}{a.region}</div>) : null;
        return [head, (
          <div key={a.id} className="ov-row">
            <span className="dot" style={{ background: categoryColor(a.categoryId) }} />
            <span className="ov-label">{a.categoryId === 'gold_skulltulas' ? `GS ${a.number}: ` : ''}{a.name.replace(/^[^:]+: /, '')}</span>
            {state.canBeAdult && a.ages.length === 1 && <span className={`age ${a.ages[0]}`}>{a.ages[0][0].toUpperCase()}</span>}
            {a.night && <span className="age night">☾</span>}
          </div>
        )];
      })}
    </div>
  );
}

function Remaining({ state }: { state: AppState }) {
  const regions = new Set(state.areaRegions);
  const rows = state.categories
    .filter(c => c.part !== 'C')
    .flatMap(c => c.items.filter(i => !i.done && i.chapter && regions.has(i.chapter)).map(i => ({ c, i })));
  return (
    <div className="ov-list">
      <div className="ov-area">{state.summary?.area ?? 'Unknown area'}{regions.size ? '' : ' · no checklist regions matched'}</div>
      {rows.length === 0 && regions.size > 0 && <div className="ov-row muted">Nothing left here 🎉</div>}
      {rows.slice(0, 40).map(({ c, i }) => (
        <div key={i.id} className={`ov-row ${i.state === 'unmapped' ? 'unmapped' : ''}`}>
          <span className="dot" style={{ background: categoryColor(c.id) }} />
          <span className="ov-label">{c.id === 'gold_skulltulas' ? `GS ${i.number}: ${i.name.replace(/^[^:]+: /, '')}` : i.name}</span>
        </div>
      ))}
    </div>
  );
}
