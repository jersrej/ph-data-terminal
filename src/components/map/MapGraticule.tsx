import { project, unproject } from '@/features/geography/geography.shapes';
import { useView, type ViewStore } from './view-store';

// Candidate spacings in degrees, from 5 degrees down to 15 arc-seconds.
const STEPS = [5, 2, 1, 0.5, 0.25, 1 / 6, 1 / 12, 1 / 30, 1 / 60, 1 / 120, 1 / 240];

function formatAngle(value: number, positive: string, negative: string, step: number): string {
  const hemisphere = value >= 0 ? positive : negative;
  const totalSeconds = Math.round(Math.abs(value) * 3600);
  const degrees = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (step >= 1) return `${degrees}°${hemisphere}`;
  const dm = `${degrees}°${String(minutes).padStart(2, '0')}′`;
  return step >= 1 / 60 ? `${dm}${hemisphere}` : `${dm}${String(seconds).padStart(2, '0')}″${hemisphere}`;
}

/**
 * The map sheet's graticule: lines of latitude and longitude with coordinate
 * labels along the top and left edges. It re-divides as the view zooms, so the
 * margin always reads as real coordinates for what is on screen.
 */
export function MapGraticule({ store, width, height }: { store: ViewStore; width: number; height: number }) {
  const view = useView(store);
  if (width < 1 || height < 1) return null;

  const [west, north] = unproject(-view.x / view.k, -view.y / view.k);
  const [east, south] = unproject((width - view.x) / view.k, (height - view.y) / view.k);
  const target = (east - west) / Math.max(3, Math.round(width / 170));
  const step = STEPS.find((s) => s <= target) ?? STEPS.at(-1)!;

  const meridians: { x: number; label: string }[] = [];
  for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
    meridians.push({ x: project(lon, 0)[0] * view.k + view.x, label: formatAngle(lon, 'E', 'W', step) });
  }
  const parallels: { y: number; label: string }[] = [];
  for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
    parallels.push({ y: project(0, lat)[1] * view.k + view.y, label: formatAngle(lat, 'N', 'S', step) });
  }

  return (
    <g aria-hidden="true" className="pointer-events-none">
      {meridians.map((m) => (
        <line key={`m${m.label}`} x1={m.x} x2={m.x} y1={0} y2={height} className="graticule-line" />
      ))}
      {parallels.map((p) => (
        <line key={`p${p.label}`} x1={0} x2={width} y1={p.y} y2={p.y} className="graticule-line" />
      ))}
      {meridians.map((m) => (
        <text key={`ml${m.label}`} x={m.x + 4} y={12} className="graticule-label">{m.label}</text>
      ))}
      {parallels.map((p) => (
        <text key={`pl${p.label}`} x={4} y={p.y - 4} className="graticule-label">{p.label}</text>
      ))}
    </g>
  );
}
