// Normalises the cached raw sources (see fetch-sources.mjs) into the static
// assets the app loads from public/data/. Nothing here invents a number: every
// statistic is copied from a PSA OpenSTAT table, and barangay land area is the
// only derived quantity (measured from the boundary polygon, flagged as such).
//
//   public/data/core.json              hierarchy + statistics down to city/municipality
//   public/data/bgy/{parent}.json      barangay statistics for one city/municipality
//   public/data/search-barangays.json  barangay names for search, grouped by parent
//   public/data/geo/{parent}.json      TopoJSON of the children of {parent}, ids = PSGC
import { readFile, writeFile, mkdir, rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import mapshaper from 'mapshaper';
import { feature, merge } from 'topojson-client';
import { topology } from 'topojson-server';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'public/data');
const COUNTRY = '0000000000';

const readJson = async (f) => JSON.parse(await readFile(f, 'utf8'));
const pad = (c) => String(c).padStart(10, '0');

// ---------------------------------------------------------------- statistics

const REGIONS = {
  '01': ['Ilocos Region', 'Region I'],
  '02': ['Cagayan Valley', 'Region II'],
  '03': ['Central Luzon', 'Region III'],
  '04': ['CALABARZON', 'Region IV-A'],
  '05': ['Bicol Region', 'Region V'],
  '06': ['Western Visayas', 'Region VI'],
  '07': ['Central Visayas', 'Region VII'],
  '08': ['Eastern Visayas', 'Region VIII'],
  '09': ['Zamboanga Peninsula', 'Region IX'],
  '10': ['Northern Mindanao', 'Region X'],
  '11': ['Davao Region', 'Region XI'],
  '12': ['SOCCSKSARGEN', 'Region XII'],
  '13': ['National Capital Region', 'NCR'],
  '14': ['Cordillera Administrative Region', 'CAR'],
  '16': ['Caraga', 'Region XIII'],
  '17': ['MIMAROPA', 'MIMAROPA Region'],
  '18': ['Negros Island Region', 'NIR'],
  '19': ['Bangsamoro Autonomous Region in Muslim Mindanao', 'BARMM'],
};

