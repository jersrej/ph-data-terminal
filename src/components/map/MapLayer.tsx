import { memo } from 'react';
import type { GeoNode, Psgc } from '@/features/geography/geography.types';
import type { ShapeLayer } from '@/features/geography/geography.shapes';
import type { DataLayer } from '@/features/statistics/statistics.layers';
import type { ColorScale } from '@/features/statistics/statistics.scale';
import { UNAVAILABLE } from '@/lib/format';

export const NO_DATA_FILL = 'var(--color-nodata)';

interface MapLayerProps {
  shapes: ShapeLayer;
  nodes: Map<Psgc, GeoNode>;
  /** The deepest loaded level carries the choropleth; levels above it are context. */
  role: 'active' | 'context';
  /** On a context level: the area the user drilled into, drawn under its children. */
  openCode?: Psgc;
  layer: DataLayer;
  year: number;
  scale: ColorScale | null;
  verb: 'Explore' | 'Compare';
  /** Large levels (hundreds of barangays) are reachable from the ranking list instead of Tab. */
  tabbable: boolean;
}

/**
 * One administrative level: a group of sibling areas. Pointer and keyboard
 * events are delegated to the parent <g> via data-code, so this component only
 * re-renders when its data or the active layer changes, never on hover.
 */
export const MapLayer = memo(function MapLayer({ shapes, nodes, role, openCode, layer, year, scale, verb, tabbable }: MapLayerProps) {
  return (
    <g className="map-layer" data-role={role}>
      {shapes.shapes.map((shape) => {
        const node = nodes.get(shape.code);
        const value = node ? layer.getValue(node, year) : null;
        const name = node?.name ?? `Area ${shape.code}`;
        if (role === 'context') {
          const open = shape.code === openCode;
          return (
            <path
              key={shape.code}
              d={shape.d}
              data-code={shape.code}
              className={open ? 'map-area map-area-open' : 'map-area map-area-context'}
              role={open ? undefined : 'button'}
              tabIndex={open ? undefined : -1}
              aria-hidden={open || undefined}
              aria-label={open ? undefined : `Go to ${name}`}
            />
          );
        }
        const described = value === null ? UNAVAILABLE.toLowerCase() : layer.formatValue(value);
        return (
          <path
            key={shape.code}
            d={shape.d}
            data-code={shape.code}
            className="map-area map-area-active"
            style={{ fill: scale?.colorOf(value) ?? NO_DATA_FILL }}
            role="button"
            tabIndex={tabbable ? 0 : -1}
            aria-label={`${verb} ${name}. ${layer.label}: ${described}`}
          />
        );
      })}
    </g>
  );
});
