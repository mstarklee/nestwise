import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

// shadcn/ui-style button (copied in by hand; plain screens until the visual design is done).
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-green-900 text-white hover:bg-green-800',
        outline: 'border border-zinc-300 bg-white hover:bg-zinc-100',
        ghost: 'hover:bg-zinc-100',
        destructive: 'bg-red-700 text-white hover:bg-red-600',
      },
      size: { default: 'h-10 px-4', sm: 'h-8 px-3', lg: 'h-12 px-6 text-base' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
