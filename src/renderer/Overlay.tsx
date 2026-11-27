import { useEffect, useRef, useState } from 'react';
import type { AppState, TrackedCategory, OverlayMode } from '../shared/types';
import { api } from './api';
import { categoryColor } from './icons';
import { buildCards } from './view';
import { reachableSpotsHere } from '../core/spots';

/** Compact always-on-top view. Locked = click-through; unlocked = drag/resize + controls. */
export function Overlay() {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => {
    document.body.classList.add('overlay-body');
    void api.getState().then(setState);
    return api.onState(setState);
  }, []);
  const s = state?.summary;
  // Numbers that just went up pulse for a few seconds.
  const bumped = useBumps(s ? { hearts: (s.hearts ?? 0) * 4 + (s.heartPiecesHeld ?? 0), tokens: s.tokens ?? 0, pct: s.doneA } : {});
  if (!state) return null;
  const o = state.overlay;
  const live = state.live;

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
          <div className="ov-head">
            <span className="ov-here">{s.area ?? 'Unknown area'}</span>
            {live.enabled && live.status !== 'off' && live.status !== 'unavailable' && (
              <span className={`ov-src ${live.using ? 'on' : ''}`} title={live.using ? 'Live from the game' : (live.detail ?? 'Using saves')}>{live.using ? '● live' : '○ saves'}</span>
            )}
          </div>
          <div className="ov-summary">
            <span className={bumped.has('hearts') ? 'bump' : ''}><b style={{ color: '#ff3d5a' }}>♥</b> {s.hearts ?? '?'}{s.heartPiecesHeld ? <small> +{s.heartPiecesHeld}/4</small> : null}</span>
            <span className={bumped.has('tokens') ? 'bump' : ''}><b style={{ color: '#e8b931' }}>✦</b> {s.tokens ?? '?'}</span>
            <span className={`ov-pct ${bumped.has('pct') ? 'bump' : ''}`}>{s.percent.toFixed(1)}%</span>
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

/** Keys whose value went up recently (cleared after `ms`). Ignores the first render. */
function useBumps(values: Record<string, number>, ms = 4000): Set<string> {
  const prev = useRef<Record<string, number> | null>(null);
  const [bumped, setBumped] = useState<Set<string>>(new Set());
  const sig = JSON.stringify(values);
  useEffect(() => {
    const before = prev.current;
    prev.current = values;
    if (!before) return;
    const up = Object.keys(values).filter(k => before[k] !== undefined && values[k] > before[k]);
    if (!up.length) return;
    setBumped(b => new Set([...b, ...up]));
    // Each change clears only its own keys; no cleanup, so a quick second change
    // doesn't leave the first one pulsing.
    setTimeout(() => setBumped(b => new Set([...b].filter(k => !up.includes(k)))), ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return bumped;
}

function Counters({ cats }: { cats: TrackedCategory[] }) {
  // Same merged cards as the main window (Hearts, Items, Equipment, Bosses...).
  const cards = buildCards(cats).filter(c => c.part === 'A');
  const bumped = useBumps(Object.fromEntries(cards.map(c => [c.id, c.done])));
  return (
    <div className="ov-list">
      {cards.map(c => (
        <div key={c.id} className={`ov-row ${c.total && c.done === c.total ? 'full' : ''} ${bumped.has(c.id) ? 'bump' : ''}`}>
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
      {state.available.length === 0 && <div className="ov-row muted">Nothing to get right now</div>}
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

/** Why a row can't be got yet, in a couple of words (from its logic status). */
export function laterReason(logic: { ages: string[]; missing: string[] } | undefined): string | undefined {
  if (!logic || logic.ages.length) return undefined;
  const m = logic.missing;
  if (m.some(x => x.startsWith('Master Sword'))) return 'adult';
  const item = m.find(x => !x.startsWith('reach ') && x !== 'adult' && x !== 'child');
  if (item) return `needs ${item.replace(/([a-z])([A-Z])/g, '$1 $2')}`;
  if (m.includes('adult')) return 'adult';
  if (m.includes('child')) return 'child';
  return m.length ? "can't reach yet" : undefined;
}

function Remaining({ state }: { state: AppState }) {
  const regions = new Set(state.areaRegions);
  const rows = state.categories
    .filter(c => c.part !== 'C')
    .flatMap(c => c.items.filter(i => !i.done && i.chapter && regions.has(i.chapter)).map(i => ({ c, i, later: laterReason(i.logic) })))
    // Counter spots (bean planting) only as reminders once they're reachable.
    .concat(reachableSpotsHere(state.categories, regions).map(r => ({ ...r, later: undefined })))
    // What you can get now first, then the rest.
    .sort((a, b) => Number(!!a.later) - Number(!!b.later));
  const later = rows.filter(r => r.later).length;
  const now = rows.length - later;
  return (
    <div className="ov-list">
      <div className="ov-area">
        {!regions.size ? 'No checklist entries for this area' : rows.length ? (later ? `${now} to get · ${later} later` : `${rows.length} left here`) : ''}
      </div>
      {rows.length === 0 && regions.size > 0 && <div className="ov-row muted">Nothing left here 🎉</div>}
      {rows.slice(0, 40).map(({ c, i, later }) => (
        <div key={i.id} className={`ov-row ${later ? 'later' : ''}`}>
          <span className="dot" style={{ background: categoryColor(c.id) }} />
          <span className="ov-label">{c.id === 'gold_skulltulas' ? `GS ${i.number}: ` : ''}{i.name.replace(/^[^:]+: /, '')}</span>
          {later ? <span className="ov-why" title={later}>{later}</span> : i.logic?.night && <span className="age night">☾</span>}
        </div>
      ))}
    </div>
  );
}
