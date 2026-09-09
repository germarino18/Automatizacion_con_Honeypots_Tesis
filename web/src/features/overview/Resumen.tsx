import { useState } from 'react';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import SeverityBadge from '../../components/SeverityBadge';
import type { CriticalAlert, HoneypotCount, Overview, TopIp } from '../../lib/api';
import {
  formatDuration,
  formatEsArNumber,
  formatInteger,
  formatRiskScore,
  formatTimestamp,
} from '../../lib/formatters';
import EventDetailDrawer from '../events-explorer/EventDetailDrawer';
import { riskTone } from '../events-explorer/eventDetail';
import { useCountUpProgress } from '../../hooks/useCountUpProgress';
import { buildHoneypotStrip } from './honeypotStrip';
import { buildTrendGeometry, countUpTargets } from './heroTrend';
import { useOverview } from './useOverview';

function HoneypotStrip({ data }: { data: HoneypotCount[] }) {
  const entries = buildHoneypotStrip(data);
  if (entries.length === 0) return null;
  return (
    <div className="honeypot-strip" role="group">
      <span className="honeypot-strip-title">Eventos por honeypot</span>
      <div className="honeypot-strip-bars">
        {entries.map((entry) => (
          <span key={entry.label} className="honeypot-strip-item">
            <span className="honeypot-strip-label font-mono">{entry.label}</span>
            <span className="honeypot-strip-track">
              <span
                className="honeypot-strip-fill"
                style={{ width: `${entry.pct}%` }}
              />
            </span>
            <span className="honeypot-strip-count font-mono">
              {formatInteger(entry.count)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BentoHero({ overview }: { overview: Overview }) {
  const progress = useCountUpProgress();
  const trend = (overview.eventos_por_hora ?? []).map((bucket) => bucket.count);
  const geometry = buildTrendGeometry(trend, progress);

  const [total, ips, muestras, criticas, bloqueos] = countUpTargets(
    [
      overview.total_eventos,
      overview.ips_unicas,
      overview.total_malware,
      overview.alertas_criticas.length,
      overview.bloqueos_ufw ?? 0,
    ],
    progress,
  );
  const mttd = countUpTargets([overview.mttd_seconds ?? 0], progress)[0];
  const mttr = countUpTargets([overview.mttr_seconds ?? 0], progress)[0];
  const mttdDisplay =
    overview.mttd_seconds == null ? '—' : formatDuration(mttd);
  const mttrDisplay =
    overview.mttr_seconds == null ? '—' : formatDuration(mttr);

  return (
    <article className="card bento-tile bento-hero hero-card">
      <span className="hero-scanline" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-main">
          <p className="hero-label">Ataques capturados</p>
          <p className="hero-value">{formatEsArNumber(total)}</p>
          <div className="hero-substats">
            <span className="hero-substat">
              <strong>{formatEsArNumber(ips)}</strong> IPs únicas
            </span>
            <span className="hero-substat">
              <strong>{formatEsArNumber(muestras)}</strong> muestras
            </span>
          </div>
        </div>

        <div className="hero-trend-block">
          <svg
            className="hero-trend"
            viewBox="0 0 240 48"
            role="img"
            aria-label="Eventos por hora en las últimas 24 horas"
            preserveAspectRatio="none"
          >
            <polygon className="hero-trend-area" points={geometry.area} />
            <polyline className="hero-trend-line" points={geometry.line} />
          </svg>
          <div className="hero-trend-labels" aria-hidden="true">
            <span>−24 H</span>
            <span>AHORA</span>
          </div>
        </div>

        <div className="hero-stats-segmented">
          <div className="hero-stat-tile">
            <span className="hero-stat-label">Críticas</span>
            <span className="hero-stat-value hero-stat-value--critical">
              {formatEsArNumber(criticas)}
            </span>
          </div>
          <div className="hero-stat-tile">
            <span className="hero-stat-label">MTTD</span>
            <span className="hero-stat-value hero-stat-value--info">
              {mttdDisplay}
            </span>
          </div>
          <div className="hero-stat-tile">
            <span className="hero-stat-label">MTTR</span>
            <span className="hero-stat-value hero-stat-value--info">
              {mttrDisplay}
            </span>
          </div>
          <div className="hero-stat-tile">
            <span className="hero-stat-label">Bloqueos</span>
            <span className="hero-stat-value hero-stat-value--ok">
              {formatEsArNumber(bloqueos)}
            </span>
          </div>
        </div>
      </div>
      <HoneypotStrip data={overview.eventos_por_honeypot} />
    </article>
  );
}

function TopIps({ ips }: { ips: TopIp[] }) {
  if (ips.length === 0) {
    return <EmptyState title="Sin atacantes registrados" />;
  }
  const max = Math.max(...ips.map((ip) => ip.total_ataques), 1);
  return (
    <div className="topip-list">
      {ips.map((ip) => {
        const risk = ip.max_riesgo ?? ip.riesgo_promedio;
        return (
          <div key={ip.src_ip} className="topip-row">
            <span className="font-mono topip-ip" title={ip.src_ip}>
              {ip.src_ip}
            </span>
            <span className="bar-track topip-bar">
              <span
                className="bar-fill"
                style={{
                  width: `${Math.round((ip.total_ataques / max) * 100)}%`,
                }}
              />
            </span>
            <span className="font-mono topip-count">
              {formatInteger(ip.total_ataques)}
            </span>
            <span className={`font-mono risk-tone-${riskTone(risk)}`}>
              {formatRiskScore(risk)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AlertasCriticas({
  alerts,
  onInvestigar,
}: {
  alerts: CriticalAlert[];
  onInvestigar: (alertId: number) => void;
}) {
  if (alerts.length === 0) {
    return <EmptyState title="Sin alertas críticas recientes" />;
  }
  return (
    <div className="alert-table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">IP origen</th>
            <th scope="col">Honeypot</th>
            <th scope="col">Técnica</th>
            <th scope="col">Severidad</th>
            <th scope="col">Riesgo</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr
              key={alert.id}
              className="alert-tr"
              role="button"
              tabIndex={0}
              aria-label={`Abrir detalle del evento de ${alert.src_ip}`}
              onClick={() => onInvestigar(alert.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onInvestigar(alert.id);
                }
              }}
            >
              <td className="font-mono cell-muted">
                {formatTimestamp(alert.timestamp)}
              </td>
              <td className="font-mono">{alert.src_ip}</td>
              <td className="cell-muted">{alert.source_honeypot}</td>
              <td className="font-mono cell-muted">
                {alert.att_ck_technique ?? '—'}
              </td>
              <td>
                <SeverityBadge severity={alert.severity} />
              </td>
              <td className={`font-mono risk-tone-${riskTone(alert.risk_score)}`}>
                {formatRiskScore(alert.risk_score)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Resumen() {
  const { data, isPending, isError, error, refetch } = useOverview();
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  return (
    <section className="screen">
      <h1 className="screen-title">Resumen del SOC</h1>
      <p className="screen-subtitle">
        Métricas generales, top atacantes y alertas críticas recientes.
      </p>

      {isPending ? (
        <div className="card loading-state">
          <span className="spinner" aria-hidden="true" /> Cargando métricas…
        </div>
      ) : isError || !data ? (
        <div className="card">
          <ErrorState
            message={
              error instanceof Error ? error.message : 'Error desconocido'
            }
            onRetry={() => {
              void refetch();
            }}
          />
        </div>
      ) : data.total_eventos === 0 ? (
        <div className="card">
          <EmptyState
            title="Sin datos de ataques"
            message="No hay eventos registrados en el rango consultado."
          />
        </div>
      ) : (
        <div className="bento-grid">
          <BentoHero overview={data} />

          <article className="card bento-tile bento-topips">
            <h2 className="bento-kicker">Top IPs atacantes</h2>
            <TopIps ips={data.top_ips} />
          </article>

          <article className="card bento-tile bento-alerts">
            <h2 className="bento-kicker">Alertas críticas</h2>
            <AlertasCriticas
              alerts={data.alertas_criticas}
              onInvestigar={(alertId) => setSelectedAlertId(alertId)}
            />
          </article>
        </div>
      )}

      <EventDetailDrawer
        eventId={selectedAlertId}
        onClose={() => setSelectedAlertId(null)}
      />
    </section>
  );
}