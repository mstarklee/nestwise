import type { ComponentProps, LabelHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from './cn';

const field = 'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-green-800';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1 block text-sm font-medium text-zinc-700', className)} {...props} />;
}
