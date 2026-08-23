import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatInteger,
  formatRiskScore,
  formatTimestamp,
} from './formatters';

describe('formatDuration', () => {
  it('devuelve "—" para valores nulos o no finitos', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('formatea segundos por debajo del minuto', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(42)).toBe('42 s');
    expect(formatDuration(59.4)).toBe('59 s');
  });

  it('formatea minutos y horas con un decimal y coma decimal', () => {
    expect(formatDuration(90)).toBe('1,5 min');
    expect(formatDuration(3599)).toBe('60,0 min');
    expect(formatDuration(9000)).toBe('2,5 h');
  });

  it('escala a días cuando supera las 24 horas', () => {
    expect(formatDuration(86_400 * 3)).toBe('3,0 d');
    expect(formatDuration(129_600)).toBe('1,5 d');
  });
});

describe('formatInteger', () => {
  it('no agrupa números menores a mil', () => {
    expect(formatInteger(0)).toBe('0');
    expect(formatInteger(999)).toBe('999');
  });

  it('agrupa miles con punto sin decimales', () => {
    expect(formatInteger(1000)).toBe('1.000');
    expect(formatInteger(1_234_567)).toBe('1.234.567');
  });

  it('mantiene el signo en negativos', () => {
    expect(formatInteger(-2500)).toBe('-2.500');
  });
});

describe('formatRiskScore', () => {
  it('devuelve "—" cuando no hay score', () => {
    expect(formatRiskScore(null)).toBe('—');
    expect(formatRiskScore(undefined)).toBe('—');
  });

  it('fija dos decimales con punto', () => {
    expect(formatRiskScore(0)).toBe('0.00');
    expect(formatRiskScore(0.87)).toBe('0.87');
    expect(formatRiskScore(1)).toBe('1.00');
  });
});

describe('formatTimestamp', () => {
  it('renderiza fecha y hora UTC con ceros rellenados', () => {
    expect(formatTimestamp('2026-03-05T14:23:09Z')).toBe(
      '2026-03-05 14:23:09',
    );
    expect(formatTimestamp('2026-01-01T00:00:00Z')).toBe(
      '2026-01-01 00:00:00',
    );
  });

  it('devuelve "—" para entradas inválidas', () => {
    expect(formatTimestamp('no-es-fecha')).toBe('—');
    expect(formatTimestamp('')).toBe('—');
  });
});
