import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  EMPTY_FILTER_STATE,
  filtersToParams,
  paramsToFilters,
  stateToSearchParams,
  type EventFilterState,
} from './filters';

/**
 * Fuente de verdad de filtros + paginación del explorador.
 * - Lee los search params al montar (deep-linking: /eventos?technique=T1110).
 * - Sincroniza estado -> URL con replace para que el refresh lo conserve.
 * - Resetea la página a 1 al aplicar/resetear filtros o cambiar page_size;
 *   se conserva al navegar entre páginas.
 */
export function useEventFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initial] = useState(() => paramsToFilters(searchParams));
  const [state, setState] = useState<EventFilterState>(initial.state);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);

  useEffect(() => {
    setSearchParams(stateToSearchParams(state, page, pageSize), {
      replace: true,
    });
    // setSearchParams es estable en react-router v7; no entra en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, page, pageSize]);

  const applyFilters = useCallback((draft: EventFilterState) => {
    setState(draft);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setState(EMPTY_FILTER_STATE);
    setPage(1);
  }, []);

  const goToPage = useCallback((next: number) => {
    setPage(next < 1 ? 1 : next);
  }, []);

  const changePageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const query = useMemo(
    () => filtersToParams(state, page, pageSize),
    [state, page, pageSize],
  );

  return {
    state,
    page,
    pageSize,
    query,
    applyFilters,
    resetFilters,
    goToPage,
    changePageSize,
  };
}
