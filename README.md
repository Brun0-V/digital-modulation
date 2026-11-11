<img src="assets/icon.svg" width="64" height="64" alt="">

# Digital modulation

Visualizador educativo de modulación digital: **ASK, FSK, PSK y QAM**.

Escribís un mensaje y la app muestra toda la cadena:

1. **Mensaje → bits** (UTF-8, por carácter).
2. **Bits → símbolos** de *k* bits (M = 2^k), con código Gray o binario natural.
3. **Señal transmitida** s(t) en una ventana desplazable de símbolos.
4. **Canal AWGN** con Es/N₀ ajustable (o canal ideal) y semilla de ruido regenerable.
5. **Señal recibida** r(t) con los símbolos erróneos marcados.
6. **Constelación I/Q** (ASK, PSK, QAM) con fronteras de decisión, o **detector de energía** para FSK.
7. **Demodulación**: bits detectados, mensaje recibido, BER y SER.

Órdenes disponibles: ASK, FSK y PSK de 2 a 16 símbolos; QAM 4, 16, 64 y 256.

Pasá el mouse por un bit, un tramo de la señal o un punto de la constelación para ver el mismo símbolo resaltado en todos los paneles. Hacé clic en un símbolo del flujo de bits para centrar la ventana de señales en él.

## Uso

```sh
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas
npm run build    # build estático en dist/
```

## Modelo

- Tiempo de símbolo Ts = 1; la portadora tiene un número entero de ciclos por símbolo.
- ASK unipolar (niveles 0…1), PSK de amplitud 1 (QPSK con desfase de 45°), QAM cuadrada normalizada a ±1.
- FSK con tonos f₀ + p/Ts (ortogonales), detección no coherente por energía.
- ASK/PSK/QAM se demodulan con un correlador coherente I/Q y decisión por mínima distancia.
- El ruido se define por Es/N₀; Eb/N₀ = Es/N₀ − 10·log₁₀(k).

Created in [T3 Code](https://t3.codes).
