import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { COUNTRY_CODE, KIND_LABEL, type GeoNode, type Psgc } from '@/features/geography/geography.types';
import { barangayParentCode, childrenLabel, resolveSelection, type GeoIndex } from '@/features/geography/geography.hierarchy';
import { toggleCompare, useUrlState } from '@/features/geography/geography.store';
import { barangayQuery, coreQuery } from '@/features/statistics/statistics.api';
import type { CoreDataset } from '@/features/statistics/statistics.normalizers';
import { getLayer, resolveYear } from '@/features/statistics/statistics.layers';
import { rankAreas } from '@/features/statistics/statistics.derive';
import { PhilippinesMap, type MapLevel } from '@/components/map/PhilippinesMap';
import { MapBreadcrumbs } from '@/components/map/MapBreadcrumbs';
import { TopBar } from '@/components/TopBar';
import { SearchBox } from '@/components/SearchBox';
import { SelectedPanel } from '@/components/panels/SelectedPanel';
import { RankingPanel } from '@/components/panels/RankingPanel';
import { ComparePanel } from '@/components/panels/ComparePanel';
import { DataSources } from '@/components/panels/DataSources';
import { Button } from '@/components/ui/button';
import { BootScreen } from '@/components/BootScreen';
import { SettingsMenu } from '@/components/SettingsMenu';
import { shapesQuery } from '@/features/geography/geography.shapes';
import { bootSteps, isBootComplete, useBootPhase, type BootInputs } from '@/features/boot/boot';
import { useSettings } from '@/features/settings/settings.store';
import { getPalette } from '@/features/theme/palettes';
import { inProse } from '@/lib/format';

const EMPTY: Map<Psgc, GeoNode> = new Map();

// Opened on demand; keeps the dialog code out of the first load.
const BaybayinPanel = lazy(() => import('@/components/BaybayinPanel'));

export function App() {
  const core = useQuery(coreQuery);
  // The same query the map uses for its first level, so the boot screen's silhouette
  // is the real geometry and costs no extra request.
  const country = useQuery(shapesQuery(COUNTRY_CODE, false));
  const [mapReady, setMapReady] = useState(false);
  const onMapReady = useCallback(() => setMapReady(true), []);

  const inputs: BootInputs = {
    dataset: core.status,
    indexed: core.data ? core.data.nodes.length : null,
    boundaries: country.status,
    mapReady,
  };
  const { phase, returning } = useBootPhase(isBootComplete(inputs));
  const booting = phase !== 'gone';

  return (
    <>
      {core.data && (
        // Mounted under the boot screen so the map initialises for real; kept out of reach until it lifts.
        <div inert={booting} aria-hidden={booting || undefined}>
          <Terminal dataset={core.data} index={core.data.index} onMapReady={onMapReady} />
        </div>
      )}
      {booting && (
        <BootScreen
          steps={bootSteps(inputs)}
          phase={phase}
          returning={returning}
          outline={country.data}
          error={core.error}
          onRetry={() => core.refetch()}
        />
      )}
    </>
  );
}

/** Resolve any PSGC codes to nodes, loading barangay files for the ones that need it. */
function useResolvedNodes(index: GeoIndex, codes: Psgc[]) {
  const parents = [...new Set(codes.filter((c) => !index.has(c)).map(barangayParentCode))].filter((p) => index.hasBarangayChildren(p));
  const results = useQueries({ queries: parents.map((p) => barangayQuery(p)) });
  return codes.map((code) => ({
    code,
    node: index.get(code) ?? results[parents.indexOf(barangayParentCode(code))]?.data?.get(code),
  }));
}

