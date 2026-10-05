import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MapBreadcrumbs } from './map/MapBreadcrumbs';
import { MapLegend } from './map/MapLegend';
import { ComparePanel } from './panels/ComparePanel';
import { RankingPanel } from './panels/RankingPanel';
import { SearchBox } from './SearchBox';
import { getLayer } from '@/features/statistics/statistics.layers';
import { rankAreas } from '@/features/statistics/statistics.derive';
import { buildScale } from '@/features/statistics/statistics.scale';
import { CALABARZON, CAVITE, LAGUNA, LUCENA, fixtureIndex } from '@/test/fixtures';

const index = fixtureIndex();
const population = getLayer('population');

describe('MapBreadcrumbs', () => {
  it('makes every ancestor a button and marks the current area', async () => {
    const onNavigate = vi.fn();
    render(<MapBreadcrumbs trail={index.lineage(index.get(LAGUNA)!)} onNavigate={onNavigate} />);
    expect(screen.getByText('Laguna')).toHaveAttribute('aria-current', 'location');
    expect(screen.queryByRole('button', { name: 'Laguna' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'CALABARZON' }));
    expect(onNavigate).toHaveBeenCalledWith(CALABARZON);
  });
});

describe('MapLegend', () => {
  it('follows the active layer and admits when there is nothing to show', () => {
    const scale = buildScale([1_000_000, 4_000_000, 17_000_000], 'sequential');
    const { rerender } = render(<MapLegend layer={population} year={2024} scale={scale} hasMissing levelName="Philippines" />);
    expect(screen.getByRole('heading', { name: 'Population' })).toBeInTheDocument();
    expect(screen.getByText('1M to 17M')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();

    rerender(<MapLegend layer={getLayer('growth')} year={2024} scale={null} hasMissing />);
    expect(screen.getByRole('heading', { name: 'Population growth' })).toBeInTheDocument();
    expect(screen.getByText('Data unavailable for this geographic level.')).toBeInTheDocument();
  });
});

describe('RankingPanel', () => {
  const setup = (year = 2024) => {
    const onPick = vi.fn();
    render(
      <RankingPanel
        parent={index.get(CALABARZON)!}
        kindLabel="Provinces"
        ranked={rankAreas(index.children(CALABARZON), population, year)}
        status="ready"
        layer={population}
        year={year}
        selectedCode={CALABARZON}
        hoveredCode={null}
        compareMode={false}
        onHover={() => {}}
        onPick={onPick}
      />,
    );
    return onPick;
  };

  it('lists the loaded areas in rank order and drills on click', async () => {
    const onPick = setup();
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['01Cavite4.57M', '02Laguna3.69M', '03City of Lucena280K']);
    await userEvent.click(within(rows[1]!).getByRole('button'));
    expect(onPick).toHaveBeenCalledWith(LAGUNA);
  });

  it('says "No data" instead of showing a zero', () => {
    setup(2020);
    expect(screen.getAllByRole('listitem').at(-1)).toHaveTextContent('City of LucenaNo data');
  });
});

describe('ComparePanel', () => {
  const areas = [LAGUNA, CAVITE].map((code) => ({ code, node: index.get(code) }));

  it('prompts for a second area until two are chosen', () => {
    render(<ComparePanel areas={areas.slice(0, 1)} picking onRemove={() => {}} onClear={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Pick one more area');
    expect(screen.queryByRole('row', { name: /Population/ })).toBeNull();
  });

  it('tabulates both areas and labels missing figures', () => {
    render(<ComparePanel areas={areas} picking={false} onRemove={() => {}} onClear={() => {}} onOpen={() => {}} />);
    const population = screen.getByRole('row', { name: /^Population/ });
    expect(within(population).getByText('3,687,345')).toBeInTheDocument();
    expect(within(population).getByText('4,573,884')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /^Barangays/ })).getByText('803')).toBeInTheDocument();
    // Cavite has no urban figure in the fixture.
    expect(within(screen.getByRole('row', { name: /^Urban/ })).getByText('Data unavailable')).toBeInTheDocument();
  });

  it('removes one area or clears the comparison', async () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    render(<ComparePanel areas={areas} picking={false} onRemove={onRemove} onClear={onClear} onOpen={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Cavite from comparison' }));
    expect(onRemove).toHaveBeenCalledWith(CAVITE);
    await userEvent.click(screen.getByRole('button', { name: 'Clear comparison' }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('SearchBox', () => {
  const setup = () => {
    const onSelect = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ '0403405': ['011Canlubang'] })));
    render(
      <QueryClientProvider client={client}>
        <SearchBox index={index} onSelect={onSelect} />
      </QueryClientProvider>,
    );
    return { onSelect, input: screen.getByRole('combobox') };
  };

  it('navigates to the highlighted result with the keyboard', async () => {
    const { onSelect, input } = setup();
    await userEvent.type(input, 'luc');
    const option = await screen.findByRole('option', { name: /City of Lucena/ });
    expect(option).toHaveTextContent('CALABARZON');
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(LUCENA);
    expect(input).toHaveValue('');
  });

  it('finds barangays once their names have loaded', async () => {
    const { onSelect, input } = setup();
    await userEvent.type(input, 'canlu');
    await userEvent.click(await screen.findByRole('option', { name: /Canlubang/ }));
    expect(onSelect).toHaveBeenCalledWith('0403405011');
  });

  it('explains when nothing matches', async () => {
    const { input } = setup();
    await userEvent.type(input, 'atlantis');
    expect(await screen.findByText(/No place matches/)).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });
});
