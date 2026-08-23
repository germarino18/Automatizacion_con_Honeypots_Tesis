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

/**
 * ISO "naive": sin zona horaria (sin Z ni offset ±hh:mm al final).
 * El backend puede emitir timestamps sin sufijo; representan UTC.
 */
const NAIVE_ISO_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;

/**
 * Parsea un timestamp de la API a Date absoluto.
 * * ISO con Z u offset → se respeta tal cual.
 * * ISO naive (sin zona) → se interpreta como UTC (evita el desfase del host).
 * Devuelve null si no es parseable.
 */
export function parseUtcDate(value: string): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const trimmed = value.trim();
  const normalized = NAIVE_ISO_RE.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Instante → "YYYY-MM-DD HH:mm:ss" en la zona LOCAL del navegador. */
export function formatTimestamp(iso: string): string {
  const date = parseUtcDate(iso);
  if (!date) return DASH;
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())} ${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
