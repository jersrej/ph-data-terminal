import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap border font-sans text-xs font-semibold tracking-wider uppercase [font-stretch:80%] transition-colors disabled:opacity-45',
  {
    variants: {
      variant: {
        solid: 'border-ink bg-ink text-panel hover:bg-ink/85',
        outline: 'border-ink bg-transparent text-ink hover:bg-ink hover:text-panel aria-pressed:bg-ink aria-pressed:text-panel',
        quiet: 'border-transparent text-ink-2 underline decoration-ink-3 underline-offset-4 hover:text-ink',
      },
      size: { md: 'h-9 px-3', sm: 'h-7 px-2' },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export function Button({ className, variant, size, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
