import { FILLED } from '../../types/puzzle';

/**
 * Small picture of a board. Shows the player's own progress, or the finished
 * picture once solved; never the answer of an unsolved puzzle.
 */
export function Thumbnail({
  width,
  height,
  cells,
  size = 56,
  faded = false,
}: {
  width: number;
  height: number;
  cells: ArrayLike<number> | null;
  size?: number;
  faded?: boolean;
}) {
  const unit = size / Math.max(width, height);
  const w = width * unit;
  const h = height * unit;
  const rects = [];
  if (cells) {
    for (let i = 0; i < width * height; i++) {
      if (cells[i] === FILLED) {
        rects.push(<rect key={i} x={(i % width) * unit} y={Math.floor(i / width) * unit} width={unit + 0.02} height={unit + 0.02} />);
      }
    }
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="block shrink-0">
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="var(--sheet)" stroke="var(--rule)" />
      {!cells && (
        <g stroke="var(--rule)" strokeWidth={0.5}>
          {Array.from({ length: Math.floor((width - 1) / 5) }, (_, k) => (
            <line key={`v${k}`} x1={(k + 1) * 5 * unit} y1={0} x2={(k + 1) * 5 * unit} y2={h} />
          ))}
          {Array.from({ length: Math.floor((height - 1) / 5) }, (_, k) => (
            <line key={`h${k}`} x1={0} y1={(k + 1) * 5 * unit} x2={w} y2={(k + 1) * 5 * unit} />
          ))}
        </g>
      )}
      <g fill="var(--fill)" opacity={faded ? 0.45 : 1}>
        {rects}
      </g>
    </svg>
  );
}
