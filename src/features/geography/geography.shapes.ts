import { queryOptions } from '@tanstack/react-query';
import { geoPath, geoTransform } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Geometry, Polygon } from 'geojson';
import { fetchData } from '../statistics/statistics.api';
import type { Psgc } from './geography.types';

/** [[minX, minY], [maxX, maxY]] in map units. */
export type Bounds = [[number, number], [number, number]];

export interface Shape {
  code: Psgc;
  /** SVG path data in map units. */
  d: string;
  bounds: Bounds;
  /** Centroid and bounds of the largest polygon: where a label belongs. */
  anchor: [number, number];
  anchorBounds: Bounds;
}

export interface ShapeLayer {
  parent: Psgc;
  shapes: Shape[];
  byCode: Map<Psgc, Shape>;
  bounds: Bounds;
}

// A fixed Mercator plane: 100 map units per degree of longitude, origin off the
// north-west of Luzon. Every layer is projected once into this plane; zooming is
// then a pure scale + translate of it, which is what makes the drill-down smooth.
const ORIGIN_LON = 116;
const ORIGIN_LAT = 21.5;
const UNITS_PER_DEGREE = 100;
const RAD = Math.PI / 180;
const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;
const ORIGIN_Y = mercator(ORIGIN_LAT);

export function project(lon: number, lat: number): [number, number] {
  return [(lon - ORIGIN_LON) * UNITS_PER_DEGREE, (ORIGIN_Y - mercator(lat)) * UNITS_PER_DEGREE];
}

export function unproject(x: number, y: number): [lon: number, lat: number] {
  const lat = (2 * Math.atan(Math.exp((ORIGIN_Y - y / UNITS_PER_DEGREE) * RAD)) - Math.PI / 2) / RAD;
  return [x / UNITS_PER_DEGREE + ORIGIN_LON, lat];
}

const planar = geoTransform({
  point(lon, lat) {
    const [x, y] = project(lon, lat);
    this.stream.point(x, y);
  },
});

export function unionBounds(all: Bounds[]): Bounds {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [[ax, ay], [bx, by]] of all) {
    x0 = Math.min(x0, ax); y0 = Math.min(y0, ay);
    x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
  }
  return [[x0, y0], [x1, y1]];
}

/** Convert a TopoJSON file of sibling areas into drawable shapes keyed by PSGC. */
export function buildShapeLayer(parent: Psgc, topology: Topology, fine: boolean): ShapeLayer {
  const object = topology.objects.f as GeometryCollection | undefined;
  if (!object) throw new Error(`Boundary file ${parent} has no features`);
  // Barangays are drawn hundreds of times larger than regions and need the precision.
  const path = geoPath(planar).digits(fine ? 4 : 3);
  const shapes: Shape[] = [];
  for (const f of feature(topology, object).features) {
    const d = f.geometry ? path(f) : null;
    if (!d || typeof f.id !== 'string') continue;
    const main = largestPolygon(f.geometry, (g) => path.area(g));
    shapes.push({
      code: f.id,
      d,
      bounds: path.bounds(f) as Bounds,
      anchor: path.centroid(main) as [number, number],
      anchorBounds: path.bounds(main) as Bounds,
    });
  }
  if (!shapes.length) throw new Error(`Boundary file ${parent} has no drawable features`);
  return { parent, shapes, byCode: new Map(shapes.map((s) => [s.code, s])), bounds: unionBounds(shapes.map((s) => s.bounds)) };
}

function largestPolygon(geometry: Geometry, area: (g: Geometry) => number): Geometry {
  if (geometry.type !== 'MultiPolygon') return geometry;
  let best: Polygon | null = null;
  let bestArea = -1;
  for (const coordinates of geometry.coordinates) {
    const polygon: Polygon = { type: 'Polygon', coordinates };
    const a = area(polygon);
    if (a > bestArea) [best, bestArea] = [polygon, a];
  }
  return best ?? geometry;
}

/** Boundaries of the children of `parent`. Loaded only when the user drills that far. */
export const shapesQuery = (parent: Psgc, fine: boolean) =>
  queryOptions({
    queryKey: ['shapes', parent],
    queryFn: async () => buildShapeLayer(parent, (await fetchData(`geo/${parent}.json`)) as Topology, fine),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });

export interface ViewTransform {
  k: number;
  x: number;
  y: number;
}

export interface FitOptions {
  /** Pixels kept clear on every side. */
  padding?: number;
  /** Largest share of the viewport the bounds may fill, 0..1. */
  maxFill?: number;
}

/** The scale + translate that centres `bounds` in a viewport. */
export function fitTransform(bounds: Bounds, width: number, height: number, { padding = 0, maxFill = 1 }: FitOptions = {}): ViewTransform {
  const [[x0, y0], [x1, y1]] = bounds;
  const w = Math.max(x1 - x0, 1e-6);
  const h = Math.max(y1 - y0, 1e-6);
  const availableW = Math.max(width - padding * 2, 1) * maxFill;
  const availableH = Math.max(height - padding * 2, 1) * maxFill;
  const k = Math.min(availableW / w, availableH / h);
  return { k, x: width / 2 - k * (x0 + x1) / 2, y: height / 2 - k * (y0 + y1) / 2 };
}
