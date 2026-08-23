import SeverityBadge from '../../components/SeverityBadge';
import type { EventItem } from '../../lib/api';
import { formatRiskScore, formatTimestamp } from '../../lib/formatters';
import { selectionHasText } from '../../lib/selection';

interface EventsTableProps {
  events: EventItem[];
  fetching?: boolean;
  onSelect: (event: EventItem) => void;
}

/** Tabla paginada del explorador, ordenada por timestamp DESC (lo hace la API). */
export default function EventsTable({
  events,
  fetching = false,
  onSelect,
}: EventsTableProps) {
  function handleRowClick(event: EventItem): void {
    // Ignorar el click si el usuario estaba seleccionando texto
    if (selectionHasText(window.getSelection())) return;
    onSelect(event);
  }

  return (
    <div className={`table-scroll${fetching ? ' is-refreshing' : ''}`}>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">IP origen</th>
            <th scope="col">Honeypot</th>
            <th scope="col">Protocolo</th>
            <th scope="col">Usuario</th>
            <th scope="col">Técnica MITRE</th>
            <th scope="col">Riesgo</th>
            <th scope="col">Severidad</th>
            <th scope="col">Malware</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              className="row-clickable"
              onClick={() => handleRowClick(event)}
            >
              <td className="font-mono">{formatTimestamp(event.timestamp)}</td>
              <td className="font-mono">{event.src_ip}</td>
              <td>{event.source_honeypot}</td>
              <td className="cell-muted font-mono">{event.protocol ?? '—'}</td>
              <td className="cell-muted font-mono">{event.username ?? '—'}</td>
              <td className="font-mono cell-muted">
                {event.att_ck_technique ?? '—'}
              </td>
              <td className="font-mono">{formatRiskScore(event.risk_score)}</td>
              <td>
                <SeverityBadge severity={event.severity} />
              </td>
              <td title={event.malware_hash ?? undefined}>
                {event.malware_hash ? (
                  <span
                    className="malware-dot"
                    role="img"
                    aria-label="Malware detectado"
                  />
                ) : (
                  <span className="cell-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
