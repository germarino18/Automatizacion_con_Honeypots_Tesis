import { describe, expect, it } from 'vitest';

import type { EventItem } from '../../lib/api';
import {
  MAX_LIVE_EVENTS,
  MAX_SSE_FAILURES,
  classifySseMessage,
  computeEventsPerSecond,
  mergeEvents,
  parseSsePayload,
  shouldFallbackToPolling,
} from './liveFeed';

function buildEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 1,
    timestamp: '2026-03-05T14:00:00Z',
    source_honeypot: 'cowrie',
    src_ip: '203.0.113.7',
    protocol: 'tcp',
    att_ck_technique: 'T1110',
    severity: 'high',
    ...overrides,
  };
}

describe('classifySseMessage', () => {
  it('clasifica el tipo nombrado "event" como evento de datos', () => {
    expect(classifySseMessage('event')).toBe('event');
  });

  it('clasifica el heartbeat "ping" y deja el resto como desconocido', () => {
    expect(classifySseMessage('ping')).toBe('ping');
    expect(classifySseMessage('message')).toBe('unknown');
    expect(classifySseMessage('')).toBe('unknown');
  });
});

describe('shouldFallbackToPolling', () => {
  it('no degrada antes de alcanzar el umbral de fallos', () => {
    expect(MAX_SSE_FAILURES).toBe(3);
    expect(shouldFallbackToPolling(0)).toBe(false);
    expect(shouldFallbackToPolling(1)).toBe(false);
    expect(shouldFallbackToPolling(2)).toBe(false);
  });

  it('degrada con el umbral alcanzado o superado', () => {
    expect(shouldFallbackToPolling(3)).toBe(true);
    expect(shouldFallbackToPolling(10)).toBe(true);
  });
});

describe('parseSsePayload', () => {
  it('parsea un payload válido a EventItem', () => {
    const raw = JSON.stringify(buildEvent({ id: 41 }));
    const parsed = parseSsePayload(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe(41);
    expect(parsed?.severity).toBe('high');
  });

  it('devuelve null ante JSON inválido o primitivos', () => {
    expect(parseSsePayload('{no-json')).toBeNull();
    expect(parseSsePayload('42')).toBeNull();
    expect(parseSsePayload('"texto"')).toBeNull();
  });

  it('devuelve null si faltan campos obligatorios o la severidad es inválida', () => {
    expect(parseSsePayload(JSON.stringify({ id: 1 }))).toBeNull();
    expect(
      parseSsePayload(JSON.stringify({ id: 'x', timestamp: '', severity: 'low' })),
    ).toBeNull();
    expect(
      parseSsePayload(
        JSON.stringify(buildEvent({ severity: 'catastrofico' as never })),
      ),
    ).toBeNull();
  });
});

describe('mergeEvents', () => {
  const older = buildEvent({ id: 1, timestamp: '2026-03-05T14:00:00Z' });
  const middle = buildEvent({ id: 2, timestamp: '2026-03-05T14:01:00Z' });
  const newer = buildEvent({ id: 3, timestamp: '2026-03-05T14:02:00Z' });

  it('deduplica por id y ordena del más nuevo al más viejo', () => {
    const merged = mergeEvents([older, middle], [middle, newer]);
    expect(merged.map((event) => event.id)).toEqual([3, 2, 1]);
  });

  it('limita el feed al máximo definido conservando los más nuevos', () => {
    const many: EventItem[] = [];
    for (let i = 0; i < 6; i += 1) {
      many.push(
        buildEvent({ id: i + 10, timestamp: `2026-03-05T14:0${i}:00Z` }),
      );
    }
    expect(MAX_LIVE_EVENTS).toBe(100);
    expect(many.length).toBeGreaterThan(3);
    const merged = mergeEvents([], many, 3);
    expect(merged.map((event) => event.id)).toEqual([15, 14, 13]);
  });

  it('acepta lotes vacíos sin alterar el feed', () => {
    expect(mergeEvents([older], [])).toEqual([older]);
  });
});

describe('computeEventsPerSecond', () => {
  const NOW = 1_000_000;

  it('cuenta solo los eventos dentro de la ventana deslizante', () => {
    const timestamps = [
      NOW - 1_000,
      NOW - 2_000,
      NOW - 3_000,
      NOW - 4_000,
      NOW - 30_000,
    ];
    expect(computeEventsPerSecond(timestamps, NOW)).toBe(0.4);
  });

  it('excluye eventos fuera de la ventana y devuelve cero sin datos', () => {
    expect(computeEventsPerSecond([NOW - 60_000], NOW)).toBe(0);
    expect(computeEventsPerSecond([], NOW)).toBe(0);
  });

  it('incluye el borde exacto de la ventana y redondea a un decimal', () => {
    expect(computeEventsPerSecond([NOW - 10_000], NOW, 10_000)).toBe(0.1);
    expect(computeEventsPerSecond([NOW - 500, NOW - 900], NOW, 10_000)).toBe(
      0.2,
    );
  });
});

