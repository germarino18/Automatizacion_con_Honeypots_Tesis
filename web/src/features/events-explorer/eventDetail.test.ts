import { describe, expect, it } from 'vitest';

import { geoInfo, riskPercent, riskTone } from './eventDetail';

describe('geoInfo', () => {
  it('devuelve vacío sin enrichment data', () => {
    expect(geoInfo(null)).toEqual({});
    expect(geoInfo(undefined)).toEqual({});
  });

  it('lee country en la raíz del enrichment', () => {
    expect(geoInfo({ country: 'AR' })).toEqual({ country: 'AR' });
  });

  it('lee country anidado en geo', () => {
    expect(geoInfo({ geo: { country: 'DE' } })).toEqual({ country: 'DE' });
  });

  it('lee country anidado en geolocation', () => {
    expect(geoInfo({ geolocation: { country: 'BR' } })).toEqual({
      country: 'BR',
    });
  });

  it('da prioridad al country de nivel raíz sobre los anidados', () => {
    expect(
      geoInfo({ country: 'AR', geo: { country: 'DE' } }),
    ).toEqual({ country: 'AR' });
  });

  it('ignora paths de country vacíos', () => {
    expect(geoInfo({ country: '' })).toEqual({});
    expect(geoInfo({ geo: { country: '' } })).toEqual({});
  });

  it('lee asn cuando está presente', () => {
    expect(geoInfo({ asn: 'AS13335' })).toEqual({ asn: 'AS13335' });
  });

  it('descarta keys desconocidas', () => {
    expect(geoInfo({ nota: 'x', honeypot: 'ssh' })).toEqual({});
  });
});

describe('riskPercent', () => {
  it('devuelve null sin score', () => {
    expect(riskPercent(null)).toBeNull();
    expect(riskPercent(undefined)).toBeNull();
    expect(riskPercent(Number.NaN)).toBeNull();
  });

  it('convierte el score 0-1 a porcentaje', () => {
    expect(riskPercent(0)).toBe(0);
    expect(riskPercent(0.85)).toBe(85);
    expect(riskPercent(1)).toBe(100);
  });

  it('recorta valores fuera de rango', () => {
    expect(riskPercent(-0.5)).toBe(0);
    expect(riskPercent(-1.2)).toBe(0);
    expect(riskPercent(1.5)).toBe(100);
    expect(riskPercent(2)).toBe(100);
  });
});

describe('riskTone', () => {
  it('resuelve low sin score o score vacío', () => {
    expect(riskTone(null)).toBe('low');
    expect(riskTone(undefined)).toBe('low');
    expect(riskTone(Number.NaN)).toBe('low');
  });

  it('mapea crítico desde 0.75', () => {
    expect(riskTone(0.75)).toBe('critical');
    expect(riskTone(0.78)).toBe('critical');
    expect(riskTone(0.99)).toBe('critical');
  });

  it('mapea alto desde 0.50', () => {
    expect(riskTone(0.5)).toBe('high');
    expect(riskTone(0.64)).toBe('high');
    expect(riskTone(0.74)).toBe('high');
  });

  it('mapea medio desde 0.30', () => {
    expect(riskTone(0.3)).toBe('medium');
    expect(riskTone(0.44)).toBe('medium');
    expect(riskTone(0.49)).toBe('medium');
  });

  it('mapea bajo bajo 0.30', () => {
    expect(riskTone(0)).toBe('low');
    expect(riskTone(0.22)).toBe('low');
    expect(riskTone(0.29)).toBe('low');
    expect(riskTone(1.2)).toBe('critical');
  });
});