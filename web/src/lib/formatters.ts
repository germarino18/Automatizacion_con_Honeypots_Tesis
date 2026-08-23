/*
 * Formateadores deterministas compartidos por las pantallas del SOC.
 * Sin dependencia de Intl/locales del host: la salida debe ser estable
 * entre Node (tests), Vite dev y el build de producción.
 */

const DASH = '—';

function oneDecimalEs(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1).replace('.', ',');
}

/** Entero con separador de miles "." (convención es) y signo preservado. */
export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return DASH;
  const sign = value < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(value)).toString();
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Duración en segundos → texto humano ("42 s", "1,5 min", "2,5 h", "3,0 d").
 * Devuelve "—" para null/undefined/no finitos/negativos (MTTD/MTTR vacíos).
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (
    seconds === null ||
    seconds === undefined ||
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return DASH;
  }
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3_600) return `${oneDecimalEs(seconds / 60)} min`;
  if (seconds < 86_400) return `${oneDecimalEs(seconds / 3_600)} h`;
  return `${oneDecimalEs(seconds / 86_400)} d`;
}

/** Risk score 0–1 con dos decimales fijos, "—" si no hay dato. */
export function formatRiskScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return DASH;
  }
  return score.toFixed(2);
}

/** ISO → "YYYY-MM-DD HH:mm:ss" en UTC, "—" si no es parseable. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}
