import { X } from 'lucide-react';
import { KIND_LABEL, type GeoNode, type Psgc } from '@/features/geography/geography.types';
import { compareAreas } from '@/features/statistics/statistics.derive';
import { UNAVAILABLE } from '@/lib/format';
import { Button } from '@/components/ui/button';

interface ComparePanelProps {
  /** Resolved areas, in pick order; undefined while a barangay's data loads. */
  areas: { code: Psgc; node: GeoNode | undefined }[];
  picking: boolean;
  onRemove: (code: Psgc) => void;
  onClear: () => void;
  onOpen: (code: Psgc) => void;
}

const SLOT = ['A', 'B'] as const;

/** Two areas side by side. Bars are scaled per row, each to the larger of the pair. */
export function ComparePanel({ areas, picking, onRemove, onClear, onOpen }: ComparePanelProps) {
  const [a, b] = areas;
  const rows = a?.node && b?.node ? compareAreas(a.node, b.node) : null;

  return (
    <section aria-labelledby="compare-heading" className="panel-section bg-sea">
      <div className="flex items-center justify-between gap-3">
        <h2 id="compare-heading" className="eyebrow text-ink">Comparison</h2>
        {areas.length > 0 && <Button variant="quiet" size="sm" className="px-0 normal-case" onClick={onClear}>Clear comparison</Button>}
      </div>

      {areas.length < 2 && (
        <p className="mt-1.5 text-[13px] text-ink-2" role="status">
          {picking
            ? areas.length === 0 ? 'Pick two areas on the map or in the ranking.' : 'Pick one more area on the map or in the ranking.'
            : 'Add one more area with its Compare button.'}
        </p>
      )}

      {areas.length > 0 && (
        <table className="mt-3 w-full table-fixed border-collapse text-[13px]">
          <caption className="sr-only">Statistics for the compared areas, 2024</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[30%]"><span className="sr-only">Statistic</span></th>
              {SLOT.map((slot, i) => {
                const area = areas[i];
                return (
                  <th key={slot} scope="col" className="pb-2 pl-2 text-left align-top font-normal">
                    {area ? (
                      <>
                        <span className="flex items-start justify-between gap-1">
                          <button type="button" className="min-w-0 text-left font-semibold break-words underline decoration-ink-3 underline-offset-2 hover:decoration-ink" onClick={() => onOpen(area.code)}>
                            <span className="figure mr-1.5 inline-grid size-4 place-items-center bg-ink text-[10px] text-panel no-underline">{slot}</span>
                            {area.node?.name ?? 'Loading…'}
                          </button>
                          <button type="button" aria-label={`Remove ${area.node?.name ?? 'area'} from comparison`} className="shrink-0 p-0.5 text-ink-2 hover:text-ink" onClick={() => onRemove(area.code)}>
                            <X aria-hidden size={13} />
                          </button>
                        </span>
                        {area.node && <span className="eyebrow block text-ink-3">{KIND_LABEL[area.node.kind]}</span>}
                      </>
                    ) : (
                      <span className="text-ink-3">Not chosen</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          {rows && (
            <tbody>
              {rows.map(({ metric, a: va, b: vb, bars }) => (
                <tr key={metric.id} className="border-t border-rule align-top">
                  <th scope="row" className="py-1.5 pr-1 text-left font-normal text-ink-2">{metric.label}</th>
                  {[va, vb].map((v, i) => (
                    <td key={i} className="py-1.5 pl-2">
                      {v === null ? (
                        <span className="unavailable">{UNAVAILABLE}</span>
                      ) : (
                        <span className="figure text-xs">{metric.format(v)}</span>
                      )}
                      {bars && (
                        <span className="mt-1 block h-[3px] bg-rule-soft" aria-hidden="true">
                          <span className="block h-full bg-data" style={{ width: `${Math.max(bars[i]! * 100, 1)}%` }} />
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      )}
    </section>
  );
}
