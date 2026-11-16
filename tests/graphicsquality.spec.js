import { expect, test } from '@playwright/test';
import { drawingDensity, slowRendering } from '../src/graphicsquality.js';

test('power-saving refresh rates do not force the game into coarse graphics', () => {
  for (const frameMs of [33.3, 50, 66.7]) expect(slowRendering(frameMs, 5)).toBe(false);
  expect(slowRendering(33.3, 20)).toBe(true);
  expect(slowRendering(16.7, 15)).toBe(false);
});

test('fast mode preserves screen detail on phones and respects a bounded pixel budget', () => {
  expect(drawingDensity(390, 844, true, 3)).toBe(1);
  expect(drawingDensity(1280, 800, true, 1)).toBeGreaterThan(.9);
  expect(drawingDensity(390, 844, false, 3)).toBe(2);
  for (const fast of [true, false]) {
    const density = drawingDensity(3840, 2160, fast, 2);
    expect(density * density * 3840 * 2160).toBeLessThanOrEqual((fast ? 1_000_000 : 4_000_000) + 1);
  }
});
