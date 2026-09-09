export interface HoneypotStripEntry {
  label: string;
  count: number;
  pct: number;
}

/**
 * Build horizontal strip data for the hero card's bottom honeypot
 * distribution bar. `pct` is relative to the max count (always ≥1),
 * rounded to the nearest integer.
 */
export function buildHoneypotStrip(
  entries: { source_honeypot: string; count: number }[],
): HoneypotStripEntry[] {
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map((e) => e.count), 1);
  return entries.map((e) => ({
    label: e.source_honeypot,
    count: e.count,
    pct: Math.round((e.count / max) * 100),
  }));
}
