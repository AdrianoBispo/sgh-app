import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils/cn', () => {
  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'bg-red-500')).toBe('px-2 py-1 bg-red-500');
  });

  it('handles conditional classes', () => {
    expect(cn('px-2', true && 'py-1', false && 'bg-red-500')).toBe('px-2 py-1');
  });

  it('merges conflicting tailwind classes using tailwind-merge', () => {
    // bg-blue-500 should be overwritten by bg-red-500
    expect(cn('bg-blue-500', 'bg-red-500')).toBe('bg-red-500');
    // px-2 should be overwritten by p-4
    expect(cn('px-2', 'p-4')).toBe('p-4');
  });
});
