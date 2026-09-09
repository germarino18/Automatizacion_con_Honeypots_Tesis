import { describe, expect, it } from 'vitest';

import { buildTrendGeometry, countUpTargets } from './heroTrend';

function pointsOf(geometry: { line: string }) {
  return geometry.line.split(' ');
}

describe('buildTrendGeometry', () => {
  it('mapea 24 puntos al viewBox 240x48 en orden asc', () => {
    const trend = Array.from({ length: 24 }, (_, i) => (i + 1) * 10);
    const geometry = buildTrendGeometry(trend, 1);

    const pts = pointsOf(geometry);
    expect(pts).toHaveLength(24);
    const first = pts[0].split(',').map(Number);
    const last = pts[pts.length - 1].split(',').map(Number);
    expect(first[0]).toBe(0);
    expect(last[0]).toBe(240);
    // La serie es creciente: el último punto queda arriba, el primero abajo.
    expect(first[1]).toBeGreaterThan(last[1]);
  });

  it('sin progreso (g=0) la línea queda pegada a la base', () => {
    const trend = [10, 50, 90];
    const geometry = buildTrendGeometry(trend, 0);

    const ys = pointsOf(geometry).map((p) => Number(p.split(',')[1]));
    expect(ys.every((y) => y === 44)).toBe(true);
  });

  it('el área cierra el polígono contra la base del viewBox', () => {
    const trend = [0, 50, 100];
    const geometry = buildTrendGeometry(trend, 1);

    expect(geometry.area).toMatch(/^0,48 /);
    expect(geometry.area).toMatch(/ 240,48$/);
    // Mismo shape poligonal que la polyline, pero cerrado.
    expect(geometry.area).toContain(pointsOf(geometry).join(' '));
  });

  it('normaliza el pico por el máximo de la serie (no por 100)', () => {
    const scale = [0, 25, 50];
    const geometry = buildTrendGeometry(scale, 1);
    const [, midY] = pointsOf(geometry)[1].split(',').map(Number);
    // 25 es la mitad del máximo (50): y = 44 - 0.5*40 = 24.
    expect(midY).toBe(24);
  });

  it('con clampa progreso fuera de rango [0,1]', () => {
    const trend = [10];
    expect(() => buildTrendGeometry(trend, -1)).not.toThrow();
    expect(() => buildTrendGeometry(trend, 2)).not.toThrow();
  });

  it('serie vacía produce geometría vacía pero válida', () => {
    const geometry = buildTrendGeometry([], 1);
    expect(geometry.line).toBe('');
    // Área mínima sin onda: solo la base.
    expect(geometry.area).toBe('0,48 0,48 240,48');
  });
});

describe('countUpTargets', () => {
  it('en progreso 0 devuelve ceros', () => {
    expect(countUpTargets([1284, 213, 37], 0)).toEqual([0, 0, 0]);
  });

  it('en progreso 1 devuelve los valores reales exactos', () => {
    expect(countUpTargets([1284, 213, 37], 1)).toEqual([1284, 213, 37]);
  });

  it('en progreso intermedio escala y redondea', () => {
    const [total] = countUpTargets([1284], 0.5);
    expect(total).toBe(642);
    const [ips] = countUpTargets([213], 0.25);
    expect(ips).toBe(53);
  });

  it('clampa progreso fuera de [0,1]', () => {
    expect(countUpTargets([10], 2)).toEqual([10]);
    expect(countUpTargets([10], -1)).toEqual([0]);
  });
});