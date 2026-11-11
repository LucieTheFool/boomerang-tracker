import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, TrackedCategory, TrackedItem, UiPrefs, ChangeRow, OverlayMode, AvailableEntry } from '../shared/types';
import { api, timeAgo } from './api';
import { symbolIcons, categoryColor } from './icons';
import { Symbol } from './symbols';
import { buildCards, tileItems, Card, TileModel } from './view';
import { Masonry } from './Masonry';

const icons = symbolIcons;

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [prefs, setPrefs] = useState<UiPrefs | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    void api.getState().then(setState);
    void api.getPrefs().then(setPrefs);
    const off = api.onState(setState);
    const t = setInterval(() => tick(x => x + 1), 15000); // keep "x min ago" fresh
    return () => { off(); clearInterval(t); };
  }, []);

  const updatePrefs = (p: UiPrefs) => { setPrefs(p); void api.setPrefs(p); };

  const cards = useMemo(() => (state ? buildCards(state.categories) : []), [state]);
  type Selection = { stack: Extract<TileModel, { kind: 'stack' }> } | { cat: TrackedCategory; item: TrackedItem } | null;
  const selectedItem = useMemo((): Selection => {
    if (!state || !selected) return null;
    for (const card of cards) for (const s of card.sections) for (const t of s.tiles) if (t.kind === 'stack' && t.key === selected) return { stack: t };
    for (const c of state.categories) for (const i of c.items) if (i.id === selected) return { cat: c, item: i };
    return null;
  }, [state, cards, selected]);

  if (!state || !prefs) return <div className="loading">Loading…</div>;

  if (state.status !== 'ok') {
    return (
      <div className="setup">
        <h1>Boomerang Tracker</h1>
        {state.status === 'loading' ? <p>Looking for your saves…</p> : <p className="error-text">{state.message}</p>}
        {state.status !== 'loading' && (
          <>
            <p className="muted">Pick the Hookshot game folder, or the <code>user\save\&lt;id&gt;</code> folder inside it. The tracker only ever reads your saves.</p>
            <button className="primary" onClick={() => void api.browseFolder()}>Choose save folder…</button>
          </>
        )}
      </div>
    );
  }

  const visible = (c: Card) =>
    !prefs.hiddenCategories.includes(c.id) && (c.part === 'A' || (c.part === 'B' && prefs.showParts.B) || (c.part === 'C' && prefs.showParts.C));
  const parts: { part: 'A' | 'B' | 'C'; title: string }[] = [
    { part: 'A', title: '100% checklist' },
    { part: 'B', title: 'Quest progress' },
    { part: 'C', title: 'Extras (not counted)' },
  ];

  return (
    <div className="app">
      <SummaryBar state={state} />
      <Toolbar state={state} cards={cards} prefs={prefs} onPrefs={updatePrefs} />
      {state.message && <div className="banner">{state.message}</div>}
      <AvailablePanel state={state} open={!(prefs.collapsed ?? []).includes('__available')} selected={selected} onSelect={setSelected}
        height={prefs.availableHeight} onResize={h => updatePrefs({ ...prefs, availableHeight: h })}
        onToggle={open => updatePrefs({ ...prefs, collapsed: open ? (prefs.collapsed ?? []).filter(x => x !== '__available') : [...(prefs.collapsed ?? []), '__available'] })} />
      <div className="body">
        <main className="grid-wrap">
          {parts.map(({ part, title }) => {
            const list = cards.filter(c => c.part === part && visible(c));
            if (!list.length) return null;
            return (
              <section key={part}>
                <h2 className="part-title">{title}</h2>
                <Masonry items={list.map(c => {
                  const collapsed = (prefs.collapsed ?? []).includes(c.id);
                  return {
                    key: c.id,
                    node: (
                      <CardView card={c} hideCollected={prefs.hideCollected} selected={selected} onSelect={setSelected}
                        collapsed={collapsed}
                        onToggle={() => updatePrefs({ ...prefs, collapsed: collapsed ? prefs.collapsed.filter(x => x !== c.id) : [...(prefs.collapsed ?? []), c.id] })} />
                    ),
                  };
                })} />
              </section>
            );
          })}
        </main>
        <aside className="side">
          {state.identify.length > 0 && <IdentifyCard q={state.identify[0]} more={state.identify.length - 1} onShow={setSelected} />}
          {selectedItem && 'stack' in selectedItem
            ? <StackDetails stack={selectedItem.stack} onShow={setSelected} onClose={() => setSelected(null)} />
            : selectedItem ? <Details cat={selectedItem.cat} item={selectedItem.item} onClose={() => setSelected(null)} /> : <Legend />}
          {state.devPanel && <DevPanel state={state} />}
        </aside>
      </div>
      <div className="toasts">
        {state.toasts.map(t => <div key={t.id} className="toast">{t.text}</div>)}
      </div>
    </div>
  );
}

