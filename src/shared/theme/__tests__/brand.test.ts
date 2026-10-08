import { color } from '@/shared/theme/theme';

// Must equal the web (../web/tailwind.config.js brand-*, app/globals.css --primary/--foreground).
describe('brand parity with the web', () => {
  it('violet, pressed violet, washes and ink match the web values', () => {
    expect(color.actionFill).toBe('#7C3AED');
    expect(color.actionPressed).toBe('#6D28D9');
    expect(color.linkText).toBe('#6D28D9');
    expect(color.selectedWash).toBe('#EBE5FF');
    expect(color.textPrimary).toBe('#1A0D4D');
  });
});
