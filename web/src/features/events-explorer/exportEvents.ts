/*
 * Descarga del set de resultados actual para exportar CSV.
 * La API limita page_size a 100 (schemas/events.py le=100), así que se
 * itera por páginas hasta total o hasta el tope EXPORT_MAX_ROWS.
 */

import { apiGet, type EventFilters, type EventItem, type EventPage } from '../../lib/api';

const API_PAGE_SIZE_CAP = 100;

export const EXPORT_PAGE_SIZE = API_PAGE_SIZE_CAP;
export const EXPORT_MAX_ROWS = 1000;

/** Trae hasta EXPORT_MAX_ROWS filas con los mismos filtros de la tabla. */
export async function fetchEventsForExport(
  filters: EventFilters,
): Promise<EventItem[]> {
  const base: EventFilters = { ...filters, page_size: EXPORT_PAGE_SIZE };
  delete base.page;
  const collected: EventItem[] = [];
  let total = Number.POSITIVE_INFINITY;
  let page = 1;
  while (
    collected.length < Math.min(total, EXPORT_MAX_ROWS) &&
    collected.length < EXPORT_MAX_ROWS
  ) {
    const response = await apiGet<EventPage>('/events', {
      ...base,
      page,
    });
    collected.push(...response.items);
    total = response.total;
    if (response.items.length < EXPORT_PAGE_SIZE) break;
    page += 1;
  }
  return collected.slice(0, EXPORT_MAX_ROWS);
}
