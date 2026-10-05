# PH Data Terminal

An interactive map for exploring Philippine census statistics. Start from the whole country, click a region, and the map flies into it and redraws at the next administrative level: region → province → city or municipality → barangay. The statistics follow the map.

It is a static site. There is no backend, no API key, and nothing to configure.

> An independent portfolio project. It is not an official website of the Philippine Statistics Authority or any government agency.

## What it does

- **Drill-down map.** Click any area to zoom into it. The camera uses a smooth pull-back-and-push-in zoom while the next level's boundaries load and fade in.
- **Six data layers.** Population, population density, population growth, urbanization, households, and household size, drawn as a classed choropleth with a legend that shows the class boundaries.
- **Census years.** Population and density for 2024, 2020, 2015 (population also 2010); growth for the three intercensal periods.
- **Selected-area panel.** Headline figure, rank among siblings, share of the parent's population, a fixed set of statistics, and population across census years.
- **Ranking.** The areas currently on the map, ordered by the active layer. It doubles as the keyboard route into the map.
- **Comparison.** Pick any two areas, at any level, and see them side by side.
- **Search.** All 43,768 areas, including every barangay. Choosing a result navigates the map there.
- **Shareable URLs.** The selected area, layer, year and comparison live in the query string, and the browser's Back button steps back through the drill-down.
- **Honest gaps.** A figure that is not published for an area is shown as "Data unavailable", never as zero.
- **Palettes.** Five curated themes (Philippine Blue, Topographic Green, Sunset, Monochrome, Archive) restyle the interface and the choropleth together. The choice is remembered.
- **Baybayin.** A local Latin-to-Baybayin converter, and an optional Baybayin form of the selected place's name where one can be derived without guessing.
- **Start-up screen.** Shows real initialization progress over the country's actual outline and leaves as soon as the map is ready.

## Baybayin

The converter in the header writes Filipino text in Baybayin using the Unicode Tagalog block (U+1700–U+171F). It runs entirely in the browser: no API, no network request.

**It is a modern phonetic transliteration, not a translation, and not a historical spelling.** Baybayin writes syllables, so converting Latin spelling into it involves choices. The ones made here, all in [`src/features/baybayin/`](src/features/baybayin/):

| Input | Rule |
| --- | --- |
| `a`, `e`/`i`, `o`/`u` | The three Baybayin vowels; `e` is written as `i` and `o` as `u` |
| consonant + vowel | One letter, with a kudlit mark for `i`/`e` or `u`/`o` |
| `ng` | Always the single letter NGA, never N + G |
| consonant with no vowel after it | Marked with the **pamudpod** (U+1715) by default. The panel can switch to the krus-kudlit virama (U+1714) or to traditional spelling, which leaves the consonant unwritten |
| `r` | The modern letter RA (U+170D); archaic RA and DA are available in code |
| `mga`, `ng` (the words) | Written as pronounced: *manga*, *nang* |
| `c f j q v x z ñ`, `ch sh ph th qu` | Not in the native alphabet. Respelled by sound first (`c` → `k` or `s`, `f` → `p`, `v` → `b`, `j` → `dy` ...) and flagged in the panel as approximated |
| spaces, digits, punctuation, line breaks | Preserved as typed |

It follows spelling, not speech, so a word like *Batangas* comes out as ba-ta-nga-s although it is said ba-tang-gas. English and other borrowed words can have several defensible spellings; the converter picks one deterministically.

The Baybayin name in the selected-area panel is deliberately conservative. It appears only for provinces, cities, municipalities and barangays whose names use native letters and Filipino-like syllables: *Laguna* and *Pasig* get one; *Cavite*, *Quezon* and *Greenhills* do not. It can be turned off in settings.

Glyphs render in a bundled copy of Noto Sans Tagalog (6 kB), so they display on devices with no Baybayin font. Text copied elsewhere depends on that device's fonts; the pamudpod is a 2021 addition to Unicode and older fonts lack it.

## Palettes

Palettes are defined in [`palettes.ts`](src/features/theme/palettes.ts). Each is a complete set: interface colours, a six-step single-hue ramp for the choropleth, a contrasting pair for population decline, and a selection colour from outside the ramp's hue. Applying one sets CSS custom properties on the root element; the map's colour scale reads the same object, so the legend, map, charts and bars always agree.

