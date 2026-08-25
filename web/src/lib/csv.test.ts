import { describe, expect, it } from 'vitest';

import type { EventItem } from './api';
import {
  CSV_BOM,
  CSV_ROW_END,
  CSV_SEPARATOR,
  EVENT_CSV_HEADERS,
  buildCsv,
  escapeCsvValue,
  eventToCsvRow,
  eventsToCsv,
} from './csv';

const BOM = '\uFEFF';

function buildEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 7,
    timestamp: '2026-03-05T14:00:00Z',
    source_honeypot: 'cowrie',
    src_ip: '203.0.113.7',
    dst_port: 22,
    protocol: 'ssh',
    username: 'root',
    commands: 'uname -a; cat /etc/passwd',
    malware_hash: null,
    malware_filename: null,
    playbook_id: null,
    risk_score: 0.85,
    att_ck_technique: 'T1110',
    severity: 'high',
    enrichment_data: null,
    raw_data: null,
    created_at: null,
    ...overrides,
  };
}

describe('escapeCsvValue', () => {
  it('deja intactos los valores simples sin separadores ni saltos', () => {
    expect(escapeCsvValue('203.0.113.7')).toBe('203.0.113.7');
    expect(escapeCsvValue('')).toBe('');
  });

  it('entrecomilla valores que contienen el separador ";"', () => {
    expect(escapeCsvValue('a;b')).toBe('"a;b"');
  });

  it('duplica las comillas interiores al estilo RFC 4180 y entrecomilla', () => {
    expect(escapeCsvValue('el dijo "hola"')).toBe('"el dijo ""hola"""');
  });

  it('entrecomilla valores con saltos de linea y retornos de carro', () => {
    expect(escapeCsvValue('linea1\nlinea2')).toBe('"linea1\nlinea2"');
    expect(escapeCsvValue('linea1\r\nlinea2')).toBe('"linea1\r\nlinea2"');
  });
});

describe('buildCsv', () => {
  it('prefija el BOM UTF-8 exactamente una vez al inicio del archivo', () => {
    const csv = buildCsv(['a', 'b'], [['1', '2']]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.indexOf(BOM)).toBe(0);
    expect(csv.lastIndexOf(BOM)).toBe(0);
    expect(CSV_BOM).toBe('\uFEFF');
  });

  it('usa ";" como separador de columnas y CRLF como fin de linea', () => {
    const csv = buildCsv(['col_a', 'col_b'], [['v1', 'v2']]);
    expect(csv).toContain(`col_a${CSV_SEPARATOR}col_b`);
    expect(csv).toContain(`v1${CSV_SEPARATOR}v2`);
    expect(csv.endsWith(`${CSV_ROW_END}`)).toBe(true);
    expect(CSV_SEPARATOR).toBe(';');
    expect(CSV_ROW_END).toBe('\r\n');
  });

  it('con lista vacia produce solo encabezado (BOM + cabecera + CRLF)', () => {
    const csv = buildCsv(['x', 'y'], []);
    expect(csv).toBe(`${BOM}x${CSV_SEPARATOR}y${CSV_ROW_END}`);
  });

  it('escribe una fila por registro en el mismo orden de las columnas', () => {
    const csv = buildCsv(['h1', 'h2'], [
      ['r1c1', 'r1c2'],
      ['r2c1', 'r2c2'],
    ]);
    const lines = csv.slice(1).split(CSV_ROW_END).filter(Boolean);
    expect(lines).toEqual(['h1;h2', 'r1c1;r1c2', 'r2c1;r2c2']);
  });
});

describe('eventToCsvRow', () => {
  it('mapea los campos del evento a las columnas definidas', () => {
    expect(EVENT_CSV_HEADERS.length).toBeGreaterThan(0);
    const row = eventToCsvRow(buildEvent());
    expect(row[0]).toBe('7');
    expect(row).toContain('203.0.113.7');
    expect(row).toContain('cowrie');
    expect(row).toContain('T1110');
    expect(row).toContain('0.85');
    expect(row).toContain('high');
  });

  it('deja vacios los campos nulos o ausentes (hash, usuario, tecnica)', () => {
    const row = eventToCsvRow(
      buildEvent({
        dst_port: null,
        protocol: null,
        username: null,
        commands: null,
        att_ck_technique: null,
        risk_score: null,
        malware_hash: null,
      }),
    );
    expect(row.filter((value) => value === '')).toHaveLength(12);
  });

  it('preserva risk_score 0 (no lo trata como vacio)', () => {
    const row = eventToCsvRow(buildEvent({ risk_score: 0 }));
    expect(row).toContain('0');
  });
});

describe('eventsToCsv', () => {
  it('exporta la lista completa con BOM, encabezados y filas escapadas', () => {
    const csv = eventsToCsv([
      buildEvent({ id: 1 }),
      buildEvent({ id: 2, commands: 'echo "pwned"; whoami' }),
    ]);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).split(CSV_ROW_END).filter(Boolean);
    expect(lines.length).toBe(3); // header + 2 eventos
    expect(lines[0].split(CSV_SEPARATOR)).toEqual([...EVENT_CSV_HEADERS]);
    expect(lines[2]).toContain('"echo ""pwned""; whoami"');
  });

  it('con cero eventos devuelve solo la fila de encabezado con BOM', () => {
    const csv = eventsToCsv([]);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).split(CSV_ROW_END).filter(Boolean);
    expect(lines.length).toBe(1);
    expect(lines[0].split(CSV_SEPARATOR)).toEqual([...EVENT_CSV_HEADERS]);
  });
});
