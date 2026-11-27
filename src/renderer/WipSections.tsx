import { useMemo, useState, type ReactNode } from 'react';
import type { TrackedCategory } from '../shared/types';
import { categoryColor } from './icons';
import { Symbol } from './symbols';
import { cardDone, rowOf, sectionDone, thresholdText, unmappedCount, wipStatus, type WipCard, type WipEntry, type WipSection, type WipStatus } from './wip';

const UNMAPPED = 'Data not yet mapped';
/** Card width in the Fit layout: these cards hold chips and rows, not tiles. */
const FIT_W = 380;
/** Open folds, kept outside the card: Masonry remounts a card when it moves to another column. */
const openFolds = new Set<string>();

/** One WIP card (Settings → Advanced → Developer options), styled like a checklist card. Hatched = not mapped yet. */
export function WipCardView({ card, categories, fit }: { card: WipCard; categories: TrackedCategory[]; fit: boolean }) {
  const st = useMemo(() => wipStatus(categories), [categories]);
  const [open, setOpen] = useState<string[]>(() => [...openFolds]);
  const toggle = (id: string) => {
    if (openFolds.has(id)) openFolds.delete(id); else openFolds.add(id);
    setOpen([...openFolds]);
  };
  const done = cardDone(card, st);
  const { unmapped, of } = unmappedCount(card, st);
  const mapped = of === 0 ? 'nothing listed yet' : unmapped === 0 ? 'every entry follows its checklist row' : unmapped === of ? 'not yet mapped' : `${unmapped} of ${of} not yet mapped`;
  return (
    <div className="card wip" style={fit ? { width: `${FIT_W}px` } : undefined}>
      <div className="card-head">
        <span className="card-title" title={`${card.about}\nWIP: ${mapped}`}><Symbol name={card.symbol} size={18} />{card.title}<span className="wip-tag">WIP</span></span>
        <span className="card-count" title={done === null ? UNMAPPED : undefined}>{done ?? '?'}/{card.total}</span>
      </div>
      {done === null ? <div className="bar unmapped" /> : <div className="bar"><div className="fill" style={{ width: `${card.total ? (done / card.total) * 100 : 0}%` }} /></div>}
      {unmapped > 0 && <div className="counter-note">{unmapped === of ? UNMAPPED : `Hatched entries: ${UNMAPPED.toLowerCase()}`}</div>}
      {card.stats && <Stats card={card} st={st} />}
      {card.sections.map(s => <Section key={s.id} section={s} st={st} open={open} onToggle={toggle} />)}
    </div>
  );
}

function Stats({ card, st }: { card: WipCard; st: WipStatus }) {
  const stats = card.stats!;
  return (
    <div className="section">
      <div className="section-title">Toward the Master medal</div>
      {stats.length === 0 && <div className="muted small">Nothing listed yet</div>}
      <div className="wip-stats">
        {stats.map(s => {
          const cur = s.link ? st.categories.get(s.link) : undefined;
          const goal = thresholdText(s.master, s.unit);
          const master = cur !== undefined && cur >= s.master;
          return (
            <div key={s.id} className="wip-stat" title={cur === undefined ? UNMAPPED : master ? 'Master medal reached' : undefined}>
              <div className="wip-stat-top">
                <span>{s.name}{master && <span className="wip-master"><span aria-hidden="true"> ✓</span><span className="sr-only"> (Master medal reached)</span></span>}</span>
                <span className="wip-count">{cur ?? '?'} / {goal}</span>
              </div>
              {cur === undefined
                ? <div className="bar unmapped" role="progressbar" aria-label={s.name} aria-valuemin={0} aria-valuemax={s.master} aria-valuetext={`${UNMAPPED}. Master at ${goal}`} />
                : <div className="bar" role="progressbar" aria-label={s.name} aria-valuemin={0} aria-valuemax={s.master} aria-valuenow={cur}
                  style={{ ['--cat' as string]: categoryColor(s.link!) }}><div className="fill" style={{ width: `${Math.min(100, (cur / s.master) * 100)}%` }} /></div>}
            </div>
          );
        })}
      </div>
      {!!card.unthresholded && <div className="muted small wip-foot">{card.unthresholded} more medals are listed without a Master threshold.</div>}
    </div>
  );
}