/** OpenSTAT labels carry indentation dots and footnote markers ("Cebu  *", "Kapalawan 6/"). */
function cleanName(label) {
  return label
    .replace(/^\.+/, '')
    .replace(/(\s+(\*+|\d+\/|[¹²³⁴-⁹]+))+\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadTables() {
  const dir = path.join(CACHE, 'openstat');
  const tables = {};
  for (const f of (await readdir(dir)).sort()) {
    const t = await readJson(path.join(dir, f));
    const values = new Map();
    for (const row of t.data) {
      const [code, param] = row.key;
      const raw = row.values[0];
      const n = raw === '..' || raw === '' || raw == null ? null : Number(raw);
      values.set(`${code}|${param}`, Number.isFinite(n) ? n : null);
    }
    tables[t.table.slice(0, 3)] = { ...t, values };
  }
  return tables;
}

function buildTree(tables) {
  const nodes = new Map();
  const add = (n) => { nodes.set(n.code, { children: [], ...n }); return nodes.get(n.code); };
  add({ code: COUNTRY, name: 'Philippines', kind: 'country', parent: null });

  for (let i = 1; i <= 18; i++) {
    const t = tables[String(i).padStart(3, '0')];
    const regionCode = Object.keys(t.labels)[0];
    const prefix = regionCode.slice(0, 2);
    const stack = [];
    for (const [code, label] of Object.entries(t.labels)) {
      // The CAR table is published with ~1,100 stray Region II rows appended; drop them.
      if (!code.startsWith(prefix)) continue;
      const dots = label.length - label.replace(/^\.+/, '').length;
      // Manila's sub-municipalities are published without indentation.
      const depth = dots === 0 ? 6 : dots;
      while (stack.length && stack.at(-1).depth >= depth) stack.pop();
      let parent = stack.at(-1)?.code ?? COUNTRY;
      // City of Isabela is listed after Zamboanga Sibugay but is not part of any province.
      if (depth === 6 && parent.slice(0, 5) !== code.slice(0, 5)) parent = regionCode;
      const name = cleanName(label);
      let kind;
      if (depth === 2) kind = 'region';
      else if (depth === 8) kind = 'barangay';
      else if (dots === 0) kind = 'submun';
      else if (/\bCity\b/i.test(name)) kind = 'city';
      else if (depth === 6 || name === 'Pateros') kind = 'municipality';
      else if (name === 'Special Geographic Area') kind = 'sga';
      else kind = 'province';
      const node = add({ code, name, kind, parent });
      if (kind === 'region') [node.name, node.alt] = REGIONS[prefix];
      node.pop = t.values.get(`${code}|0`);
      node.hhPop = t.values.get(`${code}|1`);
      node.hh = t.values.get(`${code}|2`);
      stack.push({ depth, code });
    }
  }
  for (const n of nodes.values()) if (n.parent) nodes.get(n.parent).children.push(n.code);

  const [summary, growth, density, urban] = [tables['019'], tables['021'], tables['022'], tables['023']];
  const root = nodes.get(COUNTRY);
  root.pop = summary.values.get(`${COUNTRY}|0`);
  root.hhPop = summary.values.get(`${COUNTRY}|1`);
  root.hh = summary.values.get(`${COUNTRY}|2`);
  for (const n of nodes.values()) {
    // Some summary tables file City of Isabela under its province-level code.
    const alias = n.code === '0990101000' ? '0990100000' : n.code;
    const v = (t, p) => t.values.get(`${n.code}|${p}`) ?? t.values.get(`${alias}|${p}`) ?? null;
    n.urb = v(urban, 1);
    if (n.kind === 'barangay') continue;
    n.p10 = v(growth, 0); n.p15 = v(growth, 1); n.p20 = v(growth, 2);
    n.g1015 = v(growth, 4); n.g1520 = v(growth, 5); n.g2024 = v(growth, 7);
    n.area = v(density, 3);
  }
  // Descendant barangay counts, so upper levels can report them without loading barangays.
  const countBgy = (n) => (n.nBgy = n.kind === 'barangay' ? 1 : n.children.reduce((s, c) => s + countBgy(nodes.get(c)), 0));
  countBgy(root);
  return nodes;
}

// ------------------------------------------------------------------ geometry

/** 2023-vintage boundary codes -> 2024 PSGC codes used by the census tables. */
function crosswalk(code) {
  if (/^(06045|06302|07046|07061)/.test(code)) return `18${code.slice(2)}`; // Negros Island Region
  if (code.startsWith('19066')) return `09${code.slice(2)}`; // Sulu moved to Region IX
  if (code === '0990100000') return '0990101000'; // "City of Isabela (Not a Province)"
  return code;
}

const polygonsOf = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(a) / 2;
}

/** Planar area with a local cos(latitude) correction; ample for barangay-sized polygons. */
function areaKm2(geometry) {
  const KM_PER_DEG = 111.195;
  let total = 0;
  for (const poly of polygonsOf(geometry)) {
    const lat = poly[0].reduce((s, p) => s + p[1], 0) / poly[0].length;
    const k = KM_PER_DEG * KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
    total += (ringArea(poly[0]) - poly.slice(1).reduce((s, r) => s + ringArea(r), 0)) * k;
  }
  return total;
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inGeometry = (pt, g) => polygonsOf(g).some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));

const featuresOf = (topo) => Object.values(topo.objects).flatMap((o) => feature(topo, o).features);
const fc = (features) => ({ type: 'FeatureCollection', features });
const feat = (id, geometry) => ({ type: 'Feature', id, properties: { id }, geometry });
const toTopo = (features, q) => topology({ f: fc(features.map((f) => feat(f.id, f.geometry))) }, q);

async function shape(inputs, commands) {
  const files = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, JSON.stringify(v)]));
  const out = await mapshaper.applyCommands(
    `${commands} -filter-fields id -o out.json format=topojson id-field=id quantization=100000`,
    files,
  );
  const topo = JSON.parse(out['out.json'].toString());
  // Normalise to a single object named "f" with id-only geometries.
  const obj = Object.values(topo.objects)[0];
  for (const g of obj.geometries) delete g.properties;
  topo.objects = { f: obj };
  return topo;
}

