import { lazy, Suspense, useState } from 'react';
import { Check, CornerLeftUp, Link2 } from 'lucide-react';
import { KIND_LABEL, type GeoKind, type GeoNode } from '@/features/geography/geography.types';
import type { DataLayer } from '@/features/statistics/statistics.layers';
import { populationIn } from '@/features/statistics/statistics.layers';
import { METRICS, shareOfParent, type RankedArea } from '@/features/statistics/statistics.derive';
import { formatInteger, formatPercent, inProse, UNAVAILABLE } from '@/lib/format';
import { placeNameInBaybayin } from '@/features/baybayin/baybayin';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { TrendPoint } from './TrendChart';

const TrendChart = lazy(() => import('./TrendChart'));

interface SelectedPanelProps {
  node: GeoNode;
  /** Nearest-first ancestors, country excluded. */
  ancestors: GeoNode[];
  parent?: GeoNode;
  layer: DataLayer;
  year: number;
  /** This area's standing among its siblings for the active layer. */
  standing?: { rank: RankedArea['rank']; of: number; among: string };
  counts: Partial<Record<GeoKind, number>>;
  inComparison: boolean;
  onToggleCompare: () => void;
  onUp?: () => void;
  /** Show a Baybayin form of the name when one can be derived without guessing. */
  showBaybayin: boolean;
}

const COUNT_ROWS: [GeoKind, string][] = [
  ['region', 'Regions'],
  ['province', 'Provinces'],
  ['city', 'Cities'],
  ['municipality', 'Municipalities'],
];

export function SelectedPanel({ node, ancestors, parent, layer, year, standing, counts, inComparison, onToggleCompare, onUp, showBaybayin }: SelectedPanelProps) {
  // Regions and the country carry English or acronym names; only local place names qualify.
  const baybayin = showBaybayin && node.kind !== 'country' && node.kind !== 'region' ? placeNameInBaybayin(node.name) : null;
  const [copied, setCopied] = useState(false);
  const value = layer.getValue(node, year);
  const share = shareOfParent(node, parent);
  const trend: TrendPoint[] = [2010, 2015, 2020, 2024].flatMap((y) => {
    const population = populationIn(node, y);
    return population === null ? [] : [{ year: y, population }];
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the address bar already holds the same link.
    }
  };

  return (
    <section aria-labelledby="selected-name" className="panel-section">
      <p className="eyebrow text-ink-2">
        {KIND_LABEL[node.kind]}
        {ancestors.length > 0 && <span className="text-ink-3"> · {ancestors.map((a) => a.name).join(' · ')}</span>}
      </p>
      <h1 id="selected-name" className="display mt-1.5 text-[2rem] break-words">{node.name}</h1>
      {baybayin && (
        <p className="mt-1.5 flex items-baseline gap-2" data-testid="baybayin-name">
          <span lang="tl-Tglg" className="baybayin text-[1.35rem] leading-snug">{baybayin}</span>
          <span className="eyebrow text-ink-3" title="A modern phonetic transliteration of the name, not a historical spelling">Baybayin · approximate</span>
        </p>
      )}
      <p className="mt-2 font-mono text-[11px] text-ink-3">
        PSGC {node.code}
        {node.alt && <span> · {node.alt}</span>}
      </p>

      <div className="mt-4 border-t-2 border-ink pt-3">
        <p className="eyebrow text-ink-2">{layer.label} · {layer.yearLabel(year)}</p>
        {value === null ? (
          <p className="mt-1 text-lg font-semibold text-ink-2" data-testid="headline-value">{UNAVAILABLE} for this geographic level.</p>
        ) : (
          <p className="figure mt-0.5 text-[1.75rem] leading-tight font-medium" data-testid="headline-value">{layer.formatValue(value)}</p>
        )}
        <p className="mt-1 text-xs text-ink-2">
          {standing?.rank != null && <>Ranks {formatInteger(standing.rank)} of {formatInteger(standing.of)} {standing.among}. </>}
          {share !== null && parent && <>{formatPercent(share, share < 1 ? 2 : 1)} of the population of {inProse(parent.name)}.</>}
        </p>
      </div>

      <dl className="mt-3">
        {METRICS.map((metric) => {
          const v = metric.getValue(node);
          if (metric.id === 'barangays' && node.kind === 'barangay') return null;
          const note = v !== null ? metric.note?.(node) : undefined;
          return (
            <div key={metric.id} className="stat-row">
              <dt>{metric.label}</dt>
              <dd className={v === null ? 'unavailable' : 'figure'}>
                {v === null ? UNAVAILABLE : metric.format(v)}
                {note && <span className="ml-1.5 font-sans text-[10px] text-ink-3">{note}</span>}
              </dd>
            </div>
          );
        })}
        {COUNT_ROWS.map(([kind, label]) =>
          counts[kind] ? (
            <div key={kind} className="stat-row">
              <dt>{label}</dt>
              <dd className="figure">{formatInteger(counts[kind])}</dd>
            </div>
          ) : null,
        )}
      </dl>

      <div className="mt-4">
        <h2 className="eyebrow text-ink-2">Population by census</h2>
        {trend.length >= 2 ? (
          <ErrorBoundary fallback={<p className="mt-1 text-xs text-ink-3">The chart could not be loaded.</p>}>
            <Suspense fallback={<div className="h-28" />}>
              <TrendChart points={trend} activeYear={layer.id === 'growth' ? 2024 : year} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <p className="mt-1 text-xs text-ink-3">Earlier census counts are not published at this geographic level.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button aria-pressed={inComparison} onClick={onToggleCompare}>
          {inComparison ? 'In comparison' : 'Compare'}
        </Button>
        <Button onClick={copyLink}>
          {copied ? <Check aria-hidden size={13} /> : <Link2 aria-hidden size={13} />}
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
        {onUp && parent && (
          <Button variant="quiet" onClick={onUp} className="normal-case">
            <CornerLeftUp aria-hidden size={13} />
            Up to {inProse(parent.name)}
          </Button>
        )}
      </div>
    </section>
  );
}
