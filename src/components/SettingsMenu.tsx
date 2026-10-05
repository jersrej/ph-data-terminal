import { useState } from 'react';
import { Popover } from 'radix-ui';
import { SlidersHorizontal } from 'lucide-react';
import { PALETTES } from '@/features/theme/palettes';
import { updateSettings, useSettings, type Settings } from '@/features/settings/settings.store';

type Toggle = { key: keyof Omit<Settings, 'palette'>; label: string; hint: string };

const MAP_TOGGLES: Toggle[] = [
  { key: 'mapAnimation', label: 'Zoom animation', hint: 'Fly between places' },
  { key: 'mapLabels', label: 'Labels', hint: 'Names and values on the map' },
];
const NAME_TOGGLES: Toggle[] = [{ key: 'baybayinNames', label: 'Baybayin place names', hint: 'In the selected-area panel, where one can be derived' }];

function SwitchRow({ toggle, settings }: { toggle: Toggle; settings: Settings }) {
  const on = settings[toggle.key];
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{toggle.label}</span>
        <span className="block text-[11px] text-ink-3">{toggle.hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={toggle.label} className="switch" onClick={() => updateSettings({ [toggle.key]: !on })} />
    </label>
  );
}

/** Appearance and map preferences, plus the way into tools on narrow screens. */
export function SettingsMenu({ onOpenBaybayin }: { onOpenBaybayin: () => void }) {
  const settings = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Settings"
        title="Settings"
        className="grid size-9 shrink-0 place-items-center border border-ink text-ink hover:bg-ink hover:text-panel data-[state=open]:bg-ink data-[state=open]:text-panel"
      >
        <SlidersHorizontal aria-hidden size={15} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="popover">
          <section className="px-3.5 pt-3 pb-2.5">
            <h2 className="eyebrow text-ink-2" id="theme-heading">Theme</h2>
            <div role="radiogroup" aria-labelledby="theme-heading" className="mt-1.5">
              {PALETTES.map((palette) => {
                const checked = settings.palette === palette.id;
                return (
                  <button
                    key={palette.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className="flex w-full items-center gap-2.5 py-1.5 text-left"
                    onClick={() => updateSettings({ palette: palette.id })}
                  >
                    <span aria-hidden="true" className="grid size-3.5 shrink-0 place-items-center rounded-full border border-ink">
                      {checked && <span className="size-2 rounded-full bg-ink" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{palette.label}</span>
                      <span className="block truncate text-[11px] text-ink-3">{palette.description}</span>
                    </span>
                    {/* Preview drawn from the palette itself, not the active theme. */}
                    <span aria-hidden="true" className="flex h-4 w-[84px] shrink-0 border" style={{ borderColor: palette.ui.ink }}>
                      {palette.dataScale.map((color) => (
                        <span key={color} className="flex-1" style={{ background: color }} />
                      ))}
                      <span className="w-1.5" style={{ background: palette.ui.selection }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-t border-rule px-3.5 py-2.5">
            <h2 className="eyebrow text-ink-2">Map</h2>
            {MAP_TOGGLES.map((t) => <SwitchRow key={t.key} toggle={t} settings={settings} />)}
          </section>

          <section className="border-t border-rule px-3.5 py-2.5">
            <h2 className="eyebrow text-ink-2">Tools</h2>
            {NAME_TOGGLES.map((t) => <SwitchRow key={t.key} toggle={t} settings={settings} />)}
            <button
              type="button"
              className="mt-1.5 flex w-full items-center justify-between border border-ink px-2.5 py-2 text-left text-[13px] font-medium hover:bg-ink hover:text-panel"
              onClick={() => { setOpen(false); onOpenBaybayin(); }}
            >
              Baybayin converter
              <span aria-hidden="true" className="baybayin text-base leading-none">{'ᜊᜌ᜕ᜊᜌᜒᜈ᜕'}</span>
            </button>
          </section>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
