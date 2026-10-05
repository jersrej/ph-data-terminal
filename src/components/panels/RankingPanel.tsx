import { useState } from 'react';
import type { GeoNode, Psgc } from '@/features/geography/geography.types';
import type { DataLayer } from '@/features/statistics/statistics.layers';
import type { RankedArea } from '@/features/statistics/statistics.derive';
import { inProse, UNAVAILABLE } from '@/lib/format';
import { Button } from '@/components/ui/button';

const COLLAPSED = 8;

interface RankingPanelProps {
  parent: GeoNode;
  /** Plural label of what is being ranked, e.g. "Provinces". */
  kindLabel: string;
  ranked: RankedArea[];
  status: 'ready' | 'loading' | 'error';
  layer: DataLayer;
  year: number;
  selectedCode: Psgc;
  hoveredCode: Psgc | null;
  compareMode: boolean;
  onHover: (code: Psgc | null) => void;
  onPick: (code: Psgc) => void;
}

/** The areas currently on the map, ordered by the active layer. Also the keyboard route into the map. */
export function RankingPanel({ parent, kindLabel, ranked, status, layer, year, selectedCode, hoveredCode, compareMode, onHover, onPick }: RankingPanelProps) {
  const [expandedFor, setExpandedFor] = useState<Psgc | null>(null);
  const expanded = expandedFor === parent.code;
  const selectedIndex = ranked.findIndex((r) => r.node.code === selectedCode);
  // Keep a selected area visible even when it ranks below the fold.
  const visible = expanded ? ranked : ranked.filter((_, i) => i < COLLAPSED || i === selectedIndex);
  const headingId = 'ranking-heading';

  return (
    <section aria-labelledby={headingId} className="border-b border-rule pt-[18px] pb-3">
      <div className="px-5">
        <h2 id={headingId} className="eyebrow text-ink">{kindLabel} in {inProse(parent.name)}</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          Ranked by {layer.label.toLowerCase()}, {layer.yearLabel(year)}
          {compareMode && ' · click to add to the comparison'}
        </p>
      </div>

      {status === 'loading' && <p className="px-5 pt-3 text-xs text-ink-3" role="status">Loading statistics…</p>}
      {status === 'error' && <p className="px-5 pt-3 text-sm text-ink-2" role="alert">{UNAVAILABLE}: statistics for this level could not be loaded.</p>}
      {status === 'ready' && ranked.length === 0 && <p className="px-5 pt-3 text-sm text-ink-2">{UNAVAILABLE} for this geographic level.</p>}

      {status === 'ready' && ranked.length > 0 && (
        <ol className="mt-2" onPointerLeave={() => onHover(null)}>
          {visible.map(({ node, value, rank, fraction }) => (
            <li key={node.code}>
              <button
                type="button"
                className="rank-row"
                data-selected={node.code === selectedCode || undefined}
                data-hovered={node.code === hoveredCode || undefined}
                aria-current={node.code === selectedCode || undefined}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(node.code)}
                onFocus={() => onHover(node.code)}
                onBlur={() => onHover(null)}
                onClick={() => onPick(node.code)}
              >
                <span className="figure text-[11px] opacity-60">{rank === null ? '–' : String(rank).padStart(2, '0')}</span>
                <span className="truncate font-medium">{node.name}</span>
                <span className={value === null ? 'text-[11px] opacity-60' : 'figure text-xs'}>{value === null ? 'No data' : layer.formatCompact(value)}</span>
                {fraction !== null && (
                  <span className="rank-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(fraction * 100, 0.5)}%` }} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}

      {status === 'ready' && ranked.length > COLLAPSED && (
        <div className="px-5 pt-2">
          <Button variant="quiet" size="sm" className="px-0 normal-case" aria-expanded={expanded} onClick={() => setExpandedFor(expanded ? null : parent.code)}>
            {expanded ? 'Show fewer' : `Show all ${ranked.length}`}
          </Button>
        </div>
      )}
    </section>
  );
}
