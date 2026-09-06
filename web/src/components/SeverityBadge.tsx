import type { Severity } from '../lib/api';

const LABELS: Record<Severity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

interface SeverityBadgeProps {
  severity: Severity;
}

/** Badge de severidad con la escala semántica del design system. */
export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`badge badge--severity badge--severity-${severity}`}>
      {LABELS[severity]}
    </span>
  );
}