async function loadBoundaries() {
  const dir = path.join(CACHE, 'boundaries');
  const load = async (sub) => {
    const out = [];
    for (const f of (await readdir(path.join(dir, sub))).sort()) out.push([f, await readJson(path.join(dir, sub, f))]);
    return out;
  };
  const b = { regionLevel: [], provinceLevel: new Map(), cityLevel: new Map(), bgyTopo: new Map() };

  const [[, country]] = await load('country');
  b.regionLevel = featuresOf(country).map((f) => feat(pad(f.properties.adm1_psgc), f.geometry));

  for (const [, topo] of await load('regions')) {
    for (const f of featuresOf(topo)) b.provinceLevel.set(crosswalk(pad(f.properties.adm2_psgc)), f.geometry);
  }
  for (const [, topo] of await load('provdists')) {
    for (const f of featuresOf(topo)) b.cityLevel.set(crosswalk(pad(f.properties.adm3_psgc)), f.geometry);
  }
  // Barangay topologies stay as topologies so shared borders survive re-encoding and merging.
  for (const [file, topo] of await load('municities')) {
    const code = crosswalk(pad(file.match(/municity-(\d+)\./)[1]));
    const obj = Object.values(topo.objects)[0];
    obj.geometries = obj.geometries.filter((g) => g.type);
    for (const g of obj.geometries) g.id = crosswalk(pad(g.properties.adm4_psgc));
    if (obj.geometries.length) b.bgyTopo.set(code, { topo, obj });
  }
  // Manila: 2019 files, one per sub-municipality, old 9-digit codes 1339MMBBB -> 13806MMBBB.
  for (const [file, topo] of await load('manila2019')) {
    const mm = file.slice(4, 6);
    const obj = Object.values(topo.objects)[0];
    obj.geometries = obj.geometries.filter((g) => g.type && g.properties.ADM4_PCODE);
    for (const g of obj.geometries) g.id = `13806${mm}${g.properties.ADM4_PCODE.slice(-3)}`;
    b.bgyTopo.set(`13806${mm}000`, { topo, obj });
  }
  return b;
}

/** Outline of a city/municipality that has no polygon of its own: dissolve its barangays. */
const dissolveBarangays = (b, code) => {
  const src = b.bgyTopo.get(code);
  return src ? merge(src.topo, src.obj.geometries) : null;
};

const unionGeometry = (geoms) => ({ type: 'MultiPolygon', coordinates: geoms.flatMap(polygonsOf) });

