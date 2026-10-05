// Downloads the raw sources into .cache/ (git-ignored). Run once, then `npm run data:build`.
//
//   Statistics  PSA OpenSTAT (PXWeb API), 2024 Census of Population tables
//   Boundaries  faeldon/philippines-json-maps (MIT), PSGC 4Q-2023 vintage
//
// OpenSTAT allows 30 calls per 10 seconds; this script stays far below that.
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve(import.meta.dirname, '../.cache');
const OPENSTAT = 'https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/1A/PO_2024';
const MAPS = 'https://raw.githubusercontent.com/faeldon/philippines-json-maps/master';
const MAPS_TREE = 'https://api.github.com/repos/faeldon/philippines-json-maps/git/trees/master?recursive=1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (f) => access(f).then(() => true, () => false);

async function getJson(url, body) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'ph-data-terminal' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return JSON.parse((await res.text()).replace(/^\uFEFF/, ''));
    } catch (err) {
      if (attempt >= 3) throw err;
      await sleep(3000 * (attempt + 1));
    }
  }
}

async function fetchOpenStat() {
  const dir = path.join(CACHE, 'openstat');
  await mkdir(dir, { recursive: true });
  const tables = await getJson(OPENSTAT);
  for (const t of tables) {
    const id = t.id.replace(/\.px$/i, '');
    const file = path.join(dir, `${id}.json`);
    if (await exists(file)) continue;
    const url = `${OPENSTAT}/${t.id}`;
    const meta = await getJson(url);
    const query = meta.variables.map((v) => ({ code: v.code, selection: { filter: 'all', values: ['*'] } }));
    await sleep(700);
    // "json" carries the values keyed by PSGC code; "json-stat2" carries the row labels.
    const data = await getJson(url, { query, response: { format: 'json' } });
    await sleep(700);
    const stat = await getJson(url, { query, response: { format: 'json-stat2' } });
    await writeFile(file, JSON.stringify({
      table: id,
      title: meta.title,
      updated: t.updated,
      variables: meta.variables.filter((v) => v.values),
      comments: data.comments,
      labels: stat.dimension['Geographic Location'].category.label,
      data: data.data,
    }));
    console.log('openstat', id, data.data.length);
    await sleep(700);
  }
}

async function fetchBoundaries() {
  const tree = await getJson(MAPS_TREE);
  const jobs = [];
  for (const { path: p, type } of tree.tree) {
    if (type !== 'blob') continue;
    const m2023 = p.match(/^2023\/topojson\/(country|regions|provdists|municities)\/medres\/(.+)$/);
    // The 2023 vintage ships an empty file for the City of Manila; its barangays come from 2019.
    const m2019 = p.match(/^2019\/topojson\/barangays\/medres\/barangays-municity-ph(1339\d\d)000\..+$/);
    if (m2023) jobs.push([p, path.join(CACHE, 'boundaries', m2023[1], m2023[2])]);
    if (m2019) jobs.push([p, path.join(CACHE, 'boundaries', 'manila2019', `${m2019[1]}.json`)]);
  }
  let done = 0;
  const worker = async () => {
    for (let job; (job = jobs.pop()); ) {
      const [src, dest] = job;
      if (!(await exists(dest))) {
        await mkdir(path.dirname(dest), { recursive: true });
        const res = await fetch(`${MAPS}/${src}`);
        if (!res.ok) throw new Error(`${res.status} ${src}`);
        await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      }
      if (++done % 200 === 0) console.log('boundaries', done);
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
}

await fetchOpenStat();
await fetchBoundaries();
console.log('Sources cached in', CACHE);
