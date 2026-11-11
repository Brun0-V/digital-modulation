import { useCallback } from 'react';
import type { Simulation } from '../dsp/pipeline';
import { COLORS, MONO, useCanvas } from './useCanvas';

interface Props {
  sim: Simulation;
  /** Symbol whose detector outputs are shown. */
  n: number;
}

/** Bar chart of the energy each tone's correlator measured for one symbol. */
export function FskEnergy({ sim, n }: Props) {
  const { alpha, demod, symbols } = sim;
  const energies = demod.energies[n] ?? [];
  const sent = symbols[n];
  const got = demod.symbols[n];

  const draw = useCallback(
    (g: CanvasRenderingContext2D, w: number, h: number) => {
      const order = [...alpha].sort((a, b) => a.pos - b.pos);
      const top = 16;
      const bottom = 30;
      const left = 8;
      const plotH = h - top - bottom;
      const bw = (w - 2 * left) / order.length;
      const eMax = Math.max(1.2, ...energies);
      g.font = MONO;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.strokeStyle = COLORS.axis;
      g.beginPath();
      g.moveTo(left, top + plotH + 0.5);
      g.lineTo(w - left, top + plotH + 0.5);
      g.stroke();
      // Reference line at the energy of a clean tone.
      const yRef = top + plotH - (1 / eMax) * plotH;
      g.strokeStyle = COLORS.grid;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(left, Math.round(yRef) + 0.5);
      g.lineTo(w - left, Math.round(yRef) + 0.5);
      g.stroke();
      g.setLineDash([]);

      order.forEach((d, k) => {
        const e = energies[d.value] ?? 0;
        const x = left + k * bw;
        const bh = (e / eMax) * plotH;
        const isGot = d.value === got;
        const isSent = d.value === sent;
        g.fillStyle = isGot ? (got === sent ? COLORS.accent : COLORS.err) : '#3a3a3a';
        g.fillRect(x + bw * 0.15, top + plotH - bh, bw * 0.7, bh);
        if (isSent) {
          g.strokeStyle = COLORS.strong;
          g.strokeRect(x + bw * 0.15 + 0.5, top + plotH - bh + 0.5, bw * 0.7 - 1, Math.max(bh - 1, 1));
        }
        g.fillStyle = isSent || isGot ? COLORS.text : COLORS.dim;
        if (g.measureText(d.bits).width < bw - 1) g.fillText(d.bits, x + bw / 2, top + plotH + 9);
        const f = `f${d.freq}`;
        g.fillStyle = COLORS.dim;
        if (g.measureText(f).width < bw - 1) g.fillText(f, x + bw / 2, top + plotH + 22);
      });
    },
    [alpha, energies, sent, got],
  );
  const ref = useCanvas(draw, 170);
  return <canvas ref={ref} className="plot-canvas" />;
}
