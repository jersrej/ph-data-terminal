import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import BaybayinPanel from './BaybayinPanel';
import { SettingsMenu } from './SettingsMenu';
import { toBaybayin } from '@/features/baybayin/baybayin';
import { getPalette } from '@/features/theme/palettes';
import { PALETTE_KEY, loadSettings } from '@/features/settings/settings.store';
import { INITIALIZED_KEY } from '@/features/boot/boot';

const DATA = path.resolve(import.meta.dirname, '../../public/data');

beforeEach(() => {
  window.localStorage.clear();
  loadSettings();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    try {
      return new Response(await readFile(path.join(DATA, String(input).split('data/')[1]!), 'utf8'));
    } catch {
      return new Response('', { status: 404 });
    }
  });
});

function renderApp(search = '') {
  window.history.replaceState(null, '', `/${search}`);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  );
}

function Converter({ initial = '' }: { initial?: string }) {
  const [text, setText] = useState(initial);
  return <BaybayinPanel open onOpenChange={() => {}} text={text} onTextChange={setText} />;
}
const output = () => screen.getByTestId('baybayin-output');

describe('Baybayin converter', () => {
  it('converts as you type, with no request', async () => {
    render(<Converter />);
    await userEvent.type(screen.getByLabelText('Latin text'), 'Mabuhay, Pilipinas!');
    expect(output()).toHaveTextContent(toBaybayin('Mabuhay, Pilipinas!'));
    expect(output()).toHaveAttribute('lang', 'tl-Tglg');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fills the input from a sample and clears it', async () => {
    render(<Converter />);
    await userEvent.click(screen.getByRole('button', { name: 'Magandang araw' }));
    expect(screen.getByLabelText('Latin text')).toHaveValue('Magandang araw');
    expect(output()).toHaveTextContent(toBaybayin('Magandang araw'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText('Latin text')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });

  it('copies the result', async () => {
    const user = userEvent.setup();
    render(<Converter initial="Salamat" />);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(toBaybayin('Salamat'));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('switches the final-consonant convention', async () => {
    render(<Converter initial="anak" />);
    expect(screen.getByRole('radio', { name: 'Pamudpod' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Krus-kudlit' }));
    expect(output()).toHaveTextContent(toBaybayin('anak', { finalConsonant: 'virama' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Traditional' }));
    expect(output()).toHaveTextContent(toBaybayin('anak', { finalConsonant: 'omit' }));
  });

  it('says it is a transliteration, and flags approximated letters', async () => {
    render(<Converter initial="Mabuhay" />);
    expect(screen.getByText(/Modern phonetic transliteration, not a translation/)).toBeInTheDocument();
    expect(screen.queryByTestId('respelled-note')).toBeNull();
    await userEvent.type(screen.getByLabelText('Latin text'), ' Cavite');
    expect(screen.getByTestId('respelled-note')).toHaveTextContent('“c”, “v”');
  });
});

describe('settings', () => {
  it('switches and remembers the palette', async () => {
    render(<SettingsMenu onOpenBaybayin={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('radio', { name: /Philippine Blue/ })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(5);

    await userEvent.click(screen.getByRole('radio', { name: /Topographic Green/ }));
    expect(screen.getByRole('radio', { name: /Topographic Green/ })).toBeChecked();
    expect(document.documentElement.dataset.palette).toBe('topographic-green');
    expect(window.localStorage.getItem(PALETTE_KEY)).toBe('topographic-green');
  });

  it('opens the Baybayin converter from the menu', async () => {
    const onOpen = vi.fn();
    render(<SettingsMenu onOpenBaybayin={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: /Baybayin converter/ }));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('in the app', () => {
  const region = (name: string) => screen.findByRole('button', { name: new RegExp(`^Explore ${name}\\.`) });

  it('boots behind a start-up screen, then hands over to the map and remembers the visit', async () => {
    renderApp();
    expect(screen.getByTestId('boot-screen')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull(); // nothing reachable underneath yet
    await region('CALABARZON');
    await waitFor(() => expect(screen.queryByTestId('boot-screen')).toBeNull());
    expect(window.localStorage.getItem(INITIALIZED_KEY)).toBe('1');
  });

  it('recolours the choropleth from the selected palette', async () => {
    renderApp();
    const calabarzon = await region('CALABARZON'); // the most populous region: darkest class
    expect(calabarzon).toHaveStyle({ fill: getPalette('philippine-blue').dataScale[5] });

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('radio', { name: /Sunset/ }));
    expect(await region('CALABARZON')).toHaveStyle({ fill: getPalette('sunset').dataScale[5] });
  });

  it('restores a saved palette on load', async () => {
    window.localStorage.setItem(PALETTE_KEY, 'monochrome');
    loadSettings();
    renderApp();
    expect(await region('CALABARZON')).toHaveStyle({ fill: getPalette('monochrome').dataScale[5] });
  });

  it('shows a Baybayin name only where one can be derived, and lets it be turned off', async () => {
    renderApp('?geo=0403400000');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Laguna'));
    expect(screen.getByTestId('baybayin-name')).toHaveTextContent(toBaybayin('Laguna'));
    expect(screen.getByTestId('baybayin-name')).toHaveTextContent(/approximate/i);

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Baybayin place names' }));
    expect(screen.queryByTestId('baybayin-name')).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Baybayin place names' }));
    await userEvent.keyboard('{Escape}');

    // Cavite needs "c" and "v", so no Baybayin form is offered.
    fireEvent.click(screen.getByRole('button', { name: 'CALABARZON' }));
    fireEvent.click(await region('Cavite'));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cavite'));
    expect(screen.queryByTestId('baybayin-name')).toBeNull();
  });

  it('opens the converter over the map without changing the current place', async () => {
    renderApp('?geo=0403400000');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Laguna'));
    await userEvent.click(screen.getByRole('button', { name: 'Baybayin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Baybayin' });
    expect(within(dialog).getByLabelText('Latin text')).toHaveValue('Mabuhay, Pilipinas!');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close Baybayin converter' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.search).toBe('?geo=0403400000');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Laguna');
  });

  it('hides map labels when asked', async () => {
    renderApp();
    await region('CALABARZON');
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const labels = screen.getByRole('switch', { name: 'Labels' });
    expect(labels).toBeChecked();
    await userEvent.click(labels);
    expect(labels).not.toBeChecked();
    expect(JSON.parse(window.localStorage.getItem('ph-data-terminal-settings')!)).toMatchObject({ mapLabels: false });
  });
});
