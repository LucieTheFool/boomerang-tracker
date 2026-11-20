import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, TrackedCategory, TrackedItem, UiPrefs, ChangeRow, OverlayMode, AvailableEntry, AvailableFilters } from '../shared/types';
import { api } from './api';
import { recentLabel, recentTitle, slotLabel, slotTitle, timeAgo } from './slot-label';
import { symbolIcons, categoryColor } from './icons';
import { Symbol } from './symbols';
import { buildCards, keysView, tileItems, Card, TileModel } from './view';
import { Masonry } from './Masonry';
import { NO_FILTERS, entryLabel, filterCanGetNow, filterChoices, hasActiveFilters } from './filter';

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

  // saveAfterMs: wait before writing settings (typing). Any later change writes the newest prefs anyway.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updatePrefs = (p: UiPrefs, saveAfterMs = 0) => {
    setPrefs(p);
    clearTimeout(saveTimer.current);
    if (saveAfterMs) saveTimer.current = setTimeout(() => void api.setPrefs(p), saveAfterMs);
    else void api.setPrefs(p);
  };

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
            {state.platform === 'linux'
              ? <p className="muted">Pick Hookshot's save folder (<code>~/.local/share/hookshot/save/&lt;id&gt;</code>), the game folder (Hookshot, Longshot, NX2navi's Triforce folder, ReLink, or Rekarina: <code>game/profile/save/&lt;id&gt;</code>), or the emulator's data folder. The tracker only ever reads your saves.</p>
              : <p className="muted">Pick the game folder (Hookshot, Longshot, NX2navi's Triforce folder, ReLink, or Rekarina), Fritchii's data folder (<code>%APPDATA%\fritchii</code>), or the <code>user\save\&lt;id&gt;</code> folder inside it (Rekarina: <code>game\profile\save\&lt;id&gt;</code>). The tracker only ever reads your saves.</p>}
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
        filters={{ ...NO_FILTERS, ...prefs.availableFilters }} onFilters={(f, saveAfterMs) => updatePrefs({ ...prefs, availableFilters: f }, saveAfterMs)}
        onToggle={open => updatePrefs({ ...prefs, collapsed: open ? (prefs.collapsed ?? []).filter(x => x !== '__available') : [...(prefs.collapsed ?? []), '__available'] })} />
      <div className="body">
        <main className="grid-wrap">
          <KeysPanel state={state} open={!(prefs.collapsed ?? []).includes('__keys')}
            onToggle={open => updatePrefs({ ...prefs, collapsed: open ? (prefs.collapsed ?? []).filter(x => x !== '__keys') : [...(prefs.collapsed ?? []), '__keys'] })} />
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
            : selectedItem ? <Details cat={selectedItem.cat} item={selectedItem.item} dev={state.devPanel} onClose={() => setSelected(null)} /> : <Legend />}
          {state.devPanel && <DevPanel state={state} />}
        </aside>
      </div>
      <div className="toasts">
        {state.toasts.map(t => <div key={t.id} className="toast">{t.text}</div>)}
      </div>
    </div>
  );
}

/** Per-dungeon key status, worded from the data (see keysView). Hidden when no dungeon has key data. */
function KeysPanel({ state, open, onToggle }: { state: AppState; open: boolean; onToggle: (open: boolean) => void }) {
  const rows = useMemo(() => keysView(state.categories, state), [state.categories, state.keys]);
  if (!rows.length) return null;
  return (
    <section className="keys-panel">
      <button className="card-head" onClick={() => onToggle(!open)} title={open ? 'Collapse' : 'Expand'}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        <span className="card-title">Keys</span>
        <span className="small">not counted</span>
      </button>
      {open && <ul className="keys-list">
        {rows.map(r => <li key={r.dungeon} className={r.pickups && r.pickups.done === r.pickups.total && r.bossKey !== false ? 'complete' : ''}>{r.text}</li>)}
      </ul>}
    </section>
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
        <div className="stat-sub">
          <LiveBadge state={state} /> saved {timeAgo(s.lastSavedMs)}
        </div>
      </div>
    </header>
  );
}

