import { describe, expect, it } from 'vitest';
import { rupeesToPaise } from './money.js';

describe('rupeesToPaise', () => {
  it('turns rupees into whole paise', () => {
    expect(rupeesToPaise.parse(1200)).toBe(120000);
    expect(rupeesToPaise.parse(12.5)).toBe(1250);
    expect(rupeesToPaise.parse(0.01)).toBe(1);
  });

  it('handles amounts that are inexact in floating point', () => {
    // 4.35 * 100 is 434.99999999999994 in JavaScript.
    expect(rupeesToPaise.parse(4.35)).toBe(435);
    expect(rupeesToPaise.parse(0.1 + 0.2)).toBe(30);
  });

  it('rejects zero, negatives, too many decimals and huge amounts', () => {
    for (const bad of [0, -5, 1.005, 10_000_001, 'abc']) {
      expect(rupeesToPaise.safeParse(bad).success).toBe(false);
    }
  });
});
