import { describe, expect, it } from 'vitest';
import { bitsToText, textToBits } from '../src/dsp/bits';
import { alphabet, BITS_OPTIONS, gray, grayInverse, SCHEMES } from '../src/dsp/modulation';
import { simulate } from '../src/dsp/pipeline';

const MSG = 'Hola, señal! ¿QAM? 🚀';

describe('bits', () => {
  it('round-trips UTF-8 text', () => {
    expect(bitsToText(textToBits(MSG))).toBe(MSG);
  });
});

describe('gray', () => {
  it('inverse undoes gray', () => {
    for (let n = 0; n < 256; n++) expect(grayInverse(gray(n))).toBe(n);
  });
  it('neighbouring constellation points differ in one bit', () => {
    for (const scheme of ['ASK', 'PSK', 'FSK'] as const) {
      const a = alphabet({ scheme, k: 4, gray: true, fc: 2 }).sort((x, y) => x.pos - y.pos);
      for (let p = 1; p < a.length; p++) {
        const diff = a[p].value ^ a[p - 1].value;
        expect(diff & (diff - 1)).toBe(0);
      }
    }
  });
});

describe('noiseless channel', () => {
  for (const scheme of SCHEMES) {
    for (const k of BITS_OPTIONS[scheme]) {
      for (const g of [true, false]) {
        it(`${scheme} k=${k} gray=${g} recovers the message`, () => {
          const sim = simulate(MSG, { scheme, k, gray: g, fc: 2 }, { esn0dB: 0, noiseless: true, seed: 1 });
          expect(sim.bitErrors).toBe(0);
          expect(sim.rxText).toBe(MSG);
        });
      }
    }
  }
});

describe('noisy channel', () => {
  it('high SNR gives no errors, low SNR gives errors', () => {
    const cfg = { scheme: 'QAM' as const, k: 4, gray: true, fc: 2 };
    expect(simulate(MSG, cfg, { esn0dB: 40, noiseless: false, seed: 7 }).bitErrors).toBe(0);
    expect(simulate(MSG.repeat(5), cfg, { esn0dB: 0, noiseless: false, seed: 7 }).bitErrors).toBeGreaterThan(0);
  });
  it('QPSK BER is near theory at Eb/N0 = 4 dB', () => {
    const cfg = { scheme: 'PSK' as const, k: 2, gray: true, fc: 2 };
    const text = 'x'.repeat(2000);
    const sim = simulate(text, cfg, { esn0dB: 4 + 10 * Math.log10(2), noiseless: false, seed: 3 });
    const ber = sim.bitErrors / sim.bits.length;
    // Theory: Q(sqrt(2·Eb/N0)) ≈ 0.0125
    expect(ber).toBeGreaterThan(0.007);
    expect(ber).toBeLessThan(0.02);
  });
});
