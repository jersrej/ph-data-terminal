import { Maximize, Minus, Plus } from 'lucide-react';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onHome: () => void;
  atHome: boolean;
}

export function MapControls({ onZoomIn, onZoomOut, onFit, onHome, atHome }: MapControlsProps) {
  return (
    <div className="map-controls" role="group" aria-label="Map controls">
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in"><Plus aria-hidden size={16} /></button>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out"><Minus aria-hidden size={16} /></button>
      <button type="button" onClick={onFit} aria-label="Fit selected area to view" title="Fit to view"><Maximize aria-hidden size={14} /></button>
      <button type="button" onClick={onHome} disabled={atHome} className="map-controls-text" title="Back to the whole country">
        Reset
      </button>
    </div>
  );
}
