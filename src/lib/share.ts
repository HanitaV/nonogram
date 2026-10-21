/**
 * Puzzles in a URL: "<width>x<height>.<bits>.<name>" where bits is the
 * solution packed 8 cells per byte and both parts are base64url.
 */
import { MAX_SIZE } from './puzzleIO';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeShare(p: { width: number; height: number; solution: string[]; name: string }): string {
  const bits = p.solution.join('');
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i] === '#') bytes[i >> 3]! |= 1 << (7 - (i & 7));
  const name = toBase64Url(new TextEncoder().encode(p.name.slice(0, 60)));
  return `${p.width}x${p.height}.${toBase64Url(bytes)}${name ? '.' + name : ''}`;
}

export function decodeShare(code: string): { width: number; height: number; solution: string[]; name: string } | null {
  const m = /^(\d{1,3})x(\d{1,3})\.([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]*))?$/.exec(code);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (width < 1 || height < 1 || width > MAX_SIZE || height > MAX_SIZE) return null;
  const bytes = fromBase64Url(m[3]!);
  if (!bytes || bytes.length !== Math.ceil((width * height) / 8)) return null;
  const solution: string[] = [];
  for (let r = 0; r < height; r++) {
    let row = '';
    for (let c = 0; c < width; c++) {
      const i = r * width + c;
      row += bytes[i >> 3]! & (1 << (7 - (i & 7))) ? '#' : '.';
    }
    solution.push(row);
  }
  let name = 'Câu đố được chia sẻ';
  if (m[4]) {
    const nb = fromBase64Url(m[4]);
    if (nb) {
      try {
        name = new TextDecoder('utf-8', { fatal: true }).decode(nb).slice(0, 60) || name;
      } catch {
        /* keep default */
      }
    }
  }
  return { width, height, solution, name };
}
