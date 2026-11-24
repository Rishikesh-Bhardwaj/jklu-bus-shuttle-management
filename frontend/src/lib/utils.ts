import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard utility to conditionally merge Tailwind CSS classes
 * without style conflicts, following baseline-ui design practices.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

