import type { ShapeLayer } from '@/features/geography/geography.shapes';
import type { BootPhase, BootStep } from '@/features/boot/boot';
import { Button } from '@/components/ui/button';

interface BootScreenProps {
  steps: BootStep[];
  phase: BootPhase;
  /** A shorter screen for people who have seen the full one before. */
  returning: boolean;
  /** The country's real region boundaries, once loaded; drawn as the silhouette. */
  outline?: ShapeLayer;
  error?: Error | null;
  onRetry: () => void;
}

const MARK: Record<BootStep['status'], string> = { done: '✓', pending: '·', failed: '!' };

export function BootScreen({ steps, phase, returning, outline, error, onRetry }: BootScreenProps) {
  const failed = !!error;
  const online = !failed && steps.every((s) => s.status !== 'pending');
  const [[x0, y0], [x1, y1]] = outline?.bounds ?? [[0, 0], [1, 1]];

  return (
    <div className="boot" data-phase={phase} data-testid="boot-screen">
      <div className="boot-inner">
        <div className="boot-map" aria-hidden="true">
          {outline && (
            <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} preserveAspectRatio="xMidYMid meet" className="size-full overflow-visible">
              {outline.shapes.map((shape) => (
                <path key={shape.code} d={shape.d} pathLength={1} className="boot-outline" />
              ))}
            </svg>
          )}
        </div>

        <div className="min-w-0">
          <p className="display text-[1.75rem] sm:text-[2.25rem]">PH Data Terminal</p>

          {failed ? (
            <div role="alert" className="mt-4 max-w-sm">
              <p className="eyebrow text-ink">Data unavailable</p>
              <p className="mt-1.5 text-sm text-ink-2">
                The census dataset could not be loaded, so there is nothing to map yet. Check your connection and try again.
              </p>
              <p className="mt-2 font-mono text-[11px] break-words text-ink-3">{error.message}</p>
              <Button className="mt-4" variant="solid" onClick={onRetry}>Try again</Button>
            </div>
          ) : (
            <div role="status" aria-label={online ? 'System online' : 'Initializing system'}>
              <p className="mt-3 font-mono text-[11px] tracking-widest text-ink-2 uppercase">
                {online ? 'System online' : 'Initializing system…'}
              </p>
              {!returning && (
                <>
                  <ul className="mt-3 space-y-1 font-mono text-[11px] tracking-wider uppercase">
                    {steps.map((step) => (
                      <li key={step.id} data-status={step.status} className="boot-step">
                        <span aria-hidden="true">[{MARK[step.status]}]</span> {step.label}
                        <span className="sr-only">: {step.status === 'done' ? 'ready' : step.status === 'failed' ? 'unavailable' : 'loading'}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-rule pt-3 font-mono text-[10px] tracking-wider uppercase">
                    <dt className="text-ink-3">Dataset</dt>
                    <dd>2024 Census of Population</dd>
                    <dt className="text-ink-3">Source</dt>
                    <dd>Philippine Statistics Authority</dd>
                  </dl>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
