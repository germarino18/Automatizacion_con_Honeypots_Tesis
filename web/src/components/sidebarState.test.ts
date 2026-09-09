import { describe, expect, it } from 'vitest';

import {
  sidebarRailClass,
  sidebarToggleLabel,
  toggleSidebarMode,
  type SidebarMode,
} from './sidebarState';

describe('toggleSidebarMode', () => {
  it('alterna entre expanded y collapsed', () => {
    expect(toggleSidebarMode('expanded')).toBe('collapsed');
    expect(toggleSidebarMode('collapsed')).toBe('expanded');
  });
});

describe('sidebarToggleLabel', () => {
  it('describe la acción que ejecuta el toggle', () => {
    expect(sidebarToggleLabel('expanded')).toBe('Ocultar menú');
    expect(sidebarToggleLabel('collapsed')).toBe('Mostrar menú');
  });
});

describe('sidebarRailClass', () => {
  it('solo aplica el raíl cuando está colapsado', () => {
    expect(sidebarRailClass('collapsed')).toBe(' sidebar--collapsed');
    expect(sidebarRailClass('expanded')).toBe('');
  });

  it('es válida para cualquier SidebarMode', () => {
    const modes: SidebarMode[] = ['expanded', 'collapsed'];
    for (const mode of modes) {
      expect(sidebarRailClass(mode)).toMatch(/^ sidebar--collapsed$|^$/);
    }
  });
});