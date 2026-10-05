import type { ReactNode } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { LAYERS, type DataLayer } from '@/features/statistics/statistics.layers';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TopBarProps {
  layer: DataLayer;
  year: number;
  compareMode: boolean;
  search: ReactNode;
  /** Secondary tools: Baybayin and settings. */
  tools: ReactNode;
  onLayerChange: (id: string) => void;
  onYearChange: (year: number) => void;
  onToggleCompareMode: () => void;
}

export function TopBar({ layer, year, compareMode, search, tools, onLayerChange, onYearChange, onToggleCompareMode }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink bg-panel px-3 py-2 sm:px-4">
      <div className="mr-auto flex items-baseline gap-3 lg:mr-0">
        <p className="display text-[1.3rem] tracking-wide whitespace-nowrap">PH Data Terminal</p>
        <p className="hidden font-mono text-[10px] tracking-wider whitespace-nowrap text-ink-3 uppercase xl:block">
          <span className="mr-1 inline-block size-1.5 translate-y-[-1px] bg-sun" aria-hidden="true" />
          Dataset: 2024 POPCEN · Source: PSA
        </p>
      </div>

      <div className="order-last flex w-full min-w-0 lg:order-none lg:w-auto lg:max-w-md lg:flex-1">{search}</div>

      <div className="order-last flex w-full min-w-0 items-center gap-2 lg:order-none lg:ml-auto lg:w-auto">
        <Select value={layer.id} onValueChange={onLayerChange}>
          <SelectTrigger aria-label="Data layer" className="min-w-0 flex-1 lg:w-44 lg:flex-none xl:w-52">
            <span className="eyebrow mr-1.5 text-ink-3">Layer</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAYERS.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))} disabled={layer.years.length < 2}>
          <SelectTrigger aria-label={layer.id === 'growth' ? 'Period' : 'Census year'} className="w-40 shrink-0 disabled:opacity-60">
            <span className="eyebrow mr-1.5 text-ink-3">{layer.id === 'growth' ? 'Period' : 'Year'}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {layer.years.map((y) => (
              <SelectItem key={y} value={String(y)}>{layer.yearLabel(y)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">{tools}</div>

      <Button aria-pressed={compareMode} onClick={onToggleCompareMode} title="Pick two areas to compare">
        <GitCompareArrows aria-hidden size={14} />
        <span className="max-[359px]:sr-only">Compare</span>
      </Button>
    </header>
  );
}
