import { describe, expect, it } from 'vitest';

import {
  BUCKET_COLORS,
  MAP_NEUTRAL_COLOR,
  buildColorScale,
} from './colorScale';

describe('buildColorScale', () => {
  it('con lista vacia no genera buckets y devuelve color neutral', () => {
    const scale = buildColorScale([]);
    expect(scale.buckets).toHaveLength(0);
    expect(scale.colorFor(10)).toBe(MAP_NEUTRAL_COLOR);
    expect(scale.colorFor(0)).toBe(MAP_NEUTRAL_COLOR);
  });

  it('con un solo pais genera un bucket que cubre su rango', () => {
    const scale = buildColorScale([7]);
    expect(scale.buckets).toHaveLength(1);
    expect(scale.buckets[0]).toMatchObject({ min: 7, max: 7 });
    expect(scale.colorFor(7)).toBe(scale.buckets[0].color);
  });

  it('cuantiza en ~5 buckets de min a max con colores monotonicos', () => {
    const counts = [3, 12, 40, 77, 150, 300, 900];
    const scale = buildColorScale(counts);

    expect(scale.buckets.length).toBe(BUCKET_COLORS.length);
    expect(scale.buckets[0].min).toBe(3);
    expect(scale.buckets[scale.buckets.length - 1].max).toBe(900);

    // Extremos: min -> primer color, max -> último color.
    expect(scale.colorFor(3)).toBe(BUCKET_COLORS[0]);
    expect(scale.colorFor(900)).toBe(BUCKET_COLORS[BUCKET_COLORS.length - 1]);

    // Monotonía: más ataques nunca da un bucket "más tenue".
    const palette = BUCKET_COLORS as readonly string[];
    let prevIndex = 0;
    for (const count of [12, 40, 77, 150, 300]) {
      const index = palette.indexOf(scale.colorFor(count));
      expect(index).toBeGreaterThanOrEqual(prevIndex);
      prevIndex = index;
    }
  });

  it('los buckets cubren el rango completo sin huecos', () => {
    const scale = buildColorScale([10, 50]);
    for (let i = 1; i < scale.buckets.length; i += 1) {
      expect(scale.buckets[i].min).toBeCloseTo(scale.buckets[i - 1].max, 6);
    }
  });
});
