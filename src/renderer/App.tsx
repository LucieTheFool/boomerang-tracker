import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, TrackedCategory, TrackedItem, UiPrefs, ChangeRow, OverlayMode, AvailableEntry, AvailableFilters, PadState, ChecklistLayout } from '../shared/types';
import { api } from './api';
import { recentLabel, recentTitle, slotLabel, slotTitle, timeAgo } from './slot-label';
import { symbolIcons, categoryColor } from './icons';
import { Symbol } from './symbols';
import { buildCards, fitCardWidth, tileItems, Card, TileModel } from './view';
import { Masonry } from './Masonry';
import { WipCardView } from './WipSections';
import { GuideTour } from './GuideTour';
import { guideSteps, updatesStepFor } from './guide';
import { useUpdates, UpdatesSection, UpdateBanner } from './updates';
import { wipCards } from './wip';
import { NO_FILTERS, entryLabel, filterCanGetNow, filterChoices, hasActiveFilters } from './filter';

const icons = symbolIcons;

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [prefs, setPrefs] = useState<UiPrefs | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [, tick] = useState(0);
  /** Update state from the main process: the banner + the guide's opt-in step. */
  const updates = useUpdates();

  useEffect(() => {
    void api.getState().then(setState);
    void api.getPrefs().then(setPrefs);
    const off = api.onState(setState);
    const t = setInterval(() => tick(x => x + 1), 15000); // keep "x min ago" fresh
    return () => { off(); clearInterval(t); };
  }, []);
  // Settings live in a separate window; re-read prefs when this window is focused
  // again so changes there (and a replayed guide) apply without a reload.
  useEffect(() => {
    const h = () => { void api.getPrefs().then(setPrefs); };
    window.addEventListener('focus', h);
    return () => window.removeEventListener('focus', h);
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
    for (const c of state.categories) for (const i of [...c.items, ...(c.spots ?? [])]) if (i.id === selected) return { cat: c, item: i };
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

  // The middle column shows whatever the sidebar has checked: the full checklist (default),
  // or an individual selection (checklistAll off + the unchecked categories in hiddenCategories).
  const checklistAll = prefs.checklistAll !== false;
  const partOn = (c: Card) => (c.part === 'A' ? true : c.part === 'B' ? !!prefs.showParts.B : !!prefs.showParts.C);
  const visible = (c: Card) => partOn(c) && !(prefs.sidebarHidden ?? []).includes(c.id) && (checklistAll || !prefs.hiddenCategories.includes(c.id));
  const parts: { part: 'A' | 'B' | 'C'; title: string }[] = [
    { part: 'A', title: '100% checklist' },
    { part: 'B', title: 'Quest progress' },
    { part: 'C', title: 'Extras (not counted)' },
  ];
  const visibleCards = cards.filter(visible);
  // Checking a single category switches to individual selection; unchecking the last one returns to the full checklist.
  const toggleCategory = (id: string) => {
    const hiding = !prefs.hiddenCategories.includes(id);
    const hidden = hiding ? [...prefs.hiddenCategories, id] : prefs.hiddenCategories.filter(x => x !== id);
    updatePrefs({ ...prefs, checklistAll: hidden.length === 0, hiddenCategories: hidden });
  };
  const showAllCategories = () => updatePrefs({ ...prefs, checklistAll: true, hiddenCategories: [] });
  const adv = !!prefs.advanced; // advanced surfaces: live read, change log, dev tools (default off)

  // Card flow (Settings → Advanced): column-fill (default) packs cards down the
  // left column and continues in the next column at the visible bottom; fit sizes
  // each card to its tiles and wraps; stack is one card per row.
  const layout = prefs.layout ?? 'masonry';
  // The right rail appears only when it has something to show.
  const showSide = state.identify.length > 0 || selectedItem !== null || (adv && state.devPanel);
  const cardNode = (c: Card) => (
    <CardView key={c.id} card={c} hideCollected={prefs.hideCollected} selected={selected} onSelect={setSelected}
      width={layout === 'fit' ? fitCardWidth(c) : undefined} />
  );
  // Settings → Advanced → Developer options: the WIP 100% sections follow the checklist cards.
  const wipNodes = adv && state.wipFeatures ? wipCards.map(w => ({ key: w.id, node: <WipCardView key={w.id} card={w} categories={state.categories} fit={layout === 'fit'} /> })) : [];
  const renderCards = (list: Card[]) => {
    const items = [...list.map(c => ({ key: c.id, node: cardNode(c) })), ...wipNodes];
    return layout === 'masonry'
      ? <Masonry items={items} />
      : <div className={`cards ${layout}`}>{items.map(i => i.node)}</div>;
  };

  const availOpen = !(prefs.collapsed ?? []).includes('__available');
  return (
    <div className="app">
      <h1 className="sr-only">Boomerang Tracker</h1>
      <UpdateBanner updates={updates} />
      {state.message && <div className="banner">{state.message}</div>}
      <div className="body">
        <Sidebar cards={cards} parts={parts} prefs={prefs} state={state}
          onToggleCategory={toggleCategory} onShowAll={showAllCategories} onPrefs={updatePrefs} />
        <main className="grid-wrap" aria-label="Checklist">
          {renderCards(visibleCards)}
        </main>
        {prefs.showCanGetNow !== false && (
          <aside className="canget" aria-label="Can get now" data-guide="canget">
            <AvailablePanel state={state} open={availOpen} selected={selected} onSelect={setSelected}
              filters={{ ...NO_FILTERS, ...prefs.availableFilters }} onFilters={(f, saveAfterMs) => updatePrefs({ ...prefs, availableFilters: f }, saveAfterMs)}
              onToggle={open => updatePrefs({ ...prefs, collapsed: open ? (prefs.collapsed ?? []).filter(x => x !== '__available') : [...(prefs.collapsed ?? []), '__available'] })} />
          </aside>
        )}
        {showSide && (
          <aside className="side" aria-label="Details">
            {state.identify.length > 0 && <IdentifyCard q={state.identify[0]} more={state.identify.length - 1} onShow={setSelected} />}
            {selectedItem && 'stack' in selectedItem
              ? <StackDetails stack={selectedItem.stack} onShow={setSelected} onClose={() => setSelected(null)} />
              : selectedItem ? <Details cat={selectedItem.cat} item={selectedItem.item} dev={adv && state.devPanel} onClose={() => setSelected(null)} /> : null}
            {adv && state.devPanel && <DevPanel state={state} />}
          </aside>
        )}
      </div>
      <div className="toasts">
        {state.toasts.map(t => <div key={t.id} className="toast">{t.text}</div>)}
      </div>
      {prefs.guideSeen !== true && (
        <GuideTour
          steps={guideSteps({ hasCards: visibleCards.length > 0, showCanGetNow: prefs.showCanGetNow !== false, updates: updatesStepFor(updates?.mode ?? 'off') })}
          onDone={() => updatePrefs({ ...prefs, guideSeen: true })}
        />
      )}
    </div>
  );
}

/** Left sidebar: the display selector. A checked category shows in the middle column;
 *  the "Full checklist" box checks everything, and each part title toggles its part. */
function Sidebar({ cards, parts, prefs, state, onToggleCategory, onShowAll, onPrefs }: {
  cards: Card[];
  parts: { part: 'A' | 'B' | 'C'; title: string }[];
  prefs: UiPrefs;
  state: AppState;
  onToggleCategory: (id: string) => void;
  onShowAll: () => void;
  onPrefs: (p: UiPrefs) => void;
}) {
  const s = state.summary!;
  const pieces = s.heartPiecesHeld ?? 0;
  const adv = !!prefs.advanced;
  const sidebarHidden = prefs.sidebarHidden ?? [];
  const checklistAll = prefs.checklistAll !== false;
  const onLeft = (c: Card) => !sidebarHidden.includes(c.id);
  const shown = (c: Card) => {
    const partOn = c.part === 'B' ? prefs.showParts.B : c.part === 'C' ? prefs.showParts.C : true;
    return partOn && (checklistAll || !prefs.hiddenCategories.includes(c.id));
  };
  // Turning "Full checklist" off starts from a blank checklist: hide every area on the left bar.
  const leftIds = cards.filter(onLeft).map(c => c.id);
  const setFull = (on: boolean) => {
    if (on) onShowAll();
    else onPrefs({ ...prefs, checklistAll: false, hiddenCategories: leftIds });
  };
  return (
    <nav className="sidebar" aria-label="Checklist categories" data-guide="sidebar">
      <div className="side-head">
        <div className="side-icons">
          <SettingsButton />
          <button className={state.overlay.visible ? 'on' : ''} onClick={() => void api.toggleOverlay()}
            title={`Show/hide overlay (${state.hotkeys.toggleOverlay})`} aria-label="Toggle overlay">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2" /><rect x="8" y="8" width="10" height="7" rx="1" /></svg>
          </button>
          <button className={prefs.hideCollected ? 'on' : ''} onClick={() => onPrefs({ ...prefs, hideCollected: !prefs.hideCollected })}
            title={prefs.hideCollected ? 'Show collected items' : 'Hide collected items'} aria-label="Toggle hide collected">
            {prefs.hideCollected
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
          </button>
          <button className={prefs.showCanGetNow !== false ? 'on' : ''} onClick={() => onPrefs({ ...prefs, showCanGetNow: prefs.showCanGetNow === false })}
            title="Toggle the 'can get now' panel" aria-label="Toggle can get now">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5 14 10l7.5 2L14 14l-2 7.5L10 14l-7.5-2L10 10z" /></svg>
          </button>
        </div>
        <div className="side-pct">
          <span className="side-pct-big">{s.percent.toFixed(1)}%</span>
          <div className="bar big"><div className="fill" style={{ width: `${s.percent}%` }} /></div>
          <span className="side-pct-sub">{s.doneA} of {s.totalA} checklist entries</span>
        </div>
        <div className="side-hearts">
          <span style={{ color: '#ff3d5a' }}>♥</span>
          <span>{s.hearts ?? '?'}<span className="side-pct-sub">/{s.maxHeartsPossible}</span> hearts{pieces ? ` + ${pieces}/4 piece${pieces > 1 ? 's' : ''}` : ''}</span>
        </div>
        {adv && <LiveBadge state={state} />}
      </div>
      {prefs.showSidebar !== false && (<>
      <button className={`side-entry head ${checklistAll ? 'on' : 'off'}`} style={{ ['--cat' as string]: 'var(--accent)' }}
        onClick={() => setFull(!checklistAll)} title={checklistAll ? 'Turn off to start from a blank checklist' : 'Show the full checklist'}>
        <span className="side-entry-top">
          <span className="side-entry-label">Full checklist</span>
          <span className="side-entry-count">{s.doneA}/{s.totalA}</span>
        </span>
        <span className="side-entry-bar"><span className="side-entry-fill" style={{ width: `${s.totalA ? (s.doneA / s.totalA) * 100 : 0}%` }} /></span>
      </button>
      {parts.map(({ part, title }) => {
        const on = part === 'A' || (part === 'B' ? prefs.showParts.B : prefs.showParts.C);
        const list = cards.filter(c => c.part === part && onLeft(c));
        if (!list.length) return null;
        return (
          <div key={part} className="side-part">
            {part === 'A'
              ? <div className="side-part-title">{title}</div>
              : <button className={`side-part-title ${on ? 'on' : 'off'}`} onClick={() => onPrefs({ ...prefs, showParts: { ...prefs.showParts, [part]: !on } })} title={on ? 'Hide this part' : 'Show this part'}>{title}</button>}
            {on && list.map(c => (
              <button key={c.id} className={`side-entry ${shown(c) ? 'on' : 'off'}`} style={{ ['--cat' as string]: categoryColor(c.colorCat) }}
                onClick={() => onToggleCategory(c.id)} title={shown(c) ? 'Hide from the checklist' : 'Show in the checklist'}>
                <span className="side-entry-top">
                  <span className="side-dot" style={{ background: categoryColor(c.colorCat) }} />
                  <span className="side-entry-label">{c.label}</span>
                  <span className="side-entry-count">{c.done}/{c.total}</span>
                </span>
                <span className="side-entry-bar"><span className="side-entry-fill" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} /></span>
              </button>
            ))}
          </div>
        );
      })}
      </>)}
    </nav>
  );
}

/** "Can get now": Part A entries the logic says are obtainable, current area first. */
function AvailablePanel({ state, open, selected, onSelect, onToggle, filters, onFilters }: { state: AppState; open: boolean; selected: string | null; onSelect: (id: string) => void; onToggle: (open: boolean) => void; filters: AvailableFilters; onFilters: (f: AvailableFilters, saveAfterMs?: number) => void }) {
  const total = state.available.length;
  const rows = filterCanGetNow(state.available, filters);
  const groups = new Map<string, AvailableEntry[]>();
  for (const a of rows) groups.set(a.region, [...(groups.get(a.region) ?? []), a]);
  const areaCount = new Set(state.available.map(a => a.region)).size;
  return (
    <section className={`available ${open ? '' : 'closed'}`}>
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

/** The full settings panel: View, Left bar, Saves, Live tracking, Overlay, Hotkeys, Controller, Advanced. */
function SettingsPanel({ state, adv, onAdv, prefs, onPrefs }: { state: AppState; adv: boolean; onAdv: (on: boolean) => void; prefs: UiPrefs; onPrefs: (p: UiPrefs) => void }) {
  const [hk, setHk] = useState({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay });
  useEffect(() => setHk({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay }), [state.hotkeys.toggleOverlay, state.hotkeys.lockOverlay]);
  const o = state.overlay;
  // Live tracking is Windows-only for now: elsewhere the toggle is off, with the reason.
  const liveOff = state.platform !== 'win32';
  const cats = buildCards(state.categories);
  const recent = [...state.slots].sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return (
    <div className="settings-pop">
      <b>View</b>
      <label className="check">
        <input type="checkbox" checked={prefs.showSidebar !== false} onChange={e => onPrefs({ ...prefs, showSidebar: e.target.checked })} /> Category sidebar
      </label>
      <label className="check">
        <input type="checkbox" checked={prefs.showCanGetNow !== false} onChange={e => onPrefs({ ...prefs, showCanGetNow: e.target.checked })} /> "Can get now" column
      </label>
      <b>Left bar</b>
      <span className="muted small">Choose which areas appear on the left bar:</span>
      <div className="leftbar-pick">
        {cats.map(c => (
          <label key={c.id} className="check leftbar-item">
            <input type="checkbox" checked={!(prefs.sidebarHidden ?? []).includes(c.id)}
              onChange={e => onPrefs({ ...prefs, sidebarHidden: e.target.checked ? (prefs.sidebarHidden ?? []).filter(x => x !== c.id) : [...(prefs.sidebarHidden ?? []), c.id] })} />
            <span className="dot" style={{ background: categoryColor(c.colorCat) }} /> {c.label}
          </label>
        ))}
      </div>
      <b>Saves</b>
      <label>
        Slot&nbsp;
        <select value={state.slotMode === 'recent' ? '' : state.activeSlot} onChange={e => void api.pinSlot(e.target.value || null)}>
          <option value="" title={recentTitle(recent)}>{recentLabel(recent)}</option>
          {state.slots.map(sl => (
            <option key={sl.name} value={sl.name} title={slotTitle(sl)}>{slotLabel(sl)}</option>
          ))}
        </select>
      </label>
      <span className="muted small path" title={state.saveDir}>{state.saveDir ?? 'No folder chosen'}</span>
      <button onClick={() => void api.browseFolder()}>Change save folder…</button>
      {adv && (<>
        <b>Live tracking</b>
        <label className="check">
          <input type="checkbox" checked={state.live.enabled} disabled={liveOff} onChange={e => void api.setLive(e.target.checked)} /> Read progress live from the running game
        </label>
        {liveOff
          ? <span className="muted small">{state.live.detail}</span>
          : <span className="muted small">Works with Hookshot, Longshot, NX2navi, ReLink, Rekarina and Fritchii. Read-only: the tracker only looks at the game's memory, it never changes anything. Uses your saves whenever the game isn't running.</span>}
      </>)}
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
      <PadSettings pad={state.pad} />
      <UpdatesSection />
      <b>Advanced</b>
      <label className="check">
        <input type="checkbox" checked={adv} onChange={e => onAdv(e.target.checked)} /> Show advanced options
      </label>
      {adv && (<>
        <label className="check">
          <input type="checkbox" checked={state.changeLog.enabled} onChange={e => void api.setChangeLog(e.target.checked)} /> Keep a change log
        </label>
        <span className="muted small">Notes every change the tracker sees, with the time and area, in a file on this PC.</span>
        <button onClick={() => void api.openLogFolder()}>Open log folder</button>
        <label className="check">
          <input type="checkbox" checked={state.devPanel} onChange={e => void api.setDevPanel(e.target.checked)} /> Developer tools
        </label>
        <span className="muted small">Adds a panel with save snapshots and the raw values that changed, and shows how each entry is detected.</span>
        <label>Checklist layout
          <select value={prefs.layout ?? 'masonry'} onChange={e => onPrefs({ ...prefs, layout: e.target.value as ChecklistLayout })}>
            <option value="masonry">Column fill (left to right, top to bottom)</option>
            <option value="fit">Fit: cards sized to their tiles</option>
            <option value="stack">Stack: one full-width card per row</option>
          </select>
        </label>
        <span className="muted small">Column fill packs cards down the left column and starts the next one to the right when it would run past the bottom. Fit sizes each card to its tiles and wraps. Stack keeps one full-width card per row.</span>
        <b>Developer options</b>
        <label className="check">
          <input type="checkbox" checked={state.wipFeatures} onChange={e => void api.setWipFeatures(e.target.checked)} /> Show WIP 100% features
        </label>
        <span className="muted small">Adds My Play Data, Hall of Fallen Foes and Threads of Time after the checklist. Entries the checklist already tracks show their state; the rest are hatched until the tracker can read them from your save.</span>
        <b>First-run guide</b>
        <button onClick={() => onPrefs({ ...prefs, guideSeen: false })}>Show the guide again</button>
        <span className="muted small">It appears the next time you come back to the main window.</span>
      </>)}
      <span className="muted small version">Boomerang Tracker v{state.version}</span>
    </div>
  );
}

/** The gear in the top bar: opens the settings window. */
function SettingsButton() {
  return (
    <button aria-label="Settings" title="Settings" onClick={() => void api.openSettings()}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    </button>
  );
}

/** The settings window (?settings=1): the panel in its own frame, so it never gets clipped. */
export function SettingsWindow() {
  const [state, setState] = useState<AppState | null>(null);
  const [prefs, setPrefs] = useState<UiPrefs | null>(null);
  useEffect(() => {
    document.body.classList.add('settings-body');
    void api.getState().then(setState);
    void api.getPrefs().then(setPrefs);
    const off = api.onState(setState);
    return () => { off(); document.body.classList.remove('settings-body'); };
  }, []);
  if (!state || !prefs) return <div className="settings-page"><p className="muted small">Loading…</p></div>;
  const onPrefs = (p: UiPrefs) => { setPrefs(p); void api.setPrefs(p); };
  return (
    <div className="settings-page">
      <SettingsPanel state={state} adv={!!prefs.advanced} onAdv={on => onPrefs({ ...prefs, advanced: on })} prefs={prefs} onPrefs={onPrefs} />
    </div>
  );
}

/** Show/hide the overlay with a controller button (Windows only for now). */
function PadSettings({ pad }: { pad: PadState }) {
  if (!pad.supported) {
    return (<>
      <b>Controller</b>
      <span className="muted small">Show/hide the overlay with a controller button. {pad.status}.</span>
    </>);
  }
  return (<>
    <b>Controller</b>
    <label className="check">
      <input type="checkbox" checked={pad.enabled} onChange={e => void api.setPad({ enabled: e.target.checked })} /> Show/hide the overlay with a controller button
    </label>
    <span className="small">Button: {pad.button}{pad.custom ? '' : ' (default)'}</span>
    {pad.learning
      ? <button onClick={() => void api.cancelPadLearn()}>Cancel</button>
      : <button onClick={() => void api.learnPadButton()}>Choose button…</button>}
    {pad.custom && !pad.learning && <button onClick={() => void api.setPad({ resetButton: true })}>Use the default (L3)</button>}
    <label>How
      <select value={pad.mode} disabled={!pad.enabled} onChange={e => void api.setPad({ mode: e.target.value as PadState['mode'] })}>
        <option value="hold">Hold the button</option>
        <option value="press">Single press</option>
      </select>
    </label>
    {pad.mode === 'hold' && (
      <label>Hold for {(pad.holdMs / 1000).toFixed(pad.holdMs % 100 ? 2 : 1)} s
        {/* 100–3000 ms: the range settings.ts accepts */}
        <input type="range" min={100} max={3000} step={50} value={pad.holdMs} disabled={!pad.enabled} onChange={e => void api.setPad({ holdMs: Number(e.target.value) })} />
      </label>
    )}
    <span className="muted small">{pad.status}</span>
    {pad.needsChoose && <span className="muted small">There's no default button for this controller: press Choose button… to pick one.</span>}
    {pad.note && !pad.learning && <span className="muted small">{pad.note}</span>}
    <span className="muted small">Works while the game has focus. Read-only: the tracker only reads the controller's buttons, it never sends anything to it.</span>
  </>);
}

function CardView({ card, hideCollected, selected, onSelect, width }: { card: Card; hideCollected: boolean; selected: string | null; onSelect: (id: string) => void; width?: number }) {
  const pct = card.total ? (card.done / card.total) * 100 : 0;
  const complete = card.total > 0 && card.done === card.total;
  const wide = !!card.wide;
  return (
    <div className={`card ${wide ? 'wide' : ''} ${complete ? 'complete' : ''}`} data-guide="card" style={{ ['--cat' as string]: categoryColor(card.colorCat), ...(width ? { width: `${width}px` } : {}) }}>
      <div className="card-head">
        <span className="card-title">{card.symbol && <Symbol name={card.symbol} size={18} />}{card.label}</span>
        <span className="card-count">{card.kind === 'counter' && card.value === null ? '?' : card.done}/{card.total}</span>
      </div>
      <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
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
                    ? <Tile key={t.key} catId={t.categoryId} item={t.item} major={s.style === 'major'} numbered={s.style === 'numbered'} selected={selected === t.item.id} onSelect={onSelect} />
                    : <StackTile key={t.key} stack={t} selected={selected === t.key} onSelect={onSelect} />)}
                  {hideCollected && !tiles.length && <div className="muted small">All collected</div>}
                </div>
              </div>
            );
          })}
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
    item.manual ? 'manual' : '',
    item.justCollected ? 'glow' : '',
    selected ? 'selected' : '',
    numbered ? 'small' : '',
    major ? 'major' : '',
  ].join(' ');
  return (
    <button className={cls} style={{ ['--c' as string]: icon.color }} onClick={() => onSelect(item.id)}
      onDoubleClick={() => item.state !== 'yes' && void api.toggleManual(item.id)}
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
        <button className="x" onClick={onClose} aria-label={`Close ${stack.label}`} title="Close">×</button>
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
    </div>
  );
}

function Details({ cat, item, dev, onClose }: { cat: TrackedCategory; item: TrackedItem; dev: boolean; onClose: () => void }) {
  const stateText = item.state === 'yes' ? 'Collected'
    : item.manual ? 'Ticked by hand'
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
        <button className="x" onClick={onClose} aria-label="Close details" title="Close">×</button>
      </div>
      <h3>{title}{item.newInRemake && <span className="new">new in remake</span>}</h3>
      {item.chapter && <p className="area">{item.chapter}</p>}
      {item.where && <p className="where">{item.where}</p>}
      <p className={`status ${item.done ? 's-done' : 's-no'}`}>{stateText}</p>
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
