import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { easeCubicInOut } from 'd3-ease';
import 'd3-transition';
import type { GeoNode, Psgc } from '@/features/geography/geography.types';
import { fitTransform, shapesQuery, type Bounds, type Shape, type ShapeLayer } from '@/features/geography/geography.shapes';
import type { DataLayer } from '@/features/statistics/statistics.layers';
import { buildScale, isDarkFill, type ScaleRamps } from '@/features/statistics/statistics.scale';
import { UNAVAILABLE } from '@/lib/format';
import { MapLayer } from './MapLayer';
import { MapGraticule } from './MapGraticule';
import { MapLegend } from './MapLegend';
import { MapControls } from './MapControls';
import { createViewStore } from './view-store';

const DRILL_MS = 750;
const MAX_LABELS = 48;
const TAB_LIMIT = 120;

export interface MapLevel {
  /** The area whose children this level draws. */
  parent: GeoNode;
  /** Statistics for those children, keyed by PSGC. Empty while barangays load. */
  nodes: Map<Psgc, GeoNode>;
  /** Barangay-sized features need finer path precision. */
  fine: boolean;
}

interface PhilippinesMapProps {
  /** Root-first: the country, then each area drilled into, ending at the focus. */
  levels: MapLevel[];
  /** The selected area: the focus itself, or one barangay inside it. */
  selectedCode: Psgc;
  layer: DataLayer;
  year: number;
  compare: Psgc[];
  compareMode: boolean;
  hoveredCode: Psgc | null;
  onHover: (code: Psgc | null) => void;
  onPick: (code: Psgc) => void;
  onUp: () => void;
  onHome: () => void;
  /** Choropleth colours from the active palette. */
  ramps: ScaleRamps;
  /** Fly between places; off cuts straight to the new view. */
  animate: boolean;
  showLabels: boolean;
  /** Called once the first view is placed, or it is clear there are no boundaries to place. */
  onReady?: () => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Stable across renders so TanStack Query can memoise the combined result. */
function combineShapeQueries(results: UseQueryResult<ShapeLayer>[]) {
  return {
    shapeLayers: results.map((r) => r.data),
    loading: results.some((r) => r.isPending),
    focusError: results.at(-1)?.isError ?? false,
  };
}

function codeFromEvent(event: { target: EventTarget | null }): Psgc | null {
  return event.target instanceof Element ? (event.target.getAttribute('data-code') ?? null) : null;
}

export function PhilippinesMap({ levels, selectedCode, layer, year, compare, compareMode, hoveredCode, onHover, onPick, onUp, onHome, ramps, animate: animationEnabled, showLabels, onReady }: PhilippinesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [store] = useState(createViewStore);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const sizeRef = useRef(size);
  const [settledK, setSettledK] = useState(1);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const focus = levels.at(-1)!.parent;
  const { shapeLayers, loading, focusError } = useQueries({
    queries: levels.map((l) => shapesQuery(l.parent.code, l.fine)),
    combine: combineShapeQueries,
  });

  // The choropleth sits on the deepest level whose boundaries have arrived, so the
  // parent stays coloured while the camera is already flying toward its children.
  const activeDepth = shapeLayers.reduce((deepest, l, i) => (l ? i : deepest), -1);
  const activeLevel = activeDepth >= 0 ? levels[activeDepth]! : undefined;
  const activeShapes = activeDepth >= 0 ? shapeLayers[activeDepth] : undefined;

  const scale = useMemo(
    () => (activeLevel ? buildScale([...activeLevel.nodes.values()].map((n) => layer.getValue(n, year)), layer.scale, ramps) : null),
    [activeLevel, layer, year, ramps],
  );
  const hasMissing = useMemo(
    () => !!activeLevel && !!activeShapes && activeShapes.shapes.some((s) => {
      const node = activeLevel.nodes.get(s.code);
      return !node || layer.getValue(node, year) === null;
    }),
    [activeLevel, activeShapes, layer, year],
  );

  // ---- viewport size
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === Math.round(width) && prev.height === Math.round(height) ? prev : { width: Math.round(width), height: Math.round(height) }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // ---- pan & zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      // Explicit extent: the default reads SVG layout attributes that are not always available.
      .extent(() => [[0, 0], [sizeRef.current.width, sizeRef.current.height]])
      .scaleExtent([0.1, 40000])
      .on('zoom', (event) => {
        const { k, x, y } = event.transform;
        groupRef.current?.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
        // Labels and markers inside the zoomed group cancel the zoom with this.
        svg.style.setProperty('--inv-k', String(1 / k));
        store.set({ k, x, y });
      })
      .on('end', (event) => setSettledK(event.transform.k));
    zoomRef.current = behavior;
    select(svg).call(behavior).on('dblclick.zoom', null);
    return () => {
      select(svg).on('.zoom', null);
    };
  }, [store]);

  // ---- camera target: the selected barangay, else the focus area, else the whole country
  const target = useMemo<{ key: string; bounds: Bounds; maxFill: number } | null>(() => {
    const own = shapeLayers.at(-1);
    if (selectedCode !== focus.code) {
      const leaf = own?.byCode.get(selectedCode);
      if (leaf) return { key: selectedCode, bounds: leaf.bounds, maxFill: 0.4 };
    }
    if (levels.length === 1) return own ? { key: focus.code, bounds: own.bounds, maxFill: 1 } : null;
    const outline = shapeLayers.at(-2)?.byCode.get(focus.code);
    if (outline) return { key: focus.code, bounds: outline.bounds, maxFill: 1 };
    return own ? { key: focus.code, bounds: own.bounds, maxFill: 1 } : null;
  }, [shapeLayers, levels.length, focus.code, selectedCode]);

  const flyTo = useCallback((bounds: Bounds, maxFill: number, animate: boolean) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior || size.width < 1 || size.height < 1) return;
    const padding = Math.min(48, Math.min(size.width, size.height) * 0.08);
    const { k, x, y } = fitTransform(bounds, size.width, size.height, { padding, maxFill });
    const next = zoomIdentity.translate(x, y).scale(k);
    const selection = select(svg);
    selection.interrupt();
    if (animate && animationEnabled && !prefersReducedMotion()) {
      // d3-zoom interpolates with van Wijk's smooth zoom: pull back, travel, push in.
      selection.transition().duration(DRILL_MS).ease(easeCubicInOut).call(behavior.transform, next);
    } else {
      selection.call(behavior.transform, next);
    }
  }, [size.width, size.height, animationEnabled]);

  // The effect keys on the target's value, not its identity: a new level arriving
  // mid-flight recomputes `target` but must not restart or cut short the animation.
  const targetRef = useRef(target);
  const targetSignature = target ? `${target.key}|${target.bounds.flat().join(',')}|${target.maxFill}` : null;
  const lastTarget = useRef<string | null>(null);
  useEffect(() => {
    targetRef.current = target;
  });
  useEffect(() => {
    const next = targetRef.current;
    if (!next) return;
    // Animate between places; snap on first paint and when only the viewport changed.
    const animate = lastTarget.current !== null && lastTarget.current !== next.key;
    lastTarget.current = next.key;
    flyTo(next.bounds, next.maxFill, animate);
  }, [targetSignature, flyTo]);

  // ---- tell the app the map is up: a view is placed, or loading ended with nothing to place
  const settled = target !== null || !loading;
  useEffect(() => {
    if (settled) onReady?.();
  }, [settled, onReady]);

  // ---- shape lookup across every rendered level (deepest first)
  const findShape = useCallback((code: Psgc): Shape | undefined => {
    for (let i = shapeLayers.length - 1; i >= 0; i--) {
      const shape = shapeLayers[i]?.byCode.get(code);
      if (shape) return shape;
    }
    return undefined;
  }, [shapeLayers]);
  const findNode = useCallback((code: Psgc): GeoNode | undefined => {
    for (let i = levels.length - 1; i >= 0; i--) {
      const node = levels[i]!.nodes.get(code);
      if (node) return node;
    }
    return undefined;
  }, [levels]);

  // ---- labels: only names that fit inside their area at the settled zoom
  const labels = useMemo(() => {
    if (!showLabels || !activeLevel || !activeShapes) return [];
    const candidates: { shape: Shape; name: string; value: string | null; dark: boolean; area: number; w: number; h: number }[] = [];
    for (const shape of activeShapes.shapes) {
      const node = activeLevel.nodes.get(shape.code);
      if (!node) continue;
      const [[x0, y0], [x1, y1]] = shape.anchorBounds;
      const w = (x1 - x0) * settledK;
      const h = (y1 - y0) * settledK;
      const textWidth = node.name.length * 6.1 + 10;
      if (h < 18 || w < textWidth) continue;
      const v = layer.getValue(node, year);
      const value = h > 40 && v !== null ? layer.formatCompact(v) : null;
      candidates.push({ shape, name: node.name, value, dark: isDarkFill(scale?.colorOf(v) ?? null), area: w * h, w: textWidth, h: value ? 28 : 14 });
    }
    // Largest areas claim their space first; a label that would touch a placed one is dropped.
    candidates.sort((a, b) => b.area - a.area);
    const placed: typeof candidates = [];
    for (const c of candidates) {
      if (placed.length >= MAX_LABELS) break;
      const cx = c.shape.anchor[0] * settledK;
      const cy = c.shape.anchor[1] * settledK;
      const clear = placed.every((p) =>
        Math.abs(p.shape.anchor[0] * settledK - cx) > (p.w + c.w) / 2 || Math.abs(p.shape.anchor[1] * settledK - cy) > (p.h + c.h) / 2);
      if (clear) placed.push(c);
    }
    return placed;
  }, [showLabels, activeLevel, activeShapes, settledK, layer, year, scale]);

  // ---- delegated interaction
  const handleClick = (event: React.MouseEvent) => {
    const code = codeFromEvent(event);
    if (code) onPick(code);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { onUp(); return; }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const code = codeFromEvent(event);
    if (!code) return;
    event.preventDefault();
    onPick(code);
    // The picked area stops being a button once its children appear; keep focus on the map.
    svgRef.current?.focus();
  };
  const handlePointerMove = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const code = codeFromEvent(event);
    if (code !== hoveredCode) onHover(code);
    if (!code) { setTip(null); return; }
    const rect = containerRef.current!.getBoundingClientRect();
    setTip({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const handlePointerLeave = () => { onHover(null); setTip(null); };

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    const selection = select(svg);
    if (!animationEnabled || prefersReducedMotion()) selection.call(zoomRef.current.scaleBy, factor);
    else selection.transition().duration(220).call(zoomRef.current.scaleBy, factor);
  };

  const selectedLeaf = selectedCode !== focus.code ? findShape(selectedCode) : undefined;
  const hoveredShape = hoveredCode ? findShape(hoveredCode) : undefined;
  const hoveredNode = hoveredCode ? findNode(hoveredCode) : undefined;
  const hoveredIsActive = !!hoveredCode && !!activeShapes?.byCode.has(hoveredCode);
  const hoveredValue = hoveredNode ? layer.getValue(hoveredNode, year) : null;
  // The area being explored gets a firm outline over its children: "you are here".
  // Skipped at barangay level, where the parent's coarser outline would not sit on its barangays.
  const focusOutline = levels.length > 1 && !levels.at(-1)!.fine ? shapeLayers.at(-2)?.byCode.get(focus.code) : undefined;
  const selectedLeafNode = selectedLeaf ? findNode(selectedCode) : undefined;
  // The legend points at whichever area is under the pointer, else the selected barangay.
  const marked = hoveredIsActive && hoveredNode ? hoveredNode : selectedLeafNode;
  const markedValue = marked ? layer.getValue(marked, year) : null;

  return (
    <div className="relative flex h-full w-full flex-col">
    <div
      ref={containerRef}
      className="map-sheet relative min-h-0 w-full flex-1 touch-none overflow-hidden select-none"
      data-testid="map"
      data-compare={compareMode || undefined}
    >
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        role="group"
        tabIndex={-1}
        aria-label={`Map of ${focus.name}. ${layer.label}, ${layer.yearLabel(year)}.`}
        className="block"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <MapGraticule store={store} width={size.width} height={size.height} />
        <g ref={groupRef}>
          {levels.map((level, i) => {
            const shapes = shapeLayers[i];
            if (!shapes) return null;
            const role = i === activeDepth ? 'active' : 'context';
            return (
              <MapLayer
                key={level.parent.code}
                shapes={shapes}
                nodes={level.nodes}
                role={role}
                openCode={levels[i + 1]?.parent.code}
                layer={layer}
                year={year}
                scale={role === 'active' ? scale : null}
                verb={compareMode ? 'Compare' : 'Explore'}
                tabbable={shapes.shapes.length <= TAB_LIMIT}
              />
            );
          })}

          <g className="pointer-events-none" aria-hidden="true">
            {compare.map((code, i) => {
              const shape = findShape(code);
              return shape ? (
                <g key={code}>
                  <path d={shape.d} className="map-outline-compare-casing" />
                  <path d={shape.d} className="map-outline-compare" />
                  <g className="map-unscaled" style={{ transform: `translate(${shape.anchor[0]}px, ${shape.anchor[1]}px) scale(var(--inv-k))` }}>
                    <circle cy={-22} r={9} className="map-compare-badge" />
                    <text y={-18.5} textAnchor="middle" className="map-compare-badge-text">{i === 0 ? 'A' : 'B'}</text>
                  </g>
                </g>
              ) : null;
            })}
            {focusOutline && <path d={focusOutline.d} className="map-outline-focus" />}
            {hoveredShape && hoveredShape !== selectedLeaf && <path d={hoveredShape.d} className="map-outline-hover" />}
            {selectedLeaf && (
              <>
                <path d={selectedLeaf.d} className="map-outline-casing" />
                <path d={selectedLeaf.d} className="map-outline-selected" />
              </>
            )}
            {labels.filter((l) => l.shape !== selectedLeaf).map(({ shape, name, value, dark }) => (
              <g
                key={shape.code}
                className="map-unscaled map-label"
                data-dark={dark || undefined}
                style={{ transform: `translate(${shape.anchor[0]}px, ${shape.anchor[1]}px) scale(var(--inv-k))` }}
              >
                <text textAnchor="middle" y={value ? -2 : 3.5} className="map-label-name">{name}</text>
                {value && <text textAnchor="middle" y={11} className="map-label-value">{value}</text>}
              </g>
            ))}
            {selectedLeaf && selectedLeafNode && (
              // The selected area is always named, on a tag that reads on any fill.
              <g className="map-unscaled map-selected-tag" style={{ transform: `translate(${selectedLeaf.anchor[0]}px, ${selectedLeaf.anchor[1]}px) scale(var(--inv-k))` }}>
                <rect x={-(selectedLeafNode.name.length * 6.3 + 14) / 2} y={-9} width={selectedLeafNode.name.length * 6.3 + 14} height={18} />
                <text textAnchor="middle" y={3.5}>{selectedLeafNode.name}</text>
              </g>
            )}
          </g>
        </g>
      </svg>

      {tip && hoveredNode && (
        <div
          className="map-tooltip"
          role="presentation"
          style={{ left: Math.min(tip.x + 14, Math.max(size.width - 220, 0)), top: Math.max(tip.y - 14, 8) }}
        >
          <div className="font-semibold">{hoveredNode.name}</div>
          {hoveredIsActive ? (
            <div className="font-mono text-[11px] text-ink-2">
              {layer.label}: {hoveredValue === null ? UNAVAILABLE : layer.formatValue(hoveredValue)}
            </div>
          ) : (
            <div className="text-[11px] text-ink-2">Click to go here</div>
          )}
        </div>
      )}

      {focusError && (
        <div role="alert" className="absolute inset-x-3 top-14 mx-auto max-w-sm border border-ink bg-panel px-3 py-2 text-sm shadow-sm">
          <strong className="font-semibold">Boundaries unavailable.</strong> The map outline for {focus.name} could not be loaded.
          Its statistics are still listed in the panel.
        </div>
      )}
      {loading && !focusError && (
        <div className="absolute top-3 right-3 font-mono text-[10px] tracking-widest text-ink-3 uppercase" role="status">
          Loading boundaries…
        </div>
      )}

      <MapControls
        onZoomIn={() => zoomBy(1.6)}
        onZoomOut={() => zoomBy(1 / 1.6)}
        onFit={() => target && flyTo(target.bounds, target.maxFill, true)}
        onHome={onHome}
        atHome={levels.length === 1 && selectedCode === focus.code}
      />
    </div>
    {/* Overlaid on wide screens; on phones it sits under the map so it never hides land. */}
    <MapLegend
      layer={layer}
      year={year}
      scale={scale}
      hasMissing={hasMissing}
      levelName={activeLevel?.parent.name}
      marked={marked ? { name: marked.name, value: markedValue } : undefined}
    />
    </div>
  );
}