There is no free colour picker. Every palette is held to the same tests: text contrast of at least 4.5:1 (7:1 for primary text), a ramp that darkens monotonically in separable steps, a perceptual gap between the lowest class, context land, "no data" and the map sheet, and a selection outline that reads against its casing.

The palette is stored in `localStorage` under `ph-data-terminal-palette` and applied before first paint. If storage is unavailable the app uses Philippine Blue and still lets you switch for the session.

## Start-up

The boot screen is driven by the app's real initialization, not a timer: the census dataset request, the PSGC index built from it, the regional boundaries request, and the map placing its first view. The silhouette is those same regional boundaries. If the dataset fails to load, the screen becomes the error state with a retry.

On a first visit it stays up for at least half a second so it does not flash past unread; a slow connection adds nothing on top of the load itself. Returning visitors get a shorter screen with no minimum. With `prefers-reduced-motion` there is no drawing-in, no hold and no fade.

## Geographic hierarchy

```text
Philippines
└── Region                           18
    ├── Province                     82
    │   └── City / Municipality
    │       └── Barangay
    └── Highly urbanized city        33
        └── Barangay

149 cities · 1,493 municipalities · 42,011 barangays
```

The hierarchy follows the PSA's own tables rather than a strict four-level tree:

- **Highly urbanized cities are siblings of provinces.** PSA reports Cebu City separately from Cebu province, so the map draws them as separate areas and their figures are never added together.
- **The National Capital Region has no provinces.** Its 16 cities and one municipality (Pateros) sit directly under the region. The City of Isabela likewise sits directly under Region IX.
- **Manila** is the only city with sub-municipalities between it and its barangays.
- **BARMM's Special Geographic Area** is province-level without being a province.

Every area is identified by its 10-digit PSGC code. Names are never used as keys: there are, for example, hundreds of barangays called San Antonio.

## Data sources

| What | Source | Notes |
| --- | --- | --- |
| Population, household population, households (all levels) | [PSA OpenSTAT](https://openstat.psa.gov.ph/), 2024 Census of Population, tables `0011A6DTPH0`–`0181A6DTHP7` | One table per region, down to barangay |
| Population 2010, 2015, 2020 and annual growth rates | OpenSTAT `0211A6DAPG0` | Down to city/municipality |
| Land area | OpenSTAT `0221A6DLPD0` | Down to city/municipality |
| Urban population | OpenSTAT `0231A6DPUP0` | Down to barangay |
| National totals | OpenSTAT `0191A6DTHP8` | |
| Geographic codes | Philippine Standard Geographic Code (PSGC), as used in the 2024 census tables | |
| Boundaries | [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) (MIT), built from [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) | PSGC as of 31 December 2023 |

Official boundary mapping in the Philippines is the mandate of NAMRIA. The outlines used here are simplified for the web and are not authoritative.

### What is derived, and what is missing

- **Density** is population ÷ land area. For cities and above the land area is PSA's published figure. For barangays (and Manila's sub-municipalities) no land area is published, so it is **measured from the boundary polygon** and marked "approx." wherever it appears.
- **Percent urban** is urban population ÷ total population. **Household size** is household population ÷ households.
- **Growth** uses PSA's published annual rates. It is not available for barangays, and neither are pre-2024 counts.
- **Reconciling 2023 boundaries with 2024 codes.** The boundaries predate the Negros Island Region and Sulu's move to Region IX. The build re-codes the affected areas and rebuilds those region outlines, so the map shows the 18 regions the census uses.
- **Manila's barangays** are missing from the 2023 boundary release and come from the same project's 2019 release.
- **53 of 42,011 barangays** have no outline in the boundary data (most were created or renumbered after it was compiled). They appear in the ranking and search with their statistics but cannot be drawn.
- **PSA's CAR table** is published with about 1,100 stray Cagayan Valley rows appended. The build drops them.

The build script checks itself against PSA's totals: 18 regions, 82 provinces, 149 cities, 1,493 municipalities, 42,011 barangays, and every area's population equals the sum of its children.

## Architecture