function Terminal({ dataset, index, onMapReady }: { dataset: CoreDataset; index: GeoIndex; onMapReady: () => void }) {
  const settings = useSettings();
  const palette = getPalette(settings.palette);
  const ramps = useMemo(() => ({ sequential: palette.dataScale, decline: palette.declineScale }), [palette]);
  const [baybayinOpen, setBaybayinOpen] = useState(false);
  const [baybayinText, setBaybayinText] = useState('Mabuhay, Pilipinas!');
  const openBaybayin = useCallback(() => setBaybayinOpen(true), []);
  const [url, navigate] = useUrlState();
  const [compareMode, setCompareMode] = useState(false);
  const [hoveredCode, setHoveredCode] = useState<Psgc | null>(null);

  const layer = getLayer(url.layer);
  const year = resolveYear(layer, url.year);

  // ---- selection -> focus (the area whose children the map shows)
  const resolution = resolveSelection(index, url.geo);
  const focus = resolution.status === 'ok' ? resolution.focus : index.root;
  const lineage = useMemo(() => index.lineage(focus), [index, focus]);
  const focusHasBarangays = index.hasBarangayChildren(focus.code);

  const barangays = useQuery({ ...barangayQuery(focus.code), enabled: focusHasBarangays });
  const focusChildren = useMemo(
    () => (focusHasBarangays ? (barangays.data ?? EMPTY) : new Map(index.children(focus.code).map((n) => [n.code, n]))),
    [index, focus.code, focusHasBarangays, barangays.data],
  );
  const levels = useMemo<MapLevel[]>(
    () =>
      lineage.map((parent, i) => {
        const last = i === lineage.length - 1;
        return {
          parent,
          nodes: last ? focusChildren : new Map(index.children(parent.code).map((n) => [n.code, n])),
          fine: last && focusHasBarangays,
        };
      }),
    [index, lineage, focusChildren, focusHasBarangays],
  );

  const wantsBarangay = resolution.status === 'ok' && resolution.isBarangay;
  const selectedBarangay = wantsBarangay ? barangays.data?.get(url.geo) : undefined;
  const selected = selectedBarangay ?? focus;
  const selectedCode = selectedBarangay ? selectedBarangay.code : focus.code;
  const unknownCode =
    resolution.status === 'unknown' ? resolution.code : wantsBarangay && barangays.isSuccess && !selectedBarangay ? url.geo : null;

  const parent = selected.parent ? index.get(selected.parent) : undefined;
  const trail = selectedBarangay ? [...lineage, selectedBarangay] : lineage;

  // ---- ranking of what is on the map, and the selected area's standing among its siblings
  const ranked = useMemo(() => rankAreas([...focusChildren.values()], layer, year), [focusChildren, layer, year]);
  const standing = useMemo(() => {
    if (!parent) return undefined;
    const siblings = selectedBarangay ? ranked : rankAreas(index.children(parent.code), layer, year);
    const mine = siblings.find((r) => r.node.code === selected.code);
    return mine ? { rank: mine.rank, of: siblings.filter((r) => r.rank !== null).length, among: `in ${inProse(parent.name)}` } : undefined;
  }, [index, parent, selected.code, selectedBarangay, ranked, layer, year]);
  const counts = useMemo(() => (selected.kind === 'barangay' ? {} : index.descendantCounts(selected.code)), [index, selected]);

  const compareAreas = useResolvedNodes(index, url.compare);

  // ---- actions
  const goTo = useCallback((code: Psgc) => navigate({ geo: code }), [navigate]);
  const pick = useCallback(
    (code: Psgc) => {
      if (compareMode) navigate({ compare: toggleCompare(url.compare, code) });
      else navigate({ geo: code });
    },
    [compareMode, navigate, url.compare],
  );
  const goUp = useCallback(() => {
    const up = selectedBarangay ? focus.code : focus.parent;
    if (up) navigate({ geo: up });
  }, [navigate, selectedBarangay, focus]);
  const goHome = useCallback(() => navigate({ geo: COUNTRY_CODE }), [navigate]);

  useEffect(() => {
    document.title = selected.kind === 'country' ? `${layer.label} · PH Data Terminal` : `${selected.name} · ${layer.label} · PH Data Terminal`;
  }, [selected, layer]);

  const kindLabel = childrenLabel(index, focus);
  const showCompare = compareMode || url.compare.length > 0;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <TopBar
        layer={layer}
        year={year}
        compareMode={compareMode}
        search={<SearchBox index={index} onSelect={goTo} />}
        tools={
          <>
            <Button onClick={openBaybayin} className="hidden px-2.5 sm:inline-flex" title="Convert text to Baybayin">
              <span aria-hidden="true" className="baybayin text-[15px] leading-none normal-case">{'\u170A'}</span>
              <span className="max-xl:sr-only">Baybayin</span>
            </Button>
            <SettingsMenu onOpenBaybayin={openBaybayin} />
          </>
        }
        onLayerChange={(id) => navigate({ layer: id, year: null })}
        onYearChange={(y) => navigate({ year: y === layer.years[0] ? null : y })}
        onToggleCompareMode={() => setCompareMode((on) => !on)}
      />

      <p className="sr-only" role="status" aria-live="polite">
        Showing {kindLabel.toLowerCase()} in {inProse(focus.name)}, by {layer.label.toLowerCase()}.
        {selectedBarangay ? ` Selected: ${KIND_LABEL.barangay} ${selectedBarangay.name}.` : ''}
      </p>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section aria-label="Map" className="relative h-[62svh] min-h-[340px] shrink-0 border-b border-ink lg:h-auto lg:min-w-0 lg:flex-1 lg:border-r lg:border-b-0">
          <PhilippinesMap
            levels={levels}
            selectedCode={selectedCode}
            layer={layer}
            year={year}
            compare={url.compare}
            compareMode={compareMode}
            hoveredCode={hoveredCode}
            onHover={setHoveredCode}
            onPick={pick}
            onUp={goUp}
            onHome={goHome}
            ramps={ramps}
            animate={settings.mapAnimation}
            showLabels={settings.mapLabels}
            onReady={onMapReady}
          />
          <div className="pointer-events-none absolute top-5 right-3 left-12 [&>*]:pointer-events-auto">
            <div className="inline-block max-w-full bg-panel/90 px-2 py-1.5">
              <MapBreadcrumbs trail={trail} onNavigate={goTo} />
            </div>
            {unknownCode && (
              <p role="alert" className="mt-2 max-w-sm border border-ink bg-panel px-3 py-2 text-[13px]">
                No area has the PSGC code <span className="font-mono">{unknownCode}</span>. Showing {focus.name} instead.
              </p>
            )}
            {compareMode && (
              <p className="mt-2 inline-block bg-ink px-2 py-1 text-xs text-panel">
                Comparison mode: click areas to add them. <button type="button" className="underline underline-offset-2" onClick={() => setCompareMode(false)}>Done</button>
              </p>
            )}
          </div>
        </section>

        <aside aria-label="Statistics" className="w-full bg-panel lg:w-[380px] lg:shrink-0 lg:overflow-y-auto xl:w-[400px]">
          {showCompare && (
            <ComparePanel
              areas={compareAreas}
              picking={compareMode}
              onRemove={(code) => navigate({ compare: url.compare.filter((c) => c !== code) })}
              onClear={() => { navigate({ compare: [] }); setCompareMode(false); }}
              onOpen={goTo}
            />
          )}
          <SelectedPanel
            key={selected.code}
            node={selected}
            ancestors={index.ancestors(selectedBarangay ? focus : selected).concat(selectedBarangay ? [focus] : []).filter((n) => n.kind !== 'country').reverse()}
            parent={parent}
            layer={layer}
            year={year}
            standing={standing}
            counts={counts}
            inComparison={url.compare.includes(selected.code)}
            onToggleCompare={() => navigate({ compare: toggleCompare(url.compare, selected.code) })}
            onUp={parent ? goUp : undefined}
            showBaybayin={settings.baybayinNames}
          />
          <RankingPanel
            parent={focus}
            kindLabel={kindLabel}
            ranked={ranked}
            status={focusHasBarangays ? (barangays.isError ? 'error' : barangays.isPending ? 'loading' : 'ready') : 'ready'}
            layer={layer}
            year={year}
            selectedCode={selectedCode}
            hoveredCode={hoveredCode}
            compareMode={compareMode}
            onHover={setHoveredCode}
            onPick={pick}
          />
          <DataSources tables={dataset.tables} generated={dataset.generated} />
        </aside>
      </main>

      {baybayinOpen && (
        <Suspense fallback={null}>
          <BaybayinPanel open onOpenChange={setBaybayinOpen} text={baybayinText} onTextChange={setBaybayinText} />
        </Suspense>
      )}
    </div>
  );
}
