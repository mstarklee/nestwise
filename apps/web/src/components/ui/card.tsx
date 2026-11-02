import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('mb-2 text-base font-semibold', className)} {...props} />;
}
