import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-action font-semibold transition-transform active:scale-[.97] motion-reduce:transform-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-peacock text-white hover:bg-peacock-deep',
        outline: 'bg-white text-peacock ring-1 ring-line hover:bg-mist',
        ghost: 'text-peacock hover:bg-mist',
        destructive: 'bg-rani text-white hover:opacity-90',
      },
      size: { default: 'min-h-11 px-4', sm: 'min-h-11 px-3 text-[13.5px]', lg: 'min-h-[52px] px-6 text-base' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
