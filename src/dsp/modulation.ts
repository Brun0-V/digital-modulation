import { bitsToInt, bitString, intToBits, type Bit } from './bits';
import { gaussian, mulberry32 } from './rng';

export type Scheme = 'ASK' | 'FSK' | 'PSK' | 'QAM';

export const SCHEMES: Scheme[] = ['ASK', 'FSK', 'PSK', 'QAM'];

/** Bits per symbol allowed for each scheme. */
export const BITS_OPTIONS: Record<Scheme, number[]> = {
  ASK: [1, 2, 3, 4],
  FSK: [1, 2, 3, 4],
  PSK: [1, 2, 3, 4],
  QAM: [2, 4, 6, 8],
};

export const DEFAULT_BITS: Record<Scheme, number> = { ASK: 1, FSK: 1, PSK: 2, QAM: 4 };

export interface ModConfig {
  scheme: Scheme;
  /** Bits per symbol. M = 2^k. */
  k: number;
  gray: boolean;
  /** Carrier frequency in cycles per symbol (FSK: lowest tone). */
  fc: number;
}

export function schemeName(scheme: Scheme, k: number): string {
  const M = 1 << k;
  if (scheme === 'PSK' && k === 1) return 'BPSK';
  if (scheme === 'PSK' && k === 2) return 'QPSK';
  if (scheme === 'FSK' && k === 1) return 'BFSK';
  if (scheme === 'ASK' && k === 1) return 'OOK (2-ASK)';
  return `${M}-${scheme}`;
}

export const gray = (n: number) => n ^ (n >> 1);

export function grayInverse(g: number): number {
  let n = g;
  for (let s = g >> 1; s; s >>= 1) n ^= s;
  return n;
}

/** One symbol of the alphabet. Indexed by its bit value. */
export interface SymbolDef {
  value: number;
  bits: string;
  /** Position along the axis / circle / frequency ladder (after Gray mapping). */
  pos: number;
  /** In-phase and quadrature coordinates (unused for FSK). */
  i: number;
  q: number;
  amp: number;
  /** Phase in radians. */
  phase: number;
  /** Frequency in cycles per symbol. */
  freq: number;
}

/** Builds the symbol alphabet. `result[v]` is the symbol sent for bit value v. */
export function alphabet(cfg: ModConfig): SymbolDef[] {
  const { scheme, k, fc } = cfg;
  const M = 1 << k;
  const toPos = (v: number) => (cfg.gray ? grayInverse(v) : v);
  const out: SymbolDef[] = [];
  for (let v = 0; v < M; v++) {
    const base = { value: v, bits: bitString(v, k) };
    if (scheme === 'QAM') {
      const h = k / 2;
      const L = 1 << h;
      const pi = toPos(v >> h);
      const pq = toPos(v & (L - 1));
      const i = (2 * pi - (L - 1)) / (L - 1);
      const q = (2 * pq - (L - 1)) / (L - 1);
      out.push({ ...base, pos: pi * L + pq, i, q, amp: Math.hypot(i, q), phase: Math.atan2(q, i), freq: fc });
    } else if (scheme === 'PSK') {
      const p = toPos(v);
      const phase = (2 * Math.PI * p) / M + (M === 4 ? Math.PI / 4 : 0);
      out.push({ ...base, pos: p, i: Math.cos(phase), q: Math.sin(phase), amp: 1, phase, freq: fc });
    } else if (scheme === 'ASK') {
      const p = toPos(v);
      const amp = p / (M - 1);
      out.push({ ...base, pos: p, i: amp, q: 0, amp, phase: 0, freq: fc });
    } else {
      const p = toPos(v);
      out.push({ ...base, pos: p, i: 0, q: 0, amp: 1, phase: 0, freq: fc + p });
    }
  }
  return out;
}

/** Highest frequency in the signal, in cycles per symbol. */
export function maxFreq(cfg: ModConfig): number {
  return cfg.scheme === 'FSK' ? cfg.fc + (1 << cfg.k) - 1 : cfg.fc;
}

/** Samples per symbol: enough for smooth plots of the highest tone. */
export function samplesPerSymbol(cfg: ModConfig): number {
  return Math.max(96, 24 * maxFreq(cfg));
}

