import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Masonry layout: as many columns as fit, each card placed into the currently
 * shortest column (in order), so opening a tall card doesn't leave empty space
 * beside it. Card heights are measured and re-measured when they change.
 */
export function Masonry({ items, minColumn = 320, gap = 14 }: { items: { key: string; node: ReactNode }[]; minColumn?: number; gap?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const observers = useRef(new Map<string, ResizeObserver>());

  // Column count from the available width.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setCols(Math.max(1, Math.floor((el.clientWidth + gap) / (minColumn + gap))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
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

  // Greedy placement into the shortest column, in order.
  const columns: { key: string; node: ReactNode }[][] = Array.from({ length: cols }, () => []);
  const colH = new Array(cols).fill(0);
  for (const it of items) {
    let best = 0;
    for (let i = 1; i < cols; i++) if (colH[i] < colH[best] - 1) best = i;
    columns[best].push(it);
    colH[best] += (heights[it.key] ?? 120) + gap;
  }

  return (
    <div ref={wrap} className="masonry" style={{ gap }}>
      {columns.map((col, i) => (
        <div key={i} className="masonry-col" style={{ gap }}>
          {col.map(it => <div key={it.key} ref={measure(it.key)} className="masonry-item">{it.node}</div>)}
        </div>
      ))}
    </div>
  );
}
