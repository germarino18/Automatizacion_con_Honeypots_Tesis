import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import SeverityBadge from '../../components/SeverityBadge';
import type { EventItem, ResponseItem } from '../../lib/api';
import { formatTimestamp } from '../../lib/formatters';
import { useEventDetail } from './useEvents';

interface EventDetailDrawerProps {
  eventId: number | null;
  onClose: () => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ResponsesTable({ responses }: { responses: ResponseItem[] }) {
  if (responses.length === 0) {
    return (
      <EmptyState
        title="Sin respuestas automatizadas"
        message="Este evento no tiene registros en la tabla de respuestas."
      />
    );
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Acción</th>
            <th scope="col">Actor</th>
            <th scope="col">Estado</th>
            <th scope="col">Evidencia</th>
            <th scope="col">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {responses.map((response) => (
            <tr key={response.id}>
              <td>{response.action_type}</td>
              <td className="cell-muted">{response.actor ?? '—'}</td>
              <td>{response.status ?? '—'}</td>
              <td className="font-mono cell-muted detail-evidence">
                {response.evidence_uri ?? '—'}
              </td>
              <td className="font-mono cell-muted">
                {formatTimestamp(response.created_at ?? response.timestamp ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Panel lateral con el detalle completo del evento seleccionado. */
export default function EventDetailDrawer({
  eventId,
  onClose,
}: EventDetailDrawerProps) {
  const { data, isPending, isError, error, refetch } = useEventDetail(eventId);

  if (eventId === null) return null;

  const event: EventItem | null = data ?? null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del evento"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <header className="drawer-header">
          <h2 className="panel-title">
            Evento <span className="font-mono">#{eventId}</span>
          </h2>
          <button
            type="button"
            className="btn btn-ghost drawer-close"
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>

        {isPending ? (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" /> Cargando detalle…
          </div>
        ) : isError || !event ? (
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => {
              void refetch();
            }}
          />
        ) : (
          <>
            <dl className="detail-grid">
              <DetailField label="Timestamp">
                <span className="font-mono">{formatTimestamp(event.timestamp)}</span>
              </DetailField>
              <DetailField label="IP origen">
                <span className="font-mono">{event.src_ip}</span>
              </DetailField>
              <DetailField label="Honeypot">{event.source_honeypot}</DetailField>
              <DetailField label="Protocolo">
                {event.protocol ?? '—'}
              </DetailField>
              <DetailField label="Puerto destino">
                <span className="font-mono">{event.dst_port ?? '—'}</span>
              </DetailField>
              <DetailField label="Usuario">
                <span className="font-mono">{event.username ?? '—'}</span>
              </DetailField>
              <DetailField label="Técnica MITRE">
                <span className="font-mono">
                  {event.att_ck_technique ?? '—'}
                </span>
              </DetailField>
              <DetailField label="Risk score">
                <span className="font-mono">{event.risk_score ?? '—'}</span>
              </DetailField>
              <DetailField label="Severidad">
                <SeverityBadge severity={event.severity} />
              </DetailField>
              <DetailField label="Registrado">
                <span className="font-mono">
                  {formatTimestamp(event.created_at ?? '')}
                </span>
              </DetailField>
              <DetailField label="Malware hash">
                <span className="font-mono detail-hash">
                  {event.malware_hash ?? '—'}
                </span>
              </DetailField>
              <DetailField label="Archivo malware">
                <span className="font-mono">{event.malware_filename ?? '—'}</span>
              </DetailField>
            </dl>

            {event.commands ? (
              <section className="detail-section">
                <h3 className="panel-title">Comandos</h3>
                <pre className="raw-json">{event.commands}</pre>
              </section>
            ) : null}

            <section className="detail-section">
              <h3 className="panel-title">raw_data</h3>
              <pre className="raw-json">
                {JSON.stringify(event.raw_data ?? {}, null, 2)}
              </pre>
            </section>

            <section className="detail-section">
              <h3 className="panel-title">Respuestas</h3>
              {data ? <ResponsesTable responses={data.responses} /> : null}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
