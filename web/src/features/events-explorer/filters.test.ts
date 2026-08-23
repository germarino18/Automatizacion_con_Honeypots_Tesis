import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTER_STATE,
  PAGE_SIZES,
  filtersToParams,
  normalizeDateTimeLocal,
  paramsToFilters,
  stateToSearchParams,
  toDateTimeInputValue,
} from './filters';

function buildState(
  overrides: Partial<typeof EMPTY_FILTER_STATE> = {},
): typeof EMPTY_FILTER_STATE {
  return { ...EMPTY_FILTER_STATE, ...overrides };
}

describe('normalizeDateTimeLocal', () => {
  it('normaliza "YYYY-MM-DDTHH:mm" a ISO UTC con segundos y Z', () => {
    expect(normalizeDateTimeLocal('2026-03-05T14:00')).toBe(
      '2026-03-05T14:00:00Z',
    );
  });

  it('conserva los segundos cuando el input los incluye y acepta espacio', () => {
    expect(normalizeDateTimeLocal('2026-03-05T14:30:45')).toBe(
      '2026-03-05T14:30:45Z',
    );
    expect(normalizeDateTimeLocal('2026-03-05 09:05')).toBe(
      '2026-03-05T09:05:00Z',
    );
  });

  it('es idempotente sobre valores ya normalizados con Z', () => {
    expect(normalizeDateTimeLocal('2026-03-01T08:00:00Z')).toBe(
      '2026-03-01T08:00:00Z',
    );
  });

  it('devuelve undefined para vacio o formatos invalidos', () => {
    expect(normalizeDateTimeLocal('')).toBeUndefined();
    expect(normalizeDateTimeLocal('ayer')).toBeUndefined();
    expect(normalizeDateTimeLocal('2026-13-99T99:99')).toBeUndefined();
  });
});

describe('toDateTimeInputValue', () => {
  it('recorta ISO UTC al formato datetime-local "YYYY-MM-DDTHH:mm"', () => {
    expect(toDateTimeInputValue('2026-03-05T14:00:00Z')).toBe(
      '2026-03-05T14:00',
    );
  });

  it('deja intactos valores ya en formato de input y vacios a ""', () => {
    expect(toDateTimeInputValue('2026-03-05T14:00')).toBe('2026-03-05T14:00');
    expect(toDateTimeInputValue('')).toBe('');
  });
});

describe('filtersToParams', () => {
  it('con estado lleno serializa todos los filtros y fechas normalizadas', () => {
    const params = filtersToParams(
      buildState({
        from: '2026-03-01T08:00',
        to: '2026-03-31T23:59',
        severity: 'high',
        source_honeypot: 'cowrie',
        protocol: 'ssh',
        src_ip: '203.0.113.7',
        technique: 'T1110',
        search: 'root',
      }),
      3,
      50,
    );
    expect(params).toEqual({
      from: '2026-03-01T08:00:00Z',
      to: '2026-03-31T23:59:00Z',
      severity: 'high',
      source_honeypot: 'cowrie',
      protocol: 'ssh',
      src_ip: '203.0.113.7',
      technique: 'T1110',
      search: 'root',
      page: 3,
      page_size: 50,
    });
  });

  it('con estado vacio solo envia paginacion (filtros vacios omitidos)', () => {
    const params = filtersToParams(EMPTY_FILTER_STATE, 1, DEFAULT_PAGE_SIZE);
    expect(params).toEqual({ page: 1, page_size: DEFAULT_PAGE_SIZE });
    expect(Object.keys(params)).not.toContain('from');
    expect(Object.keys(params)).not.toContain('severity');
  });

  it('omite filtros con string vacio/espacios y conserva pagina dada', () => {
    const params = filtersToParams(
      buildState({ severity: '', source_honeypot: '  ', technique: 'T1059' }),
      2,
      25,
    );
    expect(params.source_honeypot).toBeUndefined();
    expect(params.severity).toBeUndefined();
    expect(params.technique).toBe('T1059');
    expect(params.page).toBe(2);
  });

  it('preserva page_size valido para exportacion/paginacion', () => {
    const params = filtersToParams(EMPTY_FILTER_STATE, 5, 100);
    expect(params.page_size).toBe(100);
    expect(PAGE_SIZES).toEqual([25, 50, 100]);
  });
});

describe('stateToSearchParams + paramsToFilters', () => {
  it('ida y vuelta: la URL reconstruye el estado y re-serializa igual', () => {
    const state = buildState({
      from: '2026-03-01T08:00',
      severity: 'critical',
      source_honeypot: 'dionaea',
      src_ip: '198.51.100.9',
      technique: 'T1110',
    });
    const search = stateToSearchParams(state, 4, 50);
    const parsed = paramsToFilters(search);
    // El from queda normalizado a ISO UTC tras la primera pasada...
    expect(parsed.state).toEqual({ ...state, from: '2026-03-01T08:00:00Z' });
    expect(parsed.page).toBe(4);
    expect(parsed.pageSize).toBe(50);
    // ...y una segunda serialización es idéntica (idempotente).
    expect(
      stateToSearchParams(parsed.state, parsed.page, parsed.pageSize),
    ).toEqual(search);
  });

  it('solo escribe claves no vacias en la URL (sin page defaults raros)', () => {
    const search = stateToSearchParams(EMPTY_FILTER_STATE, 1, 25);
    expect([...search.keys()].sort()).toEqual(['page', 'page_size']);
  });

  it('descarta severidad desconocida al leer la URL', () => {
    const parsed = paramsToFilters(
      new URLSearchParams('severity=catastrofica&technique=T1110'),
    );
    expect(parsed.state.severity).toBe('');
    expect(parsed.state.technique).toBe('T1110');
  });

  it('coacciona page/page_size invalidos a los defaults seguros', () => {
    const parsed = paramsToFilters(
      new URLSearchParams('page=0&page_size=9999'),
    );
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(DEFAULT_PAGE_SIZE);

    const nan = paramsToFilters(new URLSearchParams('page=abc'));
    expect(nan.page).toBe(1);
  });

  it('ignora parametros desconocidos de la URL', () => {
    const parsed = paramsToFilters(new URLSearchParams('foo=bar&src_ip=10.0.0.1'));
    expect(parsed.state.src_ip).toBe('10.0.0.1');
    expect(JSON.stringify(parsed)).not.toContain('foo');
  });
});
