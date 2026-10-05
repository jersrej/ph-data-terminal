import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

// The app runs against the real bundled datasets, served from disk instead of HTTP.
const DATA = path.resolve(import.meta.dirname, '../public/data');

function serveData(overrides: Record<string, () => Response> = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const file = String(input).split('data/')[1]!;
    if (overrides[file]) return overrides[file]();
    try {
      return new Response(await readFile(path.join(DATA, file), 'utf8'));
    } catch {
      return new Response('', { status: 404 });
    }
  });
}

function renderApp(search = '') {
  window.history.replaceState(null, '', `/${search}`);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

const area = (name: string) => screen.findByRole('button', { name: new RegExp(`^Explore ${name}\\.`) });
// Map areas get a bare click: jsdom cannot run the pan gesture that a full pointer sequence starts.
const clickArea = (el: HTMLElement) => fireEvent.click(el);
const heading = () => screen.getByRole('heading', { level: 1 });
const crumbs = () => within(screen.getByRole('navigation', { name: 'Geographic hierarchy' })).getAllByRole('listitem').map((li) => li.textContent?.replace('/', ''));

beforeEach(() => serveData());

describe('drill-down', () => {
  it('opens on the Philippines with its 18 regions on the map', async () => {
    renderApp();
    await area('CALABARZON');
    expect(heading()).toHaveTextContent('Philippines');
    expect(screen.getByTestId('headline-value')).toHaveTextContent('112,729,484');
    expect(screen.getAllByRole('button', { name: /^Explore / })).toHaveLength(18);
  });

  it('drills region, province, city, barangay, updating panel, breadcrumbs, ranking and URL', async () => {
    renderApp();
    clickArea(await area('CALABARZON'));
    expect(heading()).toHaveTextContent('CALABARZON');
    expect(window.location.search).toBe('?geo=0400000000');
    expect(screen.getByRole('heading', { name: /Provinces & highly urbanized cities in CALABARZON/ })).toBeInTheDocument();

    clickArea(await area('Laguna'));
    expect(screen.getByTestId('headline-value')).toHaveTextContent('3,687,345');
    expect(crumbs()).toEqual(['Philippines', 'CALABARZON', 'Laguna']);

    clickArea(await area('City of Calamba'));
    clickArea(await area('Canlubang'));
    expect(heading()).toHaveTextContent('Canlubang');
    expect(window.location.search).toBe('?geo=0403405011');
    expect(crumbs()).toEqual(['Philippines', 'CALABARZON', 'Laguna', 'City of Calamba', 'Canlubang']);
    // Barangays stay on the map and in the ranking; the selected one is marked.
    expect(screen.getByRole('heading', { name: 'Barangays in City of Calamba' })).toBeInTheDocument();
    expect(within(screen.getByRole('complementary')).getByRole('button', { current: true })).toHaveTextContent('Canlubang');
  });

  it('goes back up through breadcrumbs and the browser Back button', async () => {
    renderApp('?geo=0403400000');
    await area('City of Calamba');
    await userEvent.click(screen.getByRole('button', { name: 'CALABARZON' }));
    expect(heading()).toHaveTextContent('CALABARZON');

    act(() => {
      window.history.replaceState(null, '', '/?geo=0403400000');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(heading()).toHaveTextContent('Laguna');
  });
});

describe('shared links', () => {
  it('reconstructs a barangay view, its ancestors and its layer from the URL alone', async () => {
    renderApp('?geo=0403405011&layer=density');
    await waitFor(() => expect(heading()).toHaveTextContent('Canlubang'));
    expect(crumbs()).toEqual(['Philippines', 'CALABARZON', 'Laguna', 'City of Calamba', 'Canlubang']);
    expect(screen.getByRole('region', { name: 'Legend: Population density' })).toBeInTheDocument();
    expect(screen.getByTestId('headline-value')).toHaveTextContent('/ km²');
  });

  it('reports an unknown PSGC code and falls back to the country', async () => {
    renderApp('?geo=9999999999');
    expect(await screen.findByRole('alert')).toHaveTextContent('No area has the PSGC code 9999999999');
    expect(heading()).toHaveTextContent('Philippines');
  });
});

describe('missing data', () => {
  it('says growth is unavailable for barangays rather than showing zero', async () => {
    renderApp('?geo=0403405011&layer=growth');
    await waitFor(() => expect(heading()).toHaveTextContent('Canlubang'));
    expect(screen.getByTestId('headline-value')).toHaveTextContent('Data unavailable for this geographic level.');
    expect(within(screen.getByRole('region', { name: /Legend/ })).getByText('Data unavailable for this geographic level.')).toBeInTheDocument();
  });

  it('keeps statistics usable when a boundary file is missing', async () => {
    serveData({ 'geo/0403400000.json': () => new Response('', { status: 404 }) });
    renderApp('?geo=0403400000');
    expect(await screen.findByText(/Boundaries unavailable/)).toBeInTheDocument();
    // The app sits behind the boot screen until the map has settled, boundaries or not.
    expect(await screen.findByRole('heading', { name: /Cities & municipalities in Laguna/ })).toBeInTheDocument();
    expect(screen.getByTestId('headline-value')).toHaveTextContent('3,687,345');
  });

  it('shows an error with a retry when the census dataset is malformed', async () => {
    serveData({ 'core.json': () => new Response(JSON.stringify({ nodes: 'oops' })) });
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent('Data unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('comparison', () => {
  it('collects two areas in comparison mode without leaving the current view, then clears', async () => {
    renderApp('?geo=0400000000');
    await area('Laguna');
    await userEvent.click(screen.getByRole('button', { name: 'Compare', pressed: false, description: 'Pick two areas to compare' }));
    clickArea(await screen.findByRole('button', { name: /^Compare Laguna\./ }));
    clickArea(screen.getByRole('button', { name: /^Compare Cavite\./ }));

    expect(heading()).toHaveTextContent('CALABARZON');
    expect(window.location.search).toBe('?geo=0400000000&cmp=0403400000,0402100000');
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /^Population/ })).toHaveTextContent('3,687,345');
    expect(within(table).getByRole('row', { name: /^Population/ })).toHaveTextContent('4,573,884');

    await userEvent.click(screen.getByRole('button', { name: 'Clear comparison' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(window.location.search).toBe('?geo=0400000000');
  });
});

describe('bundled data', () => {
  it('matches PSA totals and joins every regional boundary to a census row by PSGC', async () => {
    const core = JSON.parse(await readFile(path.join(DATA, 'core.json'), 'utf8')) as { nodes: [string, string, string, string | null, ...unknown[]][] };
    const byCode = new Map(core.nodes.map((n) => [n[0], n]));
    const count = (kind: string) => core.nodes.filter((n) => n[2] === kind).length;
    expect([count('region'), count('province'), count('city'), count('municipality')]).toEqual([18, 82, 149, 1493]);
    expect(byCode.get('0000000000')!.at(-1)).toBe(42011);

    for (const [code, , kind] of core.nodes) {
      if (kind !== 'region') continue;
      const topo = JSON.parse(await readFile(path.join(DATA, 'geo', `${code}.json`), 'utf8')) as { objects: { f: { geometries: { id: string }[] } } };
      const ids = topo.objects.f.geometries.map((g) => g.id).sort();
      const children = core.nodes.filter((n) => n[3] === code).map((n) => n[0]).sort();
      expect(ids, `region ${code}`).toEqual(children);
    }
  });
});