function Toolbar({ state, cards, prefs, onPrefs }: { state: AppState; cards: Card[]; prefs: UiPrefs; onPrefs: (p: UiPrefs) => void }) {
  const [catsOpen, setCatsOpen] = useState(false);
  const recent = [...state.slots].sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  const selected = state.slotMode === 'recent' ? recent : state.slots.find(s => s.name === state.activeSlot);
  return (
    <div className="toolbar">
      <label>
        Slot&nbsp;
        <select value={state.slotMode === 'recent' ? '' : state.activeSlot} title={selected && slotLabel(selected)} onChange={e => void api.pinSlot(e.target.value || null)}>
          <option value="" title={recentTitle(recent)}>{recentLabel(recent)}</option>
          {state.slots.map(s => (
            <option key={s.name} value={s.name} title={slotTitle(s)}>{slotLabel(s)}</option>
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
    </div>
  );
}

/** "Can get now": Part A entries the logic says are obtainable, current area first. */
function AvailablePanel({ state, open, selected, onSelect, onToggle, height, onResize, filters, onFilters }: { state: AppState; open: boolean; selected: string | null; onSelect: (id: string) => void; onToggle: (open: boolean) => void; height?: number; onResize: (h: number) => void; filters: AvailableFilters; onFilters: (f: AvailableFilters, saveAfterMs?: number) => void }) {
  const total = state.available.length;
  const rows = filterCanGetNow(state.available, filters);
  const groups = new Map<string, AvailableEntry[]>();
  for (const a of rows) groups.set(a.region, [...(groups.get(a.region) ?? []), a]);
  const areaCount = new Set(state.available.map(a => a.region)).size;
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
        <span className="muted">{total} entries in {areaCount} areas{state.canBeAdult ? '' : ' · child only until you can travel through time'}</span>
      </button>
      {open && total > 0 && <AvailableFilterBar entries={state.available} shown={rows.length} filters={filters} onFilters={onFilters} />}
      {open && (
        <div className="avail-groups">
          {total === 0 && <span className="muted small">Nothing left to get with what you have right now.</span>}
          {total > 0 && rows.length === 0 && (
            <div className="avail-empty">
              <span className="muted small">No entries match these filters.</span>
              <button className="small-btn" onClick={() => onFilters(NO_FILTERS)}>Clear filters</button>
            </div>
          )}
          {[...groups].map(([region, list]) => (
            <div key={region} className={`avail-group ${list[0].here ? 'here' : ''}`}>
              <div className="avail-region">{list[0].here && <span className="here-tag">you are here</span>}{region} <span className="muted">({list.length})</span></div>
              <div className="avail-chips">
                {list.map(a => (
                  <button key={a.id} className={`chip ${selected === a.id ? 'selected' : ''}`} onClick={() => onSelect(a.id)}
                    title={`${a.categoryLabel} #${a.number}`}>
                    <span className="dot" style={{ background: categoryColor(a.categoryId) }} />
                    {entryLabel(a)}
                    {state.canBeAdult && a.ages.length === 1 && <span className={`age ${a.ages[0]}`}>{a.ages[0]}</span>}
                    {a.night && <span className="age night">night</span>}
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

/** Search box and filter chips above the "Can get now" list. */
function AvailableFilterBar({ entries, shown, filters, onFilters }: { entries: AvailableEntry[]; shown: number; filters: AvailableFilters; onFilters: (f: AvailableFilters, saveAfterMs?: number) => void }) {
  const set = (p: Partial<AvailableFilters>) => onFilters({ ...filters, ...p });
  const ages: { value: AvailableFilters['age']; label: string }[] = [{ value: null, label: 'All' }, { value: 'child', label: 'Child' }, { value: 'adult', label: 'Adult' }];
  return (
    <div className="avail-filters">
      <input placeholder="Search name or area" aria-label="Search name or area" value={filters.search}
        onChange={e => onFilters({ ...filters, search: e.target.value }, 400)} />
      <select aria-label="Area" className={filters.area != null ? 'on' : ''} value={filters.area ?? ''} onChange={e => set({ area: e.target.value || null })}>
        <option value="">All areas</option>
        {filterChoices(entries.map(a => a.region), filters.area).map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <select aria-label="Category" className={filters.category != null ? 'on' : ''} value={filters.category ?? ''} onChange={e => set({ category: e.target.value || null })}>
        <option value="">All categories</option>
        {filterChoices(entries.map(a => a.categoryLabel), filters.category).map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="btn-pair" role="group" aria-label="Age">
        {ages.map(a => (
          <button key={a.label} className={`chip ${filters.age === a.value ? 'on' : ''}`} aria-pressed={filters.age === a.value} onClick={() => set({ age: a.value })}>{a.label}</button>
        ))}
      </span>
      <button className={`chip ${filters.nightOnly ? 'on' : ''}`} aria-pressed={filters.nightOnly} onClick={() => set({ nightOnly: !filters.nightOnly })}>Night only</button>
      <button className={`chip ${filters.hereOnly ? 'on' : ''}`} aria-pressed={filters.hereOnly} title="Only entries in the area you are in" onClick={() => set({ hereOnly: !filters.hereOnly })}>Here</button>
      {hasActiveFilters(filters) && (
        <span className="avail-count">
          <span className="muted small">Showing {shown} of {entries.length}</span>
          {shown > 0 && <button className="small-btn" onClick={() => onFilters(NO_FILTERS)}>Clear filters</button>}
        </span>
      )}
    </div>
  );
}

/** Where the numbers come from right now: the running game, or the save files. */
function LiveBadge({ state }: { state: AppState }) {
  const l = state.live;
  // No live tracking on this system: always the saves, and why.
  if (state.platform !== 'win32') return <span className="live-badge" title={l.detail}>○ Saves</span>;
  if (!l.enabled || l.status === 'off' || l.status === 'unavailable') return null;
  if (l.using) return <span className="live-badge on" title="Reading progress live from the game (read-only)">● Live</span>;
  const text: Record<string, string> = {
    'no-game': 'Game not running: using saves',
    searching: 'Looking for the game\'s progress…',
    waiting: l.detail ?? 'Waiting for the game',
  };
  return <span className="live-badge" title={text[l.status] ?? ''}>{l.status === 'searching' ? '◌ Live…' : '○ Saves'}</span>;
}

function SettingsButton({ state }: { state: AppState }) {
  const [open, setOpen] = useState(false);
  const [hk, setHk] = useState({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay });
  useEffect(() => setHk({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay }), [state.hotkeys.toggleOverlay, state.hotkeys.lockOverlay]);
  // Close on a click outside the panel or on Escape.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const o = state.overlay;
  // Live tracking is Windows-only for now: elsewhere the toggle is off, with the reason.
  const liveOff = state.platform !== 'win32';
  return (
    <div className="dropdown" ref={ref}>
      <button className={open ? 'on' : ''} onClick={() => setOpen(x => !x)}>Settings ▾</button>
      {open && (
        <div className="settings-pop">
          <b>Saves</b>
          <span className="muted small path" title={state.saveDir}>{state.saveDir ?? 'No folder chosen'}</span>
          <button onClick={() => void api.browseFolder()}>Change save folder…</button>
          <b>Live tracking</b>
          <label className="check">
            <input type="checkbox" checked={state.live.enabled} disabled={liveOff} onChange={e => void api.setLive(e.target.checked)} /> Read progress live from the running game
          </label>
          {liveOff
            ? <span className="muted small">{state.live.detail}</span>
            : <span className="muted small">Works with Hookshot, Longshot, NX2navi, ReLink, Rekarina and Fritchii. Read-only: the tracker only looks at the game's memory, it never changes anything. Uses your saves whenever the game isn't running.</span>}
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
          <b>Advanced</b>
          <label className="check">
            <input type="checkbox" checked={state.changeLog.enabled} onChange={e => void api.setChangeLog(e.target.checked)} /> Keep a change log
          </label>
          <span className="muted small">Notes every change the tracker sees, with the time and area, in a file on this PC.</span>
          <button onClick={() => void api.openLogFolder()}>Open log folder</button>
          <label className="check">
            <input type="checkbox" checked={state.devPanel} onChange={e => void api.setDevPanel(e.target.checked)} /> Developer tools
          </label>
          <span className="muted small">Adds a panel with save snapshots and the raw values that changed, and shows how each entry is detected.</span>
          <span className="muted small version">Boomerang Tracker v{state.version}</span>
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
          {card.kind === 'counter' && (
            <div className="counter-note">{card.value === null ? 'Not in this save yet' : `${card.value} of ${card.max}`}</div>
          )}
          {card.sections.map((s, i) => {
            const tiles = hideCollected ? s.tiles.filter(t => tileItems(t).some(x => !x.done)) : s.tiles;
            return (
              <div key={i} className={`section ${s.style ?? ''}`}>
                {s.title && <div className="section-title">{s.title}</div>}
                <div className="tiles">
                  {tiles.map(t => t.kind === 'single'
                    ? <Tile key={t.key} catId={t.categoryId} item={t.item} noManual={card.kind === 'counter'} major={s.style === 'major'} numbered={s.style === 'numbered'} selected={selected === t.item.id} onSelect={onSelect} />
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

function Tile({ catId, item, selected, onSelect, major, numbered, noManual }: { catId: string; item: TrackedItem; selected: boolean; onSelect: (id: string) => void; major?: boolean; numbered?: boolean; noManual?: boolean }) {
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
      onDoubleClick={() => !noManual && item.state !== 'yes' && void api.toggleManual(item.id)}
      title={`${numbered ? `#${item.number} ` : ''}${item.name}${item.where ? `\n${item.where}` : ''}`}>
      <span className="glyph">{numbered ? item.number : icon.symbol ? <Symbol name={icon.symbol} size={26} /> : icon.glyph}</span>
      {item.manual && <span className="badge m">M</span>}
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
            <span className="mark">{item.done ? '✓' : '·'}</span>
            <div className="member-body">
              <button className="link" onClick={() => onShow(item.id)}>{item.name}</button>
              <span className="muted small"> {categoryLabel} #{item.number}{item.chapter ? ` · ${item.chapter}` : ''}</span>
              {!item.done && item.logic?.ages.length ? <span className="age ok-tag">can get now</span> : null}
              {item.manual && <span className="muted small"> (ticked by hand)</span>}
            </div>
            {item.state !== 'yes' && (
              <button className="small-btn" onClick={() => void api.toggleManual(item.id)}>{item.manual ? 'Untick' : 'Tick'}</button>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">Click a name to see where it is.</p>
    </div>
  );
}

function Details({ cat, item, dev, onClose }: { cat: TrackedCategory; item: TrackedItem; dev: boolean; onClose: () => void }) {
  const stateText = item.state === 'yes' ? 'Collected'
    : item.manual ? 'Ticked by hand'
    : item.state === 'unmapped' ? 'The tracker can’t see this one in your save. Tick it by hand once you have it.'
    : 'Not collected yet';
  // "Lake Hylia: Tunnel on the south-west shore" -> heading "Tunnel on the south-west shore", area below it.
  const title = item.chapter && item.name.startsWith(`${item.chapter}: `) ? item.name.slice(item.chapter.length + 2) : item.name;
  const identified = ['Identified by you', 'You identified', 'Recognised automatically'].some(p => item.evidence?.startsWith(p));
  // Checklist columns from a local checklist, shown with the developer tools.
  const shown = new Set([item.chapter, item.requirement].filter(Boolean));
  const extra = dev ? Object.entries(item.details ?? {}).filter(([, v]) => !shown.has(v) && !item.name.includes(v)) : [];
  return (
    <div className="panel details">
      <div className="panel-head">
        <span className="dot" style={{ background: categoryColor(cat.id) }} />
        <span>{cat.label} #{item.number}</span>
        <button className="x" onClick={onClose} title="Close">×</button>
      </div>
      <h3>{title}{item.newInRemake && <span className="new">new in remake</span>}</h3>
      {item.chapter && <p className="area">{item.chapter}</p>}
      {item.where && <p className="where">{item.where}</p>}
      <p className={`status s-${item.done ? 'done' : item.state}`}>{stateText}</p>
      {item.logic && !item.done && (
        <p className="logic small">
          {item.logic.ages.length
            ? <><b className="ok">You can get this now</b> as {item.logic.ages.join(' or ')}{item.logic.night ? ', at night' : ''}.</>
            : <><b>Not yet.</b> Still needed: {item.logic.missing.map(needText).join('; ')}.</>}
          {item.logic.note && <><br />{item.logic.note}</>}
        </p>
      )}
      {item.state !== 'yes' && (
        <button className="primary" onClick={() => void api.toggleManual(item.id)}>{item.manual ? 'Remove hand tick' : 'Tick by hand'}</button>
      )}
      {identified && (
        <button className="link" onClick={() => void api.forgetIdentification(item.id)}>Wrong spot? Undo this match</button>
      )}
      {dev && (
        <div className="dev-info small">
          {item.requirement && <p><b>Requirement:</b> {item.requirement}</p>}
          {extra.map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}
          {item.logic?.needs && <p><b>Logic:</b> <code>{item.logic.needs}</code></p>}
          {item.confidence
            ? <p><b>Detection:</b> {item.confidence}{item.evidence ? `: ${item.evidence}` : ''}</p>
            : item.evidence && <p>{item.evidence}</p>}
        </div>
      )}
    </div>
  );
}

/** A "still needed" entry as a phrase: "adult" -> "to be an adult", "reach X as child" -> "a way to X as a child". */
function needText(m: string): string {
  if (m === 'adult') return 'to be an adult';
  if (m === 'child') return 'to be a child';
  const r = m.match(/^reach (.+) as (child|adult)$/);
  if (r) return `a way to ${r[1]} as ${r[2] === 'adult' ? 'an adult' : 'a child'}`;
  return m;
}

function IdentifyCard({ q, more, onShow }: { q: AppState['identify'][number]; more: number; onShow: (id: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  useEffect(() => { setPicked([]); setShowOthers(false); }, [q.id]);
  const one = q.pick === 1;
  const shown = showOthers && q.others ? [...q.candidates, ...q.others] : q.candidates;
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < q.pick ? [...p, id] : p));
  return (
    <div className="panel identify">
      <div className="panel-head"><span>Which one was it?</span>{more > 0 && <span className="muted">+{more} more</span>}</div>
      <p>
        You collected {one ? 'a' : q.pick} <b>{q.categoryLabel.replace(/s$/, '')}{one ? '' : 's'}</b> in <b>{q.area}</b>.
        {one ? ' Which one?' : ` Pick the ${q.pick} you got.`}
      </p>
      <div className="cands">
        {shown.map(c => (
          <button key={c.id} className={picked.includes(c.id) ? 'on' : ''}
            onClick={() => (one ? void api.answerIdentify(q.id, [c.id]) : toggle(c.id))}
            onMouseEnter={() => onShow(c.id)}>
            <b>#{c.number}</b> {c.name.replace(/^[^:]+: /, '')}
          </button>
        ))}
      </div>
      <div className="row">
        {!one && <button className="primary" disabled={picked.length !== q.pick} onClick={() => void api.answerIdentify(q.id, picked)}>Save ({picked.length}/{q.pick})</button>}
        {q.others?.length && !showOthers ? (
          <button className="link" onClick={() => setShowOthers(true)}>Not here? Show the {q.others.length} in other areas</button>
        ) : null}
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
      <div className="leg"><span className="tile done manual mini" style={{ ['--c' as string]: '#4fc39b' }}><span className="badge m">M</span></span> Ticked by hand</div>
      <p className="muted small">Click an entry to see where it is and what you still need for it. Double-click to tick or untick it by hand.</p>
    </div>
  );
}

function DevPanel({ state }: { state: AppState }) {
  const [label, setLabel] = useState('');
  const ch = state.lastChanges;
  return (
    <div className="panel dev">
      <div className="panel-head"><span>Developer tools</span></div>
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
