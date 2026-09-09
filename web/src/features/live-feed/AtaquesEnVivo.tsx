import { useMemo, useState } from 'react';

import EmptyState from '../../components/EmptyState';
import SeverityBadge from '../../components/SeverityBadge';
import EventDetailDrawer from '../events-explorer/EventDetailDrawer';
import type { EventItem } from '../../lib/api';
import { formatTimestamp } from '../../lib/formatters';
import type { LiveConnection } from './liveFeed';
import { MAX_LIVE_EVENTS } from './liveFeed';
import { THREAT_TONE_LABEL, threatSeverityTone } from './threatSeverity';
import { useLiveEvents } from './useLiveEvents';

const STATUS_LABEL: Record<LiveConnection, string> = {
  sse: 'En vivo (SSE)',
  polling: 'Degradado: polling',
  offline: 'Sin conexión',
};

interface AmenazaActivaProps {
  event: EventItem;
  onInvestigar: (eventId: number) => void;
}

function AmenazaActiva({ event, onInvestigar }: AmenazaActivaProps) {
  const tone = threatSeverityTone(event.severity);
  const suffix = THREAT_TONE_LABEL[tone];
  const label = suffix ? `Amenaza activa · severidad ${suffix}` : 'Amenaza activa';
  return (
    <article className={`threat-card tone-${tone}`}>
      <span className="hero-scanline" aria-hidden="true" />
      <p className="threat-card-label">{label}</p>
      <div className="threat-card-main">
        <span className="threat-card-ip">{event.src_ip}</span>
        <span className="threat-card-hp">{event.source_honeypot}</span>
        <span className="threat-card-tech">{event.att_ck_technique ?? '—'}</span>
        <span className="threat-card-ts">{formatTimestamp(event.timestamp)}</span>
        <span className="threat-card-spacer" aria-hidden="true" />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onInvestigar(event.id)}
        >
          Investigar
        </button>
      </div>
    </article>
  );
}

function FeedTabla({ events }: { events: EventItem[] }) {
  // El feed nace vacío y cada <tr> se monta una sola vez (keys estables
  // por id): la animación CSS de .is-new resalta solo las filas nuevas.
  return (
    <div className="table-scroll">
      <table className="data-table feed-table">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">IP origen</th>
            <th scope="col">Honeypot</th>
            <th scope="col">Protocolo</th>
            <th scope="col">Técnica MITRE</th>
            <th scope="col">Severidad</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="is-new">
              <td className="font-mono">{formatTimestamp(event.timestamp)}</td>
              <td className="font-mono">{event.src_ip}</td>
              <td>{event.source_honeypot}</td>
              <td className="cell-muted font-mono">{event.protocol ?? '—'}</td>
              <td className="font-mono cell-muted">
                {event.att_ck_technique ?? '—'}
              </td>
              <td>
                <SeverityBadge severity={event.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedChips({
  status,
  eventsPerSecond,
  count,
  paused,
  onTogglePause,
}: {
  status: LiveConnection;
  eventsPerSecond: number;
  count: number;
  paused: boolean;
  onTogglePause: () => void;
}) {
  return (
    <div className="live-toolbar">
      <span className="live-chip">
        <span className={`status-dot ${status}`} aria-hidden="true" />
        {STATUS_LABEL[status]}
      </span>
      <span className="live-chip live-eps" title="Eventos por segundo (ventana de 10s)">
        {eventsPerSecond.toFixed(1)} ev/s
      </span>
      <span
        className="live-chip"
        title="Eventos acumulados sobre la ventana deslizante"
      >
        {count}/{MAX_LIVE_EVENTS} en ventana
      </span>
      <span className="live-space" />
      <button
        type="button"
        className="btn btn--ghost"
        aria-pressed={paused}
        onClick={onTogglePause}
      >
        {paused ? 'Reanudar' : 'Pausar'}
      </button>
    </div>
  );
}

export default function AtaquesEnVivo() {
  const [paused, setPaused] = useState(false);
  const { events, status, eventsPerSecond } = useLiveEvents({ paused });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const amenazaActiva = useMemo(
    () =>
      events.find(
        (event) => event.severity === 'critical' || event.severity === 'high',
      ),
    [events],
  );

  return (
    <section className="screen">
      <h1 className="screen-title">Ataques en Vivo</h1>
      <p className="screen-subtitle">
        Feed de eventos en tiempo real por SSE con degradación a polling.
      </p>

      <FeedChips
        status={status}
        eventsPerSecond={eventsPerSecond}
        count={events.length}
        paused={paused}
        onTogglePause={() => setPaused((value) => !value)}
      />

      {status === 'polling' ? (
        <div className="live-banner warning">
          Modo degradado: polling cada 5 s — la conexión SSE no está disponible.
        </div>
      ) : null}
      {status === 'offline' ? (
        <div className="live-banner danger">
          Sin conexión con la API. Reintentando automáticamente…
        </div>
      ) : null}

      {amenazaActiva ? (
        <AmenazaActiva
          event={amenazaActiva}
          onInvestigar={(eventId) => setSelectedId(eventId)}
        />
      ) : null}

      <div className="card panel">
        {events.length === 0 ? (
          <EmptyState
            title={status === 'offline' ? 'Feed sin conexión' : 'Esperando eventos…'}
            message={
              status === 'offline'
                ? 'No hay conexión con la API; el feed se reanudará al reconectar.'
                : 'Los eventos nuevos aparecerán aquí sin recargar la página.'
            }
          />
        ) : (
          <FeedTabla events={events} />
        )}
      </div>

      <EventDetailDrawer
        eventId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </section>
  );
}