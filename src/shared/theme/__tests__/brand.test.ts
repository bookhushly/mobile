import { color } from '@/shared/theme/theme';

// Must equal the web (../web/tailwind.config.js brand-*, app/globals.css --primary/--foreground).
describe('brand parity with the web', () => {
  it('violet, pressed violet and the selected wash match the web values', () => {
    expect(color.actionFill).toBe('#7C3AED');
    expect(color.actionPressed).toBe('#6D28D9');
    expect(color.selectedWash).toBe('#EBE5FF');
  });
});

// Owner decision 2026-11-13: neutral text and links; violet only where it means "act" or "chosen".
describe('neutral foundation', () => {
  it('text and links are neutral, not brand-tinted', () => {
    expect(color.textPrimary).toBe('#141414');
    expect(color.linkText).toBe(color.textPrimary);
  });
});
