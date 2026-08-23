import { describe, expect, it } from 'vitest';

import { buildAtlasIndex, matchCountry, normalizeCountryName } from './countryMatching';

/**
 * Nombres reales del world-atlas (properties.name de countries-110m.json,
 * verificados contra el archivo embebido en web/src/assets/world-110m.json).
 */
const ATLAS_NAMES = [
  'Argentina',
  'Australia',
  'Bolivia',
  'Brazil',
  'Canada',
  'Chile',
  'China',
  'Colombia',
  'Costa Rica',
  'Cuba',
  'Czechia',
  'Dem. Rep. Congo',
  'Dominican Rep.',
  'Ecuador',
  'El Salvador',
  'France',
  'Germany',
  'Guatemala',
  'Honduras',
  'India',
  'Indonesia',
  'Iran',
  'Macedonia',
  'Mexico',
  'Netherlands',
  'Nicaragua',
  'North Korea',
  'Panama',
  'Paraguay',
  'Peru',
  'Poland',
  'Russia',
  'South Korea',
  'Spain',
  'Turkey',
  'Ukraine',
  'United Kingdom',
  'United States of America',
  'Uruguay',
  'Venezuela',
  'Vietnam',
];

/** Códigos ISO-2 reales de api/app/data/ip_ranges.json (fallback de la API). */
const IP_RANGE_CODES = [
  ['AR', 'Argentina'],
  ['BO', 'Bolivia'],
  ['BR', 'Brazil'],
  ['CA', 'Canada'],
  ['CL', 'Chile'],
  ['CN', 'China'],
  ['CO', 'Colombia'],
  ['CR', 'Costa Rica'],
  ['CU', 'Cuba'],
  ['DE', 'Germany'],
  ['DO', 'Dominican Rep.'],
  ['EC', 'Ecuador'],
  ['FR', 'France'],
  ['GB', 'United Kingdom'],
  ['GT', 'Guatemala'],
  ['HN', 'Honduras'],
  ['ID', 'Indonesia'],
  ['IN', 'India'],
  ['KP', 'North Korea'],
  ['MX', 'Mexico'],
  ['NI', 'Nicaragua'],
  ['NL', 'Netherlands'],
  ['PA', 'Panama'],
  ['PE', 'Peru'],
  ['PL', 'Poland'],
  ['PY', 'Paraguay'],
  ['RU', 'Russia'],
  ['SV', 'El Salvador'],
  ['UY', 'Uruguay'],
  ['US', 'United States of America'],
  ['VE', 'Venezuela'],
  ['VN', 'Vietnam'],
] as const;

describe('normalizeCountryName', () => {
  it('normaliza mayusculas, acentos y espacios multiples', () => {
    expect(normalizeCountryName('  Estados   Unidos ')).toBe('estados unidos');
    expect(normalizeCountryName('RÉPUBLICA Dominicana')).toBe(
      'republica dominicana',
    );
    expect(normalizeCountryName('Alemania')).toBe('alemania');
  });
});

describe('matchCountry con nombres reales de ip_ranges.json (codigos ISO)', () => {
  const index = buildAtlasIndex(ATLAS_NAMES);

  it.each(IP_RANGE_CODES)('mapea %s al pais del atlas %s', (code, expected) => {
    expect(matchCountry(code, index)).toBe(expected);
  });

  it('es insensible a minusculas para codigos ISO', () => {
    expect(matchCountry('ar', index)).toBe('Argentina');
    expect(matchCountry('us', index)).toBe('United States of America');
  });
});

describe('matchCountry con nombres libres del enriquecimiento', () => {
  const index = buildAtlasIndex(ATLAS_NAMES);

  it('resuelve nombres en ingles directos e variantes comunes', () => {
    expect(matchCountry('United States', index)).toBe(
      'United States of America',
    );
    expect(matchCountry('USA', index)).toBe('United States of America');
    expect(matchCountry('Russian Federation', index)).toBe('Russia');
    expect(matchCountry('The Netherlands', index)).toBe('Netherlands');
    expect(matchCountry('Dominican Republic', index)).toBe('Dominican Rep.');
    expect(matchCountry('Korea, South', index)).toBe('South Korea');
    expect(matchCountry('Viet Nam', index)).toBe('Vietnam');
  });

  it('resuelve nombres en espanol frecuentes del enriquecimiento', () => {
    expect(matchCountry('Estados Unidos', index)).toBe(
      'United States of America',
    );
    expect(matchCountry('Rusia', index)).toBe('Russia');
    expect(matchCountry('Brasil', index)).toBe('Brazil');
    expect(matchCountry('República Dominicana', index)).toBe('Dominican Rep.');
    expect(matchCountry('Corea del Norte', index)).toBe('North Korea');
    expect(matchCountry('Alemania', index)).toBe('Germany');
  });

  it('devuelve null para valores sin pais conocido', () => {
    expect(matchCountry('Desconocido', index)).toBeNull();
    expect(matchCountry('', index)).toBeNull();
    expect(matchCountry('Atlantis', index)).toBeNull();
    expect(matchCountry('192.168.1.1', index)).toBeNull();
  });
});
