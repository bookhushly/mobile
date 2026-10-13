import createQr from 'qrcode-generator';

// size = module count, without the quiet zone (the renderer adds 4 modules via its viewBox).
export type QrPath = { size: number; d: string };

// Level M, Byte mode, smallest version that fits. Each horizontal run of dark modules is one
// rectangle ("M c r h n v1 h-n z"), all joined into a single SVG path so the QR renders as one
// native view. Same pixels as one square per module, with far fewer commands to parse and fill.
export function qrPath(text: string): QrPath {
  const qr = createQr(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  const parts: string[] = [];
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!qr.isDark(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < size && qr.isDark(r, c)) c++;
      const n = String(c - start);
      parts.push(`M${String(start)} ${String(r)}h${n}v1h-${n}z`);
    }
  }
  return { size, d: parts.join('') };
}
