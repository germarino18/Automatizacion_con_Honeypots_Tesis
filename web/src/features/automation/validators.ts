/*
 * Validaciones client-side de los formularios SOAR. La API revalida todo
 * (422), pero se anticipan los errores más comunes para no enviar requests
 * destinados a fallar.
 */

const IPV4_PATTERN =
  /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function isValidIpv4(value: string): boolean {
  return IPV4_PATTERN.test(value.trim());
}

export type DurationParseResult =
  | { ok: true; seconds: number | null }
  | { ok: false };

/** duration opcional: vacío -> null (la API lo trata como indefinido). */
export function parseOptionalDuration(raw: string): DurationParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, seconds: null };

  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const seconds = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(seconds) || seconds < 0) return { ok: false };
  return { ok: true, seconds };
}