function SummaryBar({ state }: { state: AppState }) {
  const s = state.summary!;
  const pieces = s.heartPiecesHeld ?? 0;
  return (
    <header className="summary">
      <div className="stat">
        <span className="stat-icon" style={{ color: '#ff3d5a' }}>♥</span>
        <div>
          <div className="stat-big">{s.hearts ?? '?'}<span className="stat-of">/{s.maxHeartsPossible}</span></div>
          <div className="stat-sub">hearts{pieces ? ` + ${pieces}/4 piece${pieces > 1 ? 's' : ''}` : ''}</div>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon" style={{ color: '#e8b931' }}>✦</span>
        <div>
          <div className="stat-big">{s.tokens ?? '?'}<span className="stat-of">/100</span></div>
          <div className="stat-sub">
            {s.claimable.length
              ? <span className="claim">ready to claim: {s.claimable.map(c => c.reward).join(', ')}</span>
              : s.nextReward ? `next: ${s.nextReward.reward} at ${s.nextReward.tokens}` : 'all rewards reached'}
          </div>
        </div>
      </div>
      <div className="stat stat-wide">
        <div className="stat-big">{s.percent.toFixed(1)}%</div>
        <div className="bar big"><div className="fill" style={{ width: `${s.percent}%` }} /></div>
        <div className="stat-sub">{s.doneA} of {s.totalA} checklist entries</div>
      </div>
      <div className="stat slotinfo">
        <div className="stat-mid">{state.activeSlot?.replace('slot_', 'Slot ')}{s.area ? ` · ${s.area}` : ''}</div>
        <div className="stat-sub">saved {timeAgo(s.lastSavedMs)}</div>
      </div>
    </header>
  );
}

