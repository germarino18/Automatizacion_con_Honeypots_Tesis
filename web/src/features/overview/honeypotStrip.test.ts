import { describe, expect, it } from 'vitest';

import { buildHoneypotStrip } from './honeypotStrip';

describe('buildHoneypotStrip', () => {
  it('empty input returns empty array', () => {
    expect(buildHoneypotStrip([])).toEqual([]);
  });

  it('single entry returns 100%', () => {
    expect(buildHoneypotStrip([{ source_honeypot: 'cowrie', count: 42 }])).toEqual([
      { label: 'cowrie', count: 42, pct: 100 },
    ]);
  });

  it('max entry gets 100%, others proportionally', () => {
    const result = buildHoneypotStrip([
      { source_honeypot: 'cowrie', count: 200 },
      { source_honeypot: 'dionaea', count: 100 },
    ]);
    expect(result[0].pct).toBe(100);
    expect(result[1].pct).toBe(50);
  });

  it('rounds pct to nearest integer', () => {
    const result = buildHoneypotStrip([
      { source_honeypot: 'a', count: 3 },
      { source_honeypot: 'b', count: 2 },
    ]);
    // 2/3 * 100 = 66.666... → 67
    expect(result[1].pct).toBe(67);
  });

  it('handles ties (multiple entries at max)', () => {
    const result = buildHoneypotStrip([
      { source_honeypot: 'a', count: 100 },
      { source_honeypot: 'b', count: 100 },
      { source_honeypot: 'c', count: 50 },
    ]);
    expect(result[0].pct).toBe(100);
    expect(result[1].pct).toBe(100);
    expect(result[2].pct).toBe(50);
  });

  it('preserves label and count from input', () => {
    const result = buildHoneypotStrip([
      { source_honeypot: 'cowrie', count: 999 },
    ]);
    expect(result[0].label).toBe('cowrie');
    expect(result[0].count).toBe(999);
  });

  it('handles several values with varied proportions', () => {
    const result = buildHoneypotStrip([
      { source_honeypot: 'a', count: 1000 },
      { source_honeypot: 'b', count: 250 },
      { source_honeypot: 'c', count: 100 },
      { source_honeypot: 'd', count: 10 },
    ]);
    expect(result.map((e) => e.pct)).toEqual([100, 25, 10, 1]);
  });
});