async function buildGeometry(nodes, b, report) {
  const geoDir = path.join(OUT, 'geo');
  await mkdir(geoDir, { recursive: true });
  const bgyArea = new Map();
  const hasGeometry = new Set();
  const write = async (parent, topo) => {
    for (const g of topo.objects.f.geometries) hasGeometry.add(g.id);
    await writeFile(path.join(geoDir, `${parent}.json`), JSON.stringify(topo));
  };

  // -- barangays (and Manila's sub-municipalities)
  for (const [parent, { topo, obj }] of b.bgyTopo) {
    if (!nodes.has(parent)) { report.orphanFiles.push(parent); continue; }
    const features = feature(topo, obj).features;
    for (const f of features) {
      bgyArea.set(f.id, areaKm2(f.geometry));
      if (!nodes.has(f.id)) report.geometryWithoutStats.push(f.id);
    }
    await write(parent, toTopo(features, 1e4));
  }
  const manila = nodes.get('1380600000');
  await write(manila.code, toTopo(manila.children.map((c) => feat(c, dissolveBarangays(b, c))), 1e4));

  // -- outlines for cities/municipalities missing from the province files
  const cityGeometry = (code) => b.cityLevel.get(code) ?? dissolveBarangays(b, code);
  const sga = nodes.get('1999900000');
  const sgaGeometry = unionGeometry(sga.children.map(cityGeometry));

  // -- cities/municipalities of each province
  for (const n of nodes.values()) {
    if (n.kind !== 'province' && n.kind !== 'sga') continue;
    const features = n.children.map((c) => feat(c, cityGeometry(c))).filter((f) => f.geometry);
    await write(n.code, toTopo(features, 2e4));
  }

  // -- provinces + highly urbanized cities of each region
  // Province polygons in the source include the HUCs inside them, while PSA reports the
  // two separately, so each HUC is cut out of its province and added as its own feature.
  for (const region of nodes.get(COUNTRY).children.map((c) => nodes.get(c))) {
    const provinces = [];
    const standalone = [];
    for (const c of region.children.map((code) => nodes.get(code))) {
      if (b.provinceLevel.has(c.code)) provinces.push(feat(c.code, b.provinceLevel.get(c.code)));
      else standalone.push(feat(c.code, c.kind === 'sga' ? sgaGeometry : cityGeometry(c.code)));
    }
    const cut = [...standalone];
    if (region.code === '1200000000') cut.push(feat(sga.code, sgaGeometry)); // SGA lies inside Cotabato
    let topo;
    if (!provinces.length) {
      topo = await shape({ 'add.json': fc(standalone) }, '-i add.json -clean');
    } else if (!cut.length) {
      topo = await shape({ 'prov.json': fc(provinces) }, '-i prov.json');
    } else {
      const inputs = { 'prov.json': fc(provinces), 'cut.json': fc(cut) };
      let cmd = '-i prov.json name=f -erase source=cut.json';
      if (standalone.length) {
        inputs['add.json'] = fc(standalone);
        cmd += ' -i add.json name=add -merge-layers target=f,add force name=f';
      }
      topo = await shape(inputs, `${cmd} -clean`);
    }
    await write(region.code, topo);
  }

  // -- regions of the country
  // The 2023 country file has 17 regions. Regions VI, VII and BARMM are split into their
  // islands, each island is assigned to its 2024 region by the province it falls in, and
  // the pieces are dissolved again. That yields NIR and moves Sulu to Region IX.
  const provinceRegion = [...b.provinceLevel].map(([code, geometry]) => ({ geometry, region: nodes.get(code)?.parent }));
  const pieces = [];
  for (const f of b.regionLevel) {
    if (!['06', '07', '19'].includes(f.id.slice(0, 2))) { pieces.push(f); continue; }
    const candidates = provinceRegion.filter((p) => ['06', '07', '09', '18', '19'].includes(p.region?.slice(0, 2)));
    for (const poly of polygonsOf(f.geometry)) {
      const ring = poly[0];
      const step = Math.max(1, Math.floor(ring.length / 40));
      const votes = new Map();
      for (let i = 0; i < ring.length; i += step) {
        const hit = candidates.find((p) => inGeometry(ring[i], p.geometry));
        if (hit) votes.set(hit.region, (votes.get(hit.region) ?? 0) + 1);
      }
      let region = [...votes].sort((x, y) => y[1] - x[1])[0]?.[0];
      if (!region) {
        // Islets too small to overlap a simplified province polygon: take the nearest province.
        let best = Infinity;
        for (const p of candidates) {
          for (const pp of polygonsOf(p.geometry)) {
            for (let i = 0; i < pp[0].length; i += 5) {
              const d = (pp[0][i][0] - ring[0][0]) ** 2 + (pp[0][i][1] - ring[0][1]) ** 2;
              if (d < best) { best = d; region = p.region; }
            }
          }
        }
      }
      pieces.push(feat(region, { type: 'Polygon', coordinates: poly }));
    }
  }
  await write(COUNTRY, await shape({ 'r.json': fc(pieces) }, '-i r.json -dissolve id copy-fields=id -simplify 40% keep-shapes'));

  for (const n of nodes.values()) {
    if (n.code !== COUNTRY && !hasGeometry.has(n.code)) report.statsWithoutGeometry.push(n.code);
  }
  return bgyArea;
}

// -------------------------------------------------------------------- output

const round = (n, d) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

