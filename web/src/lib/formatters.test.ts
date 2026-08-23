import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatInteger,
  formatRiskScore,
  formatTimestamp,
  parseUtcDate,
} from './formatters';

/** Reconstruye la hora local esperada con los getters nativos del host. */
function expectedLocalParts(value: string): string {
  const date = new Date(value);
  const pad = (part: number): string => part.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

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

describe('parseUtcDate', () => {
  it('trata los ISO naive (sin zona) como UTC', () => {
    const naive = parseUtcDate('2026-03-05T14:23:09');
    const explicit = parseUtcDate('2026-03-05T14:23:09Z');
    expect(naive).not.toBeNull();
    expect(naive?.getTime()).toBe(explicit?.getTime());
  });

  it('respeta los offsets explícitos (+hh:mm)', () => {
    const offset = parseUtcDate('2026-03-05T14:23:09+02:00');
    expect(offset?.getTime()).toBe(
      parseUtcDate('2026-03-05T12:23:09Z')?.getTime(),
    );
  });

  it('acepta separador de espacio en lugar de "T"', () => {
    const spaced = parseUtcDate('2026-03-05 14:23:09');
    expect(spaced?.getTime()).toBe(
      parseUtcDate('2026-03-05T14:23:09Z')?.getTime(),
    );
  });

  it('devuelve null para entradas inválidas o vacías', () => {
    expect(parseUtcDate('no-es-fecha')).toBeNull();
    expect(parseUtcDate('')).toBeNull();
  });
});

describe('formatTimestamp', () => {
  it('renderiza fecha y hora en la zona LOCAL del host', () => {
    expect(formatTimestamp('2026-03-05T14:23:09Z')).toBe(
      expectedLocalParts('2026-03-05T14:23:09Z'),
    );
    expect(formatTimestamp('2026-01-01T00:00:00Z')).toBe(
      expectedLocalParts('2026-01-01T00:00:00Z'),
    );
  });

  it('muestra lo mismo para instantes idénticos expresados con zona distinta', () => {
    expect(formatTimestamp('2026-03-05T12:23:09Z')).toBe(
      formatTimestamp('2026-03-05T14:23:09+02:00'),
    );
  });

  it('no desplaza la hora cuando el backend envía ISO naive', () => {
    // El mismo instante: naive (interpretado UTC) debe renderizar igual que su gemelo con Z
    expect(formatTimestamp('2026-03-05T14:23:09')).toBe(
      formatTimestamp('2026-03-05T14:23:09Z'),
    );
  });

  it('devuelve "—" para entradas inválidas', () => {
    expect(formatTimestamp('no-es-fecha')).toBe('—');
    expect(formatTimestamp('')).toBe('—');
  });
});
