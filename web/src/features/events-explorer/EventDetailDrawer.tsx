import { useRef } from 'react';
import type { ReactNode } from 'react';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import SeverityBadge from '../../components/SeverityBadge';
import { useDialogLock } from '../../hooks/useDialogLock';
import type { EventItem, ResponseItem } from '../../lib/api';
import { formatRiskScore, formatTimestamp } from '../../lib/formatters';
import { useEventDetail } from './useEvents';
import { geoInfo, riskPercent } from './eventDetail';

interface EventDetailDrawerProps {
  eventId: number | null;
  onClose: () => void;
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-field">
      <dt className="label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Donut SVG 0-100% con label central mono (risk score del evento). */
function RiskDonut({ score }: { score: number | null | undefined }) {
  const percent = riskPercent(score);
  return (
    <div className="risk-donut">
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        role="img"
        aria-label={
          percent === null ? 'Risk score no disponible' : `Risk score ${percent}%`
        }
      >
        <circle
          cx="36"
          cy="36"
          r="30"
          pathLength="100"
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth="8"
        />
        <circle
          cx="36"
          cy="36"
          r="30"
          pathLength="100"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${percent ?? 0} 100`}
          transform="rotate(-90 36 36)"
        />
        <text
          x="36"
          y="41"
          textAnchor="middle"
          className="font-mono"
          fill="var(--text-primary)"
          fontSize="16"
        >
          {percent === null ? '—' : `${percent}%`}
        </text>
      </svg>
      <div className="risk-donut-meta">
        <span className="risk-donut-label label">Risk score</span>
        <span className="font-mono risk-donut-raw">
          {formatRiskScore(score)}
        </span>
      </div>
    </div>
  );
}

/**
 * Timeline vertical del pipeline de automatización n8n del evento,
 * derivado de `responses`: cada nodo = una acción (action_type), con su
 * estado real, timestamp y payload `details` en mono.
 */
function PipelineTimeline({ responses }: { responses: ResponseItem[] }) {
  if (responses.length === 0) {
    return (
      <EmptyState
        title="Sin respuestas automatizadas"
        message="Este evento no tiene registros en la tabla de respuestas."
      />
    );
  }

  return (
    <ol className="pipeline-timeline">
      {responses.map((response) => {
        const statusValue = (response.status ?? '').toLowerCase();
        const tone =
          statusValue === 'success'
            ? 'ok'
            : statusValue === 'pending'
              ? 'pending'
              : 'failed';
        const label =
          tone === 'ok'
            ? 'ok'
            : tone === 'pending'
              ? 'pendiente'
              : 'fallido';

        return (
          <li key={response.id} className="pipeline-node">
            <span className={`pipeline-node-marker ${tone}`} aria-hidden="true" />
            <div className="pipeline-node-body">
              <div className="pipeline-node-head">
                <span className="pipeline-node-name">
                  {response.action_type || '—'}
                </span>
                <span className={`badge badge--status badge--status-${tone}`}>
                  {label}
                </span>
              </div>
              <time className="pipeline-node-time font-mono cell-muted">
                {formatTimestamp(response.created_at ?? response.timestamp ?? '')}
              </time>
              <pre className="pipeline-node-details font-mono">
                {response.details
                  ? JSON.stringify(response.details, null, 2)
                  : '—'}
              </pre>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Panel lateral con el detalle completo del evento seleccionado. */
export default function EventDetailDrawer({
  eventId,
  onClose,
}: EventDetailDrawerProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useDialogLock({ open: eventId !== null, onClose, dialogRef: overlayRef });

  const { data, isPending, isError, error, refetch } = useEventDetail(eventId);

  if (eventId === null) return null;

  const event: EventItem | null = data ?? null;

  const geo = geoInfo(event?.enrichment_data);

  return (
    <div className="overlay" ref={overlayRef} onClick={onClose}>
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
            className="btn btn--ghost drawer-close"
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
            <div className="risk-donut-row">
              <RiskDonut score={event.risk_score} />
              <SeverityBadge severity={event.severity} />
            </div>

            <dl className="detail-grid">
              <DetailField label="Detectado">
                <span className="font-mono">
                  {formatTimestamp(event.timestamp)}
                </span>
              </DetailField>
              <DetailField label="Registrado">
                <span className="font-mono">
                  {formatTimestamp(event.created_at ?? '')}
                </span>
              </DetailField>
              <DetailField label="IP origen">
                <span className="font-mono">{event.src_ip}</span>
              </DetailField>
              <DetailField label="País">
                <span className="font-mono">{geo.country ?? '—'}</span>
              </DetailField>
              <DetailField label="ASN">
                <span className="font-mono">{geo.asn ?? '—'}</span>
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
                <h3 className="panel-title">
                  Comandos ejecutados en la sesión
                </h3>
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
              <h3 className="panel-title">Pipeline n8n</h3>
              {data ? <PipelineTimeline responses={data.responses} /> : null}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}