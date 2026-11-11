export type Bit = 0 | 1;

/** One character of the message with the UTF-8 bits that encode it. */
export interface CharBits {
  char: string;
  /** Index of the first bit of this character in the full bit stream. */
  start: number;
  bits: Bit[];
}

const encoder = new TextEncoder();

function byteToBits(byte: number): Bit[] {
  const out: Bit[] = [];
  for (let i = 7; i >= 0; i--) out.push(((byte >> i) & 1) as Bit);
  return out;
}

/** Splits text into characters, each with its UTF-8 bits (MSB first). */
export function textToCharBits(text: string): CharBits[] {
  const out: CharBits[] = [];
  let start = 0;
  for (const char of text) {
    const bits = [...encoder.encode(char)].flatMap(byteToBits);
    out.push({ char, start, bits });
    start += bits.length;
  }
  return out;
}

export function textToBits(text: string): Bit[] {
  return [...encoder.encode(text)].flatMap(byteToBits);
}

export function bitsToBytes(bits: ArrayLike<number>): Uint8Array {
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] & 1);
    bytes[i] = b;
  }
  return bytes;
}

/** Decodes bits as UTF-8. Invalid sequences become the replacement character. */
export function bitsToText(bits: ArrayLike<number>): string {
  return new TextDecoder('utf-8').decode(bitsToBytes(bits));
}

/** Integer value of `k` bits starting at `offset` (MSB first). */
export function bitsToInt(bits: ArrayLike<number>, offset: number, k: number): number {
  let v = 0;
  for (let i = 0; i < k; i++) v = (v << 1) | (bits[offset + i] & 1);
  return v;
}

export function intToBits(v: number, k: number): Bit[] {
  const out: Bit[] = [];
  for (let i = k - 1; i >= 0; i--) out.push(((v >> i) & 1) as Bit);
  return out;
}

export const bitString = (v: number, k: number) => v.toString(2).padStart(k, '0');
