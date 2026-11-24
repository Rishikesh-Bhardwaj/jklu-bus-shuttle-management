import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all duration-200 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] focus-ring';

    const variants = {
      primary:
        'bg-primary-600 hover:bg-primary-700 text-white shadow-warm-sm hover:shadow-warm border border-primary-600/20 dark:bg-primary-500 dark:hover:bg-primary-600 dark:text-white dark:border-primary-400/30',
      secondary:
        'bg-white hover:bg-canvas-muted text-neutral-800 border border-line shadow-warm-sm hover:border-line-strong dark:bg-surface-dark dark:hover:bg-surface-dark-muted dark:text-neutral-100 dark:border-line-dark dark:hover:border-line-dark-strong',
      outline:
        'bg-transparent hover:bg-primary-50 text-primary-700 border border-primary-600/30 hover:border-primary-600 dark:text-primary-300 dark:border-primary-500/40 dark:hover:bg-primary-950/40 dark:hover:border-primary-400',
      ghost:
        'bg-transparent hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 border border-transparent dark:text-neutral-300 dark:hover:text-white dark:hover:bg-surface-dark-muted',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white shadow-warm-sm hover:shadow-warm border border-rose-600/20 dark:bg-rose-600 dark:hover:bg-rose-500 dark:text-white dark:border-rose-500/30',
      success:
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-warm-sm hover:shadow-warm border border-emerald-600/20 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white dark:border-emerald-500/30',
    };

    const sizes = {
      sm: 'h-8 px-2.5 text-xs rounded-md gap-1.5',
      md: 'h-9 px-3.5 text-xs sm:text-sm rounded-lg gap-2',
      lg: 'h-11 px-5 text-sm sm:text-base rounded-xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

