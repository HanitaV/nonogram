import { FILLED, UNKNOWN } from '../types/puzzle';

/** Transparent pixels stay blank in both modes. RGB is composited over black. */
export function pixelsToDrawing(data: Uint8ClampedArray, threshold: number, darkForeground: boolean): Uint8Array {
  const drawing = new Uint8Array(data.length / 4);
  for (let i = 0; i < drawing.length; i++) {
    const offset = i * 4;
    const alpha = data[offset + 3]! / 255;
    const brightness = (0.2126 * data[offset]! + 0.7152 * data[offset + 1]! + 0.0722 * data[offset + 2]!) * alpha;
    drawing[i] = alpha >= 0.5 && (darkForeground ? brightness < threshold : brightness >= threshold) ? FILLED : UNKNOWN;
  }
  return drawing;
}
