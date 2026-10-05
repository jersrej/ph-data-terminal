import { useId, useMemo, useState } from 'react';
import { Dialog } from 'radix-ui';
import { ArrowDown, Check, Copy, X } from 'lucide-react';
import { transliterate } from '@/features/baybayin/baybayin';
import type { FinalConsonantStyle } from '@/features/baybayin/baybayin.types';
import { Button } from '@/components/ui/button';

const SAMPLES = ['Mabuhay', 'Pilipinas', 'Magandang araw', 'Kumusta ka?', 'Mahal ko ang Pilipinas'];

const STYLES: { id: FinalConsonantStyle; label: string; hint: string }[] = [
  { id: 'pamudpod', label: 'Pamudpod', hint: 'Modern mark for a consonant with no vowel' },
  { id: 'virama', label: 'Krus-kudlit', hint: 'The cross mark; the most widely supported in other fonts' },
  { id: 'omit', label: 'Traditional', hint: 'Final consonants are left unwritten' },
];

interface BaybayinPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onTextChange: (text: string) => void;
}

/** A local Latin-to-Baybayin converter. It opens over the map and leaves the current view untouched. */
export default function BaybayinPanel({ open, onOpenChange, text, onTextChange }: BaybayinPanelProps) {
  const inputId = useId();
  const [finalConsonant, setFinalConsonant] = useState<FinalConsonantStyle>('pamudpod');
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => transliterate(text, { finalConsonant }), [text, finalConsonant]);
  const hasOutput = result.text.trim().length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the output stays selectable.
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="sheet" aria-describedby={`${inputId}-about`}>
          <header className="flex items-start justify-between gap-4 border-b border-ink px-4 py-3 sm:px-5">
            <div>
              <Dialog.Title className="display text-xl">Baybayin</Dialog.Title>
              <p className="eyebrow mt-1 text-ink-2">Philippine script converter</p>
            </div>
            <Dialog.Close aria-label="Close Baybayin converter" className="grid size-8 place-items-center border border-ink hover:bg-ink hover:text-panel">
              <X aria-hidden size={15} />
            </Dialog.Close>
          </header>

          <div className="px-4 py-4 sm:px-5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={inputId} className="eyebrow text-ink-2">Latin text</label>
              <button type="button" className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink disabled:opacity-40" disabled={!text} onClick={() => onTextChange('')}>
                Clear
              </button>
            </div>
            <textarea
              id={inputId}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              rows={3}
              spellCheck={false}
              autoCapitalize="off"
              placeholder="Type Filipino or Tagalog text"
              className="mt-1.5 block w-full resize-y border border-ink bg-panel px-3 py-2 text-[15px] leading-snug placeholder:text-ink-3"
            />

            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Sample text">
              {SAMPLES.map((sample) => (
                <button key={sample} type="button" className="border border-rule px-2 py-1 text-xs hover:border-ink" onClick={() => onTextChange(sample)}>
                  {sample}
                </button>
              ))}
            </div>

            <p className="eyebrow mt-4 flex items-center gap-1.5 text-ink-2" id={`${inputId}-out`}>
              <ArrowDown aria-hidden size={12} /> Baybayin
            </p>
            <output
              htmlFor={inputId}
              aria-labelledby={`${inputId}-out`}
              aria-live="polite"
              lang="tl-Tglg"
              data-testid="baybayin-output"
              className="baybayin mt-1.5 block min-h-[5.5rem] border border-rule bg-sea px-3 py-3 text-[1.75rem] leading-[1.7] break-words whitespace-pre-wrap select-all"
            >
              {hasOutput ? result.text : <span className="font-sans text-sm tracking-normal text-ink-3">The Baybayin appears here as you type.</span>}
            </output>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Button onClick={copy} disabled={!hasOutput}>
                {copied ? <Check aria-hidden size={13} /> : <Copy aria-hidden size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <div role="radiogroup" aria-label="Final consonants" className="flex border border-ink">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    role="radio"
                    aria-checked={finalConsonant === style.id}
                    title={style.hint}
                    className="border-l border-ink px-2 py-1.5 text-[11px] font-semibold tracking-wide uppercase first:border-l-0 aria-checked:bg-ink aria-checked:text-panel"
                    onClick={() => setFinalConsonant(style.id)}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <div id={`${inputId}-about`} className="mt-4 space-y-1.5 border-t border-rule pt-3 text-xs leading-relaxed text-ink-2">
              <p>
                <strong className="font-semibold text-ink">Modern phonetic transliteration, not a translation.</strong> Baybayin (also
                called Alibata) writes syllables, so the result follows the sounds of your spelling and may vary with pronunciation. It
                is not a historical or authoritative spelling.
              </p>
              {result.respelled.length > 0 ? (
                <p role="note" data-testid="respelled-note">
                  This text uses {result.respelled.map((l) => `“${l}”`).join(', ')}, which Baybayin has no letter for; those
                  sounds were approximated. Baybayin is traditionally suited to Philippine languages, and borrowed words can have several
                  valid representations.
                </p>
              ) : (
                <p>Baybayin is traditionally suited to Philippine languages. Other Latin words are transliterated by sound and may have several valid representations.</p>
              )}
              <p className="text-ink-3">Converted in your browser. If copied text shows empty boxes elsewhere, that device&rsquo;s font lacks the newer pamudpod mark; try Krus-kudlit.</p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
