import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import MetricCard from '../../components/MetricCard';
import SeverityBadge from '../../components/SeverityBadge';
import type { CriticalAlert, HoneypotCount, TopIp } from '../../lib/api';
import {
  formatDuration,
  formatInteger,
  formatRiskScore,
  formatTimestamp,
} from '../../lib/formatters';
import { useOverview } from './useOverview';

function ComparativaHoneypots({ data }: { data: HoneypotCount[] }) {
  const max = Math.max(...data.map((entry) => entry.count), 1);
  return (
    <ul className="bar-list">
      {data.map((entry, index) => (
        <li key={entry.source_honeypot}>
          <div className="bar-row-label">
            <span>{entry.source_honeypot}</span>
            <span className="bar-row-count">{formatInteger(entry.count)}</span>
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill${index % 2 === 1 ? ' secondary' : ''}`}
              style={{ width: `${Math.round((entry.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopIps({ ips }: { ips: TopIp[] }) {
  if (ips.length === 0) {
    return (
      <EmptyState title="Sin atacantes registrados" />
    );
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">IP origen</th>
          <th scope="col">Ataques</th>
          <th scope="col">Riesgo máx.</th>
        </tr>
      </thead>
      <tbody>
        {ips.map((ip) => (
          <tr key={ip.src_ip}>
            <td className="font-mono">{ip.src_ip}</td>
            <td className="font-mono">{formatInteger(ip.total_ataques)}</td>
            <td className="font-mono">
              {formatRiskScore(ip.max_riesgo ?? ip.riesgo_promedio)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlertasCriticas({ alerts }: { alerts: CriticalAlert[] }) {
  if (alerts.length === 0) {
    return <EmptyState title="Sin alertas críticas recientes" />;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">IP origen</th>
            <th scope="col">Honeypot</th>
            <th scope="col">Técnica MITRE</th>
            <th scope="col">Severidad</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td className="font-mono">{formatTimestamp(alert.timestamp)}</td>
              <td className="font-mono">{alert.src_ip}</td>
              <td className="cell-muted">{alert.source_honeypot}</td>
              <td className="font-mono cell-muted">
                {alert.att_ck_technique ?? '—'}
              </td>
              <td>
                <SeverityBadge severity={alert.severity} />
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
        <>
          <div className="metric-grid">
            <MetricCard
              title="Total de ataques"
              value={formatInteger(data.total_eventos)}
              mono
            />
            <MetricCard
              title="Alertas críticas"
              value={formatInteger(data.alertas_criticas.length)}
              hint="Recientes"
            />
            <MetricCard
              title="IPs únicas"
              value={formatInteger(data.ips_unicas)}
              hint="Orígenes distintos"
            />
            <MetricCard
              title="MTTD"
              value={formatDuration(data.mttd_seconds)}
              hint="Tiempo medio de detección"
            />
            <MetricCard
              title="MTTR"
              value={formatDuration(data.mttr_seconds)}
              hint="Tiempo medio de respuesta"
            />
          </div>

          <div className="panel-grid">
            <article className="card panel">
              <h2 className="panel-title">Top IPs atacantes</h2>
              <TopIps ips={data.top_ips} />
            </article>
            <article className="card panel">
              <h2 className="panel-title">Eventos por honeypot</h2>
              {data.eventos_por_honeypot.length > 0 ? (
                <ComparativaHoneypots data={data.eventos_por_honeypot} />
              ) : (
                <EmptyState title="Sin eventos por honeypot" />
              )}
            </article>
          </div>

          <article className="card panel">
            <h2 className="panel-title">Alertas críticas recientes</h2>
            <AlertasCriticas alerts={data.alertas_criticas} />
          </article>
        </>
      )}
    </section>
  );
}
