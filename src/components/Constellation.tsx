import { useCallback } from 'react';
import type { Simulation } from '../dsp/pipeline';
import { COLORS, MONO, useCanvas } from './useCanvas';

const PAD = 22;

interface Props {
  sim: Simulation;
  showLabels: boolean;
  hover: number | null;
  onHover: (n: number | null) => void;
}

/** I/Q diagram: ideal points, decision boundaries, and received points. */
export function Constellation({ sim, showLabels, hover, onHover }: Props) {
  const { alpha, cfg, demod, symbols } = sim;
  const M = alpha.length;
  const R = 1.4;

  const draw = useCallback(
    (g: CanvasRenderingContext2D, w: number, h: number) => {
      const size = Math.min(w, h) - 2 * PAD;
      const cx = w / 2;
      const cy = h / 2;
      const X = (i: number) => cx + (i / R) * (size / 2);
      const Y = (q: number) => cy - (q / R) * (size / 2);
      g.font = MONO;

      // Frame, axes and unit circle.
      g.strokeStyle = COLORS.grid;
      g.lineWidth = 1;
      g.strokeRect(Math.round(X(-R)) + 0.5, Math.round(Y(R)) + 0.5, size, size);
      g.strokeStyle = COLORS.axis;
      g.beginPath();
      g.moveTo(X(-R), Math.round(cy) + 0.5);
      g.lineTo(X(R), Math.round(cy) + 0.5);
      g.moveTo(Math.round(cx) + 0.5, Y(-R));
      g.lineTo(Math.round(cx) + 0.5, Y(R));
      g.stroke();
      g.fillStyle = COLORS.dim;
      g.textAlign = 'left';
      g.textBaseline = 'bottom';
      g.fillText('I', X(R) - 8, cy - 3);
      g.fillText('Q', cx + 5, Y(R) + 12);
      g.textAlign = 'center';
      g.textBaseline = 'top';
      for (const v of [-1, 1]) {
        g.fillText(String(v), X(v), cy + 3);
        g.beginPath();
        g.moveTo(X(v), cy - 3);
        g.lineTo(X(v), cy + 3);
        g.stroke();
      }

      // Decision boundaries.
      g.save();
      g.beginPath();
      g.rect(X(-R), Y(R), size, size);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.13)';
      g.setLineDash([3, 4]);
      g.beginPath();
      if (cfg.scheme === 'QAM') {
        const L = Math.round(Math.sqrt(M));
        for (let p = 0; p < L - 1; p++) {
          const v = (2 * p + 1 - (L - 1)) / (L - 1);
          g.moveTo(X(v), Y(R));
          g.lineTo(X(v), Y(-R));
          g.moveTo(X(-R), Y(v));
          g.lineTo(X(R), Y(v));
        }
      } else if (cfg.scheme === 'PSK') {
        for (const d of alpha) {
          const a = d.phase + Math.PI / M;
          g.moveTo(cx, cy);
          g.lineTo(X(2 * R * Math.cos(a)), Y(2 * R * Math.sin(a)));
        }
      } else if (cfg.scheme === 'ASK') {
        for (let p = 0; p < M - 1; p++) {
          const v = (p + 0.5) / (M - 1);
          g.moveTo(X(v), Y(R));
          g.lineTo(X(v), Y(-R));
        }
      }
      g.stroke();
      g.setLineDash([]);
      if (cfg.scheme === 'PSK') {
        g.strokeStyle = COLORS.grid;
        g.beginPath();
        g.arc(cx, cy, size / 2 / R, 0, 2 * Math.PI);
        g.stroke();
      }

      // Received points.
      const dot = M >= 64 ? 1.8 : 2.2;
      demod.points.forEach((p, n) => {
        const bad = demod.symbols[n] !== symbols[n];
        g.fillStyle = bad ? 'rgba(212,106,106,0.85)' : 'rgba(212,212,212,0.55)';
        g.beginPath();
        g.arc(X(p.i), Y(p.q), dot, 0, 2 * Math.PI);
        g.fill();
      });
      g.restore();

      // Ideal points and labels.
      const r = M >= 256 ? 2.2 : M >= 64 ? 3 : 4;
      const used = new Set(symbols);
      for (const d of alpha) {
        g.fillStyle = used.has(d.value) ? COLORS.accent : 'rgba(217,164,65,0.35)';
        g.beginPath();
        g.arc(X(d.i), Y(d.q), r, 0, 2 * Math.PI);
        g.fill();
      }
      if (showLabels) {
        g.font = M >= 64 ? '8px ui-monospace, SFMono-Regular, Menlo, monospace' : MONO;
        g.textAlign = 'center';
        g.textBaseline = 'bottom';
        g.fillStyle = COLORS.text;
        // 256 labels don't fit: only label the points involved in the hovered symbol.
        const labelled =
          M >= 256
            ? hover !== null && hover < symbols.length
              ? [alpha[symbols[hover]], alpha[demod.symbols[hover]]]
              : []
            : alpha;
        for (const d of labelled) g.fillText(d.bits, X(d.i), Y(d.q) - r - 2);
        g.font = MONO;
      }

      // Hovered symbol: line from what was sent to what was received.
      if (hover !== null && hover < symbols.length) {
        const sent = alpha[symbols[hover]];
        const got = demod.points[hover];
        const bad = demod.symbols[hover] !== symbols[hover];
        g.strokeStyle = bad ? COLORS.err : COLORS.strong;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(X(sent.i), Y(sent.q));
        g.lineTo(X(got.i), Y(got.q));
        g.stroke();
        g.beginPath();
        g.arc(X(sent.i), Y(sent.q), r + 4, 0, 2 * Math.PI);
        g.stroke();
        g.fillStyle = bad ? COLORS.err : COLORS.strong;
        g.beginPath();
        g.arc(X(got.i), Y(got.q), 4, 0, 2 * Math.PI);
        g.fill();
      }
    },
    [alpha, cfg.scheme, demod, symbols, M, showLabels, hover],
  );
  const ref = useCanvas(draw, (w) => Math.min(w, 460));

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const size = Math.min(w, h) - 2 * PAD;
    const i = ((e.nativeEvent.offsetX - w / 2) / (size / 2)) * R;
    const q = (-(e.nativeEvent.offsetY - h / 2) / (size / 2)) * R;
    const tol = (8 / (size / 2)) * R;
    let best: number | null = null;
    let bestD = tol * tol;
    demod.points.forEach((p, n) => {
      const d = (p.i - i) ** 2 + (p.q - q) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    });
    onHover(best);
  };

  return <canvas ref={ref} className="plot-canvas constellation" onMouseMove={onMove} onMouseLeave={() => onHover(null)} />;
}
