import { useEffect, useState } from 'react';
import { readStored, writeStored } from '@/lib/storage';

/**
 * Start-up sequencing. The boot screen reports real work (dataset fetched and
 * indexed, boundaries fetched, map placed) and leaves as soon as that work is
 * done. The only time it adds is a short minimum presence on a first visit so
 * the screen does not flash by unread; returning visitors get none.
 */
export const INITIALIZED_KEY = 'ph-data-terminal-initialized';
export const FIRST_VISIT_MIN_MS = 500;
export const FADE_MS = 280;

export type StepStatus = 'pending' | 'done' | 'failed';

export interface BootStep {
  id: 'statistics' | 'index' | 'boundaries' | 'map';
  label: string;
  status: StepStatus;
}

export interface BootInputs {
  /** The census dataset request. */
  dataset: 'pending' | 'success' | 'error';
  /** Number of areas indexed by PSGC once the dataset is parsed. */
  indexed: number | null;
  /** The regional boundaries request. */
  boundaries: 'pending' | 'success' | 'error';
  /** The map has placed its first view. */
  mapReady: boolean;
}

const settled = (status: 'pending' | 'success' | 'error'): StepStatus => (status === 'success' ? 'done' : status === 'error' ? 'failed' : 'pending');

export function bootSteps({ dataset, indexed, boundaries, mapReady }: BootInputs): BootStep[] {
  return [
    { id: 'statistics', label: 'Statistical data', status: settled(dataset) },
    { id: 'index', label: 'PSGC index', status: dataset === 'error' ? 'failed' : indexed !== null ? 'done' : 'pending' },
    { id: 'boundaries', label: 'Map data', status: settled(boundaries) },
    { id: 'map', label: 'Geographic engine', status: mapReady && dataset === 'success' ? 'done' : 'pending' },
  ];
}

/** The app can be shown once the dataset is in and the map has drawn or given up on its boundaries. */
export function isBootComplete({ dataset, mapReady }: BootInputs): boolean {
  return dataset === 'success' && mapReady;
}

/** How much longer the boot screen should stay once everything is ready. Never more than the first-visit minimum. */
export function remainingPresence(elapsedMs: number, returning: boolean, reducedMotion: boolean): number {
  if (returning || reducedMotion) return 0;
  return Math.max(0, FIRST_VISIT_MIN_MS - elapsedMs);
}

export const isReturningVisitor = () => readStored(INITIALIZED_KEY) !== null;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type BootPhase = 'visible' | 'leaving' | 'gone';

/**
 * Drives the boot screen from readiness. Timers are used only for the minimum
 * presence and the fade; nothing hides the screen on a fixed schedule.
 */
export function useBootPhase(complete: boolean): { phase: BootPhase; returning: boolean; reducedMotion: boolean } {
  const [returning] = useState(isReturningVisitor);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<BootPhase>('visible');
  const [shownAt] = useState(() => performance.now());

  useEffect(() => {
    if (!complete || phase !== 'visible') return;
    const wait = remainingPresence(performance.now() - shownAt, returning, reducedMotion);
    const timer = window.setTimeout(() => {
      writeStored(INITIALIZED_KEY, '1');
      setPhase(reducedMotion ? 'gone' : 'leaving');
    }, wait);
    return () => window.clearTimeout(timer);
  }, [complete, phase, returning, reducedMotion, shownAt]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(() => setPhase('gone'), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return { phase, returning, reducedMotion };
}
