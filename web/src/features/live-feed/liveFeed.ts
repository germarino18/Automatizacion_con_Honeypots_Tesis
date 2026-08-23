/*
 * Lógica pura del feed en vivo (design D4): clasificación de mensajes SSE,
 * decisión de degradación a polling, parseo/validación de payloads y
 * merge/acotación del feed + cálculo de eventos/segundo.
 *
 * Mantener libre de efectos: el hook useLiveEvents orquesta EventSource y
 * polling consumiendo estas funciones (testeadas en liveFeed.test.ts).
 */

import type { EventItem, Severity } from '../../lib/api';

export type LiveConnection = 'sse' | 'polling' | 'offline';

/** Fallos consecutivos de EventSource antes de degradar a polling. */
export const MAX_SSE_FAILURES = 3;

/** Cap del feed en memoria (los más nuevos primero). */
export const MAX_LIVE_EVENTS = 100;

export type SseMessageKind = 'event' | 'ping' | 'unknown';

/**
 * Clasifica un mensaje SSE por su nombre de evento en el wire format real
 * de la API (api/app/services/live.py): `event: event` para datos y
 * `event: ping` para heartbeats. Cualquier otro nombre es ignorado.
 */
export function classifySseMessage(eventName: string): SseMessageKind {
  if (eventName === 'event') return 'event';
  if (eventName === 'ping') return 'ping';
  return 'unknown';
}

/** true cuando los fallos consecutivos alcanzaron el umbral de degradación. */
export function shouldFallbackToPolling(consecutiveFailures: number): boolean {
  return consecutiveFailures >= MAX_SSE_FAILURES;
}

const SEVERITIES: readonly Severity[] = ['low', 'medium', 'high', 'critical'];

/**
 * Parsea el `data` JSON de un frame `event: event`. Devuelve null ante
 * JSON inválido, primitivos, o eventos sin id/timestamp/src_ip/severity
 * válidos — la UI nunca debe crashear por un payload malformado.
 */
export function parseSsePayload(raw: string): EventItem | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const candidate = data as Record<string, unknown>;
  const { id, timestamp, src_ip, severity } = candidate;
  if (typeof id !== 'number' || !Number.isInteger(id)) return null;
  if (typeof timestamp !== 'string' || timestamp.length === 0) return null;
  if (typeof src_ip !== 'string' || src_ip.length === 0) return null;
  if (!SEVERITIES.includes(severity as Severity)) return null;
  return {
    ...(candidate as unknown as EventItem),
    id,
    timestamp,
    src_ip,
    severity: severity as Severity,
  };
}

/**
 * Fusiona lotes nuevos con el feed actual: dedup por id (el polling se
 * solapa con lo ya recibido por SSE), orden descendente (más nuevo primero)
 * y acotación a `cap` eventos.
 */
export function mergeEvents(
  current: EventItem[],
  incoming: EventItem[],
  cap: number = MAX_LIVE_EVENTS,
): EventItem[] {
  const byId = new Map<number, EventItem>();
  for (const event of [...incoming, ...current]) {
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, cap);
}

/**
 * Eventos/segundo sobre una ventana deslizante: cuenta timestamps en
 * [now − windowMs, now] y divide por la ventana en segundos (1 decimal).
 */
export function computeEventsPerSecond(
  timestampsMs: number[],
  nowMs: number,
  windowMs: number = 10_000,
): number {
  const inWindow = timestampsMs.filter(
    (ts) => ts <= nowMs && nowMs - ts <= windowMs,
  ).length;
  const seconds = windowMs / 1_000;
  return Math.round((inWindow / seconds) * 10) / 10;
}
