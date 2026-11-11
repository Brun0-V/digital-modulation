import { useMemo, useState } from 'react';
import { Constellation } from './components/Constellation';
import { FskEnergy } from './components/FskEnergy';
import { BitStreamPanel, DemodPanel, formatRate, SymbolTablePanel } from './components/Panels';
import { SignalPlot } from './components/SignalPlot';
import { COLORS } from './components/useCanvas';
import { BITS_OPTIONS, DEFAULT_BITS, SCHEMES, schemeName, type Scheme } from './dsp/modulation';
import { simulate } from './dsp/pipeline';

const WINDOWS = [4, 8, 16, 32];
const MAX_CHARS = 120;

const DESCRIPTIONS: Record<Scheme, string> = {
  ASK: 'Cada símbolo es un nivel de amplitud de la portadora.',
  FSK: 'Cada símbolo es una frecuencia distinta (separación 1/Ts, ortogonales).',
  PSK: 'Cada símbolo es una fase de la portadora con amplitud constante.',
  QAM: 'Cada símbolo combina amplitud y fase: un punto de una grilla I/Q.',
};

export function App() {
  const [text, setText] = useState('Hola mundo');
  const [scheme, setScheme] = useState<Scheme>('QAM');
  const [kBy, setKBy] = useState<Record<Scheme, number>>(DEFAULT_BITS);
  const [gray, setGray] = useState(true);
  const [fc, setFc] = useState(2);
  const [esn0, setEsn0] = useState(18);
  const [noiseless, setNoiseless] = useState(false);
  const [seed, setSeed] = useState(1);
  const [hover, setHover] = useState<number | null>(null);
  const [count, setCount] = useState(8);
  const [start, setStart] = useState(0);
  const [showLabels, setShowLabels] = useState(true);

  const k = kBy[scheme];
  const sim = useMemo(
    () => simulate(text, { scheme, k, gray, fc }, { esn0dB: esn0, noiseless, seed }),
    [text, scheme, k, gray, fc, esn0, noiseless, seed],
  );

  const nSym = sim.symbols.length;
  const maxStart = Math.max(0, nSym - count);
  const from = Math.min(start, maxStart);
  const pick = (n: number) => setStart(Math.max(0, Math.min(maxStart, n - Math.floor(count / 2))));

  const labels = useMemo(() => sim.symbols.map((v) => sim.alpha[v].bits), [sim]);
  const rxLabels = useMemo(() => sim.demod.symbols.map((v) => sim.alpha[v].bits), [sim]);
  const errors = useMemo(() => sim.symbols.map((v, n) => v !== sim.demod.symbols[n]), [sim]);

  const peak = useMemo(() => {
    let m = 0;
    for (const v of sim.tx) m = Math.max(m, Math.abs(v));
    return Math.max(m, 0.1);
  }, [sim.tx]);
  const txY = peak * 1.15;
  const rxY = useMemo(() => {
    if (noiseless) return txY;
    let m = 0;
    const end = Math.min(sim.rx.length, (from + count) * sim.ns);
    for (let i = from * sim.ns; i < end; i++) m = Math.max(m, Math.abs(sim.rx[i]));
    return Math.max(txY, Math.min(m * 1.05, peak * 3));
  }, [sim, noiseless, txY, peak, from, count]);

  const ebn0 = esn0 - 10 * Math.log10(k);
  const ber = sim.bits.length ? sim.bitErrors / sim.bits.length : 0;
  const showConstellation = scheme !== 'FSK';
  const fskSymbol = hover ?? from;

  return (
    <>
      <header className="toolbar">
        <div className="brand">
          Modulación digital <span>ASK · FSK · PSK · QAM</span>
        </div>
        <div className="btn-group seg">
          {SCHEMES.map((s) => (
            <button key={s} className={`btn${s === scheme ? ' active' : ''}`} onClick={() => setScheme(s)}>
              {s}
            </button>
          ))}
        </div>
        <label className="field">
          Orden
          <select value={k} onChange={(e) => setKBy({ ...kBy, [scheme]: Number(e.target.value) })}>
            {BITS_OPTIONS[scheme].map((b) => (
              <option key={b} value={b}>
                {schemeName(scheme, b)} · {b} bit{b > 1 ? 's' : ''}/símbolo
              </option>
            ))}
          </select>
        </label>
        <label className="field check">
          <input type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
          Código Gray
        </label>
        <label className="field">
          {scheme === 'FSK' ? 'f₀' : 'Portadora'}
          <select value={fc} onChange={(e) => setFc(Number(e.target.value))} title="Ciclos de portadora por símbolo">
            {[1, 2, 3, 4, 6, 8].map((f) => (
              <option key={f} value={f}>
                {f} ciclo{f > 1 ? 's' : ''}/símbolo
              </option>
            ))}
          </select>
        </label>
        <div className="sep" />
        <label className={`field snr${noiseless ? ' disabled' : ''}`}>
          Es/N₀
          <input
            type="range"
            min={-5}
            max={35}
            step={0.5}
            value={esn0}
            disabled={noiseless}
            onChange={(e) => setEsn0(Number(e.target.value))}
          />
          <span className="mono val">{esn0.toFixed(1)} dB</span>
        </label>
        <label className="field check">
          <input type="checkbox" checked={noiseless} onChange={(e) => setNoiseless(e.target.checked)} />
          Sin ruido
        </label>
        <button className="btn small" disabled={noiseless} onClick={() => setSeed((s) => s + 1)} title="Generar otra realización de ruido">
          Nuevo ruido
        </button>
        <div className="status">
          <span className={`pill ${sim.bitErrors ? 'err' : 'ok'}`}>
            BER <span className="mono">{formatRate(ber)}</span>
          </span>
        </div>
      </header>

      <main className="layout">
        <div className="col area-left">
          <section className="panel">
            <div className="panel-head">
              <h2>Mensaje</h2>
              <span className="hint small">
                {[...text].length}/{MAX_CHARS}
              </span>
            </div>
            <textarea
              className="message"
              value={text}
              rows={3}
              spellCheck={false}
              placeholder="Escribí un mensaje…"
              onChange={(e) => setText([...e.target.value].slice(0, MAX_CHARS).join(''))}
            />
          </section>
          <BitStreamPanel sim={sim} hover={hover} onHover={setHover} onPick={pick} />
          <SymbolTablePanel sim={sim} hover={hover} />
        </div>

        <div className="col area-mid">
          <section className="panel">
            <div className="panel-head">
              <h2>Señales</h2>
              <span className="muted small">
                {schemeName(scheme, k)} · M = {1 << k}
              </span>
              <div className="window-ctl">
                <button className="btn small ghost" disabled={from === 0} onClick={() => setStart(Math.max(0, from - count))}>
                  ◀
                </button>
                <input
                  type="range"
                  min={0}
                  max={maxStart}
                  value={from}
                  disabled={maxStart === 0}
                  onChange={(e) => setStart(Number(e.target.value))}
                  title="Desplazar la ventana"
                />
                <button className="btn small ghost" disabled={from >= maxStart} onClick={() => setStart(Math.min(maxStart, from + count))}>
                  ▶
                </button>
                <select value={count} onChange={(e) => setCount(Number(e.target.value))} title="Símbolos visibles">
                  {WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {w} símbolos
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="desc small muted">{DESCRIPTIONS[scheme]}</p>

            <div className="plot-title">
              <span>Transmitida</span> <span className="mono muted">s(t)</span>
              <span className="hint small mono">
                símbolos {nSym ? from : 0}–{Math.max(0, Math.min(nSym, from + count) - 1)} de {nSym}
              </span>
            </div>
            <div className="plot-wrap">
              <SignalPlot
                signal={sim.tx}
                ns={sim.ns}
                start={from}
                count={count}
                labels={labels}
                yMax={txY}
                color={COLORS.accent}
                hover={hover}
                onHover={setHover}
              />
            </div>

            <div className="plot-title">
              <span>Recibida</span> <span className="mono muted">r(t) = s(t) + n(t)</span>
              <span className="hint small">{noiseless ? 'canal ideal' : 'en ámbar: s(t) de referencia'}</span>
            </div>
            <div className="plot-wrap">
              <SignalPlot
                signal={sim.rx}
                ghost={noiseless ? undefined : sim.tx}
                ns={sim.ns}
                start={from}
                count={count}
                labels={rxLabels}
                errors={errors}
                yMax={rxY}
                color={COLORS.text}
                hover={hover}
                onHover={setHover}
              />
            </div>
            <div className="small muted note">
              Arriba de cada símbolo: bits enviados (Tx) y bits detectados (Rx). Los símbolos con error se marcan en rojo. Pasá el
              mouse por una señal, un bit o un punto de la constelación para relacionarlos.
            </div>
          </section>
        </div>

        <div className="col area-right">
          <section className="panel">
            <div className="panel-head">
              <h2>{showConstellation ? 'Constelación I/Q' : 'Detector FSK'}</h2>
              {showConstellation && (
                <label className="field check small hint">
                  <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                  Etiquetas
                </label>
              )}
            </div>
            {showConstellation ? (
              <>
                <div className="plot-wrap">
                  <Constellation sim={sim} showLabels={showLabels} hover={hover} onHover={setHover} />
                </div>
                <div className="legend">
                  <span><i className="dot ideal" /> ideal</span>
                  <span><i className="dot rx" /> recibido</span>
                  <span><i className="dot bad" /> error</span>
                  <span><i className="dash" /> fronteras de decisión</span>
                </div>
              </>
            ) : (
              <>
                <p className="desc small muted">
                  Energía medida en cada frecuencia para el símbolo <span className="mono">{fskSymbol}</span>
                  {hover === null && ' (pasá el mouse por la señal para elegir otro)'}. Gana la frecuencia con más energía.
                </p>
                <div className="plot-wrap">
                  <FskEnergy sim={sim} n={fskSymbol} />
                </div>
                <div className="legend">
                  <span><i className="sq got" /> detectado</span>
                  <span><i className="sq sent" /> enviado</span>
                  <span><i className="sq bad" /> detectado con error</span>
                </div>
              </>
            )}
            <div className="kv-grid small channel-info">
              <label>Es/N₀</label>
              <span className="mono">{noiseless ? '∞' : `${esn0.toFixed(1)} dB`}</span>
              <label>Eb/N₀</label>
              <span className="mono">{noiseless ? '∞' : `${ebn0.toFixed(1)} dB`}</span>
              <label>Muestras/símbolo</label>
              <span className="mono">{sim.ns}</span>
            </div>
          </section>
          <DemodPanel sim={sim} hover={hover} onHover={setHover} onPick={pick} />
        </div>
      </main>
    </>
  );
}
