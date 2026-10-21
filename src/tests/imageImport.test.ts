import { describe, expect, it } from 'vitest';
import { pixelsToDrawing } from '../lib/imageImport';

describe('image conversion', () => {
  it('retains the navy, red and orange logo on a black background', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255, 28, 56, 99, 255, 240, 20, 30, 255, 255, 150, 0, 255,
    ]);
    expect([...pixelsToDrawing(pixels, 24, false)]).toEqual([0, 1, 1, 1]);
    expect([...pixelsToDrawing(pixels, 100, false)]).toEqual([0, 0, 0, 1]);
  });

  it('supports dark shapes on white and leaves transparent pixels blank in both modes', () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 0]);
    expect([...pixelsToDrawing(pixels, 128, true)]).toEqual([1, 0, 0, 0]);
    expect([...pixelsToDrawing(pixels, 128, false)]).toEqual([0, 1, 0, 0]);
  });
});
