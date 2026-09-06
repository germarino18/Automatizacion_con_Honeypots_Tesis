/*
 * Constantes de marca duplicadas en TS para código que no vive en CSS
 * (ej. la escala de color del mapa SVG). La fuente de verdad son los
 * tokens en `src/styles/tokens.css`; colorScale.test.ts verifica que
 * estas constantes no diverjan de los `--` vars correspondientes.
 */
export const TOKEN_ACCENT = '#06b6d4';
export const TOKEN_ACCENT_STRONG = '#0891b2';
export const TOKEN_BG_ELEVATED = '#243244';