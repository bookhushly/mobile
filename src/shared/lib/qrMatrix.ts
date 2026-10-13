import createQr from 'qrcode-generator';

// size = module count, without the quiet zone (the renderer adds 4 modules via its viewBox).
export type QrPath = { size: number; d: string };

// Level M, Byte mode, smallest version that fits. One unit square per dark module, joined into a
// single SVG path so the QR renders as one native view.
export function qrPath(text: string): QrPath {
  const qr = createQr(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  const parts: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.isDark(r, c)) parts.push(`M${String(c)} ${String(r)}h1v1h-1z`);
    }
  }
  return { size, d: parts.join('') };
}
