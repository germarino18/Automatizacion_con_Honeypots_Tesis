import { useEffect, useState } from 'react';

import { apiGet, type EventItem, type EventPage } from '../../lib/api';
import {
  computeEventsPerSecond,
  MAX_LIVE_EVENTS,
  mergeEvents,
  parseSsePayload,
  shouldFallbackToPolling,
  type LiveConnection,
} from './liveFeed';

const POLL_INTERVAL_MS = 5_000;
/** Ventana deslizante del indicador eventos/segundo. */
const EPS_WINDOW_MS = 10_000;
/** Fallos de polling consecutivos antes de marcar el feed como offline. */
const MAX_POLL_FAILURES = 2;

export interface UseLiveEventsResult {
  events: EventItem[];
  status: LiveConnection;
  eventsPerSecond: number;
}

/**
 * Feed en vivo (design D4/spec web-soc-ui): suscripción SSE primaria a
 * `/api/v1/events/live` (eventos nombrados `event` + heartbeats `ping`),
 * con degradación a polling de `/api/v1/events` tras MAX_SSE_FAILURES
 * errores consecutivos. Un 401 en polling redirige al login vía api.ts.
 */
export function useLiveEvents(): UseLiveEventsResult {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [status, setStatus] = useState<LiveConnection>('sse');
  const [eventsPerSecond, setEventsPerSecond] = useState(0);

  useEffect(() => {
    let disposed = false;
    let sseFailures = 0;
    let pollFailures = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const arrivals: number[] = [];

    const applyEvents = (incoming: EventItem[]) => {
      if (incoming.length === 0) return;
      setEvents((previous) => mergeEvents(previous, incoming, MAX_LIVE_EVENTS));
    };

    const registerArrival = () => {
      const now = Date.now();
      arrivals.push(now);
      while (arrivals.length > 0 && now - arrivals[0] > EPS_WINDOW_MS * 2) {
        arrivals.shift();
      }
    };

    const startPolling = () => {
      if (disposed || pollTimer !== null) return;
      setStatus('polling');
      const tick = () => {
        void (async () => {
          try {
            const page = await apiGet<EventPage>('/events', {
              page: 1,
              page_size: 20,
            });
            pollFailures = 0;
            if (!disposed) setStatus('polling');
            applyEvents(page.items);
          } catch {
            pollFailures += 1;
            if (pollFailures >= MAX_POLL_FAILURES && !disposed) {
              setStatus('offline');
            }
          }
        })();
      };
      tick();
      pollTimer = setInterval(tick, POLL_INTERVAL_MS);
    };

    // Wire format real (api/app/services/live.py): frames nombrados
    // `event: event` con data JSON y `event: ping` de heartbeat (~15s);
    // onmessage NO recibe nada: hay que suscribirse por nombre.
    const source = new EventSource('/api/v1/events/live');

    source.addEventListener('event', (messageEvent) => {
      const parsed = parseSsePayload(
        (messageEvent as MessageEvent<string>).data,
      );
      if (!parsed || disposed) return;
      sseFailures = 0;
      setStatus('sse');
      registerArrival();
      applyEvents([parsed]);
    });

    source.addEventListener('ping', () => {
      // Heartbeat recibido: la conexión está viva; resetea el conteo de
      // fallos para no degradar mientras el stream responde.
      sseFailures = 0;
    });

    source.onerror = () => {
      // EventSource reintenta solo; si los fallos son consecutivos sin
      // ningún evento/ping en medio, se degrada a polling.
      sseFailures += 1;
      if (shouldFallbackToPolling(sseFailures)) {
        source.close();
        startPolling();
      }
    };

    const epsTimer = setInterval(() => {
      setEventsPerSecond(computeEventsPerSecond(arrivals, Date.now()));
    }, 1_000);

    return () => {
      disposed = true;
      source.close();
      if (pollTimer !== null) clearInterval(pollTimer);
      clearInterval(epsTimer);
    };
  }, []);

  return { events, status, eventsPerSecond };
}
