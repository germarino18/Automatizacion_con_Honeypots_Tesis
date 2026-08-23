interface MetricCardProps {
  title: string;
  value: string;
  hint?: string;
  mono?: boolean;
}

/** Tarjeta de métrica para dashboards (valor opcionalmente en mono). */
export default function MetricCard({
  title,
  value,
  hint,
  mono = false,
}: MetricCardProps) {
  return (
    <article className="metric-card card">
      <p className="metric-card-title">{title}</p>
      <p className={`metric-card-value${mono ? ' font-mono' : ''}`}>{value}</p>
      {hint ? <p className="metric-card-hint">{hint}</p> : null}
    </article>
  );
}
