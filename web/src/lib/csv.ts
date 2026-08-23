/*
 * Exportación CSV client-side para el Explorador de Eventos.
 * Separador ";" y BOM UTF-8 (\uFEFF) según spec web-soc-ui, con
 * escapado estilo RFC 4180 (duplicado de comillas, entrecomillado de
 * valores con separador o saltos de línea).
 */

import type { EventItem } from './api';
import { formatTimestamp } from './formatters';

export const CSV_BOM = '\uFEFF';
export const CSV_SEPARATOR = ';';
export const CSV_ROW_END = '\r\n';

export const EVENT_CSV_HEADERS = [
  'id',
  'timestamp',
  'honeypot',
  'ip_origen',
  'puerto_destino',
  'protocolo',
  'usuario',
  'comandos',
  'tecnica_mitre',
  'risk_score',
  'severidad',
  'malware_hash',
] as const;

const NEEDS_QUOTING = /[;"\r\n]/;

/** Escapa un valor CSV ya convertido a string (RFC 4180). */
export function escapeCsvValue(value: string): string {
  if (!NEEDS_QUOTING.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsvString(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Columnas del export en el orden definido por EVENT_CSV_HEADERS. */
export function eventToCsvRow(event: EventItem): string[] {
  return [
    toCsvString(event.id),
    formatTimestamp(event.timestamp),
    toCsvString(event.source_honeypot),
    toCsvString(event.src_ip),
    toCsvString(event.dst_port),
    toCsvString(event.protocol),
    toCsvString(event.username),
    toCsvString(event.commands),
    toCsvString(event.att_ck_technique),
    toCsvString(event.risk_score),
    toCsvString(event.severity),
    toCsvString(event.malware_hash),
  ];
}

/**
 * Construye el documento CSV completo: BOM + fila de encabezado + filas
 * de datos. Con cero filas devuelve solo encabezado (con BOM).
 */
export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [headers.map(escapeCsvValue).join(CSV_SEPARATOR)];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(CSV_SEPARATOR));
  }
  return `${CSV_BOM}${lines.join(CSV_ROW_END)}${CSV_ROW_END}`;
}

/** Serializa eventos al CSV final listo para descargar. */
export function eventsToCsv(events: readonly EventItem[]): string {
  return buildCsv(
    EVENT_CSV_HEADERS,
    events.map((event) => eventToCsvRow(event)),
  );
}

/** Dispara la descarga de un archivo de texto generado en cliente. */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
