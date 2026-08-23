/*
 * La API exige `payload` como dict (Pydantic SimulateRequest.payload: dict).
 * El textarea acepta JSON libre o texto plano; si no parsea a objeto JSON
 * se envuelve en { raw } para no rechazar escenarios descriptivos.
 */

export function parsePayloadText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* texto libre -> se envuelve abajo */
  }

  return { raw: trimmed };
}