function Toolbar({ state, cards, prefs, onPrefs }: { state: AppState; cards: Card[]; prefs: UiPrefs; onPrefs: (p: UiPrefs) => void }) {
  const [catsOpen, setCatsOpen] = useState(false);
  const recent = [...state.slots].sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return (
    <div className="toolbar">
      <label>
        Slot&nbsp;
        <select value={state.slotMode === 'recent' ? '' : state.activeSlot} onChange={e => void api.pinSlot(e.target.value || null)}>
          <option value="">Most recent ({recent?.name})</option>
          {state.slots.map(s => (
            <option key={s.name} value={s.name}>{s.name} · {s.area ?? '?'} · {timeAgo(s.mtimeMs)}</option>
          ))}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={prefs.hideCollected} onChange={e => onPrefs({ ...prefs, hideCollected: e.target.checked })} /> Hide collected</label>
      <span className="btn-pair">
        <button title="Collapse every category" onClick={() => onPrefs({ ...prefs, collapsed: [...cards.map(c => c.id), ...(prefs.collapsed ?? []).filter(x => x === '__available')] })}>Collapse all</button>
        <button title="Expand every category" onClick={() => onPrefs({ ...prefs, collapsed: (prefs.collapsed ?? []).filter(x => x === '__available') })}>Expand all</button>
      </span>
      <label className="check"><input type="checkbox" checked={prefs.showParts.B} onChange={e => onPrefs({ ...prefs, showParts: { ...prefs.showParts, B: e.target.checked } })} /> Quest progress</label>
      <label className="check"><input type="checkbox" checked={prefs.showParts.C} onChange={e => onPrefs({ ...prefs, showParts: { ...prefs.showParts, C: e.target.checked } })} /> Extras</label>
      <div className="dropdown">
        <button onClick={() => setCatsOpen(o => !o)}>Categories ▾</button>
        {catsOpen && (
          <div className="dropdown-menu" onMouseLeave={() => setCatsOpen(false)}>
            {cards.map(c => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={!prefs.hiddenCategories.includes(c.id)}
                  onChange={e => onPrefs({ ...prefs, hiddenCategories: e.target.checked ? prefs.hiddenCategories.filter(x => x !== c.id) : [...prefs.hiddenCategories, c.id] })} />
                <span className="dot" style={{ background: categoryColor(c.colorCat) }} /> {c.label}
              </label>
            ))}
          </div>
        )}
      </div>
      <span className="spacer" />
      <button className={state.overlay.visible ? 'on' : ''} onClick={() => void api.toggleOverlay()} title={`Show/hide overlay (${state.hotkeys.toggleOverlay})`}>
        Overlay {state.overlay.visible ? 'on' : 'off'}
      </button>
      <SettingsButton state={state} />
      <button onClick={() => void api.browseFolder()} title={state.saveDir}>Save folder…</button>
      <label className="check"><input type="checkbox" checked={state.devPanel} onChange={e => void api.setDevPanel(e.target.checked)} /> Developer</label>
    </div>
  );
}

