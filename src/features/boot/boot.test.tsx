import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FADE_MS, FIRST_VISIT_MIN_MS, INITIALIZED_KEY, bootSteps, isBootComplete, remainingPresence, useBootPhase, type BootInputs } from './boot';
import { BootScreen } from '@/components/BootScreen';

const loading: BootInputs = { dataset: 'pending', indexed: null, boundaries: 'pending', mapReady: false };
const ready: BootInputs = { dataset: 'success', indexed: 1758, boundaries: 'success', mapReady: true };
const statuses = (inputs: BootInputs) => Object.fromEntries(bootSteps(inputs).map((s) => [s.id, s.status]));

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
  setReducedMotion(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('initialization state', () => {
  it('starts with every step pending', () => {
    expect(statuses(loading)).toEqual({ statistics: 'pending', index: 'pending', boundaries: 'pending', map: 'pending' });
    expect(isBootComplete(loading)).toBe(false);
  });

  it('reports each step as the real work behind it finishes', () => {
    expect(statuses({ ...loading, dataset: 'success', indexed: 1758 })).toMatchObject({ statistics: 'done', index: 'done', boundaries: 'pending', map: 'pending' });
    expect(statuses({ ...loading, boundaries: 'success' })).toMatchObject({ statistics: 'pending', boundaries: 'done' });
    expect(statuses(ready)).toEqual({ statistics: 'done', index: 'done', boundaries: 'done', map: 'done' });
    expect(isBootComplete(ready)).toBe(true);
  });

  it('marks a failed dataset and never completes', () => {
    const failed: BootInputs = { ...loading, dataset: 'error' };
    expect(statuses(failed)).toMatchObject({ statistics: 'failed', index: 'failed' });
    expect(isBootComplete({ ...failed, mapReady: true })).toBe(false);
  });

  it('still completes when only the boundaries failed: the app can show statistics', () => {
    const inputs: BootInputs = { ...ready, boundaries: 'error' };
    expect(statuses(inputs).boundaries).toBe('failed');
    expect(isBootComplete(inputs)).toBe(true);
  });
});

describe('presence', () => {
  it('holds a first visit only up to the minimum, counting time already spent loading', () => {
    expect(remainingPresence(0, false, false)).toBe(FIRST_VISIT_MIN_MS);
    expect(remainingPresence(300, false, false)).toBe(FIRST_VISIT_MIN_MS - 300);
    expect(remainingPresence(2000, false, false)).toBe(0); // a slow load adds nothing
    expect(FIRST_VISIT_MIN_MS).toBeLessThanOrEqual(1200);
  });

  it('adds no wait for returning visitors or reduced motion', () => {
    expect(remainingPresence(0, true, false)).toBe(0);
    expect(remainingPresence(0, false, true)).toBe(0);
  });
});

describe('useBootPhase', () => {
  it('stays up for as long as initialization takes, however long that is', () => {
    const { result } = renderHook(({ complete }) => useBootPhase(complete), { initialProps: { complete: false } });
    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current.phase).toBe('visible');
  });

  it('first visit: leaves after the minimum presence, then fades out and remembers the visit', () => {
    const { result, rerender } = renderHook(({ complete }) => useBootPhase(complete), { initialProps: { complete: false } });
    expect(result.current.returning).toBe(false);
    rerender({ complete: true });
    act(() => void vi.advanceTimersByTime(FIRST_VISIT_MIN_MS - 1));
    expect(result.current.phase).toBe('visible');
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.phase).toBe('leaving');
    act(() => void vi.advanceTimersByTime(FADE_MS));
    expect(result.current.phase).toBe('gone');
    expect(window.localStorage.getItem(INITIALIZED_KEY)).toBe('1');
  });

  it('first visit, slow load: no delay is added once ready', () => {
    const { result, rerender } = renderHook(({ complete }) => useBootPhase(complete), { initialProps: { complete: false } });
    act(() => void vi.advanceTimersByTime(1500));
    rerender({ complete: true });
    act(() => void vi.advanceTimersByTime(0));
    expect(result.current.phase).toBe('leaving');
  });

  it('returning visitor: leaves the moment the app is ready', () => {
    window.localStorage.setItem(INITIALIZED_KEY, '1');
    const { result } = renderHook(() => useBootPhase(true));
    expect(result.current.returning).toBe(true);
    act(() => void vi.advanceTimersByTime(0));
    expect(result.current.phase).toBe('leaving');
  });

  it('reduced motion: no hold and no fade', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useBootPhase(true));
    act(() => void vi.advanceTimersByTime(0));
    expect(result.current.phase).toBe('gone');
  });
});

describe('BootScreen', () => {
  it('lists real progress and the dataset on a first visit', () => {
    render(<BootScreen steps={bootSteps({ ...loading, dataset: 'success', indexed: 1758 })} phase="visible" returning={false} onRetry={() => {}} />);
    expect(screen.getByRole('status', { name: 'Initializing system' })).toBeInTheDocument();
    expect(screen.getByText(/Statistical data/)).toHaveAttribute('data-status', 'done');
    expect(screen.getByText(/Map data/)).toHaveAttribute('data-status', 'pending');
    expect(screen.getByText('2024 Census of Population')).toBeInTheDocument();
    expect(screen.getByText('Philippine Statistics Authority')).toBeInTheDocument();
  });

  it('announces the system online when everything has settled', () => {
    render(<BootScreen steps={bootSteps(ready)} phase="visible" returning={false} onRetry={() => {}} />);
    expect(screen.getByRole('status', { name: 'System online' })).toBeInTheDocument();
  });

  it('is shorter for a returning visitor', () => {
    render(<BootScreen steps={bootSteps(loading)} phase="visible" returning onRetry={() => {}} />);
    expect(screen.getByText('PH Data Terminal')).toBeInTheDocument();
    expect(screen.queryByText(/Statistical data/)).toBeNull();
  });

  it('shows a real error with a retry when initialization fails', async () => {
    vi.useRealTimers();
    const onRetry = vi.fn();
    render(<BootScreen steps={bootSteps({ ...loading, dataset: 'error' })} phase="visible" returning={false} error={new Error('Could not load core.json (503)')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Data unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load core.json (503)');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
