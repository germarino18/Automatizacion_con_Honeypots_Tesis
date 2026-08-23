import { describe, expect, it } from 'vitest';

import type { TechniqueCount } from '../../lib/api';

import { NO_TACTIC_LABEL, groupByTactic } from './grouping';

function tech(
  technique: string,
  count: number,
  tactic?: string | null,
  name?: string | null,
): TechniqueCount {
  return { technique, count, tactic: tactic ?? null, name: name ?? null };
}

describe('groupByTactic', () => {
  it('con lista vacia devuelve cero secciones', () => {
    expect(groupByTactic([])).toEqual([]);
  });

  it('agrupa por tactica en orden alfabetico y deja "Sin tactica" al final', () => {
    const sections = groupByTactic([
      tech('T1110', 5, 'Credential Access'),
      tech('T1595', 2, 'Reconnaissance'),
      tech('T1021', 3, null),
      tech('T1078', 1, 'Credential Access'),
      tech('T1105', 4, undefined),
      tech('T1190', 6, 'Initial Access'),
      tech('T1046', 2, ''),
    ]);
    expect(sections.map((section) => section.tactic)).toEqual([
      'Credential Access',
      'Initial Access',
      'Reconnaissance',
      NO_TACTIC_LABEL,
    ]);
    const credential = sections[0];
    expect(credential.items.map((item) => item.technique)).toEqual([
      'T1110',
      'T1078',
    ]);
    const noTacticIds = sections[3].items.map((item) => item.technique);
    expect(noTacticIds).toEqual(['T1105', 'T1021', 'T1046']);
  });

  it('ordena tecnicas por conteo descendente y desempata por id ascendente', () => {
    const sections = groupByTactic([
      tech('T1059', 2, 'Execution'),
      tech('T1105', 9, 'Execution'),
      tech('T1053', 9, 'Execution'),
      tech('T1204', 5, 'Execution'),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].items.map((item) => item.technique)).toEqual([
      'T1053',
      'T1105',
      'T1204',
      'T1059',
    ]);
  });

  it('calcula subtotal y maxCount por seccion para escalar barras', () => {
    const sections = groupByTactic([
      tech('T1110', 5, 'Credential Access'),
      tech('T1078', 1, 'Credential Access'),
      tech('T1190', 6, 'Initial Access'),
    ]);
    expect(sections[0].subtotal).toBe(6);
    expect(sections[0].maxCount).toBe(5);
    expect(sections[1].subtotal).toBe(6);
    expect(sections[1].maxCount).toBe(6);
  });

  it('normaliza la tactica recortando espacios antes de agrupar', () => {
    const sections = groupByTactic([
      tech('T1110', 1, '  Execution '),
      tech('T1059', 1, 'Execution'),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].tactic).toBe('Execution');
    expect(sections[0].subtotal).toBe(2);
  });
});