/** "Can get now": Part A entries the logic says are obtainable, current area first. */
function AvailablePanel({ state, open, selected, onSelect, onToggle, height, onResize }: { state: AppState; open: boolean; selected: string | null; onSelect: (id: string) => void; onToggle: (open: boolean) => void; height?: number; onResize: (h: number) => void }) {
  const groups = new Map<string, AvailableEntry[]>();
  for (const a of state.available) groups.set(a.region, [...(groups.get(a.region) ?? []), a]);
  // Drag the bottom edge to resize; the height is saved shortly after you stop.
  const ref = useRef<HTMLElement>(null);
  const resizeRef = useRef(onResize);
  resizeRef.current = onResize;
  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) { first = false; return; } // ignore the initial layout
      clearTimeout(t);
      t = setTimeout(() => resizeRef.current(Math.round(el.getBoundingClientRect().height)), 400);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [open]);
  return (
    <section ref={ref} className={`available ${open ? '' : 'closed'}`} style={open ? { height: height ?? 220 } : undefined}>
      <button className="avail-head" onClick={() => onToggle(!open)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        <b>Can get now</b>
        <span className="muted">{state.available.length} entries in {groups.size} areas{state.canBeAdult ? '' : ' · child only until you can travel through time'}</span>
      </button>
      {open && (
        <div className="avail-groups">
          {state.available.length === 0 && <span className="muted small">Nothing obtainable right now according to the logic.</span>}
          {[...groups].map(([region, list]) => (
            <div key={region} className={`avail-group ${list[0].here ? 'here' : ''}`}>
              <div className="avail-region">{list[0].here && <span className="here-tag">you are here</span>}{region} <span className="muted">({list.length})</span></div>
              <div className="avail-chips">
                {list.map(a => (
                  <button key={a.id} className={`chip ${selected === a.id ? 'selected' : ''}`} onClick={() => onSelect(a.id)}
                    title={`${a.categoryLabel} #${a.number}${a.unsure ? '\nRequirements unconfirmed in the remake' : ''}`}>
                    <span className="dot" style={{ background: categoryColor(a.categoryId) }} />
                    {a.categoryId === 'gold_skulltulas' ? `GS ${a.number}: ` : ''}{a.name.replace(/^[^:]+: /, '')}
                    {state.canBeAdult && a.ages.length === 1 && <span className={`age ${a.ages[0]}`}>{a.ages[0]}</span>}
                    {a.night && <span className="age night">night</span>}
                    {a.unsure && <span className="age unsure">?</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsButton({ state }: { state: AppState }) {
  const [open, setOpen] = useState(false);
  const [hk, setHk] = useState({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay });
  useEffect(() => setHk({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay }), [state.hotkeys.toggleOverlay, state.hotkeys.lockOverlay]);
  const o = state.overlay;
  return (
    <div className="dropdown">
      <button onClick={() => setOpen(x => !x)}>Settings ▾</button>
      {open && (
        <div className="settings-pop">
          <b>Overlay</b>
          <label>Opacity: {Math.round(o.opacity * 100)}%
            <input type="range" min={0.2} max={1} step={0.05} value={o.opacity} onChange={e => void api.setOverlay({ opacity: Number(e.target.value) })} />
          </label>
          <label>Shows
            <select value={o.mode} onChange={e => void api.setOverlay({ mode: e.target.value as OverlayMode })}>
              <option value="counters">Category counters</option>
              <option value="remaining">Remaining in the current area</option>
              <option value="available">Can get now</option>
            </select>
          </label>
          <button onClick={() => void api.toggleOverlayLock()}>{o.locked ? 'Unlock overlay (to move/resize)' : 'Lock overlay (click-through)'}</button>
          <b>Hotkeys</b>
          <label>Show/hide overlay <input value={hk.toggleOverlay} onChange={e => setHk({ ...hk, toggleOverlay: e.target.value })} /></label>
          <label>Lock/unlock overlay <input value={hk.lockOverlay} onChange={e => setHk({ ...hk, lockOverlay: e.target.value })} /></label>
          <span className="muted small">Format like Control+Shift+O, Alt+F9. Works while the game has focus.</span>
          <button className="primary" onClick={() => void api.setHotkeys(hk)}>Save hotkeys</button>
          {state.hotkeys.errors.map(e => <span key={e} className="err">{e}</span>)}
        </div>
      )}
    </div>
  );
}

function CardView({ card, hideCollected, selected, onSelect, collapsed, onToggle }: { card: Card; hideCollected: boolean; selected: string | null; onSelect: (id: string) => void; collapsed: boolean; onToggle: () => void }) {
  const pct = card.total ? (card.done / card.total) * 100 : 0;
  const complete = card.total > 0 && card.done === card.total;
  const wide = !!card.wide && !collapsed;
  return (
    <div className={`card ${wide ? 'wide' : ''} ${complete ? 'complete' : ''} ${collapsed ? 'collapsed' : ''}`} style={{ ['--cat' as string]: categoryColor(card.colorCat) }}>
      <button className="card-head" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
        <span className="chev">{collapsed ? '▸' : '▾'}</span>
        <span className="card-title">{card.label}</span>
        <span className="card-count">{card.kind === 'counter' && card.value === null ? '?' : card.done}/{card.total}</span>
      </button>
      <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
      {!collapsed && (
        <>
          {card.hint && <div className="hint">{card.hint}</div>}
          {card.kind === 'counter' ? (
            <div className="counter-note">{card.value === null ? 'not readable from this save' : `${card.value} of ${card.max}`}{card.counterConfidence === 'guess' ? ' · unconfirmed' : ''}</div>
          ) : card.sections.map((s, i) => {
            const tiles = hideCollected ? s.tiles.filter(t => tileItems(t).some(x => !x.done)) : s.tiles;
            return (
              <div key={i} className={`section ${s.style ?? ''}`}>
                {s.title && <div className="section-title">{s.title}</div>}
                <div className="tiles">
                  {tiles.map(t => t.kind === 'single'
                    ? <Tile key={t.key} catId={t.categoryId} item={t.item} major={s.style === 'major'} numbered={s.style === 'numbered'} selected={selected === t.item.id} onSelect={onSelect} />
                    : <StackTile key={t.key} stack={t} selected={selected === t.key} onSelect={onSelect} />)}
                  {hideCollected && !tiles.length && <div className="muted small">All collected</div>}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/** One tile for several rows (an item and its upgrades, or all bottles). */
function StackTile({ stack, selected, onSelect }: { stack: Extract<TileModel, { kind: 'stack' }>; selected: boolean; onSelect: (id: string) => void }) {
  const items = stack.members.map(m => m.item);
  const n = items.filter(i => i.done).length;
  const icon = icons.get('', stack.categoryId === 'bottles' ? 'bottles' : 'items', stack.iconName);
  const cls = ['tile', 'stack', n === items.length ? 'done' : n > 0 ? 'partial' : 'todo', items.some(i => i.justCollected) ? 'glow' : '', selected ? 'selected' : ''].join(' ');
  return (
    <button className={cls} style={{ ['--c' as string]: icon.color }} onClick={() => onSelect(stack.key)}
      title={`${stack.label}: ${n} of ${items.length}\n${stack.members.map(m => `${m.item.done ? '✓' : '·'} ${m.item.name}`).join('\n')}`}>
      <span className="glyph">{icon.symbol ? <Symbol name={icon.symbol} size={26} /> : icon.glyph}</span>
      <span className="level">{n}/{items.length}</span>
      <span className="pips">{items.map(i => <i key={i.id} className={i.done ? 'on' : ''} />)}</span>
      <span className="tile-label">{stack.label}</span>
    </button>
  );
}

function Tile({ catId, item, selected, onSelect, major, numbered }: { catId: string; item: TrackedItem; selected: boolean; onSelect: (id: string) => void; major?: boolean; numbered?: boolean }) {
  const icon = icons.get(item.iconId, catId, item.name);
  const cls = [
    'tile',
    item.done ? 'done' : 'todo',
    item.state === 'unmapped' && !item.done ? 'unmapped' : '',
    item.manual ? 'manual' : '',
    item.justCollected ? 'glow' : '',
    selected ? 'selected' : '',
    numbered ? 'small' : '',
    major ? 'major' : '',
  ].join(' ');
  return (
    <button className={cls} style={{ ['--c' as string]: icon.color }} onClick={() => onSelect(item.id)}
      onDoubleClick={() => item.state !== 'yes' && void api.toggleManual(item.id)}
      title={`${item.number}. ${item.name}${item.region ? `\n${item.region}` : ''}`}>
      <span className="glyph">{numbered ? item.number : icon.symbol ? <Symbol name={icon.symbol} size={26} /> : icon.glyph}</span>
      {item.manual && <span className="badge m">M</span>}
      {item.confidence === 'guess' && item.state === 'yes' && <span className="badge g" title="unconfirmed mapping">?</span>}
      {!numbered && <span className="tile-label">{shortName(item.name)}</span>}
    </button>
  );
}

/** Tile caption: "Heart Container (Gohma)" -> "Gohma", "Kokiri Tunic (Hero's Clothes)" -> "Kokiri Tunic". */
function shortName(n: string): string {
  const inner = n.match(/^Heart Container \((.+)\)$/);
  if (inner) return inner[1];
  const afterColon = n.includes(': ') ? n.slice(n.indexOf(': ') + 2) : n;
  return afterColon.replace(/\s*\([^()]*\)$/, '').slice(0, 30);
}

/** Details for a combined tile: each part with its own status and hand-tick button. */
function StackDetails({ stack, onShow, onClose }: { stack: Extract<TileModel, { kind: 'stack' }>; onShow: (id: string) => void; onClose: () => void }) {
  const n = stack.members.filter(m => m.item.done).length;
  return (
    <div className="panel details">
      <div className="panel-head">
        <span className="dot" style={{ background: categoryColor(stack.categoryId) }} />
        <span>{stack.label}: {n} of {stack.members.length}</span>
        <button className="x" onClick={onClose}>×</button>
      </div>
      <h3>{stack.label}</h3>
      <div className="members">
        {stack.members.map(({ categoryLabel, item }) => (
          <div key={item.id} className={`member ${item.done ? 'is-done' : ''}`}>
            <span className="mark">{item.done ? '✓' : item.state === 'unmapped' ? '?' : '·'}</span>
            <div className="member-body">
              <button className="link" onClick={() => onShow(item.id)}>{item.name}</button>
              <span className="muted small"> {categoryLabel} #{item.number}{item.region ? ` · ${item.region}` : ''}</span>
              {!item.done && item.logic?.ages.length ? <span className="age ok-tag">can get now</span> : null}
              {item.manual && <span className="muted small"> (ticked by hand)</span>}
            </div>
            {item.state !== 'yes' && (
              <button className="small-btn" onClick={() => void api.toggleManual(item.id)}>{item.manual ? 'Untick' : 'Tick'}</button>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">Click a name for its full details.</p>
    </div>
  );
}

function Details({ cat, item, onClose }: { cat: TrackedCategory; item: TrackedItem; onClose: () => void }) {
  const stateText = item.state === 'yes' ? 'Collected (from your save)'
    : item.manual ? 'Ticked by hand'
    : item.state === 'unmapped' ? 'Not detected yet: the tracker can’t read this from the save yet'
    : item.state === 'unknown' ? 'Unknown: this save is missing the key'
    : 'Not collected';
  // Show only checklist columns not already shown as Where / Area / Needs / the name.
  const shown = new Set([item.region, item.chapter, item.requirement].filter(Boolean));
  const extra = Object.entries(item.details ?? {}).filter(([, v]) => !shown.has(v) && !item.name.includes(v));
  return (
    <div className="panel details">
      <div className="panel-head">
        <span className="dot" style={{ background: categoryColor(cat.id) }} />
        <span>{cat.label} #{item.number}</span>
        <button className="x" onClick={onClose}>×</button>
      </div>
      <h3>{item.name}{item.newInRemake && <span className="new">new in remake</span>}</h3>
      {item.region && <p><b>Where:</b> {item.region}</p>}
      {item.chapter && item.chapter !== item.region && <p><b>Area:</b> {item.chapter}</p>}
      {item.requirement && <p><b>Needs:</b> {item.requirement}</p>}
      {extra.map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}
      <p className={`status s-${item.done ? 'done' : item.state}`}>{stateText}</p>
      {item.logic && !item.done && (
        <p className="logic small">
          {item.logic.ages.length
            ? <><b className="ok">Can get now</b> as {item.logic.ages.join(' or ')}{item.logic.night ? ' (at night)' : ''}.</>
            : <><b>Not yet.</b> Missing: {item.logic.missing.join(', ')}.</>}
          {item.logic.needs && <><br />Needs: <code>{item.logic.needs}</code></>}
          {item.logic.note && <><br />{item.logic.note}</>}
          {item.logic.unsure && <><br /><span className="muted">These requirements are unconfirmed for the remake.</span></>}
        </p>
      )}
      {item.state !== 'yes' && (
        <button className="primary" onClick={() => void api.toggleManual(item.id)}>{item.manual ? 'Remove manual tick' : 'Tick by hand'}</button>
      )}
      {item.confidence && (
        <p className="muted small">Detection: <b>{item.confidence}</b>{item.evidence ? `: ${item.evidence}` : ''}</p>
      )}
      {(item.evidence?.startsWith('Identified by you') || item.evidence?.startsWith('You identified')) && (
        <button className="link" onClick={() => void api.forgetIdentification(item.id)}>That was wrong: undo this identification</button>
      )}
      {!item.confidence && item.evidence && <p className="muted small">{item.evidence}</p>}
    </div>
  );
}

function IdentifyCard({ q, more, onShow }: { q: AppState['identify'][number]; more: number; onShow: (id: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [q.id]);
  const one = q.pick === 1;
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < q.pick ? [...p, id] : p));
  return (
    <div className="panel identify">
      <div className="panel-head"><span>Which one was it?</span>{more > 0 && <span className="muted">+{more} more</span>}</div>
      <p>
        You collected {one ? 'a' : q.pick} <b>{q.categoryLabel.replace(/s$/, '')}{one ? '' : 's'}</b> in <b>{q.area}</b>.
        {one ? ' Which one?' : ` Pick the ${q.pick} you got.`}
      </p>
      <div className="cands">
        {q.candidates.map(c => (
          <button key={c.id} className={picked.includes(c.id) ? 'on' : ''}
            onClick={() => (one ? void api.answerIdentify(q.id, [c.id]) : toggle(c.id))}
            onMouseEnter={() => onShow(c.id)}>
            <b>#{c.number}</b> {c.name.replace(/^[^:]+: /, '')}
          </button>
        ))}
      </div>
      <div className="row">
        {!one && <button className="primary" disabled={picked.length !== q.pick} onClick={() => void api.answerIdentify(q.id, picked)}>Save ({picked.length}/{q.pick})</button>}
        <button className="link" onClick={() => void api.skipIdentify(q.id)}>Not sure, skip</button>
      </div>
      <p className="muted small">Skipping is fine: it still counts, just not on a specific tile.</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="panel legend">
      <div className="panel-head"><span>Legend</span></div>
      <div className="leg"><span className="tile done mini" style={{ ['--c' as string]: '#4fc39b' }} /> Collected</div>
      <div className="leg"><span className="tile todo mini" style={{ ['--c' as string]: '#4fc39b' }} /> Not collected yet</div>
      <div className="leg"><span className="tile todo unmapped mini" /> Not detected yet (tick by hand)</div>
      <div className="leg"><span className="tile done manual mini" style={{ ['--c' as string]: '#4fc39b' }}><span className="badge m">M</span></span> Ticked by hand</div>
      <p className="muted small">Click an entry for details. Double-click to tick or untick it by hand.</p>
    </div>
  );
}

function DevPanel({ state }: { state: AppState }) {
  const [label, setLabel] = useState('');
  const ch = state.lastChanges;
  return (
    <div className="panel dev">
      <div className="panel-head"><span>Developer</span></div>
      <div className="row">
        <input placeholder="snapshot label, e.g. before-skulltula" value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { void api.takeSnapshot(label); setLabel(''); } }} />
        <button className="primary" onClick={() => { void api.takeSnapshot(label); setLabel(''); }}>Snapshot</button>
      </div>
      <button className="link" onClick={() => void api.openSnapshotFolder()}>Open snapshot folder</button>
      <p className="small">Spots you identified: <b>{state.learnedCount}</b>{' '}
        <button className="link" onClick={() => void api.exportLearned().then(msg => alert(msg))}>Write them into the mapping file</button>
      </p>
      {state.snapshotDiff && (
        <>
          <h4>Since previous snapshot ({state.snapshotDiff.rows.length})</h4>
          <Rows rows={state.snapshotDiff.rows} />
        </>
      )}
      <h4>Latest save {ch ? `(${ch.slot}, ${timeAgo(ch.atMs)})` : ''}</h4>
      {!ch && <p className="muted small">Changes appear here after the game writes its next save.</p>}
      {ch && (
        <>
          <p className="small"><b>Tracked keys</b> ({ch.known.length})</p>
          <Rows rows={ch.known} />
          <p className="small"><b>Other keys</b> ({ch.unknown.length}, {ch.hiddenNoise} play-time/position keys hidden)</p>
          <Rows rows={ch.unknown} />
        </>
      )}
    </div>
  );
}

function Rows({ rows }: { rows: ChangeRow[] }) {
  if (!rows.length) return <p className="muted small">none</p>;
  return (
    <table className="rows">
      <tbody>
        {rows.slice(0, 80).map(r => (
          <tr key={r.key} title={r.entries?.join('\n')}>
            <td className="mono">{r.name ?? r.key}</td>
            <td className="mono">{r.old} → {r.new}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
