import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { GeoIndex } from '@/features/geography/geography.hierarchy';
import { KIND_LABEL, type Psgc } from '@/features/geography/geography.types';
import { buildBarangayEntries, buildCoreEntries, search } from '@/features/geography/geography.search';
import { barangaySearchQuery } from '@/features/statistics/statistics.api';

interface SearchBoxProps {
  index: GeoIndex;
  onSelect: (code: Psgc) => void;
}

/** Global place search. Picking a result navigates the map there; it never just lists. */
export function SearchBox({ index, onSelect }: SearchBoxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [wanted, setWanted] = useState(false);
  const deferredQuery = useDeferredValue(query);

  // 42,000 barangay names are only fetched once someone actually reaches for search.
  const barangays = useQuery({ ...barangaySearchQuery, enabled: wanted });
  const coreEntries = useMemo(() => buildCoreEntries(index), [index]);
  const entries = useMemo(
    () => (barangays.data ? [...coreEntries, ...buildBarangayEntries(barangays.data)] : coreEntries),
    [coreEntries, barangays.data],
  );
  const results = useMemo(() => search(entries, index, deferredQuery), [entries, index, deferredQuery]);
  const showList = open && deferredQuery.trim().length >= 2;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (code: Psgc) => {
    onSelect(code);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (!showList || !results.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    else if (event.key === 'Enter') { event.preventDefault(); const hit = results[Math.min(active, results.length - 1)]; if (hit) choose(hit.code); }
  };

  return (
    <div className="relative min-w-0 flex-1" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <label className="flex h-9 items-center gap-2 border border-ink bg-panel px-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
        <Search aria-hidden size={14} className="shrink-0 text-ink-2" />
        <span className="sr-only">Search places in the Philippines</span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results.length ? `${listId}-${Math.min(active, results.length - 1)}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search a region, province, city or barangay"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => { setWanted(true); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        <kbd aria-hidden className="hidden border border-rule px-1 font-mono text-[10px] text-ink-3 sm:block">/</kbd>
      </label>

      {showList && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 border border-ink bg-panel shadow-[4px_4px_0_rgb(12_30_51/0.12)]">
          <ul id={listId} role="listbox" aria-label="Matching places" className="max-h-[60vh] overflow-y-auto">
            {results.map((result, i) => (
              <li
                key={result.code}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="cursor-pointer border-b border-rule-soft px-3 py-2 last:border-b-0 aria-selected:bg-ink aria-selected:text-panel"
                onPointerMove={() => setActive(i)}
                // Keep focus in the input so the list does not close before the click lands.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(result.code)}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-semibold">{result.name}</span>
                  <span className="eyebrow shrink-0 opacity-70">{KIND_LABEL[result.kind]}</span>
                </div>
                {result.trail.length > 0 && <div className="truncate text-xs opacity-70">{result.trail.join(' · ')}</div>}
              </li>
            ))}
          </ul>
          {results.length === 0 && (
            <p role="status" className="px-3 py-3 text-[13px] text-ink-2">
              No place matches &ldquo;{deferredQuery.trim()}&rdquo;. Try a city, province or barangay name.
            </p>
          )}
          {barangays.isPending && wanted && <p className="border-t border-rule-soft px-3 py-1.5 text-[11px] text-ink-3">Loading barangay names…</p>}
          {barangays.isError && <p className="border-t border-rule-soft px-3 py-1.5 text-[11px] text-ink-3">Barangay names could not be loaded; showing cities and above.</p>}
        </div>
      )}
    </div>
  );
}
