import { describe, expect, it } from 'vitest';

import { parsePayloadText } from './payload';

describe('parsePayloadText', () => {
  it('texto vacio produce un dict vacio', () => {
    expect(parsePayloadText('')).toEqual({});
    expect(parsePayloadText('   \n ')).toEqual({});
  });

  it('JSON de objeto valido se pasa tal cual', () => {
    expect(parsePayloadText('{"user":"root","port":22}')).toEqual({
      user: 'root',
      port: 22,
    });
  });

  it('texto libre se envuelve en { raw } porque la API exige un dict', () => {
    expect(parsePayloadText('intentos de login fallidos desde root')).toEqual({
      raw: 'intentos de login fallidos desde root',
    });
  });

  it('JSON valido que no es objeto (string/array/null) tambien se envuelve', () => {
    expect(parsePayloadText('"solo texto"')).toEqual({ raw: '"solo texto"' });
    expect(parsePayloadText('[1,2,3]')).toEqual({ raw: '[1,2,3]' });
    expect(parsePayloadText('null')).toEqual({ raw: 'null' });
  });
});
