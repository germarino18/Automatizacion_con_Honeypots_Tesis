import { describe, expect, it } from 'vitest';

import { isValidIpv4, parseOptionalDuration } from './validators';

describe('isValidIpv4', () => {
  it('acepta IPv4 validas', () => {
    expect(isValidIpv4('8.8.8.8')).toBe(true);
    expect(isValidIpv4('192.168.1.100')).toBe(true);
    expect(isValidIpv4('0.0.0.0')).toBe(true);
    expect(isValidIpv4('255.255.255.255')).toBe(true);
  });

  it('rechaza formatos invalidos', () => {
    expect(isValidIpv4('256.1.1.1')).toBe(false);
    expect(isValidIpv4('8.8.8')).toBe(false);
    expect(isValidIpv4('1.2.3.4.5')).toBe(false);
    expect(isValidIpv4('abc')).toBe(false);
    expect(isValidIpv4('')).toBe(false);
    expect(isValidIpv4('2001:db8::1')).toBe(false);
  });
});

describe('parseOptionalDuration', () => {
  it('campo vacio (o espacios) -> null, la API lo trata como opcional', () => {
    expect(parseOptionalDuration('')).toEqual({ ok: true, seconds: null });
    expect(parseOptionalDuration('   ')).toEqual({ ok: true, seconds: null });
  });

  it('entero >= 0 se acepta y recorta espacios', () => {
    expect(parseOptionalDuration('3600')).toEqual({ ok: true, seconds: 3600 });
    expect(parseOptionalDuration(' 600 ')).toEqual({ ok: true, seconds: 600 });
    expect(parseOptionalDuration('0')).toEqual({ ok: true, seconds: 0 });
  });

  it('negativos, decimales o no numericos son invalidos', () => {
    expect(parseOptionalDuration('-5')).toEqual({ ok: false });
    expect(parseOptionalDuration('12.5')).toEqual({ ok: false });
    expect(parseOptionalDuration('abc')).toEqual({ ok: false });
    expect(parseOptionalDuration('1e3')).toEqual({ ok: false });
  });
});
