import type { Severity } from '../../lib/api';

export type ThreatTone = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

/**
 * Derives the visual tone for the "Amenaza activa" card from a live
 * event's severity. `unknown` covers events without a severity field
 * (label keeps "Amenaza activa", no suffix, red family default).
 */
export function threatSeverityTone(severity: Severity | undefined): ThreatTone {
  if (severity == null) return 'unknown';
  return severity;
}

export const THREAT_TONE_LABEL: Record<ThreatTone, string | undefined> = {
  critical: 'crítica',
  high: 'alta',
  medium: 'media',
  low: 'baja',
  unknown: undefined,
};
