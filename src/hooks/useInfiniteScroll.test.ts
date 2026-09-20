import { describe, it, expect, beforeAll, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInfiniteScroll } from './useInfiniteScroll';

const observers: { callback: IntersectionObserverCallback; disconnect: () => void }[] = [];

beforeAll(() => {
  // jsdom não implementa IntersectionObserver.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds = [];

      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
    },
  );
});

const items = Array.from({ length: 50 }, (_, index) => index);

describe('useInfiniteScroll', () => {
  it('mostra apenas a primeira página e sinaliza que há mais', () => {
    const { result } = renderHook(() => useInfiniteScroll(items, 15));
    expect(result.current.displayedItems).toHaveLength(15);
    expect(result.current.hasMore).toBe(true);
  });

  it('volta à primeira página quando o filtro muda', () => {
    // Regressão: sem `resetKey`, trocar o filtro mantinha a contagem antiga e
    // a nova lista já abria com dezenas de linhas renderizadas.
    const { result, rerender } = renderHook(({ key }) => useInfiniteScroll(items, 15, key), {
      initialProps: { key: 'a' },
    });

    act(() => {
      observers.at(-1)?.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    const { result: scrolled } = renderHook(() => useInfiniteScroll(items, 15, 'a'));
    expect(scrolled.current.displayedItems).toHaveLength(15);

    rerender({ key: 'b' });
    expect(result.current.displayedItems).toHaveLength(15);
  });

  it('indica o fim da lista quando tudo já foi exibido', () => {
    const { result } = renderHook(() => useInfiniteScroll(items.slice(0, 10), 15));
    expect(result.current.displayedItems).toHaveLength(10);
    expect(result.current.hasMore).toBe(false);
  });
});
