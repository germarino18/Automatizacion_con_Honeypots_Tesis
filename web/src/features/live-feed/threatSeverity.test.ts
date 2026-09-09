import { describe, expect, it } from 'vitest';

import { THREAT_TONE_LABEL, threatSeverityTone } from './threatSeverity';

describe('threatSeverityTone', () => {
  it('maps each severity to its own tone', () => {
    expect(threatSeverityTone('critical')).toBe('critical');
    expect(threatSeverityTone('high')).toBe('high');
    expect(threatSeverityTone('medium')).toBe('medium');
    expect(threatSeverityTone('low')).toBe('low');
  });

  it('maps missing severity to unknown', () => {
    expect(threatSeverityTone(undefined)).toBe('unknown');
    expect(threatSeverityTone(null as unknown as undefined)).toBe('unknown');
  });

  it('label suffix per tone (unknown has no suffix)', () => {
    expect(THREAT_TONE_LABEL.critical).toBe('crítica');
    expect(THREAT_TONE_LABEL.high).toBe('alta');
    expect(THREAT_TONE_LABEL.medium).toBe('media');
    expect(THREAT_TONE_LABEL.low).toBe('baja');
    expect(THREAT_TONE_LABEL.unknown).toBeUndefined();
  });
});
