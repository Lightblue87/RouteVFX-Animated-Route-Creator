import { describe, expect, it } from 'vitest';
import { suggestProfile } from '../../src/adapters/encoding/capabilities';
import type { ExportCapability } from '../../src/core/types';

const caps = (avail: string[]): ExportCapability[] =>
  (['1080p30', '1080p60', '4k30', '4k60'] as const).map((p) => ({ profile: p, available: avail.includes(p) }));

describe('suggestProfile (Rückstufung statt Fehlschlag)', () => {
  it('keeps the wanted profile when available', () => {
    expect(suggestProfile(caps(['1080p30', '4k60']), '4k60')).toBe('4k60');
  });
  it('steps down 4k60 → 4k30 → 1080p60 → 1080p30', () => {
    expect(suggestProfile(caps(['1080p30', '1080p60', '4k30']), '4k60')).toBe('4k30');
    expect(suggestProfile(caps(['1080p30', '1080p60']), '4k60')).toBe('1080p60');
    expect(suggestProfile(caps(['1080p30']), '4k30')).toBe('1080p30');
  });
  it('never suggests a higher profile than wanted and returns null if none', () => {
    expect(suggestProfile(caps(['4k60']), '1080p30')).toBeNull();
    expect(suggestProfile(caps([]), '4k60')).toBeNull();
  });
});
