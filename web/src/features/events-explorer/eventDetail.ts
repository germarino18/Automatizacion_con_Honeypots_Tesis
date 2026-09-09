/*
 * Extractor de geolocalización desde enrichment_data (JSONB) de un evento.
 * El backend no garantiza ninguna key específica: usa los paths observados
 * en production (country a nivel raíz, o anidado en `geo`/`geolocation`) y
 * el ASN cuando enriquecedores lo dejan disponible. Nunca inventa datos:
 * si no hay country/asn, devuelve campos vacíos (el drawer muestra '—').
 */

const COUNTRY_PATHS = ['country', 'geo.country', 'geolocation.country'] as const;

export interface GeoInfo {
  country?: string;
  asn?: string;
}

function readPath(source: Record<string, unknown>, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc !== null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      source,
    );
  return typeof value === 'string' ? value : '';
}

export function geoInfo(enrichment: Record<string, unknown> | null | undefined): GeoInfo {
  if (!enrichment) return {};

  const result: GeoInfo = {};
  for (const path of COUNTRY_PATHS) {
    const country = readPath(enrichment, path);
    if (country) {
      result.country = country;
      break;
    }
  }

  const asn = readPath(enrichment, 'asn');
  if (asn) result.asn = asn;

  return result;
}

/**
 * Risk score (0–1) a porcentaje entero para el donut del drawer, con los
 * valores fuera de rango recortados a 0/100. Devuelve null sin score.
 */
export function riskPercent(score: number | null | undefined): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null;
  }
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

export type RiskTone = 'critical' | 'high' | 'medium' | 'low';

/**
 * Risk score (0–1) a tono de severidad para números de riesgo en la UI
 * (Top IPs / alertas), con los mismos umbrales visuales del mockup bento:
 * >=75% crítico, >=50% alto, >=30% medio, resto bajo.
 */
export function riskTone(score: number | null | undefined): RiskTone {
  const percent = riskPercent(score);
  if (percent === null || percent < 30) return 'low';
  if (percent >= 75) return 'critical';
  if (percent >= 50) return 'high';
  return 'medium';
}