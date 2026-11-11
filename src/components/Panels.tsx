import { bitsToText } from '../dsp/bits';
import type { Simulation } from '../dsp/pipeline';

interface HoverProps {
  sim: Simulation;
  hover: number | null;
  onHover: (n: number | null) => void;
  onPick?: (n: number) => void;
}

const visible = (c: string) => (c === ' ' ? '␣' : c === '\n' ? '↵' : c);

/** Message characters with their UTF-8 bits, then the same bits grouped into k-bit words. */
export function BitStreamPanel({ sim, hover, onHover, onPick }: HoverProps) {
  const { chars, padded, bits, cfg, symbols } = sim;
  const k = cfg.k;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Flujo de bits</h2>
        <span className="hint small">{bits.length} bits · UTF-8</span>
      </div>
      <div className="sub">Caracteres → bits</div>
      <div className="chars">
        {chars.map((c, ci) => (
          <div className="char" key={ci} title={`U+${c.char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`}>
            <span className="char-glyph">{visible(c.char)}</span>
            <span className="mono char-bits">
              {c.bits.map((b, j) => {
                const n = Math.floor((c.start + j) / k);
                return (
                  <span
                    key={j}
                    className={`bit${n === hover ? ' hl' : ''}${(c.start + j) % 8 === 0 && j ? ' byte-gap' : ''}`}
                    onMouseEnter={() => onHover(n)}
                    onMouseLeave={() => onHover(null)}
                    onClick={() => onPick?.(n)}
                  >
                    {b}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
        {!chars.length && <span className="muted small">Escribí un mensaje para ver sus bits.</span>}
      </div>
      <div className="sub">
        Bits → símbolos <span className="muted">({k} bit{k > 1 ? 's' : ''} por símbolo · {symbols.length} símbolos)</span>
      </div>
      <div className="words mono">
        {symbols.map((_, n) => {
          const word = padded.slice(n * k, n * k + k);
          return (
            <span
              key={n}
              className={`word${n === hover ? ' hl' : ''}${n % 2 ? ' odd' : ''}`}
              onMouseEnter={() => onHover(n)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onPick?.(n)}
              title={`Símbolo ${n}`}
            >
              {word.map((b, j) => (
                <span key={j} className={n * k + j >= bits.length ? 'pad' : undefined}>
                  {b}
                </span>
              ))}
            </span>
          );
        })}
      </div>
      {padded.length > bits.length && (
        <div className="small muted note">
          Se agregaron {padded.length - bits.length} bits de relleno (en gris) para completar el último símbolo.
        </div>
      )}
    </section>
  );
}

/** Bits → waveform parameter for every symbol of the alphabet. */
export function SymbolTablePanel({ sim, hover }: { sim: Simulation; hover: number | null }) {
  const { alpha, cfg, symbols } = sim;
  const uses = new Array(alpha.length).fill(0);
  for (const s of symbols) uses[s]++;
  const rows = cfg.scheme === 'QAM' ? alpha : [...alpha].sort((a, b) => a.pos - b.pos);
  const current = hover !== null ? symbols[hover] : null;
  const fmt = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(3));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Tabla de símbolos</h2>
        <span className="hint small">{cfg.gray ? 'Código Gray' : 'Binario natural'}</span>
      </div>
      <div className="scroll-y">
        <table className="tbl mono">
          <thead>
            <tr>
              <th>Bits</th>
              {cfg.scheme === 'ASK' && <th className="r">Amplitud</th>}
              {cfg.scheme === 'FSK' && <th className="r">Frecuencia</th>}
              {(cfg.scheme === 'PSK' || cfg.scheme === 'QAM') && (
                <>
                  <th className="r">I</th>
                  <th className="r">Q</th>
                  <th className="r">|A|</th>
                  <th className="r">Fase</th>
                </>
              )}
              <th className="r">Usos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.value} className={d.value === current ? 'active' : uses[d.value] ? '' : 'unused'}>
                <td>{d.bits}</td>
                {cfg.scheme === 'ASK' && <td className="r">{fmt(d.amp)}</td>}
                {cfg.scheme === 'FSK' && <td className="r">{d.freq}/Ts</td>}
                {(cfg.scheme === 'PSK' || cfg.scheme === 'QAM') && (
                  <>
                    <td className="r">{fmt(d.i)}</td>
                    <td className="r">{fmt(d.q)}</td>
                    <td className="r">{fmt(d.amp)}</td>
                    <td className="r">{(((d.phase * 180) / Math.PI + 360) % 360).toFixed(1)}°</td>
                  </>
                )}
                <td className="r">{uses[d.value] || '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Received bits, decoded text and error counts. */
export function DemodPanel({ sim, hover, onHover, onPick }: HoverProps) {
  const { bits, rxBits, chars, cfg, symbols, demod, bitErrors, symbolErrors } = sim;
  const k = cfg.k;
  const ber = bits.length ? bitErrors / bits.length : 0;
  const ser = symbols.length ? symbolErrors / symbols.length : 0;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Demodulación</h2>
        <span className="hint small">
          {cfg.scheme === 'FSK' ? 'Detector de energía (no coherente)' : cfg.scheme === 'ASK' ? 'Correlador coherente, decisión sobre I' : 'Correlador coherente I/Q, punto más cercano'}
        </span>
      </div>
      <div className="stats">
        <div>
          <label>Errores de bit</label>
          <span className={`mono big ${bitErrors ? 'err' : 'ok'}`}>{bitErrors}</span>
          <span className="mono muted small"> / {bits.length}</span>
        </div>
        <div>
          <label>BER</label>
          <span className={`mono big ${bitErrors ? 'err' : 'ok'}`}>{formatRate(ber)}</span>
        </div>
        <div>
          <label>Errores de símbolo</label>
          <span className={`mono big ${symbolErrors ? 'err' : 'ok'}`}>{symbolErrors}</span>
          <span className="mono muted small"> / {symbols.length}</span>
        </div>
        <div>
          <label>SER</label>
          <span className={`mono big ${symbolErrors ? 'err' : 'ok'}`}>{formatRate(ser)}</span>
        </div>
      </div>

      <div className="sub">Símbolos detectados → bits</div>
      <div className="words mono">
        {demod.symbols.map((_, n) => (
          <span
            key={n}
            className={`word${n === hover ? ' hl' : ''}${n % 2 ? ' odd' : ''}${demod.symbols[n] !== symbols[n] ? ' bad' : ''}`}
            onMouseEnter={() => onHover(n)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onPick?.(n)}
          >
            {Array.from({ length: k }, (_, j) => {
              const idx = n * k + j;
              if (idx >= bits.length) return null;
              return (
                <span key={j} className={rxBits[idx] !== bits[idx] ? 'flip' : undefined}>
                  {rxBits[idx]}
                </span>
              );
            })}
          </span>
        ))}
      </div>

      <div className="sub">Mensaje recibido</div>
      <div className="rx-text">
        {chars.map((c, ci) => {
          const got = bitsToText(rxBits.slice(c.start, c.start + c.bits.length));
          const ok = got === c.char;
          return (
            <span key={ci} className={ok ? undefined : 'bad'} title={ok ? undefined : `Enviado: “${c.char}”`}>
              {got}
            </span>
          );
        })}
        {!chars.length && <span className="muted small">—</span>}
      </div>
    </section>
  );
}

export function formatRate(r: number): string {
  if (r === 0) return '0';
  if (r >= 0.01) return r.toFixed(3);
  return r.toExponential(1);
}
