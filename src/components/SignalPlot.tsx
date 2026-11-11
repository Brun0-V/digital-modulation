import { useCallback } from 'react';
import { COLORS, MONO, useCanvas } from './useCanvas';

const LEFT = 38;
const TOP = 18;
const BOTTOM = 16;

interface Props {
  signal: Float64Array;
  /** Faint reference trace drawn underneath (e.g. the clean Tx signal). */
  ghost?: Float64Array;
  ns: number;
  start: number;
  count: number;
  /** Text shown above each symbol (its bits). */
  labels: string[];
  errors?: boolean[];
  yMax: number;
  color: string;
  height?: number;
  hover: number | null;
  onHover: (n: number | null) => void;
}

/** Time-domain plot of a window of symbols. */
export function SignalPlot({ signal, ghost, ns, start, count, labels, errors, yMax, color, height = 150, hover, onHover }: Props) {
  const draw = useCallback(
    (g: CanvasRenderingContext2D, w: number, h: number) => {
      const plotW = w - LEFT - 6;
      const plotH = h - TOP - BOTTOM;
      const symW = plotW / count;
      const X = (sample: number) => LEFT + ((sample - start * ns) / ns) * symW;
      const Y = (v: number) => TOP + plotH / 2 - (v / yMax) * (plotH / 2);
      const total = signal.length / ns;
      g.font = MONO;
      g.textBaseline = 'middle';

      // Symbol cells: hover / error shading, boundaries, bit labels.
      for (let k = 0; k < count; k++) {
        const n = start + k;
        const x0 = LEFT + k * symW;
        if (n >= total) {
          g.fillStyle = 'rgba(255,255,255,0.015)';
          g.fillRect(x0, TOP, symW, plotH);
          continue;
        }
        if (errors?.[n]) {
          g.fillStyle = COLORS.errBg;
          g.fillRect(x0, TOP, symW, plotH);
        }
        if (n === hover) {
          g.fillStyle = COLORS.hover;
          g.fillRect(x0, 0, symW, h);
        }
        const label = labels[n] ?? '';
        g.textAlign = 'center';
        if (g.measureText(label).width < symW - 4) {
          g.fillStyle = errors?.[n] ? COLORS.err : n === hover ? COLORS.accent : COLORS.muted;
          g.fillText(label, x0 + symW / 2, TOP / 2);
        }
        const idx = String(n);
        if (g.measureText(idx).width < symW - 4) {
          g.fillStyle = COLORS.dim;
          g.fillText(idx, x0 + symW / 2, h - BOTTOM / 2);
        }
      }
      g.strokeStyle = COLORS.grid;
      g.lineWidth = 1;
      for (let k = 0; k <= count; k++) {
        const x = Math.round(LEFT + k * symW) + 0.5;
        g.beginPath();
        g.moveTo(x, TOP);
        g.lineTo(x, TOP + plotH);
        g.stroke();
      }

      // Y axis: 0 and ±yMax/2 ticks.
      g.textAlign = 'right';
      for (const v of [yMax * 0.8, yMax * 0.4, 0, -yMax * 0.4, -yMax * 0.8]) {
        const y = Math.round(Y(v)) + 0.5;
        g.strokeStyle = v === 0 ? COLORS.axis : COLORS.grid;
        g.beginPath();
        g.moveTo(LEFT, y);
        g.lineTo(LEFT + plotW, y);
        g.stroke();
        g.fillStyle = COLORS.dim;
        g.fillText(v === 0 ? '0' : v.toFixed(Math.abs(v) < 1 ? 2 : 1), LEFT - 5, y);
      }

      const from = start * ns;
      const to = Math.min(signal.length, (start + count) * ns + 1);
      const trace = (s: Float64Array, stroke: string, width: number) => {
        g.save();
        g.beginPath();
        g.rect(LEFT, TOP, plotW, plotH);
        g.clip();
        g.strokeStyle = stroke;
        g.lineWidth = width;
        g.lineJoin = 'round';
        g.beginPath();
        for (let i = from; i < to; i++) {
          const x = X(i);
          const y = Y(s[i]);
          if (i === from) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        g.restore();
      };
      if (ghost) trace(ghost, 'rgba(217,164,65,0.45)', 1);
      trace(signal, color, ghost ? 1 : 1.5);
    },
    [signal, ghost, ns, start, count, labels, errors, yMax, color, hover],
  );
  const ref = useCanvas(draw, height);

  const symbolAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const w = e.currentTarget.clientWidth;
    const k = Math.floor(((e.nativeEvent.offsetX - LEFT) / (w - LEFT - 6)) * count);
    const n = start + k;
    return k >= 0 && k < count && n < signal.length / ns ? n : null;
  };

  return (
    <canvas
      ref={ref}
      className="plot-canvas"
      onMouseMove={(e) => onHover(symbolAt(e))}
      onMouseLeave={() => onHover(null)}
    />
  );
}
