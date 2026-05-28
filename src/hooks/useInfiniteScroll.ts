import { useState, useCallback, useRef, useMemo } from 'react';

export function useInfiniteScroll<T>(items: T[], itemsPerPage: number = 20) {
  const [displayCount, setDisplayCount] = useState(itemsPerPage);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();

    if (node) {
      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          setDisplayCount(prev => prev + itemsPerPage);
        }
      }, {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      });
      observerRef.current.observe(node);
    }
  }, [itemsPerPage]);

  const displayedItems = useMemo(() => {
    return items.slice(0, displayCount);
  }, [items, displayCount]);

  const hasMore = displayCount < items.length;

  return { displayedItems, loadMoreRef, hasMore };
}
