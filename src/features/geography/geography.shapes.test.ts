import { describe, expect, it } from 'vitest';
import type { Topology } from 'topojson-specification';
import { buildShapeLayer, fitTransform, project, unproject } from './geography.shapes';

describe('projection', () => {
  it('round-trips longitude and latitude', () => {
    const [lon, lat] = unproject(...project(121.05, 14.6));
    expect(lon).toBeCloseTo(121.05, 9);
    expect(lat).toBeCloseTo(14.6, 9);
  });

  it('puts north up and east right', () => {
    expect(project(121, 15)[1]).toBeLessThan(project(121, 14)[1]);
    expect(project(122, 14)[0]).toBeGreaterThan(project(121, 14)[0]);
  });
});

describe('fitTransform', () => {
  it('centres the bounds and fills the limiting dimension inside the padding', () => {
    const t = fitTransform([[10, 10], [30, 20]], 400, 400, { padding: 50 });
    expect(t.k).toBe(15); // 300px available / 20 units wide
    expect(t.k * 20 + t.x).toBe(200);
    expect(t.k * 15 + t.y).toBe(200);
  });

  it('holds back when asked to leave room around a small target', () => {
    const full = fitTransform([[0, 0], [10, 10]], 500, 500);
    expect(fitTransform([[0, 0], [10, 10]], 500, 500, { maxFill: 0.4 }).k).toBeCloseTo(full.k * 0.4);
  });
});

describe('buildShapeLayer', () => {
  const topology: Topology = {
    type: 'Topology',
    arcs: [[[121, 14], [121.1, 14], [121.1, 14.1], [121, 14.1], [121, 14]], [[122, 14], [122.4, 14], [122.4, 14.4], [122, 14.4], [122, 14]]],
    objects: {
      f: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'MultiPolygon', id: '0403405001', arcs: [[[0]], [[1]]] },
          { type: null, id: '0403405002' },
        ],
      },
    },
  };

  it('keys shapes by PSGC and skips features without geometry', () => {
    const layer = buildShapeLayer('0403405000', topology, true);
    expect(layer.shapes.map((s) => s.code)).toEqual(['0403405001']);
    expect(layer.byCode.get('0403405001')?.d).toMatch(/^M/);
  });

  it('anchors the label on the largest polygon of a multi-part area', () => {
    const shape = buildShapeLayer('0403405000', topology, true).shapes[0]!;
    const [x] = project(122.2, 14.2);
    expect(shape.anchor[0]).toBeCloseTo(x, 3);
  });

  it('fails loudly on a file with nothing to draw', () => {
    expect(() => buildShapeLayer('x', { type: 'Topology', arcs: [], objects: {} }, false)).toThrow(/no features/);
  });
});