async function writeStatistics(nodes, tables, bgyArea) {
  const core = [];
  const search = {};
  await mkdir(path.join(OUT, 'bgy'), { recursive: true });
  for (const n of nodes.values()) {
    if (n.kind === 'barangay') continue;
    // No land area is published for Manila's sub-municipalities either: sum their barangay outlines.
    if (n.kind === 'submun') n.area = round(n.children.reduce((s, c) => s + (bgyArea.get(c) ?? 0), 0), 4) || null;
    core.push([
      n.code, n.name, n.kind, n.parent, n.alt ?? null,
      n.pop, n.hhPop, n.hh, n.urb, n.area,
      n.p20, n.p15, n.p10, n.g2024, n.g1520, n.g1015, n.nBgy,
    ]);
    const bgys = n.children.map((c) => nodes.get(c)).filter((c) => c.kind === 'barangay');
    if (!bgys.length) continue;
    const rows = bgys.map((c) => [c.code, c.name, c.pop, c.hhPop, c.hh, c.urb, round(bgyArea.get(c.code) ?? null, 4)]);
    await writeFile(path.join(OUT, 'bgy', `${n.code}.json`), JSON.stringify({ parent: n.code, fields: ['code', 'name', 'pop', 'hhPop', 'hh', 'urb', 'areaEst'], rows }));
    search[n.code.slice(0, 7)] = bgys.map((c) => c.code.slice(7) + c.name);
  }
  const used = ['001', '019', '021', '022', '023'].map((k) => tables[k]);
  const meta = {
    generated: new Date().toISOString().slice(0, 10),
    census: '2024 Census of Population (POPCEN), reference date 1 July 2024',
    fields: ['code', 'name', 'kind', 'parent', 'alt', 'pop', 'hhPop', 'hh', 'urb', 'area', 'p20', 'p15', 'p10', 'g2024', 'g1520', 'g1015', 'nBgy'],
    tables: used.map((t) => ({ id: t.table, title: t.title.replace(/: Ilocos Region$/, ' (18 regional tables)'), updated: t.updated?.slice(0, 10) })),
  };
  await writeFile(path.join(OUT, 'core.json'), JSON.stringify({ meta, nodes: core }));
  await writeFile(path.join(OUT, 'search-barangays.json'), JSON.stringify(search));
}

async function dirSize(dir) {
  let bytes = 0, files = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const s = await dirSize(p); bytes += s.bytes; files += s.files; }
    else { bytes += (await stat(p)).size; files++; }
  }
  return { bytes, files };
}

const tables = await loadTables();
const nodes = buildTree(tables);
const report = { orphanFiles: [], geometryWithoutStats: [], statsWithoutGeometry: [] };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const boundaries = await loadBoundaries();
const bgyArea = await buildGeometry(nodes, boundaries, report);
await writeStatistics(nodes, tables, bgyArea);

// ---------------------------------------------------------------- validation
const kinds = {};
for (const n of nodes.values()) kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
console.log('nodes by kind', kinds);
const sumMismatch = [];
for (const n of nodes.values()) {
  if (!n.children.length || n.code === COUNTRY) continue;
  const sum = n.children.reduce((s, c) => s + (nodes.get(c).pop ?? 0), 0);
  if (sum !== n.pop) sumMismatch.push(`${n.code} ${n.name}: ${n.pop} vs children ${sum}`);
}
console.log('population roll-up mismatches', sumMismatch.length, sumMismatch.slice(0, 10));
const name = (c) => `${c} ${nodes.get(c)?.name ?? '(not in census)'}`;
console.log('statistics without geometry', report.statsWithoutGeometry.length, report.statsWithoutGeometry.map(name));
console.log('geometry without statistics', report.geometryWithoutStats.length, report.geometryWithoutStats);
console.log('boundary files without a census parent', report.orphanFiles);
const missing = (field, ks) => [...nodes.values()].filter((n) => ks.includes(n.kind) && n[field] == null).map((n) => name(n.code));
const upper = ['region', 'province', 'city', 'municipality', 'sga'];
for (const f of ['area', 'p20', 'g2024', 'urb']) console.log(`missing ${f}`, missing(f, upper).slice(0, 12));
console.log('missing urb (barangay)', missing('urb', ['barangay']).length, '| missing areaEst', [...nodes.values()].filter((n) => n.kind === 'barangay' && !bgyArea.has(n.code)).length);
for (const d of ['geo', 'bgy']) {
  const s = await dirSize(path.join(OUT, d));
  console.log(d, s.files, 'files', (s.bytes / 1e6).toFixed(1), 'MB');
}
for (const f of ['core.json', 'search-barangays.json', 'geo/0000000000.json']) console.log(f, ((await stat(path.join(OUT, f))).size / 1e3).toFixed(0), 'kB');
