import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full border';

  const variants = {
    primary:
      'bg-primary-50 text-primary-800 border-primary-200/80 dark:bg-primary-950/70 dark:text-primary-300 dark:border-primary-800/80',
    success:
      'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80',
    warning:
      'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80',
    danger:
      'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/80',
    neutral:
      'bg-canvas-muted text-neutral-700 border-line dark:bg-surface-dark-muted dark:text-neutral-300 dark:border-line-dark',
    info:
      'bg-sky-50 text-sky-800 border-sky-200/80 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800/80',
  };

  const dotColors = {
    primary: 'bg-primary-600 dark:bg-primary-400',
    success: 'bg-emerald-600 dark:bg-emerald-400',
    warning: 'bg-amber-600 dark:bg-amber-400',
    danger: 'bg-rose-600 dark:bg-rose-400',
    neutral: 'bg-neutral-500 dark:bg-neutral-400',
    info: 'bg-sky-600 dark:bg-sky-400',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      <span>{children}</span>
    </span>
  );
};

