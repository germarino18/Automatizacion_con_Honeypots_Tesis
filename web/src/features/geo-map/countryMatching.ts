/*
 * Matching entre nombres de país de la API (/geo/countries) y las
 * propiedades.name del world-atlas embebido (countries-110m.json, en inglés).
 *
 * La API puede devolver tres formas de valor:
 *  1. Nombres libres del enriquecimiento ("United States", "Estados Unidos").
 *  2. Códigos ISO-2 del fallback de rangos IP (api/app/data/ip_ranges.json).
 *  3. Basura / "Desconocido" -> null (el país igual se lista en la tabla).
 */

export type AtlasIndex = ReadonlyMap<string, string>;

const ISO2_TO_ATLAS: Readonly<Record<string, string>> = {
  /* Claves presentes en api/app/data/ip_ranges.json */
  AR: 'Argentina',
  AU: 'Australia',
  BO: 'Bolivia',
  BR: 'Brazil',
  CA: 'Canada',
  CL: 'Chile',
  CN: 'China',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  DE: 'Germany',
  DO: 'Dominican Rep.',
  EC: 'Ecuador',
  FR: 'France',
  GB: 'United Kingdom',
  GT: 'Guatemala',
  HN: 'Honduras',
  ID: 'Indonesia',
  IN: 'India',
  KP: 'North Korea',
  MX: 'Mexico',
  NI: 'Nicaragua',
  NL: 'Netherlands',
  PA: 'Panama',
  PE: 'Peru',
  PL: 'Poland',
  PY: 'Paraguay',
  RU: 'Russia',
  SV: 'El Salvador',
  UY: 'Uruguay',
  US: 'United States of America',
  VE: 'Venezuela',
  VN: 'Vietnam',
  /* Extras frecuentes en fuentes de enriquecimiento (AbuseIPDB/VT) */
  AT: 'Austria',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BG: 'Bulgaria',
  BY: 'Belarus',
  CH: 'Switzerland',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  DZ: 'Algeria',
  EG: 'Egypt',
  EE: 'Estonia',
  ES: 'Spain',
  FI: 'Finland',
  GR: 'Greece',
  HK: 'China',
  HR: 'Croatia',
  HU: 'Hungary',
  IE: 'Ireland',
  IL: 'Israel',
  IQ: 'Iraq',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  KZ: 'Kazakhstan',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MA: 'Morocco',
  MD: 'Moldova',
  MK: 'Macedonia',
  MM: 'Myanmar',
  MT: 'Malta',
  MY: 'Malaysia',
  NG: 'Nigeria',
  NO: 'Norway',
  NZ: 'New Zealand',
  PH: 'Philippines',
  PK: 'Pakistan',
  PT: 'Portugal',
  RO: 'Romania',
  RS: 'Serbia',
  SA: 'Saudi Arabia',
  SE: 'Sweden',
  SG: 'Malaysia',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TH: 'Thailand',
  TR: 'Turkey',
  TW: 'Taiwan',
  UA: 'Ukraine',
  ZA: 'South Africa',
};

/** Alias frecuentes -> nombre canónico del atlas (claves ya normalizadas). */
const ALIAS_TO_ATLAS: Readonly<Record<string, string>> = {
  alemania: 'Germany',
  'bolivia plurinational state of': 'Bolivia',
  brasil: 'Brazil',
  'brunei darussalam': 'Brunei',
  'china taiwan': 'Taiwan',
  'corea del norte': 'North Korea',
  'corea del sur': 'South Korea',
  'cote divoire': "Côte d'Ivoire",
  dprk: 'North Korea',
  'dominican republic': 'Dominican Rep.',
  'dr congo': 'Dem. Rep. Congo',
  eeuu: 'United States of America',
  'emiratos arabes unidos': 'United Arab Emirates',
  england: 'United Kingdom',
  espanya: 'Spain',
  espana: 'Spain',
  estadosunidos: 'United States of America',
  'estados unidos': 'United States of America',
  'feduracion rusa': 'Russia',
  'gran bretana': 'United Kingdom',
  holanda: 'Netherlands',
  holland: 'Netherlands',
  'iran islamic republic of': 'Iran',
  'ivory coast': "Côte d'Ivoire",
  japon: 'Japan',
  'korea democratic people s republic of': 'North Korea',
  'korea north': 'North Korea',
  'korea republic of': 'South Korea',
  'korea south': 'South Korea',
  'lao people s democratic republic': 'Laos',
  'moldova republic of': 'Moldova',
  northmacedonia: 'Macedonia',
  'north macedonia': 'Macedonia',
  polonia: 'Poland',
  'paises bajos': 'Netherlands',
  'republic of korea': 'South Korea',
  'republic of the congo': 'Congo',
  'republica checa': 'Czechia',
  'republica dominicana': 'Dominican Rep.',
  'republica eslovaca': 'Slovakia',
  'republica islamica de iran': 'Iran',
  rusia: 'Russia',
  'russian federation': 'Russia',
  'state of palestine': 'Palestine',
  suecia: 'Sweden',
  suiza: 'Switzerland',
  'syrian arab republic': 'Syria',
  'taiwan province of china': 'Taiwan',
  'the netherlands': 'Netherlands',
  turquia: 'Turkey',
  ucrania: 'Ukraine',
  uk: 'United Kingdom',
  'united states': 'United States of America',
  unitedstatesofamerica: 'United States of America',
  usa: 'United States of America',
  'venezuela bolivarian republic of': 'Venezuela',
  'viet nam': 'Vietnam',
};

/** minúsculas + sin acentos + comas como espacio + espacios colapsados. */
export function normalizeCountryName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/,/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');
}

/** Índice normalizado -> nombre canónico, solo con nombres reales del atlas. */
export function buildAtlasIndex(names: Iterable<string>): AtlasIndex {
  const index = new Map<string, string>();
  for (const name of names) {
    if (!name) continue;
    index.set(normalizeCountryName(name), name);
  }
  return index;
}

/**
 * Resuelve un país de la API al nombre exacto de una geometría del atlas.
 * Orden: coincidencia directa -> código ISO-2 -> alias -> null.
 */
export function matchCountry(
  country: string,
  index: AtlasIndex,
): string | null {
  if (!country) return null;

  const normalized = normalizeCountryName(country);
  if (!normalized) return null;

  const direct = index.get(normalized);
  if (direct !== undefined) return direct;

  if (/^[a-z]{2}$/.test(normalized)) {
    const isoTarget = ISO2_TO_ATLAS[normalized.toUpperCase()];
    if (isoTarget !== undefined && index.has(normalizeCountryName(isoTarget))) {
      return isoTarget;
    }
  }

  const aliased = ALIAS_TO_ATLAS[normalized];
  if (aliased !== undefined && index.has(normalizeCountryName(aliased))) {
    return aliased;
  }

  return null;
}
