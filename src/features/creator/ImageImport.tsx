import { useEffect, useMemo, useRef, useState } from 'react';
import { pixelsToDrawing } from '../../lib/imageImport';
import { PUZZLE_SIZES } from '../../lib/puzzleLimits';
import { FILLED } from '../../types/puzzle';

export function ImageImport({ onApply }: { onApply: (drawing: Uint8Array, width: number, height: number, name: string) => void }) {
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState(150);
  const [threshold, setThreshold] = useState(24);
  const [dark, setDark] = useState(false);
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => () => source?.close(), [source]);

  const converted = useMemo(() => {
    if (!source) return null;
    const ratio = size / Math.max(source.width, source.height);
    const width = Math.max(1, Math.round(source.width * ratio));
    const height = Math.max(1, Math.round(source.height * ratio));
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, width, height);
    return { width, height, drawing: pixelsToDrawing(ctx.getImageData(0, 0, width, height).data, threshold, dark) };
  }, [source, size, threshold, dark]);

  useEffect(() => {
    if (!converted || !canvas.current) return;
    const { width, height, drawing } = converted;
    const ctx = canvas.current.getContext('2d');
    if (!ctx) return;
    const pixels = ctx.createImageData(width, height);
    drawing.forEach((value, i) => {
      const color = value === FILLED ? 32 : 250;
      pixels.data.set([color, color, color, 255], i * 4);
    });
    ctx.putImageData(pixels, 0, 0);
  }, [converted]);

  const load = async (file: File) => {
    const ticket = ++request.current;
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      if (ticket !== request.current) { bitmap.close(); return; }
      setSource(bitmap);
      setName(file.name.replace(/\.[^.]+$/, '').slice(0, 60));
    } catch {
      if (ticket === request.current) setError('Không đọc được ảnh. Hãy chọn ảnh PNG, JPEG hoặc WebP.');
    }
  };

  return (
    <div className="space-y-3 border-t border-rule pt-4">
      <button type="button" className="btn btn-line" onClick={() => fileRef.current?.click()}>Nhập ảnh</button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void load(file);
        e.target.value = '';
      }} />
      {converted && <>
        <label className="block text-sm">Cạnh dài (ô)
          <select className="field ml-2" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {PUZZLE_SIZES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm">Ngưỡng sáng: {threshold}
          <input className="mt-2 w-full" type="range" min={1} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />Đảo màu (hình tối, nền sáng)</label>
        <canvas ref={canvas} width={converted.width} height={converted.height} className="w-full border border-rule" style={{ imageRendering: 'pixelated' }} role="img" aria-label={`Ảnh chuyển đổi đen trắng, ${converted.width} × ${converted.height} ô`} />
        <p className="text-sm text-pencil">{converted.width} × {converted.height} ô · Đen trắng, giữ tỉ lệ ảnh. Áp dụng sẽ thay bản vẽ hiện tại.</p>
        <button type="button" className="btn btn-line" onClick={() => onApply(converted.drawing.slice(), converted.width, converted.height, name)}>Áp dụng ảnh vào lưới</button>
      </>}
      {error && <p role="alert" className="text-sm text-redpen">{error}</p>}
    </div>
  );
}
