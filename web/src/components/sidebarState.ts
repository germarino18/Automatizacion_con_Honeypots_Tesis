export type SidebarMode = 'expanded' | 'collapsed';

export function toggleSidebarMode(mode: SidebarMode): SidebarMode {
  return mode === 'collapsed' ? 'expanded' : 'collapsed';
}

export function sidebarToggleLabel(mode: SidebarMode): string {
  return mode === 'collapsed' ? 'Mostrar menú' : 'Ocultar menú';
}

export function sidebarRailClass(mode: SidebarMode): string {
  return mode === 'collapsed' ? ' sidebar--collapsed' : '';
}