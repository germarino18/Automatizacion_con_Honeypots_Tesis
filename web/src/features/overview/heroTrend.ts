/**
 * Geometría del sparkline del hero card y targets del count-up.
 *
 * Replica las fórmulas del mockup del operador (Honeypot SOC v3):
 *   - pts = (i/(len-1)*240), (44 - (v/max)*40*g)
 *   - area = '0,48 ' + pts + ' 240,48'
 * La serie de tendencia es REAL (eventos_por_hora de la API), nunca un
 * array decorativo hardcodeado.
 */

export interface TrendGeometry {
  /** Puntos de la polyline, "x,y" separados por espacio. */
  line: string;
  /** Polígono del área sombreada, cerrado contra la base del viewBox. */
  area: string;
}

export const TREND_VIEWBOX = { width: 240, height: 48 } as const;
export const TREND_BASE_Y = TREND_VIEWBOX.height;
export const TREND_TOP_Y = 44;
export const TREND_AMP = 40;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Construye la geometría (line/area) del sparkline en un viewBox de
 * 240x48. `progress` (0→1) anima el trazado: en 0 la línea es plana en la
 * base (y=44), en 1 alcanza su pico real.
 */
export function buildTrendGeometry(
  trend: number[],
  progress: number,
): TrendGeometry {
  const g = clamp01(progress);
  const max = Math.max(...trend, 1);
  const n = trend.length;
  const points: string[] = [];

  for (let i = 0; i < n; i += 1) {
    const x = n > 1 ? (i / (n - 1)) * 240 : 0;
    const y = TREND_TOP_Y - (trend[i] / max) * TREND_AMP * g;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  const line = points.join(' ');
  if (n === 0) {
    return { line: '', area: `0,${TREND_BASE_Y} 0,${TREND_BASE_Y} 240,${TREND_BASE_Y}` };
  }
  return {
    line,
    area: `0,${TREND_BASE_Y} ${line} 240,${TREND_BASE_Y}`,
  };
}

/**
 * Targets reales del count-up: cada valor base escalado por el progreso
 * (0→1) y redondeado. En progreso 1 devuelve los valores exactos de la API.
 */
export function countUpTargets(base: number[], progress: number): number[] {
  const g = clamp01(progress);
  return base.map((value) => Math.round(value * g));
}