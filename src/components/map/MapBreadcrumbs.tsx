import type { GeoNode, Psgc } from '@/features/geography/geography.types';

interface MapBreadcrumbsProps {
  /** Root-first, ending with the selected area. */
  trail: GeoNode[];
  onNavigate: (code: Psgc) => void;
}

export function MapBreadcrumbs({ trail, onNavigate }: MapBreadcrumbsProps) {
  return (
    <nav aria-label="Geographic hierarchy" className="breadcrumbs">
      <ol className="flex flex-wrap items-center gap-y-1">
        {trail.map((node, i) => {
          const current = i === trail.length - 1;
          return (
            <li key={node.code} className="flex items-center">
              {i > 0 && <span aria-hidden="true" className="mx-1.5 text-ink-3">/</span>}
              {current ? (
                <span aria-current="location" className="breadcrumb-current">{node.name}</span>
              ) : (
                <button type="button" className="breadcrumb-link" onClick={() => onNavigate(node.code)}>
                  {node.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
