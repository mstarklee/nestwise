import type { ComponentProps, LabelHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from './cn';

const field = 'min-h-[52px] w-full rounded-chip bg-mist px-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-peacock';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1 block text-[13.5px] font-semibold text-muted', className)} {...props} />;
}
