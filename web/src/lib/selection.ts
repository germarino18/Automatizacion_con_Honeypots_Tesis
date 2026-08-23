/**
 * Guardia de interacción: evita que un click sobre una fila se procese
 * cuando el usuario estaba seleccionando texto (mouseup con selección).
 */
export function selectionHasText(selection: Selection | null | undefined): boolean {
  if (!selection || selection.isCollapsed) return false;
  return selection.toString().trim().length > 0;
}
