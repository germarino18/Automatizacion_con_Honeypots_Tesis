import { useMemo } from 'react';

import EmptyState from '../../components/EmptyState';
import SeverityBadge from '../../components/SeverityBadge';
import type { EventItem } from '../../lib/api';
import { formatTimestamp } from '../../lib/formatters';
import type { LiveConnection } from './liveFeed';
import { useLiveEvents } from './useLiveEvents';

const STATUS_LABEL: Record<LiveConnection, string> = {
  sse: 'En vivo (SSE)',
  polling: 'Degradado: polling',
  offline: 'Sin conexión',
};

function AmenazaActiva({ event }: { event: EventItem }) {
  return (
    <article
      className={`card threat-panel${event.severity === 'critical' ? '' : ' high'}`}
    >
      <h2 className="threat-panel-title">
        Amenaza activa — severidad{' '}
        {event.severity === 'critical' ? 'crítica' : 'alta'}
      </h2>
      <div className="threat-panel-body">
        <SeverityBadge severity={event.severity} />
        <span className="font-mono">{event.src_ip}</span>
        <span>{event.source_honeypot}</span>
        <span className="font-mono cell-muted">
          {event.att_ck_technique ?? '—'}
        </span>
        <span className="font-mono cell-muted">
          {formatTimestamp(event.timestamp)}
        </span>
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

export default function AtaquesEnVivo() {
  const { events, status, eventsPerSecond } = useLiveEvents();

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

      <div className="live-toolbar">
        <span className="live-indicator">
          <span
            className={`status-dot ${status}`}
            aria-hidden="true"
          />
          {STATUS_LABEL[status]}
        </span>
        <span className="live-eps" title="Eventos por segundo (ventana de 10s)">
          {eventsPerSecond.toFixed(1)} ev/s
        </span>
      </div>

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

      {amenazaActiva ? <AmenazaActiva event={amenazaActiva} /> : null}

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
    </section>
  );
}
