/*
 * Estado de filtros del Explorador de Eventos y su serialización:
 *  - EventFilterState -> query params de GET /api/v1/events (los vacíos
 *    se omiten; fechas datetime-local se normalizan a ISO UTC).
 *  - URL search params -> estado inicial (deep-linking /eventos?technique=…).
 * La página se resetea a 1 al cambiar filtros y se conserva al paginar;
 * esa política vive en useEventFilters, la serialización solo la porta.
 */

import type { EventFilters, Severity } from '../../lib/api';

export const SEVERITIES: readonly Severity[] = [
  'low',
  'medium',
  'high',
  'critical',
];

export const PAGE_SIZES: readonly number[] = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

export interface EventFilterState {
  from: string;
  to: string;
  severity: Severity | '';
  source_honeypot: string;
  protocol: string;
  src_ip: string;
  technique: string;
  search: string;
}

export const EMPTY_FILTER_STATE: EventFilterState = {
  from: '',
  to: '',
  severity: '',
  source_honeypot: '',
  protocol: '',
  src_ip: '',
  technique: '',
  search: '',
};

const DATE_LOCAL_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?Z?$/;

/**
 * "2026-03-05T14:00" (datetime-local) -> "2026-03-05T14:00:00Z".
 * Conversión por string puro: determinista en tests y coherente con el
 * resto de la UI, que muestra timestamps en UTC.
 */
export function normalizeDateTimeLocal(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = DATE_LOCAL_RE.exec(trimmed);
  if (!match) return undefined;
  const [, date, hhmm, seconds] = match;
  if (Number(hhmm.slice(0, 2)) > 23 || Number(hhmm.slice(3)) > 59) {
    return undefined;
  }
  if (seconds !== undefined && Number(seconds) > 59) return undefined;
  return `${date}T${hhmm}:${seconds ?? '00'}Z`;
}

/** ISO/local -> valor válido para <input type="datetime-local">. */
export function toDateTimeInputValue(value: string): string {
  return value ? value.slice(0, 16) : '';
}

function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Estado + paginación -> params de GET /events. Los vacíos se omiten. */
export function filtersToParams(
  state: EventFilterState,
  page: number,
  pageSize: number,
): EventFilters {
  const params: EventFilters = { page, page_size: pageSize };
  const from = normalizeDateTimeLocal(state.from);
  if (from) params.from = from;
  const to = normalizeDateTimeLocal(state.to);
  if (to) params.to = to;
  if (state.severity) params.severity = state.severity;
  const honeypot = trimmedOrUndefined(state.source_honeypot);
  if (honeypot) params.source_honeypot = honeypot;
  const protocol = trimmedOrUndefined(state.protocol);
  if (protocol) params.protocol = protocol;
  const srcIp = trimmedOrUndefined(state.src_ip);
  if (srcIp) params.src_ip = srcIp;
  const technique = trimmedOrUndefined(state.technique);
  if (technique) params.technique = technique;
  const search = trimmedOrUndefined(state.search);
  if (search) params.search = search;
  return params;
}

/** Serializa el estado a URLSearchParams para deep-linking/refresh. */
export function stateToSearchParams(
  state: EventFilterState,
  page: number,
  pageSize: number,
): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(
    filtersToParams(state, page, pageSize),
  )) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search;
}

function readString(search: URLSearchParams, key: string): string {
  return search.get(key)?.trim() ?? '';
}

function parsePage(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function parsePageSize(raw: string | null): number {
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

/** Lee los search params y devuelve estado inicial seguro + paginación. */
export function paramsToFilters(search: URLSearchParams): {
  state: EventFilterState;
  page: number;
  pageSize: number;
} {
  const severityRaw = readString(search, 'severity');
  return {
    state: {
      from: readString(search, 'from'),
      to: readString(search, 'to'),
      severity: (SEVERITIES as readonly string[]).includes(severityRaw)
        ? (severityRaw as Severity)
        : '',
      source_honeypot: readString(search, 'source_honeypot'),
      protocol: readString(search, 'protocol'),
      src_ip: readString(search, 'src_ip'),
      technique: readString(search, 'technique'),
      search: readString(search, 'search'),
    },
    page: parsePage(search.get('page')),
    pageSize: parsePageSize(search.get('page_size')),
  };
}
