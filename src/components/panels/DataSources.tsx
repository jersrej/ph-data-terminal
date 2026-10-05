import type { SourceTable } from '@/features/statistics/statistics.types';

const OPENSTAT = 'https://openstat.psa.gov.ph/';

export function DataSources({ tables, generated }: { tables: SourceTable[]; generated: string }) {
  return (
    <footer className="panel-section border-b-0 text-xs leading-relaxed text-ink-2">
      <h2 className="eyebrow text-ink">Data sources</h2>
      <ul className="mt-2 space-y-2">
        <li>
          <strong className="font-semibold text-ink">Statistics.</strong> Philippine Statistics Authority (PSA), 2024 Census of
          Population, retrieved from <a className="underline underline-offset-2" href={OPENSTAT} target="_blank" rel="noreferrer">PSA OpenSTAT</a> and
          bundled as static files on {generated}. Land area is the figure PSA publishes alongside its population density table.
        </li>
        <li>
          <strong className="font-semibold text-ink">Geographic codes.</strong> Philippine Standard Geographic Code (PSGC), as used in
          the 2024 census tables. Every area is identified and joined by its 10-digit PSGC.
        </li>
        <li>
          <strong className="font-semibold text-ink">Boundaries.</strong>{' '}
          <a className="underline underline-offset-2" href="https://github.com/faeldon/philippines-json-maps" target="_blank" rel="noreferrer">faeldon/philippines-json-maps</a>{' '}
          (MIT), built from <a className="underline underline-offset-2" href="https://github.com/altcoder/philippines-psgc-shapefiles" target="_blank" rel="noreferrer">altcoder/philippines-psgc-shapefiles</a>,
          a public compilation aligned to the PSGC of 31 December 2023 and re-coded here to the 2024 PSGC. Official boundary mapping in the
          Philippines is the mandate of NAMRIA; these outlines are simplified for the web and are not authoritative. Barangay land areas and
          densities are measured from them and are approximate.
        </li>
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-ink underline underline-offset-2">OpenSTAT tables used</summary>
        <ul className="mt-2 space-y-1.5">
          {tables.map((t) => (
            <li key={t.id}>
              <span className="font-mono text-[10px] text-ink-3">{t.id}</span> {t.title}
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-3 border-t border-rule pt-3">
        An independent portfolio project. Not an official website of the PSA or any Philippine government agency.
      </p>
    </footer>
  );
}
