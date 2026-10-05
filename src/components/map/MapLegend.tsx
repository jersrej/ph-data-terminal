import type { DataLayer } from '@/features/statistics/statistics.layers';
import type { ColorScale } from '@/features/statistics/statistics.scale';
import { inProse } from '@/lib/format';
import { NO_DATA_FILL } from './MapLayer';

interface MapLegendProps {
  layer: DataLayer;
  year: number;
  scale: ColorScale | null;
  hasMissing: boolean;
  levelName?: string;
  /** The area under the pointer (or the selected one): its class is pointed out on the ramp. */
  marked?: { name: string; value: number | null };
}

/** Class swatches with their boundaries, so a colour can be read back as a range. */
export function MapLegend({ layer, year, scale, hasMissing, levelName, marked }: MapLegendProps) {
  const markedClass = scale && marked && marked.value !== null ? scale.classOf(marked.value) : null;
  return (
    <section aria-label={`Legend: ${layer.label}`} className="map-legend">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow text-ink">{layer.label}</h2>
        <span className="font-mono text-[10px] text-ink-3">{layer.yearLabel(year)}</span>
      </div>
      {scale ? (
        <>
          <div className="mt-1.5 flex gap-px" role="img" aria-label={`${scale.colors.length} classes from ${layer.formatCompact(scale.min)} to ${layer.formatCompact(scale.max)}`}>
            {scale.colors.map((color, i) => (
              <span key={i} className="legend-swatch" data-marked={i === markedClass || undefined} style={{ background: color }} />
            ))}
          </div>
          <div className="relative mt-1 h-3.5 font-mono text-[10px] text-ink-2" aria-hidden="true">
            {scale.breaks.map((b, i) => (
              <span key={i} className="absolute -translate-x-1/2" style={{ left: `${((i + 1) / scale.colors.length) * 100}%` }}>
                {layer.formatCompact(b)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-ink-2">Data unavailable for this geographic level.</p>
      )}
      {marked && scale && (
        <p className="mt-1 truncate text-[11px] text-ink" data-testid="legend-readout">
          <span className="font-semibold">{marked.name}</span>{' '}
          <span className="font-mono">{marked.value === null ? 'no data' : layer.formatCompact(marked.value)}</span>
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-ink-3">
        {scale && <span className="font-mono">{layer.formatCompact(scale.min)} to {layer.formatCompact(scale.max)}</span>}
        {layer.unit && <span>{layer.unit}</span>}
        {hasMissing && scale && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 border border-rule" style={{ background: NO_DATA_FILL }} />
            No data
          </span>
        )}
        {levelName && <span className="truncate">within {inProse(levelName)}</span>}
      </div>
    </section>
  );
}
