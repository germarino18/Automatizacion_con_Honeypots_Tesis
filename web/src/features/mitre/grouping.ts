/*
 * Agrupación de técnicas MITRE ATT&CK por táctica para la Matriz.
 * Política de orden (documentada): las tácticas se ordenan alfabéticamente
 * (comparación base, independiente del locale del host) y la sección
 * "Sin táctica" — bucket para técnica/táctica ausente o vacía — siempre
 * queda al final porque es un fallback, no una táctica real.
 */

import type { TechniqueCount } from '../../lib/api';

export const NO_TACTIC_LABEL = 'Sin táctica';

export interface MitreSection {
  tactic: string;
  subtotal: number;
  maxCount: number;
  items: TechniqueCount[];
}

function tacticOf(entry: TechniqueCount): string {
  const trimmed = entry.tactic?.trim();
  return trimmed ? trimmed : NO_TACTIC_LABEL;
}

/** Agrupa técnicas por táctica: secciones ordenadas, ítems por conteo desc. */
export function groupByTactic(techniques: TechniqueCount[]): MitreSection[] {
  const buckets = new Map<string, TechniqueCount[]>();
  for (const entry of techniques) {
    const key = tacticOf(entry);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  }

  const sections: MitreSection[] = [];
  for (const [tactic, items] of buckets) {
    const sorted = [...items].sort(
      (a, b) =>
        b.count - a.count ||
        a.technique.localeCompare(b.technique, 'es', { sensitivity: 'base' }),
    );
    sections.push({
      tactic,
      subtotal: sorted.reduce((sum, item) => sum + item.count, 0),
      maxCount: sorted.reduce((max, item) => Math.max(max, item.count), 0),
      items: sorted,
    });
  }

  return sections.sort((a, b) => {
    if (a.tactic === NO_TACTIC_LABEL) return 1;
    if (b.tactic === NO_TACTIC_LABEL) return -1;
    return a.tactic.localeCompare(b.tactic, 'es', { sensitivity: 'base' });
  });
}
