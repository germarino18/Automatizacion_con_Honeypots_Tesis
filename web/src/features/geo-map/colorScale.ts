/*
 * Escala de color para el mapa de origen de ataques.
 * Cuantiza los conteos en ~5 buckets (min..max) con una rampa cian del
 * design system Obsidian Sentinel: más ataques = más brillante.
 * Los tonos intermedios y el neutral provienen de los tokens CSS
 * (ver colorTokens.ts, sincronizado por colorScale.test.ts).
 */

import {
  TOKEN_ACCENT,
  TOKEN_ACCENT_STRONG,
  TOKEN_BG_ELEVATED,
} from '../../lib/colorTokens';

export const BUCKET_COLORS = [
  '#155e75',
  '#0e7490',
  TOKEN_ACCENT_STRONG,
  TOKEN_ACCENT,
  '#67e8f9',
] as const;

/** Color de países sin datos (superficie elevada del design system). */
export const MAP_NEUTRAL_COLOR = TOKEN_BG_ELEVATED;

const BUCKET_COUNT = BUCKET_COLORS.length;
/** Con min === max no hay comparación relativa: tono medio. */
const SINGLE_BUCKET_COLOR_INDEX = 2;

export interface ColorBucket {
  readonly min: number;
  readonly max: number;
  readonly color: string;
}

export interface ColorScale {
  readonly buckets: readonly ColorBucket[];
  colorFor(count: number): string;
}

function clampIndex(index: number): number {
  return Math.max(0, Math.min(BUCKET_COUNT - 1, index));
}

/**
 * Construye la escala a partir de los conteos observados. Los valores
 * fuera de rango se recortan al primer/último bucket; sin datos devuelve
 * siempre el color neutral (mapa apagado).
 */
export function buildColorScale(counts: readonly number[]): ColorScale {
  if (counts.length === 0) {
    return { buckets: [], colorFor: () => MAP_NEUTRAL_COLOR };
  }

  const min = Math.min(...counts);
  const max = Math.max(...counts);

  if (max === min) {
    const color = BUCKET_COLORS[SINGLE_BUCKET_COLOR_INDEX];
    return {
      buckets: [{ min, max, color }],
      colorFor: () => color,
    };
  }

  const step = (max - min) / BUCKET_COUNT;
  const buckets: ColorBucket[] = BUCKET_COLORS.map((color, i) => ({
    // Último bucket cerrado sobre max para incluir el valor máximo.
    max: i === BUCKET_COUNT - 1 ? max : min + step * (i + 1),
    min: min + step * i,
    color,
  }));

  const colorFor = (count: number): string => {
    const index = clampIndex(Math.floor((count - min) / step));
    return buckets[index].color;
  };

  return { buckets, colorFor };
}