/** Average symbol energy (symbol time = 1). */
export function averageEnergy(alpha: SymbolDef[], scheme: Scheme): number {
  if (scheme === 'FSK') return 0.5;
  return alpha.reduce((s, d) => s + (d.i * d.i + d.q * d.q) / 2, 0) / alpha.length;
}

/** Groups bits into symbol values, padding the last word with zeros. */
export function bitsToSymbols(bits: Bit[], k: number): { symbols: number[]; padded: Bit[] } {
  const padded = [...bits];
  while (padded.length % k) padded.push(0);
  const symbols: number[] = [];
  for (let i = 0; i < padded.length; i += k) symbols.push(bitsToInt(padded, i, k));
  return { symbols, padded };
}

export function symbolsToBits(symbols: number[], k: number): Bit[] {
  return symbols.flatMap((s) => intToBits(s, k));
}

/** Passband signal: s(t) = I·cos(2π fc t) − Q·sin(2π fc t), or a tone per symbol for FSK. */
export function modulate(cfg: ModConfig, alpha: SymbolDef[], symbols: number[], ns: number): Float64Array {
  const out = new Float64Array(symbols.length * ns);
  symbols.forEach((v, n) => {
    const d = alpha[v];
    for (let j = 0; j < ns; j++) {
      const t = n + j / ns;
      const idx = n * ns + j;
      if (cfg.scheme === 'FSK') out[idx] = Math.cos(2 * Math.PI * d.freq * t);
      else out[idx] = d.i * Math.cos(2 * Math.PI * cfg.fc * t) - d.q * Math.sin(2 * Math.PI * cfg.fc * t);
    }
  });
  return out;
}

/**
 * Adds white Gaussian noise for a given Es/N0 (dB).
 * Per-sample variance σ² = (N0/2)·Ns, so after the correlator each I/Q
 * coordinate carries noise with variance N0.
 */
export function awgn(tx: Float64Array, es: number, esn0dB: number, ns: number, seed: number): Float64Array {
  const n0 = es / 10 ** (esn0dB / 10);
  const sigma = Math.sqrt((n0 / 2) * ns);
  const rand = mulberry32(seed);
  const out = new Float64Array(tx.length);
  for (let i = 0; i < tx.length; i++) out[i] = tx[i] + sigma * gaussian(rand);
  return out;
}

export interface DemodResult {
  /** Decided symbol values. */
  symbols: number[];
  /** Correlator outputs (received I/Q point) per symbol. */
  points: { i: number; q: number }[];
  /** FSK only: energy at each tone, per symbol, indexed by symbol value. */
  energies: number[][];
}

/** Coherent correlator for ASK/PSK/QAM, non-coherent energy detector for FSK. */
export function demodulate(cfg: ModConfig, alpha: SymbolDef[], rx: Float64Array, ns: number): DemodResult {
  const nSym = Math.floor(rx.length / ns);
  const symbols: number[] = [];
  const points: { i: number; q: number }[] = [];
  const energies: number[][] = [];

  const correlate = (n: number, f: number) => {
    let c = 0;
    let s = 0;
    for (let j = 0; j < ns; j++) {
      const t = n + j / ns;
      const r = rx[n * ns + j];
      c += r * Math.cos(2 * Math.PI * f * t);
      s += r * Math.sin(2 * Math.PI * f * t);
    }
    return { i: (2 * c) / ns, q: (-2 * s) / ns };
  };

  for (let n = 0; n < nSym; n++) {
    if (cfg.scheme === 'FSK') {
      const e = alpha.map((d) => {
        const p = correlate(n, d.freq);
        return p.i * p.i + p.q * p.q;
      });
      let best = 0;
      for (let v = 1; v < e.length; v++) if (e[v] > e[best]) best = v;
      symbols.push(best);
      energies.push(e);
      points.push(correlate(n, alpha[best].freq));
      continue;
    }
    const p = correlate(n, cfg.fc);
    points.push(p);
    let best = 0;
    let bestD = Infinity;
    for (const d of alpha) {
      // ASK is decided on the I axis only.
      const dist = cfg.scheme === 'ASK' ? (p.i - d.i) ** 2 : (p.i - d.i) ** 2 + (p.q - d.q) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = d.value;
      }
    }
    symbols.push(best);
  }
  return { symbols, points, energies };
}
