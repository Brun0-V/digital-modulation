import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const COLORS = {
  accent: '#d9a441',
  err: '#d46a6a',
  ok: '#8fb573',
  text: '#d4d4d4',
  strong: '#ededed',
  muted: '#a0a0a0',
  dim: '#5f5f5f',
  grid: 'rgba(255,255,255,0.06)',
  axis: 'rgba(255,255,255,0.16)',
  hover: 'rgba(217,164,65,0.10)',
  errBg: 'rgba(212,106,106,0.10)',
};

export const MONO = '10px ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';

/**
 * Canvas that redraws on resize and whenever `draw` changes.
 * `height` may be a number (px) or a function of the width.
 */
export function useCanvas(
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  height: number | ((w: number) => number),
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setWidth(c.clientWidth));
    ro.observe(c);
    setWidth(c.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !width) return;
    const h = typeof height === 'function' ? height(width) : height;
    const dpr = window.devicePixelRatio || 1;
    c.style.height = `${h}px`;
    c.width = Math.round(width * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, h);
    draw(g, width, h);
  }, [draw, width, height]);

  return ref;
}
