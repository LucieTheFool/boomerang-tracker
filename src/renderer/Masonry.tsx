import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Column-fill layout: as many columns as fit, cards placed in order filling
 * the left column top-to-bottom; when a card would run past the visible
 * height of the checklist area, it continues in the next column to the right.
 * Card heights are measured and re-measured when they change.
 */
export function Masonry({ items, minColumn = 320, gap = 14 }: { items: { key: string; node: ReactNode }[]; minColumn?: number; gap?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);
  const [viewH, setViewH] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const observers = useRef(new Map<string, ResizeObserver>());
  // The card fade-in plays only on the first paint; once it settles, re-mounts
  // (filter changes, hide-collected) don't replay it.
  const [settled, setSettled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSettled(true), 320); return () => clearTimeout(t); }, []);

  // Column count from the available width; visible height from the scroll container.
  useLayoutEffect(() => {
    const el = wrap.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const update = () => {
      setCols(Math.max(1, Math.floor((el.clientWidth + gap) / (minColumn + gap))));
      const cs = getComputedStyle(parent);
      setViewH(parent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [minColumn, gap]);

  useEffect(() => () => { for (const o of observers.current.values()) o.disconnect(); }, []);

  // Measure each card; only store real changes to avoid layout loops.
  const measure = (key: string) => (el: HTMLDivElement | null) => {
    observers.current.get(key)?.disconnect();
    observers.current.delete(key);
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.getBoundingClientRect().height);
      setHeights(prev => (Math.abs((prev[key] ?? -1) - h) > 1 ? { ...prev, [key]: h } : prev));
    });
    ro.observe(el);
    observers.current.set(key, ro);
  };

  // Fill the left column top-to-bottom; a card that would run past the visible
  // height continues in the next column to the right.
  const columns: { key: string; node: ReactNode }[][] = Array.from({ length: cols }, () => []);
  const colH = new Array(cols).fill(0);
  let target = 0;
  for (const it of items) {
    const h = heights[it.key] ?? 120;
    if (target < cols - 1 && colH[target] + gap + h > viewH) target++;
    columns[target].push(it);
    colH[target] += h + gap;
  }

  return (
    <div ref={wrap} className={settled ? 'masonry settled' : 'masonry'} style={{ gap }}>
      {columns.map((col, i) => (
        <div key={i} className="masonry-col" style={{ gap }}>
          {col.map(it => <div key={it.key} ref={measure(it.key)} className="masonry-item">{it.node}</div>)}
        </div>
      ))}
    </div>
  );
}