function Section({ section: s, st, open, onToggle }: { section: WipSection; st: WipStatus; open: string[]; onToggle: (id: string) => void }) {
  const listed = s.folds ? s.folds.reduce((n, f) => n + f.entries.length, 0) : s.entries.length;
  return (
    <div className="section">
      <div className="section-title wip-head"><span>{s.title}</span><span>{sectionDone(s, st) ?? '?'}/{s.total}</span></div>
      {listed === 0 && <div className="muted small">Nothing listed yet</div>}
      {listed > 0 && listed < s.total && <div className="muted small wip-gap">{listed} of {s.total} listed so far</div>}
      {s.folds?.map(f => (
        <div key={f.id}>
          <FoldHead id={f.id} label={f.title} count={`?/${f.total}`} open={open} onToggle={onToggle} />
          {open.includes(f.id) && <Chips entries={f.entries} st={st} nested />}
        </div>
      ))}
      {!s.folds && (s.layout === 'chips' ? <Chips entries={s.entries} st={st} /> : <Rows entries={s.entries} st={st} open={open} onToggle={onToggle} />)}
    </div>
  );
}

/** A row that opens and closes the entries under it (an area of statues, a quest's sub-quests). */
function FoldHead({ id, label, count, mark, title, open, onToggle }: { id: string; label: string; count: string; mark?: ReactNode; title?: string; open: string[]; onToggle: (id: string) => void }) {
  const isOpen = open.includes(id);
  return (
    <button className="wip-fold-head" aria-expanded={isOpen} title={title} onClick={() => onToggle(id)}>
      <span className="wip-fold-label"><span className="chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>{mark}{label}</span>
      <span className="wip-count">{count}</span>
    </button>
  );
}

/** Tooltip and look of one entry: the checklist row's state, or hatched when not mapped. */
function look(e: WipEntry, st: WipStatus) {
  const r = rowOf(e, st);
  const facts = [e.detail, e.tip].filter(Boolean).map(f => `${f}\n`).join('');
  if (!r) return { cls: 'unmapped', style: undefined, title: facts + UNMAPPED };
  const state = `${r.done ? 'Collected' : 'Not collected yet'} (${r.categoryLabel} in the checklist)`;
  return { cls: r.done ? 'done' : 'todo', style: { ['--c' as string]: categoryColor(r.categoryId) }, title: facts + state };
}

function Chips({ entries, st, nested }: { entries: WipEntry[]; st: WipStatus; nested?: boolean }) {
  return (
    <ul className={`wip-chips ${nested ? 'wip-sub' : ''}`}>
      {entries.map(e => { const l = look(e, st); return <li key={e.id} className={`wip-chip ${l.cls}`} style={l.style} title={l.title}>{e.name}</li>; })}
    </ul>
  );
}

function Rows({ entries, st, open, onToggle }: { entries: WipEntry[]; st: WipStatus; open: string[]; onToggle: (id: string) => void }) {
  return (
    <ul className="wip-rows">
      {entries.map(e => {
        if (!e.sub) return <Row key={e.id} entry={e} st={st} />;
        const subDone = e.sub.every(s => rowOf(s, st)) ? e.sub.filter(s => rowOf(s, st)!.done).length : '?';
        return (
          <li key={e.id}>
            <FoldHead id={e.id} label={e.name} count={`${subDone}/${e.sub.length}`} mark={<Mark entry={e} st={st} />} title={look(e, st).title} open={open} onToggle={onToggle} />
            {open.includes(e.id) && <ul className="wip-rows wip-sub">{e.sub.map(s => <Row key={s.id} entry={s} st={st} />)}</ul>}
          </li>
        );
      })}
    </ul>
  );
}

function Row({ entry: e, st }: { entry: WipEntry; st: WipStatus }) {
  return (
    <li className="wip-row" title={look(e, st).title}>
      {/* the empty chevron slot keeps every row's marker in one column */}
      <span className="wip-fold-label"><span className="chev" aria-hidden="true" /><Mark entry={e} st={st} />{e.name}</span>
      {e.detail && <span className="wip-count">{e.detail}</span>}
    </li>
  );
}

/** The square in front of a row: filled = collected, outline = not yet, hatched = not mapped. */
function Mark({ entry, st }: { entry: WipEntry; st: WipStatus }) {
  const l = look(entry, st);
  return <span className={`wip-mark ${l.cls}`} style={l.style} aria-hidden="true" />;
}
