// Generates the four gate cue sounds as 16-bit mono PCM WAV. Deterministic; no third-party audio.
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 22050;

function tone(segments) {
  const samples = [];
  for (const { hz, ms, gain = 0.6 } of segments) {
    const n = Math.round((RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (RATE * 0.005), (n - i) / (RATE * 0.02)); // 5 ms in, 20 ms out
      samples.push(hz === 0 ? 0 : Math.sin((2 * Math.PI * hz * i) / RATE) * gain * env);
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

mkdirSync('assets/sounds', { recursive: true });
const out = {
  'gate-success': [
    { hz: 880, ms: 90 },
    { hz: 1320, ms: 140 },
  ],
  'gate-warning': [
    { hz: 660, ms: 120 },
    { hz: 0, ms: 60 },
    { hz: 660, ms: 120 },
  ],
  'gate-error': [{ hz: 220, ms: 420, gain: 0.7 }],
  'gate-retry': [{ hz: 520, ms: 110, gain: 0.45 }],
};
for (const [name, segs] of Object.entries(out)) {
  writeFileSync(`assets/sounds/${name}.wav`, tone(segs));
}