```text
React components
  ↓
TanStack Query ── caches each static file for the session
  ↓
Normalisers ───── raw rows → typed nodes, indexed by PSGC
  ↓
public/data/*.json  ←  scripts/build-data.mjs  ←  PSA OpenSTAT (build time only)

React components
  ↓
D3 ────────────── d3-geo paths in a fixed Mercator plane; d3-zoom for the camera
  ↓
TopoJSON ──────── one file per parent area, fetched when you drill into it
  ↓
Philippine administrative boundaries
```

```text
src/
  features/
    geography/    PSGC types, hierarchy, URL state, search, projection + shape loading
    statistics/   dataset loading, normalisers, data layers, colour scale, rankings + comparison
    baybayin/     transliteration rules and engine
    theme/        palettes and contrast checks
    settings/     persisted preferences (palette, map animation, labels)
    boot/         start-up sequencing
  components/
    map/          PhilippinesMap, MapLayer, graticule, legend, controls, breadcrumbs
    panels/       selected area, ranking, comparison, trend chart, data sources
    ui/           button and select (shadcn/ui style, on Radix)
scripts/
  fetch-sources.mjs   download raw OpenSTAT tables and boundary files into .cache/
  build-data.mjs      normalise them into public/data/
public/data/
  core.json                 hierarchy + statistics down to city/municipality (220 kB)
  bgy/{psgc}.json           barangay statistics for one city/municipality
  geo/{psgc}.json           boundaries of the children of one area
  search-barangays.json     barangay names, fetched when search is first focused
```

A few decisions worth knowing about:

- **One projection, many levels.** Every boundary file is projected once into the same plane. Zooming is then a scale and translate of that plane, so levels line up exactly and the transition between them is a camera move rather than a swap of images.
- **The choropleth rides the deepest loaded level.** When you click a region it stays coloured while the camera is already moving; its provinces fade in over it when their file arrives. Levels above become muted context that you can click to jump sideways.
- **Progressive loading.** The first view needs two data requests: the core dataset and the regions. Barangay boundaries (roughly 12 MB across some 1,650 files) are only ever fetched one city at a time.
- **Adding a data layer** is one entry in `LAYERS` in [`statistics.layers.ts`](src/features/statistics/statistics.layers.ts). The map, legend, ranking and URL pick it up.

### Why the data is bundled

GitHub Pages serves files and nothing else, and OpenSTAT is rate-limited (30 calls per 10 seconds) and occasionally publishes tables with defects. So the tables are fetched once, validated, normalised and committed. At runtime the app never calls OpenSTAT: it loads small static files from its own origin, joins them to map features locally by PSGC, and keeps working whether or not the PSA's servers are up.

To refresh the data after a new PSA release:

```bash
npm run data:fetch   # download sources into .cache/ (git-ignored)
npm run data:build   # regenerate public/data/ and print a validation report
```

## Development

Requires Node 24 or later (`nvm use` picks it up from `.nvmrc`).

```bash
npm install
npm run dev
```

```bash
npm run lint
npm run typecheck
npm run test
```

The tests run the real bundled datasets through the app: drilling from country to barangay, restoring a view from a URL, comparison, and the missing-data and failed-load paths.

## Production

```bash
npm run build     # type-checks, then writes dist/
npm run preview   # serve dist/ locally
```

## Deployment

The build uses a relative base path (`base: './'`) and keeps all state in the query string, so `dist/` works from any sub-path with no server rewrites.

To publish to GitHub Pages:

```bash
npm run deploy
```

This builds, then force-pushes the contents of `dist/` as a single commit to the `gh-pages` branch, which GitHub Pages serves at <https://jersrej.github.io/ph-data-terminal/>. No GitHub Actions workflow and no extra dependency is involved.

## Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `Tab`, then `Enter` | Move through areas on the map or in the ranking, and open one |
| `Esc` | Go up one level (with the map focused) |

Levels with more than 120 areas are reachable from the ranking list rather than by tabbing through the map.

## Licence and attribution

Statistics: Philippine Statistics Authority, via OpenSTAT. Boundary data is MIT-licensed by its authors. Fonts: Archivo, IBM Plex Mono and Noto Sans Tagalog (SIL Open Font License).
