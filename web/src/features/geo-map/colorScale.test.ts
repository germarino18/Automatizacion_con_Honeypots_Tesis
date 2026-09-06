import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  TOKEN_ACCENT,
  TOKEN_ACCENT_STRONG,
  TOKEN_BG_ELEVATED,
} from '../../lib/colorTokens';
import {
  BUCKET_COLORS,
  MAP_NEUTRAL_COLOR,
  buildColorScale,
} from './colorScale';

function readCssVar(name: string): string {
  const css = readFileSync(
    new URL('../../styles/tokens.css', import.meta.url),
    'utf8',
  );
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`Token --${name} no encontrado en tokens.css`);
  }
  return match[1].trim();
}

describe('sincronía con tokens del design system', () => {
  it('BUCKET_COLORS y MAP_NEUTRAL_COLOR coinciden con los tokens CSS', () => {
    expect(TOKEN_ACCENT).toBe(readCssVar('accent'));
    expect(TOKEN_ACCENT_STRONG).toBe(readCssVar('accent-strong'));
    expect(TOKEN_BG_ELEVATED).toBe(readCssVar('bg-elevated'));

    expect(BUCKET_COLORS[2]).toBe(TOKEN_ACCENT_STRONG);
    expect(BUCKET_COLORS[3]).toBe(TOKEN_ACCENT);
    expect(MAP_NEUTRAL_COLOR).toBe(TOKEN_BG_ELEVATED);
  });

  it('la rampa conserva sus extremos oscuro/claro (no son los tokens)', () => {
    expect(BUCKET_COLORS).toHaveLength(5);
    expect(BUCKET_COLORS[0]).not.toBe(TOKEN_ACCENT);
    expect(BUCKET_COLORS[BUCKET_COLORS.length - 1]).not.toBe(TOKEN_ACCENT);
  });
});

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
