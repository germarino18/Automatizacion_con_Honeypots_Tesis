import { describe, expect, it } from 'vitest';

import { selectionHasText } from './selection';

function fakeSelection(
  collapsed: boolean,
  text: string,
  exists = true,
): Selection | null {
  if (!exists) return null;
  return {
    isCollapsed: collapsed,
    toString: () => text,
  } as unknown as Selection;
}

describe('selectionHasText', () => {
  it('devuelve false sin objeto Selection (click simple)', () => {
    expect(selectionHasText(null)).toBe(false);
  });

  it('devuelve false cuando la selección está colapsada', () => {
    expect(selectionHasText(fakeSelection(true, 'texto'))).toBe(false);
  });

  it('devuelve false cuando la selección solo tiene espacios', () => {
    expect(selectionHasText(fakeSelection(false, '   '))).toBe(false);
  });

  it('devuelve true cuando hay texto seleccionado de verdad', () => {
    expect(selectionHasText(fakeSelection(false, 'rm -rf /'))).toBe(true);
  });
});
