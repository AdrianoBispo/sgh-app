import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Renderização incremental de listas longas.
 *
 * `resetKey` deve conter os filtros da tela: sem ele, quem rolasse até o item
 * 200 e trocasse o filtro continuaria renderizando 200 linhas do novo
 * resultado. O observer também passa a ser desconectado ao desmontar.
 */
export function useInfiniteScroll<T>(items: T[], itemsPerPage: number = 20, resetKey: string = '') {
  const [displayCount, setDisplayCount] = useState(itemsPerPage);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setDisplayCount(itemsPerPage);
  }, [resetKey, itemsPerPage]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) setDisplayCount((current) => current + itemsPerPage);
        },
        { root: null, rootMargin: '100px', threshold: 0.1 },
      );
      observerRef.current.observe(node);
    },
    [itemsPerPage],
  );

  const displayedItems = useMemo(() => items.slice(0, displayCount), [items, displayCount]);

  return { displayedItems, loadMoreRef, hasMore: displayCount < items.length };
}
