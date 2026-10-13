import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { qrPath } from '@/shared/lib/qrMatrix';
import { color } from '@/shared/theme';
import { QrCode } from '@/shared/ui';

it('draws the code as one ink path with a 4-module quiet zone', async () => {
  await render(<QrCode value="AB12CD34" size={240} testID="qr" />);
  const { size, d } = qrPath('AB12CD34');
  const svg = screen.getByTestId('qr-svg').props;
  expect([svg.minX, svg.minY, svg.vbWidth, svg.vbHeight]).toEqual([-4, -4, size + 8, size + 8]);
  expect(screen.getAllByTestId('qr-path')).toHaveLength(1);
  const path = screen.getByTestId('qr-path').props;
  expect(path.d).toBe(d);
  // react-native-svg hands colours to native as processed ARGB ints.
  expect(path.fill).toEqual({ type: 0, payload: processColor(color.textPrimary) });
});

it('is a white square image with a default label', async () => {
  await render(<QrCode value="AB12CD34" size={240} testID="qr" />);
  const box = screen.getByTestId('qr');
  expect(box.props.accessibilityLabel).toBe('QR code');
  expect(box.props.accessibilityRole).toBe('image');
  expect(box.props.style).toEqual(
    expect.objectContaining({ width: 240, height: 240, backgroundColor: color.surface }),
  );
});

it('applies a custom accessibility label', async () => {
  await render(<QrCode value="x" size={200} accessibilityLabel="Ticket QR code" testID="qr" />);
  expect(screen.getByLabelText('Ticket QR code')).toBeTruthy();
});
