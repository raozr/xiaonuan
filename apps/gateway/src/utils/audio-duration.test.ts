import { describe, expect, it } from 'vitest';
import { estimatePcm16MonoDurationSec } from './audio-duration.js';

describe('estimatePcm16MonoDurationSec', () => {
  it('estimates 16kHz 16-bit mono wav duration from byte length', () => {
    expect(estimatePcm16MonoDurationSec(44 + 32_000)).toBe(1);
    expect(estimatePcm16MonoDurationSec(44 + 80_000)).toBe(2.5);
  });

  it('returns zero for missing or header-only audio', () => {
    expect(estimatePcm16MonoDurationSec(0)).toBe(0);
    expect(estimatePcm16MonoDurationSec(44)).toBe(0);
  });
});
