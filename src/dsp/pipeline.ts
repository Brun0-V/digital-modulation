import { bitsToText, textToBits, textToCharBits, type Bit, type CharBits } from './bits';
import {
  alphabet,
  averageEnergy,
  awgn,
  bitsToSymbols,
  demodulate,
  modulate,
  samplesPerSymbol,
  symbolsToBits,
  type DemodResult,
  type ModConfig,
  type SymbolDef,
} from './modulation';

export interface ChannelConfig {
  /** Es/N0 in dB. */
  esn0dB: number;
  noiseless: boolean;
  seed: number;
}

export interface Simulation {
  cfg: ModConfig;
  chars: CharBits[];
  /** Message bits (without padding). */
  bits: Bit[];
  /** Bits padded with zeros to a whole number of symbols. */
  padded: Bit[];
  alpha: SymbolDef[];
  symbols: number[];
  ns: number;
  es: number;
  tx: Float64Array;
  rx: Float64Array;
  demod: DemodResult;
  rxBits: Bit[];
  rxText: string;
  bitErrors: number;
  symbolErrors: number;
}

/** Runs the whole chain: text → bits → symbols → signal → channel → demodulator → text. */
export function simulate(text: string, cfg: ModConfig, ch: ChannelConfig): Simulation {
  const chars = textToCharBits(text);
  const bits = textToBits(text);
  const { symbols, padded } = bitsToSymbols(bits, cfg.k);
  const alpha = alphabet(cfg);
  const ns = samplesPerSymbol(cfg);
  const es = averageEnergy(alpha, cfg.scheme);
  const tx = modulate(cfg, alpha, symbols, ns);
  const rx = ch.noiseless ? tx : awgn(tx, es, ch.esn0dB, ns, ch.seed);
  const demod = demodulate(cfg, alpha, rx, ns);
  const rxPadded = symbolsToBits(demod.symbols, cfg.k);
  const rxBits = rxPadded.slice(0, bits.length);
  let bitErrors = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i] !== rxBits[i]) bitErrors++;
  let symbolErrors = 0;
  for (let i = 0; i < symbols.length; i++) if (symbols[i] !== demod.symbols[i]) symbolErrors++;
  return {
    cfg, chars, bits, padded, alpha, symbols, ns, es, tx, rx, demod, rxBits,
    rxText: bitsToText(rxBits), bitErrors, symbolErrors,
  };
}
